import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { calculateAge } from '../../../../lib/utils';
import { createNextMatch } from '../../../../lib/matches';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  // Obtener ID del partido
  const { id: matchId } = req.query;
  if (!matchId || typeof matchId !== 'string') {
    return res.status(400).json({ message: 'ID de partido inválido' });
  }

  // GET para obtener los detalles del partido
  if (req.method === 'GET') {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
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

      return res.status(200).json(match);
    } catch (error) {
      console.error('Error fetching match:', error);
      return res.status(500).json({ message: 'Error al obtener el partido' });
    }
  }

  // DELETE para eliminar un partido
  if (req.method === 'DELETE') {
    console.log('DELETE request received for match:', {
      matchId,
      userId: user?.id,
    });
    try {
      // Verificar que el partido existe
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          group: {
            include: {
              members: {
                where: {
                  userId: user.id,
                  role: 'ADMIN', // Verificar que el usuario es admin
                },
              },
            },
          },
        },
      });

      console.log('Match found:', {
        match: !!match,
        hasMembers: match?.group?.members && match.group.members.length > 0,
        groupId: match?.groupId,
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Partido no encontrado',
        });
      }

      // Verificar que el usuario es administrador del grupo
      if (!match.group?.members || match.group.members.length === 0) {
        console.log('User is not an admin of this group');
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar este partido',
        });
      }

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

      console.log('Match deleted successfully:', { matchId });

      return res.status(200).json({
        success: true,
        message: 'Partido eliminado correctamente',
      });
    } catch (error) {
      console.error('Error deleting match:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar el partido',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
}
