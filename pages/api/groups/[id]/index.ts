import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const session = await getSession({ req });
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

    // Obtener información básica del grupo
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
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
          where: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Verificar si el usuario está en el grupo
    const userMembership = group.members.find(
      (member) => member.userId === session.user.id
    );

    // Determinar status del usuario en el grupo
    let userStatus = 'NOT_MEMBER';
    if (userMembership) {
      userStatus = userMembership.status;
    }

    // Determinar rol del usuario
    let userRole = null;
    if (userMembership) {
      userRole = userMembership.role;
    }

    // Construir respuesta simplificada con solo datos esenciales
    const response = {
      id: group.id,
      name: group.name,
      description: group.description,
      sport: group.sport,
      location: group.location,
      teamAName: group.teamAName,
      teamBName: group.teamBName,
      recurrenceType: group.recurrenceType,
      recurrenceDays: group.recurrenceDays,
      recurrenceTime: group.recurrenceTime,
      requiredPlayers: group.requiredPlayers,
      inviteToken: group.inviteToken,
      createdAt: group.createdAt,
      createdBy: group.createdBy,
      creator: group.creator,
      userStatus,
      userRole,
      isAdmin: userRole === 'ADMIN' || group.createdBy === session.user.id,
      nextMatchId: group.nextMatchId,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
