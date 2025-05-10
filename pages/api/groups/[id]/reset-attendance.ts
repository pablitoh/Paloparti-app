import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

// Define an interface that includes the nextMatchId field from the schema
interface GroupWithNextMatch {
  id: string;
  nextMatchId?: string | null;
  [key: string]: any; // To allow for other properties
}

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

    // Get group ID from URL
    const { id: groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check if the user is an admin of the group
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: 'Only group admins can reset attendance status' });
    }

    // Find the group and cast it to our interface
    const group = (await prisma.group.findUnique({
      where: { id: groupId },
    })) as GroupWithNextMatch | null;

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.nextMatchId) {
      return res.status(404).json({ error: 'No next match found for group' });
    }

    // Reset all attendance statuses for the next match to PENDING
    const result = await prisma.matchAttendance.updateMany({
      where: {
        matchId: group.nextMatchId,
      },
      data: {
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    console.log(
      `Admin ${user.id} reset attendance statuses for next match ${group.nextMatchId} in group ${groupId}, ${result.count} records updated`
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
