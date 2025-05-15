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

    // Obtener grupo para verificar permisos
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        createdBy: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Buscar si el usuario es miembro y su rol
    const userMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: session.user.id,
      },
    });

    // Verificar si el usuario es administrador (para mostrar solicitudes pendientes)
    const isAdmin =
      userMembership?.role === 'ADMIN' || group.createdBy === session.user.id;

    // Obtener todos los miembros del grupo
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Separar miembros activos y pendientes
    const activeMembers = members
      .filter(
        (member: (typeof members)[0]) =>
          member.status === 'ACTIVE' || member.status === 'CONFIRMED'
      )
      .map((member: (typeof members)[0]) => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        avatar: member.user.image,
        role: member.role,
        status: member.status,
        starRating: member.starRating,
        isCaptain: member.role === 'ADMIN' || member.userId === group.createdBy,
      }));

    const pendingMembers = isAdmin
      ? members
          .filter((member: (typeof members)[0]) => member.status === 'PENDING')
          .map((member: (typeof members)[0]) => ({
            id: member.id,
            userId: member.userId,
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.image,
            role: member.role,
            status: member.status,
            starRating: member.starRating,
          }))
      : [];

    return res.status(200).json({
      members: activeMembers,
      pendingRequests: pendingMembers,
      isAdmin,
    });
  } catch (error) {
    console.error('Error al obtener miembros del grupo:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
