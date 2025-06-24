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

      // Parsear equipos desde JSON strings o usar los matchPlayers como fallback
      let teamAPlayers: any[] = [];
      let teamBPlayers: any[] = [];

      // Intentar parsear teamA y teamB como JSON
      try {
        if (match.teamA && typeof match.teamA === 'string') {
          teamAPlayers = JSON.parse(match.teamA);
        }
      } catch (error) {
        console.log(
          'Could not parse teamA as JSON, using matchPlayers fallback'
        );
      }

      try {
        if (match.teamB && typeof match.teamB === 'string') {
          teamBPlayers = JSON.parse(match.teamB);
        }
      } catch (error) {
        console.log(
          'Could not parse teamB as JSON, using matchPlayers fallback'
        );
      }

      // Si no se pudieron parsear los equipos, usar matchPlayers como fallback
      if (teamAPlayers.length === 0 || teamBPlayers.length === 0) {
        teamAPlayers = (match.matchPlayers as any[])
          .filter((player: any) => player.isTeamA)
          .map((player: any) => ({
            id: player.userId || player.user?.id,
            name: player.user?.name || null,
            avatar: player.user?.image || null,
            age: player.user?.age || null,
            birthdate: player.user?.birthdate || null,
            playerRoles: [], // No tenemos esta información en matchPlayers
            starRating: null, // No tenemos esta información en matchPlayers
            assignedRole: null,
            positionForced: false,
          }));

        teamBPlayers = (match.matchPlayers as any[])
          .filter((player: any) => !player.isTeamA)
          .map((player: any) => ({
            id: player.userId || player.user?.id,
            name: player.user?.name || null,
            avatar: player.user?.image || null,
            age: player.user?.age || null,
            birthdate: player.user?.birthdate || null,
            playerRoles: [], // No tenemos esta información en matchPlayers
            starRating: null, // No tenemos esta información en matchPlayers
            assignedRole: null,
            positionForced: false,
          }));
      }

      return {
        id: match.id,
        date: match.date,
        location: match.location,
        teamA: teamAPlayers, // Ahora es un array como en next-match
        teamB: teamBPlayers, // Ahora es un array como en next-match
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        status: match.status,
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
