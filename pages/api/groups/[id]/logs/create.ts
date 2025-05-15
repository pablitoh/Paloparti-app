import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { LogAction } from '../../../../../utils/logTypes';
import { getCurrentUser } from '../../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Verify user is authenticated using getCurrentUser instead of getSession
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id: groupId } = req.query;
  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ message: 'ID de grupo inválido' });
  }

  // Extract data from request body
  const {
    action,
    performedBy,
    performedByName,
    targetUserId,
    targetUserName,
    details,
  } = req.body;

  try {
    // Verify the user is a member of the group
    const userMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!userMembership) {
      return res.status(403).json({ message: 'No eres miembro de este grupo' });
    }

    // Create the log entry
    const logEntry = await prisma.groupLog.create({
      data: {
        groupId,
        userId: performedBy,
        action,
        details: {
          ...details,
          targetUserId,
          targetUserName,
          performedByName,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Log creado correctamente',
      logEntry,
    });
  } catch (error) {
    console.error('Error al crear log:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear log',
    });
  }
}
