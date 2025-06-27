import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { createUnifiedBalancedTeams } from '../../../../lib/matches/unifiedBalancer';
import { Member, PlayerRoleType } from '../../../../lib/teambuilder/types';
import {
  MatchAttendance as PrismaMatchAttendance,
  User,
  GroupMember,
} from '@prisma/client';
import { PlayerRole } from '../../../../lib/teambuilder';

interface PlayerData {
  id: string;
  name: string;
}

interface ExtendedMatchAttendance
  extends Omit<PrismaMatchAttendance, 'playerRoles'> {
  playerRoles: PlayerRole[];
  user: User;
}

// Función para convertir jugadores a formato Member
const convertToMembers = (players: any[]): Member[] => {
  return players.map((player) => {
    // Asegurarse que los roles estén en el formato correcto
    const playerRoles =
      player.playerRoles?.map((role: any) => {
        if (typeof role === 'object' && role.role) {
          return role;
        }
        // Si es un string, convertirlo a objeto PlayerRole
        return {
          role: role as PlayerRoleType,
          priority: 1,
        };
      }) || [];

    return {
      id: player.id,
      name: player.name || '',
      age: player.age || null,
      playerRoles: playerRoles,
      starRating: player.starRating || 0,
      avatar: player.avatar || null,
      birthdate: player.birthdate || null,
      role: player.role || null,
    };
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Obtener usuario autenticado
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query; // match ID

    // Obtener el partido actual
    const match = await prisma.match.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        groupId: true,
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

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Verificar que el usuario es miembro del grupo
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: 'User is not a member of this group' });
    }

    // Parsear los equipos actuales
    let teamAData = [];
    let teamBData = [];

    try {
      // Intentar parsear como JSON primero
      if (typeof match.teamA === 'string') {
        try {
          teamAData = JSON.parse(match.teamA);
        } catch {
          // Si falla, intentar parsear como array simple
          teamAData = match.teamA.split(',').map(
            (player: string): PlayerData => ({
              id: player.trim(),
              name: player.trim(),
            })
          );
        }
      } else if (Array.isArray(match.teamA)) {
        teamAData = match.teamA;
      }

      if (typeof match.teamB === 'string') {
        try {
          teamBData = JSON.parse(match.teamB);
        } catch {
          // Si falla, intentar parsear como array simple
          teamBData = match.teamB.split(',').map(
            (player: string): PlayerData => ({
              id: player.trim(),
              name: player.trim(),
            })
          );
        }
      } else if (Array.isArray(match.teamB)) {
        teamBData = match.teamB;
      }

      // Obtener los datos completos de los jugadores desde la tabla de asistencia
      const attendance = await prisma.matchAttendance.findMany({
        where: {
          matchId: String(id),
          status: 'CONFIRMED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              birthdate: true,
            },
          },
        },
      });

      // Obtener los ratings de los jugadores
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: match.groupId,
        },
        select: {
          userId: true,
          starRating: true,
        },
      });

      // Mapear los ratings a un objeto para fácil acceso
      const ratingsMap = Object.fromEntries(
        groupMembers.map((member: GroupMember) => [
          member.userId,
          member.starRating || 0,
        ])
      );

      // Combinar los datos de asistencia con los equipos
      const allPlayers = attendance.map((att: ExtendedMatchAttendance) => ({
        id: att.user.id,
        name: att.user.name || '',
        age: att.user.birthdate
          ? calculateAge(new Date(att.user.birthdate))
          : null,
        playerRoles: att.playerRoles || [],
        starRating: ratingsMap[att.user.id] || 0,
        avatar: att.user.image,
        birthdate: att.user.birthdate,
        role: null,
      }));

      // Convertir a formato Member
      const members = convertToMembers(allPlayers);

      // Usar el balanceador unificado
      const [newTeamA, newTeamB] = createUnifiedBalancedTeams(members, {
        balanceByAge: true,
        balanceByRating: true,
        balanceByRole: true,
      });

      // Actualizar el partido con los nuevos equipos
      const updatedMatch = await prisma.match.update({
        where: { id: String(id) },
        data: {
          teamA: JSON.stringify(newTeamA),
          teamB: JSON.stringify(newTeamB),
          sortCount: {
            increment: 1,
          },
        },
        include: {
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

      // Actualizar matchPlayers para mantener consistencia
      await prisma.matchPlayer.deleteMany({
        where: { matchId: String(id) },
      });

      // Crear nuevos registros de matchPlayers para el equipo A
      for (const player of newTeamA) {
        if (player.id && !player.id.startsWith('tbd-')) {
          await prisma.matchPlayer.create({
            data: {
              matchId: String(id),
              userId: player.id,
              isTeamA: true,
            },
          });
        }
      }

      // Crear nuevos registros de matchPlayers para el equipo B
      for (const player of newTeamB) {
        if (player.id && !player.id.startsWith('tbd-')) {
          await prisma.matchPlayer.create({
            data: {
              matchId: String(id),
              userId: player.id,
              isTeamA: false,
            },
          });
        }
      }

      // Preparar la respuesta
      const responseData = {
        success: true,
        message: 'Teams rebalanced successfully',
        matchData: {
          id: match.id,
          teamA: newTeamA,
          teamB: newTeamB,
          tbdPlayers: match.tbdPlayers,
          attendance: updatedMatch.attendance,
          sortCount: updatedMatch.sortCount,
        },
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Error resorting teams:', error);
      return res.status(500).json({
        error: 'Error resorting teams',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error resorting teams:', error);
    return res.status(500).json({
      error: 'Error resorting teams',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Helper function to calculate age
function calculateAge(birthdate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return age;
}
