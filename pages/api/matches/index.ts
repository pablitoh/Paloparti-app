import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await getCurrentUser(req);

  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  if (req.method === 'GET') {
    try {
      const { groupId } = req.query;

      const userGroups = await prisma.groupMember.findMany({
        where: {
          userId: user.id,
        },
        select: {
          groupId: true,
        },
      });

      const userGroupIds = userGroups.map((ug) => ug.groupId);

      if (groupId && typeof groupId === 'string') {
        if (!userGroupIds.includes(groupId)) {
          return res.status(403).json({
            message: 'No tienes acceso a los partidos de este grupo',
          });
        }

        const matches = await prisma.match.findMany({
          where: {
            groupId,
          },
          orderBy: {
            date: 'desc',
          },
        });

        return res.status(200).json(matches);
      }

      const matches = await prisma.match.findMany({
        where: {
          groupId: {
            in: userGroupIds,
          },
        },
        include: {
          group: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      return res.status(200).json(matches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      return res.status(500).json({ message: 'Error al obtener partidos' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        groupId,
        date,
        location,
        teamA,
        teamB,
        players,
        status = 'PENDING',
      } = req.body;

      if (!groupId || !date || !location || !teamA || !teamB) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
      }

      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: user.id,
          role: 'ADMIN',
        },
      });

      if (!membership) {
        return res.status(403).json({
          message: 'No tienes permisos para crear partidos en este grupo',
        });
      }

      // Create the match
      const match = await prisma.match.create({
        data: {
          date: new Date(date),
          location,
          groupId,
          teamA,
          teamB,
          status,
          scoreA: 0,
          scoreB: 0,
        },
      });

      // Create MatchPlayer records if players array is provided
      if (players && Array.isArray(players)) {
        // Filter out placeholder players that shouldn't be created in the database
        const realPlayers = players.filter((player) => !player.isPlaceholder);

        if (realPlayers.length > 0) {
          await Promise.all(
            realPlayers.map((player) =>
              prisma.matchPlayer.create({
                data: {
                  matchId: match.id,
                  userId: player.userId,
                  isTeamA: player.isTeamA,
                },
              })
            )
          );
        }
      }

      // Update group's match count and next match date
      const activeMatchesCount = await prisma.match.count({
        where: {
          groupId,
          status: {
            not: 'DELETED',
          },
        },
      });

      await prisma.group.update({
        where: { id: groupId },
        data: {
          totalMatches: activeMatchesCount,
          ...(new Date(date) > new Date() && { nextMatch: new Date(date) }),
        },
      });

      // Include match details in response
      try {
        const matchWithDetails = await prisma.match.findUnique({
          where: { id: match.id },
          include: {
            playersA: {
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

        return res.status(201).json({
          message: 'Partido creado correctamente',
          match: matchWithDetails,
          redirectUrl: `/matches/${match.id}/results`,
        });
      } catch (error) {
        console.error('Error fetching match details:', error);
        return res.status(201).json({
          message: 'Partido creado correctamente',
          match: { id: match.id },
          redirectUrl: `/matches/${match.id}/results`,
        });
      }
    } catch (error) {
      console.error('Error creating match:', error);
      return res.status(500).json({ message: 'Error al crear el partido' });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
}
