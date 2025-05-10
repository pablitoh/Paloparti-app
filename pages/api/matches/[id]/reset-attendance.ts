import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

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
    const { id: matchId } = req.query;
    if (!matchId || typeof matchId !== 'string') {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    // Get the match to find the group
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        groupId: true,
        id: true,
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if the user is an admin of the group
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: 'Only group admins can reset attendance status' });
    }

    // Reset all attendance statuses for this match to PENDING
    const result = await prisma.matchAttendance.updateMany({
      where: {
        matchId: matchId,
      },
      data: {
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    console.log(
      `Admin ${user.id} reset attendance statuses for match ${matchId}, ${result.count} records updated`
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance statuses reset successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Error resetting attendance statuses:', error);
    return res
      .status(500)
      .json({ error: 'Failed to reset attendance statuses' });
  }
}
