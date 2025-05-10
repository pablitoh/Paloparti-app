import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import crypto from 'crypto';

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

    // Obtener ID del grupo
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    console.log('Generando invitación para grupo:', id);

    // Obtener duración opcional en horas (por defecto 24 horas)
    const { expirationHours } = req.body;
    const duration = Number(expirationHours) > 0 ? Number(expirationHours) : 24;
    console.log('Duración de invitación:', duration, 'horas');

    // Verificar que el usuario es admin del grupo
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!membership) {
      return res
        .status(403)
        .json({ message: 'No tienes permisos para crear invitaciones' });
    }

    // Generar token de invitación más corto para facilitar su uso
    const token = crypto.randomBytes(8).toString('hex');
    console.log('Token generado:', token);

    // Crear fecha de expiración con la duración configurada
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + duration);
    console.log('Fecha de expiración:', expiresAt);

    // Almacenar la invitación directamente en el grupo
    // Usamos solo el método alternativo por ahora
    console.log('Actualizando grupo con información de invitación...');
    await prisma.group.update({
      where: { id },
      data: {
        lastSortingCriteria: `invite:${token}:${expiresAt.toISOString()}`,
      },
    });
    console.log('Grupo actualizado exitosamente con token:', token);

    // Construir URL de invitación
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${token}`;
    console.log('URL de invitación generada:', inviteUrl);

    return res.status(201).json({
      message: 'Invitación creada exitosamente',
      inviteUrl,
      expiresAt,
      duration: `${duration} horas`,
    });
  } catch (error) {
    console.error('Error al crear invitación:', error);
    return res.status(500).json({ message: 'Error al crear invitación' });
  }
}
