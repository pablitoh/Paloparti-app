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
 * @param actionType - Tipo de acción para filtrar (opcional)
 */
export async function getGroupLogs(
  groupId: string,
  page: number = 1,
  pageSize: number = 20,
  actionType?: string
) {
  const skip = (page - 1) * pageSize;

  // Preparar el filtro para las acciones
  let whereCondition: any = { groupId };

  // Si se especifica un tipo de acción, filtrar por ese tipo
  if (actionType) {
    // Mapeamos los grupos de acciones a las acciones específicas
    const actionMap: Record<string, string[]> = {
      match: [
        LogAction.MATCH_CREATED,
        LogAction.MATCH_EDITED,
        LogAction.MATCH_DELETED,
        LogAction.MATCH_COMPLETED,
        LogAction.MATCH_RESULT_ADDED,
        LogAction.MATCH_RESULT_EDITED,
      ],
      attendance: [
        LogAction.USER_ATTENDANCE_UPDATED,
        LogAction.ADMIN_ATTENDANCE_UPDATED,
        LogAction.ATTENDANCE_RESET,
      ],
      members: [
        LogAction.USER_JOINED,
        LogAction.USER_LEFT,
        LogAction.USER_ROLE_CHANGED,
        LogAction.STAR_RATING_UPDATED,
        LogAction.MEMBER_RATING_UPDATED,
      ],
      teams: [
        LogAction.TEAM_SORTED,
        LogAction.TEAM_RESORTED,
        LogAction.PLAYER_REPLACED,
      ],
    };

    // Si es un tipo de acción específico, filtrar por ese grupo
    if (actionMap[actionType]) {
      whereCondition.action = {
        in: actionMap[actionType],
      };
    }
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.groupLog.findMany({
        where: whereCondition,
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
        where: whereCondition,
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
