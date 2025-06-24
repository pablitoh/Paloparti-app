import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { PLAYER_ROLES } from '../../../../lib/matches/constants';
import { PlayerRole, normalizePlayerRoles } from '../../../../lib/teambuilder';
import { PlayerRoleType } from '../../../../lib/teambuilder/types';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';
import { createUnifiedBalancedTeams } from '../../../../lib/matches/unifiedBalancer';
import { Member } from '../../../../lib/teambuilder/types';

// Define types for TBD players
interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

// Type assertion to ensure PLAYER_ROLES values match PlayerRoleType
const TYPED_ROLES = {
  GOALKEEPER: 'Arquero' as PlayerRoleType,
  DEFENDER: 'Defensor' as PlayerRoleType,
  MIDFIELDER: 'Mediocampo' as PlayerRoleType,
  FORWARD: 'Delantero' as PlayerRoleType,
  WILDCARD: 'Comodín' as PlayerRoleType,
};

// Función para convertir jugadores a formato Member
const convertToMembers = (players: any[]): Member[] => {
  return players.map((player) => ({
    id: player.id,
    name: player.name || '',
    age: player.age || null,
    playerRoles: player.playerRoles || [],
    starRating: player.starRating || 0,
    avatar: player.avatar || null,
    birthdate: player.birthdate || null,
    role: player.role || null,
  }));
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query; // match ID
    const { status, playerRoles: rawPlayerRoles } = req.body;
    const user = session.user;

    console.log('======= MATCH ATTENDANCE API =======');
    console.log('USER ID:', user.id);
    console.log('MATCH ID:', id);
    console.log('STATUS:', status);
    console.log('RAW PLAYER ROLES:', rawPlayerRoles);
    console.log('RAW PLAYER ROLES TYPE:', typeof rawPlayerRoles);

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

    // Obtener el partido con sus datos actuales
    const match = await prisma.match.findUnique({
      where: { id: String(id) },
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
        matchId: String(id),
      },
    });

    let attendanceResult;

    // Los roles se guardarán directamente en MatchAttendance más abajo

    if (existingAttendance) {
      // Update existing attendance record
      attendanceResult = await prisma.matchAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          playerRoles:
            status === 'CONFIRMED' && validatedRoles.length > 0
              ? validatedRoles
              : null,
          updatedAt: new Date(),
        },
      });
      console.log('Registro de asistencia ACTUALIZADO:', attendanceResult);
    } else {
      // Create new attendance record
      attendanceResult = await prisma.matchAttendance.create({
        data: {
          userId: user.id,
          matchId: String(id),
          groupId: match.groupId,
          matchDate: match.date,
          status,
          playerRoles:
            status === 'CONFIRMED' && validatedRoles.length > 0
              ? validatedRoles
              : null,
        },
      });
      console.log('Registro de asistencia CREADO:', attendanceResult);
    }

    // Registrar en el log
    await logGroupEvent(
      match.groupId,
      user.id,
      LogAction.USER_ATTENDANCE_UPDATED,
      {
        matchId: String(id),
        status,
        playerRoles: validatedRoles.map((role) => role.role).join(', '),
      }
    );

    // Si el estado es DECLINED, manejar la remoción del usuario de los equipos
    let updatedMatchData = null;
    let mappedPlayersA = [];
    let mappedPlayersB = [];

    if (status === 'DECLINED') {
      console.log(
        `Usuario ${user.id} canceló asistencia, removiendo de equipos si está asignado`
      );

      // Obtener los datos actuales de los equipos
      const currentMatch = await prisma.match.findUnique({
        where: { id: String(id) },
        select: {
          teamA: true,
          teamB: true,
          matchPlayers: {
            where: {
              userId: user.id,
            },
          },
        },
      });

      if (currentMatch) {
        let teamAData = [];
        let teamBData = [];

        // Parsear los datos de los equipos
        try {
          teamAData =
            typeof currentMatch.teamA === 'string'
              ? JSON.parse(currentMatch.teamA)
              : Array.isArray(currentMatch.teamA)
              ? currentMatch.teamA
              : [];
        } catch (e) {
          console.error('Error parsing teamA:', e);
          teamAData = [];
        }

        try {
          teamBData =
            typeof currentMatch.teamB === 'string'
              ? JSON.parse(currentMatch.teamB)
              : Array.isArray(currentMatch.teamB)
              ? currentMatch.teamB
              : [];
        } catch (e) {
          console.error('Error parsing teamB:', e);
          teamBData = [];
        }

        // Remover el usuario de ambos equipos
        const filteredTeamA = teamAData.filter(
          (player: any) => player.id !== user.id
        );
        const filteredTeamB = teamBData.filter(
          (player: any) => player.id !== user.id
        );

        // Procesar los jugadores TBD para mantener consistencia
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
                // Extract from team structure
                currentTbdPlayers = [
                  ...(Array.isArray(parsed.teamA) ? parsed.teamA : []),
                  ...(Array.isArray(parsed.teamB) ? parsed.teamB : []),
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

        console.log('TBD Players encontrados:', {
          count: currentTbdPlayers.length,
          players: currentTbdPlayers.map((p: any) => ({
            id: p.id,
            isTeamA: p.isTeamA,
          })),
        });

        // Si se necesita agregar jugadores TBD para completar, crear uno
        const requiredPlayers = 10; // Valor por defecto
        const tbdId = `tbd-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        const newTbdPlayer: TbdPlayer = {
          id: tbdId,
          name: `TBD ${currentTbdPlayers.length + 1}`,
          avatar: null,
          age: null,
          playerType: 'TBD' as const,
          isTeamA: filteredTeamA.length <= filteredTeamB.length,
        };

        currentTbdPlayers.push(newTbdPlayer);

        console.log(
          `Added TBD player to ${
            newTbdPlayer.isTeamA ? 'Team A' : 'Team B'
          }: ${tbdId}`
        );

        // Actualizar la tabla Match con el nuevo array de tbdPlayers
        const tbdPlayersToSave = currentTbdPlayers;

        await prisma.match.update({
          where: { id: String(id) },
          data: {
            teamA: JSON.stringify(filteredTeamA),
            teamB: JSON.stringify(filteredTeamB),
            tbdPlayers: JSON.stringify(tbdPlayersToSave),
          },
        });

        console.log(
          `Updated match.tbdPlayers with new TBD player ${tbdId}. Total TBD players: ${currentTbdPlayers.length}`
        );

        // Verificar la actualización
        const updatedMatch = await prisma.match.findUnique({
          where: { id: String(id) },
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
            'IDs de TBD players:',
            verificationTbdPlayers.map((p) => p.id)
          );
        }

        // También eliminar el registro de MatchPlayer si existe
        await prisma.matchPlayer.deleteMany({
          where: {
            matchId: String(id),
            userId: user.id,
          },
        });

        mappedPlayersA = filteredTeamA;
        mappedPlayersB = filteredTeamB;

        updatedMatchData = {
          teamA: mappedPlayersA,
          teamB: mappedPlayersB,
          tbdPlayers: currentTbdPlayers,
        };

        console.log(
          `Usuario ${user.id} removido de los equipos. Team A: ${mappedPlayersA.length}, Team B: ${mappedPlayersB.length}`
        );
      }
    }

    // Obtener datos actualizados del partido para la respuesta
    const finalMatch = await prisma.match.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        teamA: true,
        teamB: true,
        tbdPlayers: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Preparar la respuesta
    const responseData = {
      success: true,
      message: `Attendance ${status.toLowerCase()} successfully`,
      attendance: attendanceResult,
      playerRoles: validatedRoles, // Agregar los roles del jugador a la respuesta
      matchData: finalMatch
        ? {
            id: finalMatch.id,
            teamA:
              mappedPlayersA.length > 0 ? mappedPlayersA : finalMatch.teamA,
            teamB:
              mappedPlayersB.length > 0 ? mappedPlayersB : finalMatch.teamB,
            tbdPlayers: updatedMatchData?.tbdPlayers || finalMatch.tbdPlayers,
            attendance: finalMatch.attendance,
          }
        : null,
    };

    console.log('Respuesta enviada:', {
      success: responseData.success,
      hasMatchData: !!responseData.matchData,
      attendanceStatus: attendanceResult.status,
    });

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in attendance API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
