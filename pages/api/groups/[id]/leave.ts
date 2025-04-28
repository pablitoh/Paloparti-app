import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Get the member record
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
    });

    if (!member) {
      return res
        .status(404)
        .json({ error: 'User is not a member of this group' });
    }

    // If the user is an admin, check if there are other admins
    if (member.role === 'ADMIN') {
      const otherAdmins = await prisma.groupMember.findMany({
        where: {
          groupId,
          role: 'ADMIN',
          userId: { not: user.id },
        },
      });

      // If there are no other admins, promote another member to admin
      if (otherAdmins.length === 0) {
        const otherMembers = await prisma.groupMember.findMany({
          where: {
            groupId,
            userId: { not: user.id },
          },
          take: 1,
        });

        if (otherMembers.length > 0) {
          await prisma.groupMember.update({
            where: { id: otherMembers[0].id },
            data: { role: 'ADMIN' },
          });
        }
      }
    }

    // Delete the member record
    await prisma.groupMember.delete({
      where: { id: member.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully left the group',
    });
  } catch (error) {
    console.error('Error leaving group:', error);
    return res.status(500).json({ error: 'Failed to leave group' });
  }
}
