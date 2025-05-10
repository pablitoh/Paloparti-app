import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { logGroupEvent } from '../../utils/serverLogEvents';
import { LogAction } from '../../utils/logTypes';

interface ConfirmedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
}

/**
 * API endpoint for managing attendance to matches
 * This API only handles attendance at the match level, not group membership
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { userId, groupId, matchId, status } = req.body;

    // Validate required fields
    if (!matchId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Default userId to the authenticated user if not provided
    const targetUserId = userId || session.user.id;

    // Validate status format
    if (!['CONFIRMED', 'DECLINED', 'PENDING'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    // Fetch match and group info in a single query
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        groupId: true,
        date: true,
        group: {
          select: {
            members: {
              where: {
                OR: [
                  { userId: targetUserId },
                  { userId: session.user.id, role: 'ADMIN' },
                ],
              },
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const targetGroupId = groupId || match.groupId;
    const members = match.group.members;

    // Check if user is a member and if requester is admin (if updating other's attendance)
    const targetMember = members.find(
      (m: { userId: string }) => m.userId === targetUserId
    );
    const isAdmin =
      session.user.id === targetUserId ||
      members.some(
        (m: { userId: string; role: string }) =>
          m.userId === session.user.id && m.role === 'ADMIN'
      );

    if (!targetMember) {
      return res
        .status(404)
        .json({ message: 'User is not a member of this group' });
    }

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only group admins can modify other members' attendance",
      });
    }

    // Upsert attendance record in a single query
    const attendance = await prisma.matchAttendance.upsert({
      where: {
        userId_matchId: {
          userId: targetUserId,
          matchId: matchId,
        },
      },
      update: {
        status: status,
        updatedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        matchId: matchId,
        groupId: targetGroupId,
        matchDate: match.date,
        status: status,
      },
    });

    // Registrar la acción en el log
    try {
      // Si el usuario está actualizando su propia asistencia
      if (session.user.id === targetUserId) {
        await logGroupEvent(
          targetGroupId,
          session.user.id,
          LogAction.USER_ATTENDANCE_UPDATED,
          {
            matchId,
            status,
          }
        );
      } else {
        // Si un administrador está actualizando la asistencia de otro usuario
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, name: true },
        });

        await logGroupEvent(
          targetGroupId,
          session.user.id,
          LogAction.ADMIN_ATTENDANCE_UPDATED,
          {
            matchId,
            userId: targetUserId,
            userName: targetUser?.name,
            status,
          }
        );
      }
    } catch (logError) {
      console.error('Error logging attendance update:', logError);
      // No interrumpimos el flujo principal si falla el log
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      attendance,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
