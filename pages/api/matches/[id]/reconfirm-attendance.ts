import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { PlayerRole, normalizePlayerRoles } from '../../../../lib/teambuilder';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';

// Type assertion to ensure PLAYER_ROLES values match PlayerRoleType
const TYPED_ROLES = {
  GOALKEEPER: 'Arquero' as const,
  DEFENDER: 'Defensor' as const,
  MIDFIELDER: 'Mediocampo' as const,
  FORWARD: 'Delantero' as const,
  WILDCARD: 'Comodín' as const,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query; // match ID
    const { playerRoles: rawPlayerRoles } = req.body;
    const user = session.user;

    console.log('======= RECONFIRM ATTENDANCE API =======');
    console.log('USER ID:', user.id);
    console.log('MATCH ID:', id);
    console.log('RAW PLAYER ROLES:', rawPlayerRoles);

    // Validar y procesar playerRoles
    let validatedRoles: PlayerRole[] = [];
    if (rawPlayerRoles && rawPlayerRoles.length > 0) {
      // Normalizar roles (convierte formato antiguo si es necesario)
      validatedRoles = normalizePlayerRoles(rawPlayerRoles);
      console.log('ROLES NORMALIZADOS:', validatedRoles);
    } else {
      // Si no se proporcionan roles, usar valor por defecto
      validatedRoles = [{ role: TYPED_ROLES.WILDCARD, priority: 1 }];
      console.log('USANDO VALOR DEFAULT:', validatedRoles);
    }

    // Obtener el partido
    const match = await prisma.match.findUnique({
      where: { id: String(id) },
      select: {
        groupId: true,
        date: true,
        status: true,
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status !== 'PENDING') {
      return res
        .status(400)
        .json({ error: 'Cannot update attendance for completed match' });
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

    // Verificar que ya tenga asistencia confirmada
    const existingAttendance = await prisma.matchAttendance.findFirst({
      where: {
        userId: user.id,
        matchId: String(id),
        status: 'CONFIRMED',
      },
    });

    if (!existingAttendance) {
      return res.status(400).json({
        error: 'User must have confirmed attendance first',
        message: 'Debes confirmar asistencia antes de actualizar roles',
      });
    }

    // Actualizar playerRoles directamente en MatchAttendance
    try {
      await prisma.matchAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          playerRoles: validatedRoles,
          updatedAt: new Date(),
        },
      });

      console.log(
        '✅ playerRoles actualizado correctamente en MatchAttendance'
      );
    } catch (error) {
      console.error('❌ Error al actualizar playerRoles:', error);
      return res.status(500).json({
        error: 'Failed to update player roles',
        message: 'Error al actualizar roles del jugador',
      });
    }

    // Registrar en el log
    await logGroupEvent(
      match.groupId,
      user.id,
      LogAction.USER_ATTENDANCE_UPDATED,
      {
        matchId: String(id),
        status: 'RECONFIRMED',
        playerRoles: validatedRoles.map((role) => role.role).join(', '),
        action: 'role_update',
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Roles actualizados correctamente',
      playerRoles: validatedRoles,
      userId: user.id,
    });
  } catch (error) {
    console.error('Error in reconfirm attendance API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
