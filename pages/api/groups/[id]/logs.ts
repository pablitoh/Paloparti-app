import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../../lib/prisma';
import { getGroupLogs } from '../../../../utils/serverLogEvents';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id: groupId } = req.query;

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ message: 'ID de grupo inválido' });
  }

  try {
    // Verificar si el usuario es miembro del grupo
    const userMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.user.id,
        },
      },
    });

    if (!userMembership) {
      return res.status(403).json({ message: 'No eres miembro de este grupo' });
    }

    // Obtener los parámetros de paginación
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    // Obtener los logs del grupo
    const logs = await getGroupLogs(groupId, page, pageSize);

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error al obtener logs del grupo:', error);
    return res.status(500).json({ message: 'Error al obtener logs del grupo' });
  }
}
