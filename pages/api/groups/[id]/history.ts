import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    // Obtener parámetros de paginación
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Verificar si el grupo existe
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Obtener total de partidos completados
    const totalMatches = await prisma.match.count({
      where: {
        groupId: id,
        status: 'COMPLETED',
      },
    });

    // Obtener partidos completados con paginación
    const matches = await prisma.match.findMany({
      where: {
        groupId: id,
        status: 'COMPLETED',
      },
      orderBy: [
        { createdAt: 'desc' }, // Primary sort by creation date
        { date: 'desc' }, // Secondary sort by match date
      ],
      skip,
      take: limit,
      include: {
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
        matchPlayers: {
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

    // Procesar los datos para el formato requerido por el frontend
    const formattedMatches = matches.map((match: (typeof matches)[0]) => {
      // Procesar los goles para incluir información del jugador
      const processedGoals = match.goals.map(
        (goal: (typeof match.goals)[0]) => ({
          id: goal.id,
          isTeamA: goal.isTeamA,
          scorerId: goal.scorer.id,
          scorerName: goal.scorer.name,
          scorerAvatar: goal.scorer.image,
          minute: goal.minute || undefined,
        })
      );

      // Separar jugadores en equipos A y B basados en isTeamA
      const teamAPlayers = (match.matchPlayers as any[])
        .filter((player: any) => player.isTeamA)
        .map((player: any) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: true,
          birthdate: player.user?.birthdate || null,
        }));

      const teamBPlayers = (match.matchPlayers as any[])
        .filter((player: any) => !player.isTeamA)
        .map((player: any) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: false,
        }));

      return {
        id: match.id,
        date: match.date,
        location: match.location,
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        status: match.status,
        playersA: teamAPlayers,
        playersB: teamBPlayers,
        goals: processedGoals,
        createdAt: match.createdAt,
      };
    });

    return res.status(200).json({
      matches: formattedMatches,
      pagination: {
        total: totalMatches,
        page,
        limit,
        pages: Math.ceil(totalMatches / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener historial de partidos:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
