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

    // Obtener partidos completados del grupo
    const completedMatches = await prisma.match.findMany({
      where: {
        groupId: id,
        status: 'COMPLETED',
      },
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

    // Calcular goleadores
    const goalsCount: Record<
      string,
      { goals: number; name: string; avatar: string | null }
    > = {};

    // Calcular victorias y partidos jugados para cada jugador
    const playerStats: Record<
      string,
      { wins: number; matches: number; name: string; avatar: string | null }
    > = {};

    // Para cada partido completado
    completedMatches.forEach((match) => {
      // Registrar goles
      if (match.goals && match.goals.length > 0) {
        match.goals.forEach((goal) => {
          const scorerId = goal.scorer.id;

          if (!goalsCount[scorerId]) {
            goalsCount[scorerId] = {
              goals: 0,
              name: goal.scorer?.name || 'Sin nombre',
              avatar: goal.scorer?.image,
            };
          }
          goalsCount[scorerId].goals += 1;
        });
      }

      // Determinar el equipo ganador
      const teamAWon = match.scoreA > match.scoreB;
      const isDraw = match.scoreA === match.scoreB;

      // Separar jugadores en equipos A y B basados en isTeamA
      // const teamAPlayers = match.playersA.filter((player) => player.isTeamA);
      // const teamBPlayers = match.playersA.filter((player) => !player.isTeamA);

      const teamAPlayers = (match.matchPlayers as any[])
        .filter((player) => player.isTeamA)
        .map((player) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: true,
        }));

      const teamBPlayers = (match.matchPlayers as any[])
        .filter((player) => !player.isTeamA)
        .map((player) => ({
          id: player.userId,
          name: player.user?.name || null,
          avatar: player.user?.image || null,
          isTeamA: false,
        }));

      // Registrar victorias y partidos para jugadores del Equipo A
      if (teamAPlayers) {
        teamAPlayers.forEach((player) => {
          const playerId = player.id;
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              wins: 0,
              matches: 0,
              name: player.name || 'Sin nombre',
              avatar: player.image,
            };
          }
          playerStats[playerId].matches += 1;
          if (teamAWon) playerStats[playerId].wins += 1;
          if (isDraw) playerStats[playerId].wins += 0.5; // Media victoria por empate
        });
      }

      // Registrar victorias y partidos para jugadores del Equipo B
      if (teamBPlayers) {
        teamBPlayers.forEach((player) => {
          const playerId = player.id;
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              wins: 0,
              matches: 0,
              name: player.name || 'Sin nombre',
              avatar: player.image,
            };
          }
          playerStats[playerId].matches += 1;
          if (!teamAWon && !isDraw) playerStats[playerId].wins += 1;
          if (isDraw) playerStats[playerId].wins += 0.5; // Media victoria por empate
        });
      }
    });

    // Convertir los objetos a arrays y ordenarlos
    const goleadores = Object.entries(goalsCount)
      .map(([id, data]) => ({
        id,
        name: data.name,
        goals: data.goals,
        avatar: data.avatar,
      }))
      .sort((a, b) => b.goals - a.goals);

    const mvps = Object.entries(playerStats)
      .map(([id, data]) => ({
        id,
        name: data.name,
        winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0,
        matchesPlayed: data.matches,
        avatar: data.avatar,
      }))
      .filter((player) => player.matchesPlayed >= 3) // Solo jugadores con al menos 3 partidos
      .sort((a, b) => b.winRate - a.winRate);

    return res.status(200).json({
      goleadores,
      mvps,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del grupo:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
