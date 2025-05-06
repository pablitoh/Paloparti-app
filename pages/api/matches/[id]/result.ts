import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { calculateAge } from '../../../../lib/utils';
import { createNextMatch } from '../../../../lib/matches';

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

    // Validar campos
    if (
      (scoreA !== undefined && (isNaN(scoreA) || scoreA < 0)) ||
      (scoreB !== undefined && (isNaN(scoreB) || scoreB < 0))
    ) {
      return res.status(400).json({
        message: 'Los valores de puntuación deben ser números no negativos',
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
      for (const goal of goals) {
        if (!goal.userId) continue; // Ignorar goles sin jugador asignado

        await prisma.goal.create({
          data: {
            matchId: id,
            userId: goal.userId,
            isTeamA: goal.isTeamA,
            minute: goal.minute || null,
          },
        });
      }
    }

    // Actualizar el partido con los nuevos resultados
    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        scoreA,
        scoreB,
        status: 'COMPLETED', // Marcar como completado
      },
    });

    // Resetear los estados de asistencia para futuros partidos si es necesario
    try {
      if (match.status === 'PENDING' && updatedMatch.status === 'COMPLETED') {
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
        const newMatch = await createNextMatch(groupId);
        if (newMatch) {
          console.log(
            `Nuevo partido creado automáticamente después de completar el partido anterior: ${newMatch.id}`
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
            `Asistencias para el nuevo partido inicializadas a PENDING`
          );
        }

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
