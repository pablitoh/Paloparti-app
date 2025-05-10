import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Esta API maneja:
  // 1. POST: actualizar el estado de un miembro (aprobar/rechazar)
  // 2. DELETE: eliminar un miembro del grupo

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Obtener ID del grupo
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    // Verificar que el usuario es admin del grupo
    const adminMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!adminMembership) {
      return res
        .status(403)
        .json({ message: 'No tienes permisos para gestionar este grupo' });
    }

    // Procesar acción según el método HTTP
    if (req.method === 'POST') {
      // Actualizar estado de un miembro (aprobar/rechazar)
      const { userId, action } = req.body;

      if (!userId || !action) {
        return res.status(400).json({
          message: 'Se requiere userId y action (APPROVE o REJECT)',
        });
      }

      if (action !== 'APPROVE' && action !== 'REJECT') {
        return res.status(400).json({
          message: 'Action debe ser APPROVE o REJECT',
        });
      }

      // Verificar que el miembro existe
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
      });

      if (!membership) {
        return res.status(404).json({
          message: 'Usuario no encontrado en el grupo',
        });
      }

      // Actualizar estado según la acción
      if (action === 'APPROVE') {
        await prisma.groupMember.update({
          where: {
            groupId_userId: {
              groupId: id,
              userId,
            },
          },
          data: {
            status: 'CONFIRMED',
          },
        });

        return res.status(200).json({
          message: 'Solicitud aprobada exitosamente',
          userId,
          status: 'CONFIRMED',
        });
      } else {
        // Si es REJECT, eliminamos al miembro del grupo
        await prisma.groupMember.delete({
          where: {
            groupId_userId: {
              groupId: id,
              userId,
            },
          },
        });

        return res.status(200).json({
          message: 'Solicitud rechazada exitosamente',
          userId,
        });
      }
    } else if (req.method === 'DELETE') {
      // Eliminar un miembro del grupo
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'Se requiere userId' });
      }

      // Verificar que el miembro existe
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
      });

      if (!membership) {
        return res.status(404).json({
          message: 'Usuario no encontrado en el grupo',
        });
      }

      // No permitir eliminar a otro admin o a sí mismo (protección)
      if (membership.role === 'ADMIN' && userId !== user.id) {
        return res.status(403).json({
          message: 'No puedes eliminar a otro administrador',
        });
      }

      // Eliminar al miembro del grupo
      await prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
      });

      return res.status(200).json({
        message: 'Usuario eliminado del grupo exitosamente',
        userId,
      });
    }
  } catch (error) {
    console.error('Error gestionando miembros del grupo:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
