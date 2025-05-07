import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Obtener grupo ID de la URL
    const { id: groupId } = req.query;
    const { userId, action } = req.body;

    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida' });
    }

    // Buscar el grupo
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Verificar si el usuario actual es administrador del grupo
    const adminMembership = group.members.find(
      (member) => member.userId === user.id && member.role === 'ADMIN'
    );
    const isCreator = group.createdBy === user.id;

    if (!adminMembership && !isCreator) {
      return res.status(403).json({
        message: 'No tienes permisos para gestionar solicitudes en este grupo',
      });
    }

    // Buscar la solicitud de membresía pendiente
    const membershipRequest = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: userId,
        status: 'PENDING',
      },
    });

    if (!membershipRequest) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    if (action === 'APPROVE') {
      // Aprobar la solicitud
      await prisma.groupMember.update({
        where: { id: membershipRequest.id },
        data: { status: 'CONFIRMED' },
      });

      return res.status(200).json({
        message: 'Solicitud aprobada correctamente',
        status: 'CONFIRMED',
      });
    } else if (action === 'REJECT') {
      // Rechazar la solicitud eliminándola
      await prisma.groupMember.delete({
        where: { id: membershipRequest.id },
      });

      return res.status(200).json({
        message: 'Solicitud rechazada correctamente',
      });
    }
  } catch (error) {
    console.error('Error al gestionar solicitud de membresía:', error);
    return res.status(500).json({
      message: 'Error al gestionar la solicitud',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
