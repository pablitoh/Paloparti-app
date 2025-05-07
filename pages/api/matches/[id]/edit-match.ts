import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';

// Define types for TBD players
interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { id } = req.query;

    // Datos que pueden modificarse
    const {
      date,
      location,
      tbdPlayerId,
      userId,
      isTeamA,
      action = 'update', // Tipos: 'update', 'replace-tbd'
    } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de partido inválido' });
    }

    // Obtener el partido
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Verificar que el usuario es admin del grupo
    const isAdmin = match.group.members.some(
      (member: { userId: string; role: string }) =>
        member.userId === user.id && member.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message:
          'No tienes permisos de administrador para modificar este partido',
      });
    }

    // Variables para almacenar datos a actualizar y la respuesta
    let updateData: any = {};
    let responseData: any = { message: 'Partido actualizado correctamente' };

    // Manejar diferentes tipos de acciones
    switch (action) {
      case 'update':
        // Actualizar fecha y/o ubicación
        if (date) {
          updateData.date = new Date(date);
          responseData.date = updateData.date;
        }

        if (location) {
          updateData.location = location;
          responseData.location = updateData.location;
        }

        // Actualizar el partido
        const updatedMatch = await prisma.match.update({
          where: { id },
          data: updateData,
        });

        // Registrar en el log
        await logGroupEvent(match.groupId, user.id, LogAction.MATCH_EDITED, {
          matchId: id,
          previousData: {
            date: match.date,
            location: match.location,
          },
          newData: {
            date: date ? new Date(date) : match.date,
            location: location || match.location,
          },
        });

        break;

      case 'replace-tbd':
        // Validar parámetros necesarios
        if (!tbdPlayerId || !userId) {
          return res.status(400).json({
            message:
              'Se requiere el ID del jugador TBD y el ID del usuario real',
          });
        }

        console.log('Processing TBD replacement:', {
          tbdPlayerId,
          userId,
          isTeamA,
          rawTbdPlayers: match.tbdPlayers,
        });

        // Obtener el grupo para conocer la cantidad de jugadores requeridos
        const groupWithRequirements = await prisma.group.findUnique({
          where: { id: match.groupId },
          select: {
            requiredPlayers: true,
            teamAName: true,
            teamBName: true,
          },
        });

        // Cantidad de jugadores requeridos por equipo
        const requiredPlayers = groupWithRequirements?.requiredPlayers || 10;
        const requiredPlayersPerTeam = Math.ceil(requiredPlayers / 2);

        // Obtener los jugadores existentes por equipo
        const existingPlayers = await prisma.matchPlayer.findMany({
          where: { matchId: id },
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

        // Separar por equipos
        const teamAPlayers = existingPlayers.filter(
          (p: { isTeamA: boolean }) => p.isTeamA
        );
        const teamBPlayers = existingPlayers.filter(
          (p: { isTeamA: boolean }) => !p.isTeamA
        );

        console.log('Existing players:', {
          teamA: teamAPlayers.length,
          teamB: teamBPlayers.length,
          requiredPerTeam: requiredPlayersPerTeam,
        });

        // Verificar si el ID del TBD corresponde a uno de nuestros IDs generados dinámicamente
        const tbdRegexMatch = tbdPlayerId.match(/^tbd-(\d+)-(a|b)-(\d+)$/);

        if (!tbdRegexMatch) {
          return res.status(400).json({
            message: 'Formato de ID de jugador TBD no válido',
            tbdPlayerId,
          });
        }

        // Extraer información del ID
        const [_, timestamp, team, index] = tbdRegexMatch;
        const isTbdTeamA = team === 'a';

        // Definir variable para el equipo del jugador
        let playerIsTeamA: boolean;

        // Verificar que el equipo coincida con lo esperado
        if (isTbdTeamA !== isTeamA) {
          console.log(
            `TBD player team mismatch: ID indicates ${
              isTbdTeamA ? 'teamA' : 'teamB'
            } but request says ${isTeamA ? 'teamA' : 'teamB'}`
          );
          // Usar el equipo indicado en el ID
          playerIsTeamA = isTbdTeamA;
        } else {
          playerIsTeamA = isTeamA;
        }

        // Verify the user is a member of the group
        const isMember = match.group.members.some(
          (member: { userId: string }) => member.userId === userId
        );

        if (!isMember) {
          return res.status(400).json({
            message: 'El usuario real debe ser miembro del grupo',
          });
        }

        // Check if the user is already assigned to the match
        const alreadyAssigned = await prisma.matchPlayer.findFirst({
          where: {
            matchId: id,
            userId,
          },
        });

        if (alreadyAssigned) {
          return res.status(400).json({
            message: 'El usuario ya está asignado a este partido',
          });
        }

        // Generar TBD players como lo hace el endpoint next-match
        const generateTbdPlayers = () => {
          const tbdPlayersA = [];
          const tbdPlayersB = [];

          // Completar equipo A
          const missingA = Math.max(
            0,
            requiredPlayersPerTeam - teamAPlayers.length
          );
          for (let i = 0; i < missingA; i++) {
            tbdPlayersA.push({
              id: `tbd-${Date.now()}-a-${i}`,
              name: `TBD A${i + 1}`,
              avatar: null,
              isTeamA: true,
              playerType: 'TBD',
            });
          }

          // Completar equipo B
          const missingB = Math.max(
            0,
            requiredPlayersPerTeam - teamBPlayers.length
          );
          for (let i = 0; i < missingB; i++) {
            tbdPlayersB.push({
              id: `tbd-${Date.now()}-b-${i}`,
              name: `TBD B${i + 1}`,
              avatar: null,
              isTeamA: false,
              playerType: 'TBD',
            });
          }

          // Retornar en formato de objeto con teamA/teamB
          return {
            teamA: tbdPlayersA,
            teamB: tbdPlayersB,
          };
        };

        // Obtenemos o generamos los jugadores TBD
        let tbdPlayers: any = match.tbdPlayers;

        // Si no hay datos, generamos los TBD players
        if (!tbdPlayers) {
          tbdPlayers = generateTbdPlayers();
          console.log('Generated TBD players:', {
            teamA: tbdPlayers?.teamA?.length || 0,
            teamB: tbdPlayers?.teamB?.length || 0,
          });
        } else if (typeof tbdPlayers === 'string') {
          try {
            tbdPlayers = JSON.parse(tbdPlayers);
          } catch (e) {
            console.error('Error parsing tbdPlayers string:', e);
            tbdPlayers = generateTbdPlayers();
          }
        }

        // Asegurarnos de que tbdPlayers tenga el formato correcto (con teamA y teamB)
        if (Array.isArray(tbdPlayers)) {
          // Convertir de array a estructura teamA/teamB
          tbdPlayers = {
            teamA: tbdPlayers.filter((p: any) => p.isTeamA),
            teamB: tbdPlayers.filter((p: any) => !p.isTeamA),
          };
        } else if (
          tbdPlayers &&
          typeof tbdPlayers === 'object' &&
          (!tbdPlayers.teamA || !tbdPlayers.teamB)
        ) {
          // Si no tiene la estructura adecuada, regenerar
          tbdPlayers = generateTbdPlayers();
        }

        // Create the new real player assignment
        await prisma.matchPlayer.create({
          data: {
            matchId: id,
            userId,
            isTeamA: playerIsTeamA,
          },
        });

        // Actualizar o crear el registro de asistencia para el usuario
        await prisma.matchAttendance.upsert({
          where: {
            userId_matchId: {
              userId,
              matchId: id,
            },
          },
          update: {
            status: 'CONFIRMED',
          },
          create: {
            userId,
            matchId: id,
            groupId: match.groupId,
            matchDate: match.date,
            status: 'CONFIRMED',
          },
        });

        // Obtener información del usuario real
        const replacementUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            image: true,
          },
        });

        // Registrar en el log
        await logGroupEvent(match.groupId, user.id, LogAction.PLAYER_REPLACED, {
          matchId: id,
          tbdPlayerId,
          oldPlayer: {
            id: tbdPlayerId,
            name: `Jugador TBD (${playerIsTeamA ? 'Equipo A' : 'Equipo B'})`,
          },
          newPlayer: {
            id: userId,
            name: replacementUser?.name,
          },
          isTeamA: playerIsTeamA,
        });

        // Actualizar los TBD players - filtrar el jugador reemplazado
        const updatedTbdPlayers = {
          teamA: (tbdPlayers?.teamA || []).filter(
            (p: any) => p.id !== tbdPlayerId
          ),
          teamB: (tbdPlayers?.teamB || []).filter(
            (p: any) => p.id !== tbdPlayerId
          ),
        };

        // Actualizar los TBD players en la base de datos
        updateData.tbdPlayers = updatedTbdPlayers;
        responseData.tbdPlayers = updatedTbdPlayers;
        responseData.replacedPlayer = {
          id: userId,
          name: replacementUser?.name,
          avatar: replacementUser?.image,
          isTeamA: playerIsTeamA,
          playerType: 'CONFIRMED',
        };

        break;

      default:
        return res.status(400).json({ message: 'Acción no válida' });
    }

    // Update match with the collected data
    if (Object.keys(updateData).length > 0) {
      await prisma.match.update({
        where: { id },
        data: updateData,
      });
    }

    // Get the updated match information
    const updatedMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (updatedMatch) {
      // Obtener los jugadores por equipo
      const matchPlayers = await prisma.matchPlayer.findMany({
        where: { matchId: id },
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

      // Define interface for MatchPlayer with user relation
      interface MatchPlayerWithUser {
        userId: string;
        isTeamA: boolean;
        user?: {
          id: string;
          name: string | null;
          image: string | null;
        } | null;
      }

      // Format players by team
      const teamAPlayers = matchPlayers
        .filter((player: MatchPlayerWithUser) => player.isTeamA)
        .map((player: MatchPlayerWithUser) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: true,
        }));

      const teamBPlayers = matchPlayers
        .filter((player: MatchPlayerWithUser) => !player.isTeamA)
        .map((player: MatchPlayerWithUser) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: false,
        }));

      responseData.match = {
        ...updatedMatch,
        playersA: teamAPlayers,
        playersB: teamBPlayers,
      };
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error al modificar el partido:', error);
    return res.status(500).json({
      message: 'Error al modificar el partido',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
