import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../../lib/prisma';
import { getCurrentUser } from '../../../../../../lib/auth';

// Definir la interfaz para nuestro GroupMember
interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: string;
  status?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir método PATCH
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Obtener IDs de la URL
    const { id: groupId, memberId } = req.query;
    const { status } = req.body;

    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ message: 'ID de miembro inválido' });
    }

    if (
      !status ||
      !['confirmed', 'pending', 'waiting', 'declined'].includes(status)
    ) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    // Buscar el grupo y verificar que exista
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Verificar si el usuario pertenece al grupo
    const userGroupMember = group.members.find(
      (member: GroupMember) => member.userId === user.id
    );

    if (!userGroupMember) {
      return res.status(403).json({ message: 'No perteneces a este grupo' });
    }

    // Verificar que el miembro a modificar exista en el grupo
    const targetMember = group.members.find(
      (member: GroupMember) => member.id === memberId
    );

    if (!targetMember) {
      return res
        .status(404)
        .json({ message: 'Miembro no encontrado en el grupo' });
    }

    // Verificar permisos:
    // 1. Un admin puede cambiar el estado de cualquier miembro (incluido a sí mismo)
    // 2. Un miembro regular solo puede cambiar su propio estado

    const isAdmin = userGroupMember.role === 'ADMIN';
    const isChangingSelf = userGroupMember.id === memberId;

    if (!isAdmin && !isChangingSelf) {
      return res.status(403).json({
        message: 'No tienes permiso para cambiar el estado de este miembro',
      });
    }

    // Actualizar el estado del miembro
    const updatedMember = await prisma.groupMember.update({
      where: {
        id: memberId,
      },
      data: {
        status: status.toUpperCase(), // Convertir a mayúsculas para la base de datos
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Formatear la respuesta
    const formattedMember = {
      id: updatedMember.id,
      userId: updatedMember.userId,
      name: updatedMember.user.name,
      avatar: updatedMember.user.image,
      role: updatedMember.role,
      status: updatedMember.status.toLowerCase(), // Convertir a minúsculas para el cliente
    };

    return res.status(200).json(formattedMember);
  } catch (error) {
    console.error('Error actualizando estado del miembro:', error);
    return res.status(500).json({
      message: 'Error al actualizar el estado del miembro',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
