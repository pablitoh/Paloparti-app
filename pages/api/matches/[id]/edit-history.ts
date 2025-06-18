import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';

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
    const { action, ...data } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de partido inválido' });
    }

    // Obtener el partido con información completa
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: true,
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

    // Verificar que el partido esté completado
    if (match.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'Solo se pueden editar partidos completados',
      });
    }

    // Verificar que el usuario es admin del grupo
    const isAdmin = match.group.members.some(
      (member: { userId: string; role: string }) =>
        member.userId === user.id && member.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'No tienes permisos de administrador para editar este partido',
      });
    }

    // Manejar diferentes acciones
    switch (action) {
      case 'update-score':
        return await handleUpdateScore(id, data, user, match, res);

      case 'swap-players':
        return await handleSwapPlayers(id, data, user, match, res);

      case 'update-goals':
        return await handleUpdateGoals(id, data, user, match, res);

      default:
        return res.status(400).json({ message: 'Acción no válida' });
    }
  } catch (error) {
    console.error('Error al editar partido:', error);
    return res.status(500).json({
      message: 'Error al editar el partido',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleUpdateScore(
  matchId: string,
  data: { scoreA: number; scoreB: number },
  user: any,
  match: any,
  res: NextApiResponse
) {
  const { scoreA, scoreB } = data;

  // Validar puntajes
  if (scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
    throw new Error('Los puntajes deben estar entre 0 y 99');
  }

  const previousScoreA = match.scoreA;
  const previousScoreB = match.scoreB;

  // Actualizar puntajes
  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreA,
      scoreB,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
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

  // Registrar en el log
  await logGroupEvent(match.groupId, user.id, LogAction.MATCH_RESULT_EDITED, {
    matchId,
    previousScore: { scoreA: previousScoreA, scoreB: previousScoreB },
    newScore: { scoreA, scoreB },
    teamAName: match.teamA,
    teamBName: match.teamB,
  });

  return res.status(200).json({
    message: 'Puntajes actualizados correctamente',
    match: updatedMatch,
  });
}

async function handleSwapPlayers(
  matchId: string,
  data: {
    player1Id: string;
    player2Id: string;
    player1IsTeamA: boolean;
    player2IsTeamA: boolean;
  },
  user: any,
  match: any,
  res: NextApiResponse
) {
  const { player1Id, player2Id, player1IsTeamA, player2IsTeamA } = data;

  console.log('🔄 Iniciando intercambio de jugadores:', {
    player1Id,
    player2Id,
    player1IsTeamA,
    player2IsTeamA,
    matchId,
  });

  if (player1IsTeamA === player2IsTeamA) {
    throw new Error('Los jugadores deben estar en equipos diferentes');
  }

  // Obtener información de los jugadores
  const player1 = match.matchPlayers.find(
    (mp: any) => mp.userId === player1Id && mp.isTeamA === player1IsTeamA
  );
  const player2 = match.matchPlayers.find(
    (mp: any) => mp.userId === player2Id && mp.isTeamA === player2IsTeamA
  );

  if (!player1 || !player2) {
    throw new Error('Jugadores no encontrados en el partido');
  }

  // Intercambiar jugadores
  await Promise.all([
    prisma.matchPlayer.updateMany({
      where: {
        matchId: matchId,
        userId: player1Id,
      },
      data: {
        isTeamA: !player1IsTeamA,
      },
    }),
    prisma.matchPlayer.updateMany({
      where: {
        matchId: matchId,
        userId: player2Id,
      },
      data: {
        isTeamA: !player2IsTeamA,
      },
    }),
  ]);

  // IMPORTANTE: También intercambiar los goles de estos jugadores
  await Promise.all([
    prisma.goal.updateMany({
      where: {
        matchId: matchId,
        userId: player1Id,
      },
      data: {
        isTeamA: !player1IsTeamA,
      },
    }),
    prisma.goal.updateMany({
      where: {
        matchId: matchId,
        userId: player2Id,
      },
      data: {
        isTeamA: !player2IsTeamA,
      },
    }),
  ]);

  // Recalcular los puntajes después del intercambio
  const goalsTeamA = await prisma.goal.count({
    where: {
      matchId: matchId,
      isTeamA: true,
    },
  });

  const goalsTeamB = await prisma.goal.count({
    where: {
      matchId: matchId,
      isTeamA: false,
    },
  });

  // Actualizar los puntajes del partido
  await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreA: goalsTeamA,
      scoreB: goalsTeamB,
    },
  });

  // Registrar en el log
  await logGroupEvent(match.groupId, user.id, LogAction.PLAYER_SWAPPED, {
    matchId,
    player1: {
      id: player1Id,
      name: player1?.user?.name || 'Jugador desconocido',
      originalTeam: player1IsTeamA ? 'A' : 'B',
      newTeam: player1IsTeamA ? 'B' : 'A',
    },
    player2: {
      id: player2Id,
      name: player2?.user?.name || 'Jugador desconocido',
      originalTeam: player2IsTeamA ? 'A' : 'B',
      newTeam: player2IsTeamA ? 'B' : 'A',
    },
    teamAName: match.teamA,
    teamBName: match.teamB,
    resultUpdated: {
      previousScore: { scoreA: match.scoreA, scoreB: match.scoreB },
      newScore: { scoreA: goalsTeamA, scoreB: goalsTeamB },
    },
  });

  // Obtener el partido actualizado
  const updatedMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
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

  return res.status(200).json({
    message: 'Jugadores intercambiados correctamente',
    match: updatedMatch,
  });
}

async function handleUpdateGoals(
  matchId: string,
  data: {
    goals: Array<{ scorerId: string; isTeamA: boolean; minute?: number }>;
  },
  user: any,
  match: any,
  res: NextApiResponse
) {
  const { goals } = data;

  // Eliminar todos los goles existentes
  await prisma.goal.deleteMany({
    where: { matchId },
  });

  // Crear nuevos goles
  if (goals && goals.length > 0) {
    const goalData = goals.map((goal) => ({
      matchId,
      userId: goal.scorerId,
      isTeamA: goal.isTeamA,
      minute: goal.minute || null,
    }));

    await prisma.goal.createMany({
      data: goalData,
    });
  }

  // Obtener información de los goleadores para el log
  const goalScorers = await Promise.all(
    (goals || []).map(async (goal) => {
      const user = await prisma.user.findUnique({
        where: { id: goal.scorerId },
        select: { name: true },
      });
      return {
        scorerId: goal.scorerId,
        scorerName: user?.name || 'Desconocido',
        isTeamA: goal.isTeamA,
        minute: goal.minute,
      };
    })
  );

  // Registrar en el log
  await logGroupEvent(match.groupId, user.id, LogAction.MATCH_RESULT_EDITED, {
    matchId,
    action: 'goals_updated',
    goals: goalScorers,
    teamAName: match.teamA,
    teamBName: match.teamB,
  });

  // Obtener el partido actualizado
  const updatedMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
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

  return res.status(200).json({
    message: 'Goles actualizados correctamente',
    match: updatedMatch,
  });
}
