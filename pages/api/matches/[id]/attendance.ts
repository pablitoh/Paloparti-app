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
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    // Get status from request body
    const { status } = req.body;
    if (!status || !['CONFIRMED', 'PENDING', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the match to find the group and date
    const match = await prisma.match.findUnique({
      where: { id },
      select: { groupId: true, date: true },
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
    const existingAttendance = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "MatchAttendance" 
      WHERE "userId" = ${user.id} AND "matchId" = ${id}
      LIMIT 1
    `;

    let attendanceResult;

    if (existingAttendance && existingAttendance.length > 0) {
      // Update existing attendance record
      attendanceResult = await prisma.$executeRaw`
        UPDATE "MatchAttendance"
        SET status = ${status}, "updatedAt" = NOW()
        WHERE id = ${existingAttendance[0].id}
      `;
    } else {
      // Create new attendance record
      attendanceResult = await prisma.$executeRaw`
        INSERT INTO "MatchAttendance" (
          id, "userId", "matchId", "groupId", "matchDate", status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${user.id}, ${id}, ${match.groupId}, ${match.date}, ${status}, NOW(), NOW()
        )
      `;
    }

    return res.status(200).json({
      success: true,
      message: `Attendance ${status.toLowerCase()} successfully`,
      updated: attendanceResult > 0,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
