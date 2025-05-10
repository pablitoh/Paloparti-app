import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Intenta obtener todos los grupos con sus relaciones
    const groups = await prisma.group.findMany({
      take: 1,
      include: {
        creator: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    // Verificar si la relación nextMatchRef existe
    const schema = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Group'
    `;

    // Verificar si podemos actualizar un grupo con nextMatchId
    const firstGroupId = groups[0]?.id;

    let updateResult = null;
    if (firstGroupId) {
      try {
        // Primero crear un match para usar como nextMatch
        const newMatch = await prisma.match.create({
          data: {
            date: new Date(),
            location: 'Test Location',
            groupId: firstGroupId,
            teamA: 'Team A Test',
            teamB: 'Team B Test',
            status: 'PENDING',
          },
        });

        // Actualizar el grupo con la relación
        updateResult = await prisma.$executeRaw`
          UPDATE "Group"
          SET "nextMatchId" = ${newMatch.id}
          WHERE "id" = ${firstGroupId}
        `;
      } catch (updateError) {
        updateResult = {
          error: `Error al actualizar: ${updateError}`,
        };
      }
    }

    // Obtener grupo actualizado
    const updatedGroup = firstGroupId
      ? await prisma.group.findUnique({
          where: { id: firstGroupId },
        })
      : null;

    res.status(200).json({
      message: 'Test de integración',
      groupCount: groups.length,
      firstGroup: groups[0] || null,
      schema,
      updateResult,
      updatedGroup,
    });
  } catch (error) {
    console.error('Error en la verificación:', error);
    res.status(500).json({
      error: 'Error de servidor',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
