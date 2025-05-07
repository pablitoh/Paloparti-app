import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // This API handles:
  // PATCH: Change a member's role (promote to admin or demote to member)

  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Get the group ID
    const { id: groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    // Get the action details
    const { memberId, action } = req.body;
    if (!memberId || !action) {
      return res.status(400).json({
        message: 'Se requiere memberId y action (promote o demote)',
      });
    }

    // Validate action
    if (action !== 'promote' && action !== 'demote' && action !== 'remove') {
      return res.status(400).json({
        message: 'Action debe ser promote, demote o remove',
      });
    }

    // Check if the user is admin
    const adminMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    const isCreator = await prisma.group
      .findUnique({
        where: { id: groupId },
        select: { createdBy: true },
      })
      .then(
        (group: { createdBy: string } | null) => group?.createdBy === user.id
      );

    if (!adminMembership && !isCreator) {
      return res.status(403).json({
        message: 'No tienes permisos para gestionar este grupo',
      });
    }

    // Verify the target member exists
    const targetMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!targetMember) {
      return res.status(404).json({
        message: 'Miembro no encontrado en el grupo',
      });
    }

    // Don't allow changing your own role
    if (targetMember.userId === user.id) {
      return res.status(403).json({
        message: 'No puedes cambiar tu propio rol',
      });
    }

    // Handle the action
    if (action === 'remove') {
      // Delete the member
      await prisma.groupMember.delete({
        where: {
          id: targetMember.id,
        },
      });

      return res.status(200).json({
        message: 'Miembro eliminado correctamente',
        userId: targetMember.userId,
      });
    } else {
      // Promote or demote
      const newRole = action === 'promote' ? 'ADMIN' : 'MEMBER';

      const updatedMember = await prisma.groupMember.update({
        where: {
          id: targetMember.id,
        },
        data: {
          role: newRole,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return res.status(200).json({
        message:
          action === 'promote'
            ? 'Miembro promovido a administrador correctamente'
            : 'Administrador degradado a miembro correctamente',
        member: {
          id: updatedMember.id,
          userId: updatedMember.userId,
          name: updatedMember.user.name,
          email: updatedMember.user.email,
          avatar: updatedMember.user.image,
          role: updatedMember.role,
          status: updatedMember.status,
        },
      });
    }
  } catch (error) {
    console.error('Error gestionando roles de miembros:', error);
    return res.status(500).json({
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
