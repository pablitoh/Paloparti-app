import { GroupLogsResponse } from '../utils/logTypes';

/**
 * Obtiene los logs de un grupo con paginación
 * @param groupId - ID del grupo
 * @param page - Número de página (empieza en 1)
 * @param pageSize - Tamaño de página
 */
export async function fetchGroupLogs(
  groupId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<GroupLogsResponse> {
  const response = await fetch(
    `/api/groups/${groupId}/logs?page=${page}&pageSize=${pageSize}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener logs del grupo');
  }

  return await response.json();
}
