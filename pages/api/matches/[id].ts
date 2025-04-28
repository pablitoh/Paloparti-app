import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';
import { createNextMatch } from '../../../lib/matches';

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
      const match = await prisma.match.findUnique({
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
          playersA: {
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
      });

      if (!match) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      // Check if the current user is an admin
      const isAdmin = match.group.members.some(
        (member) => member.userId === userId && member.role === 'ADMIN'
      );

      // Add age calculated from birthdate
      const matchWithAges = {
        ...match,
        playersA: match.playersA.map((player) => ({
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
      const updatedMatch = await prisma.match.update({
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
            },
          },
          playersA: {
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
      });

      // Add calculated age from birthdate
      const updatedMatchWithAges = {
        ...updatedMatch,
        playersA: updatedMatch.playersA.map((player) => ({
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
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          group: {
            include: {
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

      // Verify if user is group admin
      const isAdmin = match.group.members.some(
        (member) => member.userId === userId && member.role === 'ADMIN'
      );
      if (!isAdmin) {
        return res
          .status(403)
          .json({ message: 'No tienes permisos para eliminar este partido' });
      }

      // Delete associated goals
      await prisma.goal.deleteMany({
        where: { matchId },
      });

      // Delete associated players
      await prisma.matchPlayer.deleteMany({
        where: { matchId },
      });

      // Resetear los estados de asistencia para futuros partidos
      try {
        await prisma.$transaction(async (prisma) => {
          // Guardar el ID del grupo y la fecha antes de eliminar el partido
          const groupId = match.groupId;

          // Reset all match attendance status to PENDING for future matches
          await prisma.matchAttendance.updateMany({
            where: {
              groupId: match.groupId,
              matchDate: {
                gt: new Date(),
              },
            },
            data: {
              status: 'PENDING',
              updatedAt: new Date(),
            },
          });

          // Resetear también el estado de asistencia para este partido específico
          // Esto es redundante porque se eliminarán, pero por seguridad
          await prisma.matchAttendance.updateMany({
            where: {
              matchId,
            },
            data: {
              status: 'PENDING',
              updatedAt: new Date(),
            },
          });

          // Resetear el nextMatchId del grupo si es el partido actual
          await prisma.$executeRaw`
            UPDATE "Group"
            SET "nextMatchId" = NULL, "nextMatch" = NULL
            WHERE "nextMatchId" = ${matchId}
          `;
        });

        console.log(
          `Estados de asistencia para futuros partidos del grupo ${match.groupId} reseteados a PENDING`
        );

        // Crear un nuevo partido automáticamente
        const newMatch = await createNextMatch(match.groupId);
        if (newMatch) {
          console.log(
            `Nuevo partido creado automáticamente después de eliminar el partido anterior: ${newMatch.id}`
          );
        }
      } catch (error) {
        console.error(
          'Error al resetear asistencias futuras o crear nuevo partido:',
          error
        );
        // Continuamos con el flujo normal aunque falle el reseteo de asistencias
      }

      // Solo limpiar las asistencias específicas de este partido después de resetearlas
      await prisma.matchAttendance.deleteMany({
        where: { matchId },
      });

      console.log(
        `Asistencias del partido ${matchId} eliminadas correctamente`
      );

      // Delete the match
      await prisma.match.delete({
        where: { id: matchId },
      });

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
