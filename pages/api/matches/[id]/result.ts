import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { calculateAge } from '../../../../lib/utils';
import { createNextMatch } from '../../../../lib/matches';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';

interface MatchPlayer {
  isTeamA: boolean;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    birthdate: Date | null;
  };
}

interface Goal {
  id: string;
  userId: string;
  isTeamA: boolean;
  minute: number | null;
  scorer: {
    name: string | null;
    image: string | null;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  // Solo permitir PATCH
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Obtener ID del partido de la URL
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID de partido inválido' });
  }

  // Obtener partido con su grupo
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      group: {
        include: {
          members: {
            where: {
              userId: user.id,
              role: 'ADMIN', // Verificar que el usuario sea admin
            },
          },
        },
      },
      goals: true, // Incluir los goles existentes
    },
  });

  if (!match) {
    return res.status(404).json({ message: 'Partido no encontrado' });
  }

  // Verificar que el usuario sea administrador del grupo
  if (match.group.members.length === 0) {
    return res.status(403).json({
      message:
        'No tienes permisos de administrador para modificar este partido',
    });
  }

  try {
    const { scoreA, scoreB, goals } = req.body;

    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Validar campos
    if (
      (scoreA !== undefined && (isNaN(scoreA) || scoreA < 0)) ||
      (scoreB !== undefined && (isNaN(scoreB) || scoreB < 0))
    ) {
      return res.status(400).json({
        message: 'Los valores de puntuación deben ser números no negativos',
      });
    }

    // Validar estructura de goles
    if (goals !== undefined && !Array.isArray(goals)) {
      return res.status(400).json({
        message: 'El formato de los goles es inválido, debe ser un array',
      });
    }

    // Eliminar todos los goles existentes para este partido
    if (match.goals.length > 0) {
      await prisma.goal.deleteMany({
        where: { matchId: id },
      });
    }

    // Crear nuevos goles
    if (goals && Array.isArray(goals) && goals.length > 0) {
      console.log('Processing goals:', JSON.stringify(goals, null, 2));

      for (const goal of goals) {
        if (!goal || !goal.userId) {
          console.log('Skipping invalid goal:', goal);
          continue; // Ignorar goles sin jugador asignado
        }

        try {
          await prisma.goal.create({
            data: {
              matchId: id,
              userId: goal.userId,
              isTeamA: !!goal.isTeamA, // Ensure boolean value
              minute: goal.minute != null ? Number(goal.minute) : null,
            },
          });
        } catch (goalError) {
          console.error('Error creating goal:', goalError, 'Goal data:', goal);
          // Continue processing other goals even if one fails
        }
      }
    }

    console.log(
      `🔍 ANTES DE ACTUALIZAR - Status actual del partido: ${match.status}`
    );

    // Actualizar el partido con los nuevos resultados
    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        scoreA,
        scoreB,
        status: 'COMPLETED', // Marcar como completado
      },
    });

    console.log(
      `🔍 DESPUÉS DE ACTUALIZAR - Status nuevo del partido: ${updatedMatch.status}`
    );

    // Get team names from the group
    const groupDetails = await prisma.group.findUnique({
      where: { id: match.groupId },
      select: {
        teamAName: true,
        teamBName: true,
      },
    });

    // Format goals data for logging
    const formattedGoalsForLog = [];
    if (goals && Array.isArray(goals) && goals.length > 0) {
      // Get player details for each goal scorer
      const playerIds = [...new Set(goals.map((g) => g.userId))];
      const players = await prisma.user.findMany({
        where: {
          id: {
            in: playerIds,
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
        },
      });

      // Create a map for quick lookup
      const playerMap = new Map();
      players.forEach((p: { id: string; name: string | null }) =>
        playerMap.set(p.id, p.name || 'Desconocido')
      );

      // Format goals with player names for better log display
      formattedGoalsForLog.push(
        ...goals.map((g) => ({
          userId: g.userId,
          name: playerMap.get(g.userId) || 'Desconocido',
          team: g.isTeamA
            ? groupDetails?.teamAName || 'Equipo A'
            : groupDetails?.teamBName || 'Equipo B',
          isTeamA: g.isTeamA,
          minute: g.minute,
        }))
      );
    }

    // Registrar en el log si el partido cambió de estado a COMPLETED
    if (match.status === 'PENDING' && updatedMatch.status === 'COMPLETED') {
      await logGroupEvent(match.groupId, user.id, LogAction.MATCH_COMPLETED, {
        matchId: id,
        date: match.date,
        location: match.location,
        scoreA,
        scoreB,
        teamAName: groupDetails?.teamAName || 'Equipo A',
        teamBName: groupDetails?.teamBName || 'Equipo B',
        goals: formattedGoalsForLog,
        scorers: formattedGoalsForLog.map((g) => ({
          name: g.name,
          team: g.team,
        })),
      });
    }

    // Resetear los estados de asistencia para futuros partidos si es necesario
    try {
      console.log(`🔍 VERIFICANDO CONDICIÓN PARA CREAR NUEVO PARTIDO:`);
      console.log(`   - Status original: ${match.status}`);
      console.log(`   - Status nuevo: ${updatedMatch.status}`);
      console.log(
        `   - Condición cumplida: ${
          match.status === 'PENDING' && updatedMatch.status === 'COMPLETED'
        }`
      );

      if (match.status === 'PENDING' && updatedMatch.status === 'COMPLETED') {
        console.log(
          `✅ CONDICIÓN CUMPLIDA - Iniciando creación de nuevo partido...`
        );
        // Guardar el ID del grupo y los datos necesarios antes de cambiar el estado
        const groupId = match.groupId;

        // Reset all match attendance status to PENDING for future matches
        await prisma.$executeRaw`
          UPDATE "MatchAttendance"
          SET status = 'PENDING', "updatedAt" = NOW()
          WHERE "groupId" = ${groupId}
          AND "matchDate" > NOW()
          AND "matchId" != ${id}
        `;

        // Limpiar explícitamente las asistencias del partido actual
        // No las borramos porque querremos mantener un registro
        await prisma.$executeRaw`
          UPDATE "MatchAttendance"
          SET status = 'COMPLETED', "updatedAt" = NOW()
          WHERE "matchId" = ${id}
        `;

        // Crear un nuevo partido automáticamente que reemplazará al actual
        console.log(`🚀 Intentando crear nuevo partido para grupo: ${groupId}`);
        const newMatch = await createNextMatch(groupId);
        if (newMatch) {
          console.log(
            `✅ Nuevo partido creado automáticamente después de completar el partido anterior: ${newMatch.id}`
          );

          // Asegurar que el nuevo partido tenga 0 jugadores confirmados
          // Esto es redundante ya que createNextMatch ya lo hace, pero es una garantía adicional
          await prisma.matchAttendance.updateMany({
            where: {
              matchId: newMatch.id,
              status: 'CONFIRMED',
            },
            data: {
              status: 'PENDING',
              updatedAt: new Date(),
            },
          });

          console.log(
            `✅ Asistencias para el nuevo partido inicializadas a PENDING`
          );
        } else {
          console.error(
            `❌ ERROR: No se pudo crear el nuevo partido para el grupo ${groupId}`
          );
        }
      } else {
        console.log(`❌ CONDICIÓN NO CUMPLIDA - No se creará nuevo partido`);

        console.log(
          `Estados de asistencia para futuros partidos y actual del grupo ${match.groupId} actualizados correctamente`
        );
      }
    } catch (error) {
      console.error(
        'Error al resetear asistencias o crear nuevo partido:',
        error
      );
      // Continuamos con el flujo normal aunque falle el reseteo o la creación
    }

    // Si necesitamos los jugadores y goles, podemos hacer consultas separadas
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { matchId: id },
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

    const updatedGoals = await prisma.goal.findMany({
      where: { matchId: id },
      include: {
        scorer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Formatear goles
    const formattedGoals = updatedGoals.map((goal: Goal) => ({
      id: goal.id,
      userId: goal.userId,
      isTeamA: goal.isTeamA,
      minute: goal.minute,
      scorerName: goal.scorer.name,
      scorerAvatar: goal.scorer.image,
    }));

    // Combinar todo en una respuesta completa
    const matchWithDetails = {
      ...updatedMatch,
      matchPlayers: matchPlayers,
      goals: formattedGoals,
    };

    return res.status(200).json({
      message: 'Resultado actualizado correctamente',
      match: matchWithDetails,
    });
  } catch (error) {
    console.error('Error actualizando resultado:', error);
    return res.status(500).json({
      message: 'Error al actualizar el resultado',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
