import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Obtener token de la invitación
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ message: 'Token de invitación no proporcionado' });
    }

    console.log('Procesando solicitud para unirse a grupo con token:', token);
    const cleanToken = token.split(':')[0]; // Limpiamos el token por si tiene caracteres adicionales

    // Buscar el grupo por inviteToken en lugar de por ID
    const group = await prisma.group.findFirst({
      where: {
        inviteToken: cleanToken,
      },
    });

    console.log(
      'Resultado de búsqueda:',
      group ? 'Grupo encontrado' : 'No encontrado'
    );

    // Verificar si encontramos el grupo
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    console.log('Grupo encontrado:', group.id, group.name);

    // Verificar si el usuario ya es miembro del grupo
    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      // Si ya es miembro, devolver éxito
      return res.status(200).json({
        message: 'Ya eres miembro de este grupo',
        status: existingMembership.status,
        groupId: group.id,
      });
    }

    // Crear la solicitud de membresía del usuario en el grupo
    // El estado es PENDING, los administradores deberán aprobar
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        role: 'MEMBER',
        status: 'PENDING', // El usuario queda en espera de aprobación
      },
    });

    return res.status(201).json({
      message: 'Solicitud enviada, esperando aprobación de los administradores',
      groupId: group.id,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Error al unirse al grupo:', error);
    return res.status(500).json({ message: 'Error al unirse al grupo' });
  }
}
