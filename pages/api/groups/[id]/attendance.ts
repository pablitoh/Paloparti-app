import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    console.log('Método no permitido:', req.method);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Autenticar usuario
    const user = await getCurrentUser(req);
    if (!user) {
      console.log('No hay usuario autenticado');
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Obtener ID del grupo de la URL
    const { id: groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      console.log('ID de grupo inválido:', groupId);
      return res.status(400).json({ error: 'ID de grupo inválido' });
    }

    // Obtener estado de la solicitud
    const { status } = req.body;
    if (!status || !['CONFIRMED', 'DECLINED', 'PENDING'].includes(status)) {
      console.log('Estado inválido:', status);
      return res.status(400).json({ error: 'Estado inválido' });
    }

    console.log('Request to update attendance:', {
      userId: user.id,
      groupId,
      status,
      requestBody: req.body,
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization ? 'Present' : 'Missing',
      },
    });

    // Verificar si el usuario es miembro del grupo
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id,
      },
    });

    if (!member) {
      console.log('Usuario no es miembro del grupo:', {
        userId: user.id,
        groupId,
      });
      return res.status(404).json({ error: 'No eres miembro de este grupo' });
    }

    console.log('Found member:', {
      memberId: member.id,
      userId: member.userId,
      groupId: member.groupId,
      currentStatus: member.status,
      newStatus: status,
    });

    // Obtener información del grupo para saber el próximo partido
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      console.log('Grupo no encontrado');
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // El campo nextMatchId puede no estar tipado correctamente pero existe en la DB
    const nextMatchId = (group as any).nextMatchId;

    if (!nextMatchId) {
      console.log('Grupo no tiene próximo partido configurado');
      return res
        .status(404)
        .json({ error: 'El grupo no tiene un próximo partido programado' });
    }

    try {
      // Actualizar el estado de asistencia del usuario en el grupo
      const updatedMember = await prisma.groupMember.update({
        where: {
          id: member.id,
        },
        data: {
          status: status,
        },
      });

      // Actualizar también el registro de asistencia al próximo partido específico
      const attendanceRecord = await prisma.matchAttendance.findFirst({
        where: {
          groupId: groupId,
          userId: user.id,
          matchId: nextMatchId,
        },
      });

      if (attendanceRecord) {
        // Actualizar el registro existente
        await prisma.matchAttendance.update({
          where: { id: attendanceRecord.id },
          data: { status: status },
        });
      } else {
        // Obtener la fecha del partido para el registro
        const matchDetails = await prisma.match.findUnique({
          where: { id: nextMatchId },
          select: { date: true },
        });

        // Crear un nuevo registro de asistencia si no existe
        await prisma.matchAttendance.create({
          data: {
            groupId: groupId,
            userId: user.id,
            matchId: nextMatchId,
            matchDate: matchDetails?.date || new Date(),
            status: status,
          },
        });
      }

      console.log('Updated member status:', {
        memberId: updatedMember.id,
        status: updatedMember.status,
        userId: updatedMember.userId,
        previousStatus: member.status,
        matchAttendanceUpdated: true,
      });

      console.log(
        `Usuario ${user.id} ha actualizado su asistencia de ${member.status} a ${status} en el grupo ${groupId} y para el próximo partido ${nextMatchId}`
      );

      return res.status(200).json({
        success: true,
        status: status.toLowerCase(),
        previousStatus: member.status,
        message: `Asistencia actualizada a ${status.toLowerCase()}`,
      });
    } catch (prismaError) {
      console.error('Error en Prisma al actualizar asistencia:', prismaError);
      return res.status(500).json({
        error: 'Error al actualizar asistencia en la base de datos',
        details: prismaError,
      });
    }
  } catch (error) {
    console.error('Error al actualizar asistencia al grupo:', error);
    return res.status(500).json({
      error: 'Error al actualizar asistencia',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
