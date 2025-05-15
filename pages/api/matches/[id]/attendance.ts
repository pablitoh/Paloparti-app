import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';
import { PLAYER_ROLES } from '../../../../components/group/AttendanceConfirmation';

// Definir tipos para claridad
interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get match ID from URL
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    // Get status and playerRoles from request body
    const { status, playerRoles } = req.body;

    // Logging exhaustivo para debugging
    console.log('======= BACKEND API ATTENDANCE =======');
    console.log('USER ID:', user.id);
    console.log('MATCH ID:', id);
    console.log('BODY COMPLETO:', req.body);
    console.log('STATUS:', status);
    console.log('PLAYER ROLES:', playerRoles);
    console.log('PLAYER ROLES TYPE:', typeof playerRoles);
    console.log('PLAYER ROLES IS ARRAY:', Array.isArray(playerRoles));
    if (Array.isArray(playerRoles)) {
      console.log('PLAYER ROLES LENGTH:', playerRoles.length);
      console.log('PLAYER ROLES CONTENT:', JSON.stringify(playerRoles));
    }

    if (!status || !['CONFIRMED', 'PENDING', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Validar y procesar playerRoles
    let validatedRoles: string[] = [];
    if (status === 'CONFIRMED') {
      // Usar exactamente los roles que llegaron, si es un array
      if (Array.isArray(playerRoles) && playerRoles.length > 0) {
        // Hacer una copia para evitar mutaciones
        validatedRoles = [...playerRoles];

        console.log('USANDO ROLES DEL CLIENTE:', validatedRoles);
      } else {
        // Si no es un array o está vacío, usar el valor por defecto
        validatedRoles = [PLAYER_ROLES.WILDCARD];
        console.log(
          'NO ES ARRAY O ESTÁ VACÍO - USANDO VALOR DEFAULT:',
          validatedRoles
        );
      }
    }

    console.log('ROLES VALIDADOS FINAL:', validatedRoles);

    // Obtener el partido con sus datos actuales
    const match = await prisma.match.findUnique({
      where: { id },
      select: {
        groupId: true,
        date: true,
        tbdPlayers: true,
        matchPlayers: {
          select: {
            userId: true,
            isTeamA: true,
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    console.log('Datos actuales del partido:', {
      matchId: id,
      tbdPlayersFormat: typeof match.tbdPlayers,
      matchPlayersCount: match.matchPlayers.length,
    });

    // Check if the user is a member of the group associated with the match
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: user.id,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: 'User is not a member of this group' });
    }

    // Check if there's already an attendance record for this user and match
    const existingAttendance = await prisma.matchAttendance.findFirst({
      where: {
        userId: user.id,
        matchId: id,
      },
    });

    let attendanceResult;

    // Actualizar TBD players para almacenar los roles (ya que no tenemos campo metadata)
    if (status === 'CONFIRMED' && validatedRoles.length > 0) {
      try {
        // Obtener TBD players actuales o inicializar objeto vacío
        let tbdPlayers = match.tbdPlayers
          ? typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers as string)
            : match.tbdPlayers
          : {};

        // Asegurarnos de que tbdPlayers tenga la estructura correcta
        if (!tbdPlayers.playerRoles) {
          tbdPlayers.playerRoles = {};
        }

        // Guardar los roles del jugador usando su ID como clave
        tbdPlayers.playerRoles[user.id] = validatedRoles;
        console.log('Guardando roles en tbdPlayers:', tbdPlayers);

        // Actualizar el campo tbdPlayers en la tabla Match
        await prisma.match.update({
          where: { id },
          data: {
            tbdPlayers: tbdPlayers,
          },
        });

        console.log('tbdPlayers actualizado correctamente');
      } catch (error) {
        console.error('Error al actualizar tbdPlayers:', error);
      }
    }

    if (existingAttendance) {
      // Update existing attendance record
      attendanceResult = await prisma.matchAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });
      console.log('Registro de asistencia ACTUALIZADO:', attendanceResult);
    } else {
      // Create new attendance record
      attendanceResult = await prisma.matchAttendance.create({
        data: {
          userId: user.id,
          matchId: id,
          groupId: match.groupId,
          matchDate: match.date,
          status,
        },
      });
      console.log('Registro de asistencia CREADO:', attendanceResult);
    }

    // Si el estado es DECLINED, manejar la remoción del usuario de los equipos
    let updatedMatchData = null;
    let mappedPlayersA = [];
    let mappedPlayersB = [];

    if (status === 'DECLINED') {
      try {
        console.log(
          `User ${user.id} is declining attendance, checking if they're in a team...`
        );

        // Verificar si el jugador está en algún equipo
        const playerTeam = await prisma.matchPlayer.findFirst({
          where: {
            matchId: id,
            userId: user.id,
          },
        });

        if (playerTeam) {
          console.log(
            `Player was in team ${
              playerTeam.isTeamA ? 'A' : 'B'
            }, removing and replacing with TBD player`
          );

          // Eliminar el jugador de los equipos del partido
          const deleteResult = await prisma.matchPlayer.deleteMany({
            where: {
              matchId: id,
              userId: user.id,
            },
          });

          console.log(
            `Deleted ${deleteResult.count} player entries from teams`
          );

          // Generar un ID único para el jugador TBD
          const tbdId = `tbd-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;

          // Crear el nuevo jugador TBD
          const newTbdPlayer: TbdPlayer = {
            id: tbdId,
            name: `TBD ${Math.floor(Math.random() * 100)}`, // Número aleatorio para identificarlo
            avatar: null,
            playerType: 'TBD',
            isTeamA: playerTeam.isTeamA,
          };

          // Procesamos el campo tbdPlayers para poder trabajar con él
          let currentTbdPlayers: TbdPlayer[] = [];

          if (match.tbdPlayers) {
            try {
              if (typeof match.tbdPlayers === 'string') {
                const parsed = JSON.parse(match.tbdPlayers);
                if (Array.isArray(parsed)) {
                  currentTbdPlayers = parsed;
                } else if (parsed.players && Array.isArray(parsed.players)) {
                  currentTbdPlayers = parsed.players;
                } else if (parsed.teamA || parsed.teamB) {
                  const teamA = Array.isArray(parsed.teamA) ? parsed.teamA : [];
                  const teamB = Array.isArray(parsed.teamB) ? parsed.teamB : [];
                  currentTbdPlayers = [
                    ...teamA.map((p: any) => ({
                      ...p,
                      isTeamA: true,
                      playerType: 'TBD',
                    })),
                    ...teamB.map((p: any) => ({
                      ...p,
                      isTeamA: false,
                      playerType: 'TBD',
                    })),
                  ];
                }
              } else if (Array.isArray(match.tbdPlayers)) {
                currentTbdPlayers = match.tbdPlayers;
              } else if (
                match.tbdPlayers.players &&
                Array.isArray(match.tbdPlayers.players)
              ) {
                currentTbdPlayers = match.tbdPlayers.players;
              }
            } catch (error) {
              console.error('Error al procesar tbdPlayers actuales:', error);
              currentTbdPlayers = [];
            }
          }

          console.log('TBD Players actuales:', {
            count: currentTbdPlayers.length,
            players: currentTbdPlayers.map((p: any) => ({
              id: p.id,
              isTeamA: p.isTeamA,
            })),
          });

          // Añadir el nuevo TBD a la lista
          currentTbdPlayers.push(newTbdPlayer);

          // Crear el jugador TBD en la tabla MatchPlayer
          await prisma.matchPlayer.create({
            data: {
              matchId: id,
              userId: tbdId,
              isTeamA: playerTeam.isTeamA,
            },
          });
          console.log(
            `Created TBD player ${tbdId} in MatchPlayer table, team ${
              playerTeam.isTeamA ? 'A' : 'B'
            }`
          );

          // Actualizar la tabla Match con el nuevo array de tbdPlayers
          await prisma.match.update({
            where: { id },
            data: {
              tbdPlayers: JSON.stringify(currentTbdPlayers),
            },
          });

          console.log(
            `Updated match.tbdPlayers with new TBD player ${tbdId}. Total TBD players: ${currentTbdPlayers.length}`
          );

          // Verificación adicional: confirmar que el jugador TBD se añadió a la base de datos
          const updatedMatch = await prisma.match.findUnique({
            where: { id },
            select: { tbdPlayers: true },
          });

          if (updatedMatch && updatedMatch.tbdPlayers) {
            let verificationTbdPlayers: any[] = [];
            try {
              if (typeof updatedMatch.tbdPlayers === 'string') {
                verificationTbdPlayers = JSON.parse(updatedMatch.tbdPlayers);
              } else if (Array.isArray(updatedMatch.tbdPlayers)) {
                verificationTbdPlayers = updatedMatch.tbdPlayers;
              }
            } catch (e) {
              console.error('Error al verificar tbdPlayers actualizados:', e);
            }

            console.log(
              `Verificación: La base de datos ahora tiene ${verificationTbdPlayers.length} TBD players`
            );
            console.log(
              'IDs de los TBD players en la DB:',
              verificationTbdPlayers.map((p) => p.id)
            );
          }

          // Verificar que el jugador TBD se añadió correctamente a MatchPlayer
          const checkTbdPlayer = await prisma.matchPlayer.findFirst({
            where: {
              matchId: id,
              userId: tbdId,
            },
          });

          if (checkTbdPlayer) {
            console.log(
              `Verification: TBD player ${tbdId} is in MatchPlayer table, team ${
                checkTbdPlayer.isTeamA ? 'A' : 'B'
              }`
            );
          } else {
            console.error(
              `Verification FAILED: TBD player ${tbdId} was not found in MatchPlayer table`
            );
          }

          // Forzar actualización de los datos de la partida
          await prisma.$executeRawUnsafe(
            `
            UPDATE "Match" 
            SET "updatedAt" = NOW() 
            WHERE id = $1
          `,
            id
          );

          // Obtener las listas actualizadas de jugadores para la respuesta
          const teamAPlayers = await prisma.matchPlayer.findMany({
            where: {
              matchId: id,
              isTeamA: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          });

          const teamBPlayers = await prisma.matchPlayer.findMany({
            where: {
              matchId: id,
              isTeamA: false,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          });

          // Mostrar todos los jugadores por equipo para verificación
          console.log('Jugadores actuales en equipos:', {
            teamA: teamAPlayers.map((p: any) => p.userId),
            teamB: teamBPlayers.map((p: any) => p.userId),
          });

          // Obtener los últimos jugadores TBD
          updatedMatchData = await prisma.match.findUnique({
            where: { id },
            select: { tbdPlayers: true },
          });

          // Mapear los jugadores al formato esperado
          mappedPlayersA = teamAPlayers.map((player: any) => ({
            id: player.userId,
            name: player.user?.name || 'Unknown',
            avatar: player.user?.image,
          }));

          mappedPlayersB = teamBPlayers.map((player: any) => ({
            id: player.userId,
            name: player.user?.name || 'Unknown',
            avatar: player.user?.image,
          }));
        } else {
          console.log('Player was not in any team yet, no replacement needed');
        }
      } catch (error) {
        console.error('Error handling TBD player replacement:', error);
      }
    }

    // Registrar la acción en los logs del grupo
    await logGroupEvent(
      match.groupId,
      user.id,
      LogAction.USER_ATTENDANCE_UPDATED,
      {
        matchId: id,
        status,
        playerRoles: validatedRoles,
      }
    );

    console.log('======= FIN BACKEND API ATTENDANCE =======');

    // Si tenemos datos actualizados de los equipos, incluirlos en la respuesta
    if (
      updatedMatchData &&
      (mappedPlayersA.length > 0 || mappedPlayersB.length > 0)
    ) {
      return res.status(200).json({
        success: true,
        message: `Attendance ${status.toLowerCase()} successfully`,
        updated: !!attendanceResult,
        playerRoles: validatedRoles,
        matchDetails: {
          tbdPlayers: updatedMatchData.tbdPlayers,
          playersA: mappedPlayersA,
          playersB: mappedPlayersB,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Attendance ${status.toLowerCase()} successfully`,
      updated: !!attendanceResult,
      playerRoles: validatedRoles,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
