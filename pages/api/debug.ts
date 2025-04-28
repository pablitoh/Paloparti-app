import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userCount = await prisma.user.count();
    const groupCount = await prisma.group.count();
    const groupMemberCount = await prisma.groupMember.count();

    // Comprobar si el usuario específico existe
    const userId = 'cm97nts270000yq6wjkj42b59'; // El ID del usuario del token
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Comprobar si hay algún grupo para este usuario
    const userGroups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: true,
      },
    });

    return res.status(200).json({
      database: 'connected',
      counts: {
        users: userCount,
        groups: groupCount,
        groupMembers: groupMemberCount,
      },
      user: {
        exists: !!userExists,
        data: userExists,
      },
      userGroups: {
        count: userGroups.length,
        data: userGroups,
      },
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      database: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
