import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { getCurrentUser } from '../../../../../lib/auth';
import { logGroupEvent } from '../../../../../utils/serverLogEvents';
import { LogAction } from '../../../../../utils/logTypes';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const groupId = req.query.id as string;
  const { userId, rating } = req.body;

  // Validar el rating
  if (typeof rating !== 'number' || rating < 0 || rating > 5) {
    return res
      .status(400)
      .json({ message: 'El rating debe ser un número entre 0 y 5' });
  }

  try {
    // Verificar que el usuario es admin del grupo
    const adminMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!adminMembership) {
      return res
        .status(403)
        .json({ message: 'No tienes permisos de administrador en este grupo' });
    }

    // Verificar que el usuario a actualizar es miembro del grupo
    const targetMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            email: true,
          },
        },
      },
    });

    if (!targetMembership) {
      return res
        .status(404)
        .json({ message: 'El usuario no es miembro de este grupo' });
    }

    // Almacenar el rating anterior para el log
    const previousRating = targetMembership.starRating;

    // Actualizar el star rating usando SQL directo para evitar problemas con la API de Prisma
    const ratingValue = parseInt(rating.toString(), 10);
    await prisma.$executeRaw`UPDATE "GroupMember" SET "starRating" = ${ratingValue} WHERE id = ${targetMembership.id}`;

    // Obtener el miembro actualizado para devolverlo en la respuesta
    const updatedMember = await prisma.groupMember.findUnique({
      where: { id: targetMembership.id },
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

    // Transformar el miembro para la respuesta
    const memberResponse = updatedMember
      ? {
          id: updatedMember.id,
          userId: updatedMember.userId,
          name: updatedMember.user.name || updatedMember.user.email,
          avatar: updatedMember.user.image,
          role: updatedMember.role,
          starRating: ratingValue,
          joinedAt: updatedMember.createdAt,
        }
      : null;

    // Registrar en el log
    await logGroupEvent(groupId, user.id, LogAction.MEMBER_RATING_UPDATED, {
      targetUserId: userId,
      targetUserName: targetMembership.user.name,
      previousRating,
      newRating: rating,
    });

    return res.status(200).json({
      success: true,
      message: 'Rating actualizado correctamente',
      updatedMember: memberResponse,
    });
  } catch (error) {
    console.error('Error al actualizar el rating del miembro:', error);
    return res.status(500).json({
      message: 'Error al actualizar el rating',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
