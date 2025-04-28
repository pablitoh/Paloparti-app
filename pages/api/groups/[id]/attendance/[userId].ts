import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { GroupMember } from '@prisma/client';

// Define custom Group interface with the fields we need
interface GroupWithNextMatch {
  id: string;
  name: string;
  members: GroupMember[];
  nextMatch: Date | null;
  nextMatchId: string | null;
  location: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🚀 API Call - Update Match Attendance (Admin)');

  // Solo aceptamos POST para actualizar asistencia
  if (req.method !== 'POST') {
    console.log('⚠️ Método no permitido:', req.method);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Autenticar al usuario
    const user = await getCurrentUser(req);

    if (!user) {
      console.log('🛑 Usuario no autenticado');
      return res.status(401).json({ error: 'No autorizado' });
    }

    console.log('👤 Usuario autenticado:', user.email);

    // Obtener parámetros
    const { id: groupId, userId: targetUserId } = req.query;
    const { status } = req.body;

    // Registrar información para depuración
    console.log('📝 Parámetros recibidos:', {
      groupId,
      targetUserId,
      status,
    });

    // Validar parámetros
    if (!groupId || !targetUserId || !status) {
      console.log('⚠️ Faltan parámetros necesarios', {
        groupId,
        targetUserId,
        status,
      });
      return res.status(400).json({
        error: 'Faltan parámetros necesarios',
        providedParams: { groupId, targetUserId, status },
      });
    }

    // Obtener el grupo con los miembros y el próximo partido
    const group = (await prisma.group.findUnique({
      where: { id: groupId as string },
      include: {
        members: true,
      },
    })) as unknown as GroupWithNextMatch;

    if (!group) {
      console.log('⚠️ Grupo no encontrado:', groupId);
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Obtener información del próximo partido
    const nextMatch = group.nextMatchId
      ? await prisma.match.findUnique({
          where: { id: group.nextMatchId },
        })
      : null;

    if (!group.nextMatchId || !nextMatch) {
      console.log(
        '⚠️ El grupo no tiene un próximo partido configurado:',
        groupId
      );
      return res
        .status(404)
        .json({ error: 'El grupo no tiene un próximo partido configurado' });
    }

    console.log('📝 Datos del grupo:', {
      groupId: group.id,
      members: group.members.length,
      nextMatchId: group.nextMatchId,
    });

    // Verificar si el usuario que hace la petición es administrador
    const requesterMember = group.members.find(
      (member: GroupMember) => member.userId === user.id
    );

    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      console.log('🛑 Usuario no es administrador:', user.id);
      return res.status(403).json({
        error:
          'No tienes permiso para actualizar la asistencia de otros miembros',
      });
    }

    console.log('✅ Usuario es administrador del grupo');

    // Verificar si el miembro objetivo pertenece al grupo
    const targetMember = group.members.find(
      (member: GroupMember) => member.userId === targetUserId
    );

    if (!targetMember) {
      console.log('⚠️ El usuario objetivo no es miembro del grupo');
      return res.status(404).json({
        error: 'El usuario objetivo no es miembro de este grupo',
        groupId,
        targetUserId,
      });
    }

    console.log('✅ Miembro encontrado:', {
      memberId: targetMember.id,
      userId: targetMember.userId,
    });

    // Validar el estado de asistencia
    const validStatuses = ['CONFIRMED', 'PENDING', 'DECLINED'];
    if (!validStatuses.includes(status)) {
      console.log('⚠️ Estado de asistencia inválido:', status);
      return res.status(400).json({
        error: 'Estado de asistencia inválido',
        validStatuses,
      });
    }

    // Obtener o crear el registro de asistencia para el próximo partido
    const existingAttendance = await prisma.matchAttendance.findUnique({
      where: {
        userId_matchId: {
          userId: targetUserId as string,
          matchId: group.nextMatchId,
        },
      },
    });

    // Actualizar o crear la asistencia para el próximo partido
    let updatedAttendance;

    if (existingAttendance) {
      // Actualizar registro existente
      updatedAttendance = await prisma.matchAttendance.update({
        where: { id: existingAttendance.id },
        data: { status: status },
      });
    } else {
      // Crear nuevo registro de asistencia
      updatedAttendance = await prisma.matchAttendance.create({
        data: {
          userId: targetUserId as string,
          matchId: group.nextMatchId,
          groupId: groupId as string,
          matchDate: nextMatch.date,
          status: status,
        },
      });
    }

    console.log('✅ Asistencia actualizada con éxito:', {
      attendanceId: updatedAttendance.id,
      userId: updatedAttendance.userId,
      matchId: updatedAttendance.matchId,
      newStatus: updatedAttendance.status,
    });

    return res.status(200).json({
      message: 'Asistencia actualizada con éxito',
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error('❌ Error al procesar la solicitud:', error);
    return res.status(500).json({
      error: 'Error interno del servidor al actualizar la asistencia',
    });
  }
}
