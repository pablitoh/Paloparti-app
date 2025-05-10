import { prisma } from '../lib/prisma';
import { LogAction } from './logTypes';

/**
 * Registra un evento en el log del grupo
 * @param groupId - ID del grupo
 * @param userId - ID del usuario que realiza la acción
 * @param action - Tipo de acción del enum LogAction
 * @param details - Detalles adicionales de la acción en formato JSON
 */
export async function logGroupEvent(
  groupId: string,
  userId: string,
  action: LogAction,
  details: any = {}
) {
  try {
    await prisma.groupLog.create({
      data: {
        groupId,
        userId,
        action,
        details,
      },
    });
  } catch (error) {
    console.error('Error al registrar evento en el log:', error);
    // No lanzamos el error para no interrumpir el flujo principal
  }
}

/**
 * Obtiene los logs de un grupo con paginación
 * @param groupId - ID del grupo
 * @param page - Número de página (empieza en 1)
 * @param pageSize - Tamaño de página
 */
export async function getGroupLogs(
  groupId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;

  try {
    const [logs, total] = await Promise.all([
      prisma.groupLog.findMany({
        where: {
          groupId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      prisma.groupLog.count({
        where: {
          groupId,
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  } catch (error) {
    console.error('Error al obtener los logs del grupo:', error);
    throw error;
  }
}
