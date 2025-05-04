import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';
import { createNextMatch } from '../../../lib/matches';
import { Prisma, Match, MatchPlayer, User } from '@prisma/client';

type MatchWithRelations = Match & {
  group: {
    id: string;
    name: string;
    members: {
      userId: string;
      role: string;
    }[];
  };
  matchPlayers: (MatchPlayer & {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      birthdate: Date | null;
    };
  })[];
  goals: {
    id: string;
    minute: number | null;
    isTeamA: boolean;
    scorer: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const userId = user.id;
  const matchId = String(req.query.id);

  if (req.method === 'GET') {
    try {
      const match = (await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              members: {
                select: {
                  userId: true,
                  role: true,
                },
              },
            },
          },
          matchPlayers: {
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
          },
          goals: {
            include: {
              scorer: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      })) as MatchWithRelations;

      if (!match) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      // Check if the current user is an admin
      const isAdmin = match.group.members.some(
        (member) => member.userId === userId && member.role === 'ADMIN'
      );

      // Add age calculated from birthdate and separate players by team
      const matchWithAges = {
        ...match,
        playersA: match.matchPlayers
          .filter((player) => player.isTeamA)
          .map((player) => ({
            ...player,
            user: {
              ...player.user,
              age: calculateAge(player.user.birthdate),
            },
          })),
        playersB: match.matchPlayers
          .filter((player) => !player.isTeamA)
          .map((player) => ({
            ...player,
            user: {
              ...player.user,
              age: calculateAge(player.user.birthdate),
            },
          })),
        isAdmin, // Add isAdmin flag for frontend use
      };

      return res.status(200).json(matchWithAges);
    } catch (error) {
      console.error('Error fetching match:', error);
      return res.status(500).json({ message: 'Error al obtener el partido' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        date,
        location,
        status,
        scoreA,
        scoreB,
        teamAPlayers,
        teamBPlayers,
      } = req.body;

      // Verify match exists and user has admin permissions
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          group: {
            include: {
              members: {
                where: {
                  userId,
                  role: 'ADMIN',
                },
              },
            },
          },
        },
      });

      if (!match) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      if (match.group.members.length === 0) {
        return res.status(403).json({
          message: 'No tienes permisos de administrador para este grupo',
        });
      }

      // Delete existing players
      await prisma.matchPlayer.deleteMany({
        where: { matchId },
      });

      // Create new players for team A
      if (teamAPlayers && Array.isArray(teamAPlayers)) {
        await Promise.all(
          teamAPlayers.map((playerId: string) =>
            prisma.matchPlayer.create({
              data: {
                matchId,
                userId: playerId,
                isTeamA: true,
              },
            })
          )
        );
      }

      // Create new players for team B
      if (teamBPlayers && Array.isArray(teamBPlayers)) {
        await Promise.all(
          teamBPlayers.map((playerId: string) =>
            prisma.matchPlayer.create({
              data: {
                matchId,
                userId: playerId,
                isTeamA: false,
              },
            })
          )
        );
      }

      // Update match details
      const updatedMatch = (await prisma.match.update({
        where: { id: matchId },
        data: {
          date: date ? new Date(date) : undefined,
          location,
          status,
          scoreA: scoreA !== undefined ? scoreA : undefined,
          scoreB: scoreB !== undefined ? scoreB : undefined,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              members: {
                select: {
                  userId: true,
                  role: true,
                },
              },
            },
          },
          matchPlayers: {
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
          },
          goals: {
            include: {
              scorer: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      })) as MatchWithRelations;

      const updatedMatchWithAges = {
        ...updatedMatch,
        playersA: updatedMatch.matchPlayers
          .filter((player) => player.isTeamA)
          .map((player) => ({
            ...player,
            user: {
              ...player.user,
              age: calculateAge(player.user.birthdate),
            },
          })),
        playersB: updatedMatch.matchPlayers
          .filter((player) => !player.isTeamA)
          .map((player) => ({
            ...player,
            user: {
              ...player.user,
              age: calculateAge(player.user.birthdate),
            },
          })),
      };

      return res.status(200).json(updatedMatchWithAges);
    } catch (error) {
      console.error('Error updating match:', error);
      return res
        .status(500)
        .json({ message: 'Error al actualizar el partido' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Obtener el partido con los datos mínimos necesarios para las validaciones
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          groupId: true,
          group: {
            select: {
              members: {
                select: {
                  userId: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!match) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      // Verificar si el usuario es admin
      const isAdmin = match.group.members.some(
        (member) => member.userId === userId && member.role === 'ADMIN'
      );

      if (!isAdmin) {
        return res
          .status(403)
          .json({ message: 'No tienes permisos para eliminar este partido' });
      }

      // Ejecutar todas las operaciones en una sola transacción
      await prisma.$transaction([
        // 1. Eliminar asistencias asociadas a este partido
        prisma.matchAttendance.deleteMany({
          where: { matchId },
        }),

        // 2. Eliminar goles asociados
        prisma.goal.deleteMany({
          where: { matchId },
        }),

        // 3. Eliminar jugadores asociados
        prisma.matchPlayer.deleteMany({
          where: { matchId },
        }),

        // 4. Resetear el nextMatchId del grupo si es el partido actual
        prisma.group.updateMany({
          where: {
            nextMatchId: matchId,
          },
          data: {
            nextMatchId: null,
          },
        }),

        // 5. Finalmente eliminar el partido
        prisma.match.delete({
          where: { id: matchId },
        }),
      ]);

      // Crear un nuevo partido automáticamente después de la transacción principal
      try {
        const newMatch = await createNextMatch(match.groupId);
        if (newMatch) {
          console.log(`Nuevo partido creado automáticamente: ${newMatch.id}`);
        }
      } catch (error) {
        console.error('Error al crear nuevo partido:', error);
        // No fallamos la petición completa si esto falla
      }

      return res
        .status(200)
        .json({ message: 'Partido eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting match:', error);
      return res.status(500).json({ message: 'Error al eliminar el partido' });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
}
