import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';
import { PLAYER_ROLES } from '../../../../components/group/AttendanceConfirmation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get match ID from URL
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    // Get status and playerRoles from request body
    const { status, playerRoles } = req.body;

    // Logging exhaustivo para debugging
    console.log('======= BACKEND API ATTENDANCE =======');
    console.log('USER ID:', user.id);
    console.log('MATCH ID:', id);
    console.log('BODY COMPLETO:', req.body);
    console.log('STATUS:', status);
    console.log('PLAYER ROLES:', playerRoles);
    console.log('PLAYER ROLES TYPE:', typeof playerRoles);
    console.log('PLAYER ROLES IS ARRAY:', Array.isArray(playerRoles));
    if (Array.isArray(playerRoles)) {
      console.log('PLAYER ROLES LENGTH:', playerRoles.length);
      console.log('PLAYER ROLES CONTENT:', JSON.stringify(playerRoles));
    }

    if (!status || !['CONFIRMED', 'PENDING', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Validar y procesar playerRoles
    let validatedRoles: string[] = [];
    if (status === 'CONFIRMED') {
      // Usar exactamente los roles que llegaron, si es un array
      if (Array.isArray(playerRoles) && playerRoles.length > 0) {
        // Hacer una copia para evitar mutaciones
        validatedRoles = [...playerRoles];

        console.log('USANDO ROLES DEL CLIENTE:', validatedRoles);
      } else {
        // Si no es un array o está vacío, usar el valor por defecto
        validatedRoles = [PLAYER_ROLES.WILDCARD];
        console.log(
          'NO ES ARRAY O ESTÁ VACÍO - USANDO VALOR DEFAULT:',
          validatedRoles
        );
      }
    }

    console.log('ROLES VALIDADOS FINAL:', validatedRoles);

    // Get the match to find the group and date
    const match = await prisma.match.findUnique({
      where: { id },
      select: { groupId: true, date: true, tbdPlayers: true },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if the user is a member of the group associated with the match
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: user.id,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: 'User is not a member of this group' });
    }

    // Check if there's already an attendance record for this user and match
    const existingAttendance = await prisma.matchAttendance.findFirst({
      where: {
        userId: user.id,
        matchId: id,
      },
    });

    let attendanceResult;

    // Actualizar TBD players para almacenar los roles (ya que no tenemos campo metadata)
    if (status === 'CONFIRMED' && validatedRoles.length > 0) {
      try {
        // Obtener TBD players actuales o inicializar objeto vacío
        let tbdPlayers = match.tbdPlayers
          ? typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers as string)
            : match.tbdPlayers
          : {};

        // Asegurarnos de que tbdPlayers tenga la estructura correcta
        if (!tbdPlayers.playerRoles) {
          tbdPlayers.playerRoles = {};
        }

        // Guardar los roles del jugador usando su ID como clave
        tbdPlayers.playerRoles[user.id] = validatedRoles;
        console.log('Guardando roles en tbdPlayers:', tbdPlayers);

        // Actualizar el campo tbdPlayers en la tabla Match
        await prisma.match.update({
          where: { id },
          data: {
            tbdPlayers: tbdPlayers,
          },
        });

        console.log('tbdPlayers actualizado correctamente');
      } catch (error) {
        console.error('Error al actualizar tbdPlayers:', error);
      }
    }

    if (existingAttendance) {
      // Update existing attendance record
      attendanceResult = await prisma.matchAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });
      console.log('Registro de asistencia ACTUALIZADO:', attendanceResult);
    } else {
      // Create new attendance record
      attendanceResult = await prisma.matchAttendance.create({
        data: {
          userId: user.id,
          matchId: id,
          groupId: match.groupId,
          matchDate: match.date,
          status,
        },
      });
      console.log('Registro de asistencia CREADO:', attendanceResult);
    }

    // Registrar la acción en los logs del grupo
    await logGroupEvent(
      match.groupId,
      user.id,
      LogAction.USER_ATTENDANCE_UPDATED,
      {
        matchId: id,
        status,
        playerRoles: validatedRoles,
      }
    );

    console.log('======= FIN BACKEND API ATTENDANCE =======');

    return res.status(200).json({
      success: true,
      message: `Attendance ${status.toLowerCase()} successfully`,
      updated: !!attendanceResult,
      playerRoles: validatedRoles,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
