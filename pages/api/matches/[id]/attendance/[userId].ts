import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { getCurrentUser } from '../../../../../lib/auth';
import { logGroupEvent } from '../../../../../utils/serverLogEvents';
import { LogAction } from '../../../../../utils/logTypes';
import {
  PlayerRole,
  normalizePlayerRoles,
} from '../../../../../lib/teambuilder';
import { PLAYER_ROLES } from '../../../../../lib/matches/constants';

// Type assertion to ensure PLAYER_ROLES values match PlayerRoleType
const TYPED_ROLES = {
  GOALKEEPER: 'Arquero' as const,
  DEFENDER: 'Defensor' as const,
  MIDFIELDER: 'Mediocampo' as const,
  FORWARD: 'Delantero' as const,
  WILDCARD: 'Comodín' as const,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Autenticar usuario
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Obtener matchId y userId del objetivo desde la URL
    const { id: matchId, userId: targetUserId } = req.query;

    console.log(
      `API: Procesando solicitud para matchId=${matchId}, targetUserId=${targetUserId}, requestingUser=${user.id}`
    );

    if (
      !matchId ||
      typeof matchId !== 'string' ||
      !targetUserId ||
      typeof targetUserId !== 'string'
    ) {
      console.error(
        `API ERROR: Parámetros inválidos: matchId=${matchId}, targetUserId=${targetUserId}`
      );
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Obtener el estado de la asistencia y roles del cuerpo de la solicitud
    const { status, playerRoles: rawPlayerRoles } = req.body;
    if (!status || (status !== 'CONFIRMED' && status !== 'DECLINED')) {
      console.error(`API ERROR: Estado inválido: status=${status}`);
      return res.status(400).json({ error: 'Invalid status' });
    }

    console.log('======= ADMIN ATTENDANCE UPDATE =======');
    console.log('ADMIN USER ID:', user.id);
    console.log('TARGET USER ID:', targetUserId);
    console.log('MATCH ID:', matchId);
    console.log('STATUS:', status);
    console.log('RAW PLAYER ROLES:', rawPlayerRoles);

    // Validar y procesar playerRoles
    let validatedRoles: PlayerRole[] = [];
    if (status === 'CONFIRMED') {
      if (rawPlayerRoles && rawPlayerRoles.length > 0) {
        // Normalizar roles (convierte formato antiguo si es necesario)
        validatedRoles = normalizePlayerRoles(rawPlayerRoles);
        console.log('ROLES NORMALIZADOS:', validatedRoles);
      } else {
        // Si no se proporcionan roles, usar valor por defecto
        validatedRoles = [{ role: TYPED_ROLES.WILDCARD, priority: 1 }];
        console.log('USANDO VALOR DEFAULT:', validatedRoles);
      }
    }

    console.log('ROLES VALIDADOS FINAL:', validatedRoles);

    // Verificar si el match existe con más detalles
    console.log(`API: Buscando partido con ID: ${matchId}`);

    try {
      // Primero hacemos una consulta para verificar que el partido existe
      const matchExists = await prisma.$queryRaw<Array<any>>`
        SELECT id FROM "Match" WHERE id = ${matchId} LIMIT 1
      `;

      console.log(
        `API: Resultado de búsqueda básica: ${JSON.stringify(matchExists)}`
      );

      if (!matchExists || matchExists.length === 0) {
        console.error(
          `API ERROR: Partido no encontrado en la tabla Match con ID ${matchId}`
        );
        return res.status(404).json({
          error: 'Match not found',
          details: 'El match ID no existe en la base de datos',
        });
      }
    } catch (dbError) {
      console.error(`API ERROR: Error en búsqueda de match: ${dbError}`);
    }

    // Buscar el partido para encontrar el grupo y la fecha
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { groupId: true, date: true, id: true, playerRoles: true },
    });

    if (!match) {
      console.error(`API ERROR: Partido no encontrado con ID ${matchId}`);
      return res.status(404).json({
        error: 'Match not found',
        details: 'No se pudo encontrar la información del partido',
      });
    }

    console.log(`API: Partido encontrado: ${JSON.stringify(match)}`);

    // Verificar si el usuario actual es administrador del grupo
    const currentUserMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!currentUserMembership) {
      console.error(
        `API ERROR: El usuario ${user.id} no es admin del grupo ${match.groupId}`
      );
      return res
        .status(403)
        .json({ error: 'Only admins can update attendance for other users' });
    }

    // Encontrar al miembro que se está actualizando
    const targetMember = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: targetUserId,
      },
    });

    if (!targetMember) {
      console.error(
        `API ERROR: Usuario objetivo ${targetUserId} no es miembro del grupo ${match.groupId}`
      );
      return res
        .status(404)
        .json({ error: 'Target user is not a member of this group' });
    }

    // Los roles se guardarán directamente en MatchAttendance más abajo

    // Verificar si ya existe un registro de asistencia para el usuario y partido objetivo
    console.log(`API: Buscando registro de asistencia existente`);
    const existingAttendance = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "MatchAttendance" 
      WHERE "userId" = ${targetUserId} AND "matchId" = ${matchId}
      LIMIT 1
    `;

    console.log(
      `API: ¿Registro existente?: ${JSON.stringify(existingAttendance)}`
    );

    let attendanceResult;

    // Preparar playerRoles para guardar
    const playerRolesToSave =
      status === 'CONFIRMED' && validatedRoles.length > 0
        ? validatedRoles
        : null;

    if (existingAttendance && existingAttendance.length > 0) {
      // Actualizar registro de asistencia existente
      console.log(`API: Actualizando registro existente`);
      attendanceResult = await prisma.matchAttendance.update({
        where: { id: existingAttendance[0].id },
        data: {
          status,
          playerRoles: playerRolesToSave,
          updatedAt: new Date(),
        },
      });
    } else {
      // Crear nuevo registro de asistencia
      console.log(`API: Creando nuevo registro`);
      try {
        attendanceResult = await prisma.matchAttendance.create({
          data: {
            userId: targetUserId,
            matchId: matchId,
            groupId: match.groupId,
            matchDate: match.date,
            status,
            playerRoles: playerRolesToSave,
          },
        });
      } catch (insertError) {
        console.error(`API ERROR: Error insertando asistencia: ${insertError}`);
        return res.status(500).json({
          error: 'Database operation failed',
          details: 'Error al crear registro de asistencia',
        });
      }
    }

    console.log(
      `Admin ${user.id} updated match attendance for user ${targetUserId} to ${status}`
    );

    // Obtener el usuario objetivo para el log
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });

    // Registrar en el log para cualquier cambio de asistencia (CONFIRMED o DECLINED)
    await logGroupEvent(
      match.groupId,
      user.id,
      LogAction.ADMIN_CONFIRMED_ATTENDANCE,
      {
        matchId,
        userId: targetUserId,
        userName: targetUser?.name,
        status,
        // Incluir roles solo si se proporcionaron y el estado es CONFIRMED
        ...(status === 'CONFIRMED' &&
          validatedRoles.length > 0 && {
            playerRoles: validatedRoles
              .map((role: any) => role.role)
              .join(', '),
          }),
      }
    );

    // If the player is declining, we need to remove them from the teams
    if (status === 'DECLINED') {
      try {
        console.log(
          `Admin: User ${targetUserId} is declining attendance, removing from teams...`
        );

        // First, check if the player is in any team and which team they're in
        const playerTeam = await prisma.matchPlayer.findFirst({
          where: {
            matchId,
            userId: targetUserId,
          },
        });

        if (playerTeam) {
          console.log(
            `Admin: Player was in team ${
              playerTeam.isTeamA ? 'A' : 'B'
            }, removing and replacing with TBD player`
          );
        } else {
          console.log('Admin: Player was not in any team yet');
        }

        // Delete the player from the match teams
        const deleteResult = await prisma.matchPlayer.deleteMany({
          where: {
            matchId,
            userId: targetUserId,
          },
        });

        console.log(
          `Admin: Deleted ${deleteResult.count} player entries from teams`
        );

        // Generate a unique ID for the TBD player
        const tbdId = `tbd-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        // Update match to add a TBD player if needed
        const matchData = await prisma.match.findUnique({
          where: { id: matchId },
          select: { tbdPlayers: true },
        });

        if (matchData?.tbdPlayers) {
          // Parse the TBD players if it's a string
          let tbdPlayers =
            typeof matchData.tbdPlayers === 'string'
              ? JSON.parse(matchData.tbdPlayers)
              : matchData.tbdPlayers;

          // Add a new TBD player
          const newTbdPlayer = {
            id: tbdId,
            name: `TBD ${Math.floor(Math.random() * 100)}`, // Add a number to make it unique
            avatar: null,
            playerType: 'TBD',
            isTeamA: playerTeam ? playerTeam.isTeamA : true,
          };
          tbdPlayers.push(newTbdPlayer);

          // If we found which team they were in, add a new TBD player to that team
          if (playerTeam) {
            console.log(
              `Admin: Player was in team ${
                playerTeam.isTeamA ? 'A' : 'B'
              }, adding TBD player to same team`
            );
            await prisma.matchPlayer.create({
              data: {
                matchId,
                userId: tbdId,
                isTeamA: playerTeam.isTeamA,
              },
            });
            console.log(
              `Admin: Created TBD player ${tbdId} in team ${
                playerTeam.isTeamA ? 'A' : 'B'
              }`
            );
          } else {
            // If player wasn't in a team yet, assign to team A by default
            console.log(
              "Admin: Player wasn't in a team yet, adding TBD player to team A"
            );
            await prisma.matchPlayer.create({
              data: {
                matchId,
                userId: tbdId,
                isTeamA: true,
              },
            });
            console.log(
              `Admin: Created TBD player ${tbdId} in team A (default)`
            );
          }

          // Update the match with the new TBD player
          await prisma.match.update({
            where: { id: matchId },
            data: {
              tbdPlayers: JSON.stringify(tbdPlayers),
            },
          });

          console.log(
            `Admin: Successfully added TBD player ${tbdId} to replace user ${targetUserId}`
          );

          // Verify the TBD player was added correctly
          const checkTbdPlayer = await prisma.matchPlayer.findFirst({
            where: {
              matchId,
              userId: tbdId,
            },
          });

          if (checkTbdPlayer) {
            console.log(
              `Admin verification: TBD player ${tbdId} is in team ${
                checkTbdPlayer.isTeamA ? 'A' : 'B'
              }`
            );
          } else {
            console.error(
              `Admin verification FAILED: TBD player ${tbdId} was not found in MatchPlayer table`
            );
          }

          // Verify the changes
          const verifyPlayerRemoved = await prisma.matchPlayer.findFirst({
            where: {
              matchId,
              userId: targetUserId,
            },
          });

          if (verifyPlayerRemoved) {
            console.error(
              `Admin: FAILED - Player ${targetUserId} still exists in teams after deletion`
            );
          } else {
            console.log(
              `Admin: SUCCESS - Player ${targetUserId} was properly removed from teams`
            );
          }

          // Get the updated player lists for the response
          const teamAPlayers = await prisma.matchPlayer.findMany({
            where: {
              matchId,
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
              matchId,
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

          // Get latest TBD players
          const updatedMatchData = await prisma.match.findUnique({
            where: { id: matchId },
            select: { tbdPlayers: true },
          });

          // Map the players to the expected format
          const mappedPlayersA = teamAPlayers.map(
            (player: (typeof teamAPlayers)[0]) => ({
              id: player.userId,
              name: player.user?.name || 'Unknown',
              avatar: player.user?.image,
            })
          );

          const mappedPlayersB = teamBPlayers.map(
            (player: (typeof teamBPlayers)[0]) => ({
              id: player.userId,
              name: player.user?.name || 'Unknown',
              avatar: player.user?.image,
            })
          );

          // Include the updated team data in the response
          return res.status(200).json({
            success: true,
            status: status.toLowerCase(),
            message: `Attendance ${status.toLowerCase()} successfully`,
            details: {
              matchId,
              userId: targetUserId,
              groupId: match.groupId,
            },
            matchDetails: {
              tbdPlayers: updatedMatchData?.tbdPlayers,
              playersA: mappedPlayersA,
              playersB: mappedPlayersB,
            },
          });
        }
      } catch (error) {
        console.error('Error handling TBD player replacement:', error);
      }
    }

    // Default response if no team update was needed
    return res.status(200).json({
      success: true,
      status: status.toLowerCase(),
      message: `Attendance ${status.toLowerCase()} successfully`,
      details: {
        matchId,
        userId: targetUserId,
        groupId: match.groupId,
      },
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({
      error: 'Failed to update attendance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
