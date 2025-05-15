import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { showSuccessToast, showErrorToast } from './toastService';
import { parseTbdPlayers } from './reactQueryHooks';
import { GroupLogsResponse } from '../utils/logTypes';
import { fetchGroupLogs } from '../lib/client';

// Default query options to prevent duplicate requests and unnecessary fetching
const defaultQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  retry: 1, // Only retry once on failure
  staleTime: 5 * 60 * 1000, // 5 minutes by default
  cacheTime: 10 * 60 * 1000, // 10 minutes cache time
};

// Cache for network requests to prevent duplicates during same render cycle
const pendingRequestsCache = new Map();

// Funciones para los endpoints
const fetchGroupBasicInfo = async (groupId: string) => {
  // Deduplicate network requests with AbortController and request cache
  const cacheKey = `basic_${groupId}`;

  // Check if there's already a pending request for this resource
  if (pendingRequestsCache.has(cacheKey)) {
    return pendingRequestsCache.get(cacheKey);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Create promise and store in cache
    const requestPromise = fetch(`/api/groups/${groupId}`, { signal })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((error) => {
            throw new Error(
              error.message || 'Error al obtener información del grupo'
            );
          });
        }
        return response.json();
      })
      .finally(() => {
        // Remove from cache once complete
        pendingRequestsCache.delete(cacheKey);
      });

    // Store the promise in the cache
    pendingRequestsCache.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    pendingRequestsCache.delete(cacheKey);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted', groupId);
    }
    throw error;
  }
};

const fetchGroupNextMatch = async (groupId: string) => {
  // Deduplicate network requests with AbortController and request cache
  const cacheKey = `nextMatch_${groupId}`;

  // Check if there's already a pending request for this resource
  if (pendingRequestsCache.has(cacheKey)) {
    return pendingRequestsCache.get(cacheKey);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Create promise and store in cache
    const requestPromise = fetch(`/api/groups/${groupId}/next-match`, {
      signal,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((error) => {
            throw new Error(
              error.message || 'Error al obtener próximo partido'
            );
          });
        }
        return response.json().then((data) => {
          // Ensure TBD players are properly formatted
          if (data.nextMatchDetails) {
            data.nextMatchDetails = parseTbdPlayers(data.nextMatchDetails);
          }
          return data;
        });
      })
      .finally(() => {
        // Remove from cache once complete
        pendingRequestsCache.delete(cacheKey);
      });

    // Store the promise in the cache
    pendingRequestsCache.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    pendingRequestsCache.delete(cacheKey);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted', groupId);
    }
    throw error;
  }
};

const fetchGroupMembers = async (groupId: string) => {
  // Deduplicate network requests with AbortController and request cache
  const cacheKey = `members_${groupId}`;

  // Check if there's already a pending request for this resource
  if (pendingRequestsCache.has(cacheKey)) {
    return pendingRequestsCache.get(cacheKey);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Create promise and store in cache
    const requestPromise = fetch(`/api/groups/${groupId}/members`, { signal })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((error) => {
            throw new Error(
              error.message || 'Error al obtener miembros del grupo'
            );
          });
        }
        return response.json();
      })
      .finally(() => {
        // Remove from cache once complete
        pendingRequestsCache.delete(cacheKey);
      });

    // Store the promise in the cache
    pendingRequestsCache.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    pendingRequestsCache.delete(cacheKey);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted', groupId);
    }
    throw error;
  }
};

const fetchGroupStats = async (groupId: string) => {
  // Deduplicate network requests with AbortController and request cache
  const cacheKey = `stats_${groupId}`;

  // Check if there's already a pending request for this resource
  if (pendingRequestsCache.has(cacheKey)) {
    return pendingRequestsCache.get(cacheKey);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Create promise and store in cache
    const requestPromise = fetch(`/api/groups/${groupId}/stats`, { signal })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((error) => {
            throw new Error(
              error.message || 'Error al obtener estadísticas del grupo'
            );
          });
        }
        return response.json();
      })
      .finally(() => {
        // Remove from cache once complete
        pendingRequestsCache.delete(cacheKey);
      });

    // Store the promise in the cache
    pendingRequestsCache.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    pendingRequestsCache.delete(cacheKey);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted', groupId);
    }
    throw error;
  }
};

const fetchGroupHistory = async (groupId: string, page = 1, limit = 10) => {
  // Deduplicate network requests with AbortController and request cache
  const cacheKey = `history_${groupId}_${page}_${limit}`;

  // Check if there's already a pending request for this resource
  if (pendingRequestsCache.has(cacheKey)) {
    return pendingRequestsCache.get(cacheKey);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    // Create promise and store in cache
    const requestPromise = fetch(
      `/api/groups/${groupId}/history?page=${page}&limit=${limit}`,
      { signal }
    )
      .then((response) => {
        if (!response.ok) {
          return response.json().then((error) => {
            throw new Error(
              error.message || 'Error al obtener historial de partidos'
            );
          });
        }
        return response.json();
      })
      .finally(() => {
        // Remove from cache once complete
        pendingRequestsCache.delete(cacheKey);
      });

    // Store the promise in the cache
    pendingRequestsCache.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    pendingRequestsCache.delete(cacheKey);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted', groupId);
    }
    throw error;
  }
};

// Hooks para consumir los endpoints

// Hook para obtener información básica del grupo
export const useGroupBasicInfo = (
  groupId: string | undefined,
  options = {}
) => {
  return useQuery({
    queryKey: ['group', 'basic', groupId],
    queryFn: () => fetchGroupBasicInfo(groupId as string),
    enabled: !!groupId,
    ...defaultQueryOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes for basic group info
    ...options,
  });
};

// Hook para obtener el próximo partido del grupo
export const useGroupNextMatch = (groupId?: string, options?: any) => {
  return useQuery({
    queryKey: ['group', 'nextMatch', groupId],
    queryFn: async () => {
      if (!groupId) throw new Error('Group ID is required');
      const response = await fetch(`/api/groups/${groupId}/next-match`);
      if (!response.ok) {
        throw new Error('Failed to fetch next match');
      }
      return response.json();
    },
    enabled: !!groupId,
    staleTime: 30 * 1000, // 30 segundos de stale time
    gcTime: 5 * 60 * 1000, // 5 minutos de tiempo de caché
    refetchOnWindowFocus: true, // Permitir refetch al enfocar la ventana
    refetchOnMount: true, // Permitir refetch al montar el componente
    refetchOnReconnect: true, // Permitir refetch al reconectar
    retry: 1,
    ...options,
  });
};

// Hook para obtener los miembros del grupo
export const useGroupMembers = (
  groupId: string | undefined,
  options?: { enabled?: boolean } & Record<string, any>
) => {
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  const { enabled: _, ...restOptions } = options || {};

  return useQuery({
    queryKey: ['group', 'members', groupId],
    queryFn: () => fetchGroupMembers(groupId as string),
    enabled,
    ...defaultQueryOptions,
    staleTime: 2 * 60 * 1000, // 2 minutes for members data
    ...restOptions,
  });
};

// Hook para obtener las estadísticas del grupo
export const useGroupStats = (
  groupId: string | undefined,
  options?: { enabled?: boolean } & Record<string, any>
) => {
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  const { enabled: _, ...restOptions } = options || {};

  return useQuery({
    queryKey: ['group', 'stats', groupId],
    queryFn: () => fetchGroupStats(groupId as string),
    enabled,
    ...defaultQueryOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes, stats don't change as often
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...restOptions,
  });
};

// Hook para obtener el historial de partidos con paginación
export const useGroupHistory = (
  groupId: string | undefined,
  page = 1,
  limit = 10,
  options?: { enabled?: boolean } & Record<string, any>
) => {
  const queryClient = useQueryClient();
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  const { enabled: _, ...restOptions } = options || {};

  return useQuery({
    queryKey: ['group', 'history', groupId, page, limit],
    queryFn: () => fetchGroupHistory(groupId as string, page, limit),
    enabled,
    ...defaultQueryOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes, history doesn't change as often
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Usar placeholderData en lugar de keepPreviousData para React Query v5
    placeholderData: (previousData) => previousData,
    ...restOptions,
  });
};

// Mutaciones para actualizar datos del grupo

// Mutación para actualizar asistencia de usuario
export const useUserAttendanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      status,
      groupId,
    }: {
      matchId: string;
      status: string;
      groupId?: string;
    }) => {
      const response = await fetch('/api/attendances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          status,
          groupId,
          userId:
            (queryClient.getQueryData(['auth', 'user']) as any)?.id ||
            undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar asistencia');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Actualizar el caché directamente
      const queryKey = ['group', 'nextMatch', variables.groupId];
      const currentData = queryClient.getQueryData(queryKey);

      if (currentData) {
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData) return oldData;

          // Actualizar el estado de asistencia del usuario actual
          const updatedData = {
            ...oldData,
            userAttendance: variables.status,
            nextMatchDetails: {
              ...oldData.nextMatchDetails,
              confirmedPlayers: oldData.nextMatchDetails.confirmedPlayers.map(
                (player: any) => {
                  if (
                    player.id ===
                    (queryClient.getQueryData(['auth', 'user']) as any)?.id
                  ) {
                    return {
                      ...player,
                      status: variables.status,
                    };
                  }
                  return player;
                }
              ),
            },
          };

          return updatedData;
        });
      }

      // Mensaje personalizado según el estado
      const message =
        variables.status === 'CONFIRMED'
          ? '¡Tu asistencia ha sido confirmada!'
          : variables.status === 'DECLINED'
          ? 'Has rechazado la asistencia al partido'
          : 'Tu estado de asistencia ha sido actualizado';

      showSuccessToast(message);
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al actualizar asistencia');
    },
  });
};

// Mutación para que el admin actualice asistencia de un usuario
export const useAdminAttendanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      matchId,
      status,
      groupId,
    }: {
      userId: string;
      matchId: string;
      status: string;
      groupId?: string;
    }) => {
      const response = await fetch('/api/attendances/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          matchId,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar asistencia');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Actualizar el caché directamente
      const queryKey = ['group', 'nextMatch', variables.groupId];
      const currentData = queryClient.getQueryData(queryKey);

      if (currentData) {
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData) return oldData;

          // Actualizar el estado de asistencia del usuario
          const updatedData = {
            ...oldData,
            nextMatchDetails: {
              ...oldData.nextMatchDetails,
              confirmedPlayers: oldData.nextMatchDetails.confirmedPlayers.map(
                (player: any) => {
                  if (player.id === variables.userId) {
                    return {
                      ...player,
                      status: variables.status,
                    };
                  }
                  return player;
                }
              ),
            },
          };

          return updatedData;
        });
      }

      // Mensaje personalizado según el estado
      const statusMessage =
        variables.status === 'CONFIRMED'
          ? 'confirmada'
          : variables.status === 'DECLINED'
          ? 'cancelada'
          : 'actualizada a pendiente';

      showSuccessToast(`Asistencia de jugador ${statusMessage} correctamente`);
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al actualizar asistencia');
    },
  });
};

// Mutación para gestionar solicitudes de membresía
export const useMembershipRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      action,
    }: {
      groupId: string;
      userId: string;
      action: 'APPROVE' | 'REJECT';
    }) => {
      const response = await fetch(`/api/groups/${groupId}/member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al gestionar solicitud');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Actualizar el caché de miembros
      const queryKey = ['group', 'members', variables.groupId];
      const currentData = queryClient.getQueryData(queryKey);

      if (currentData) {
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData) return oldData;

          // Filtrar la solicitud procesada
          const updatedData = {
            ...oldData,
            pendingRequests: oldData.pendingRequests.filter(
              (request: any) => request.userId !== variables.userId
            ),
          };

          return updatedData;
        });
      }

      const message =
        variables.action === 'APPROVE'
          ? 'Solicitud aprobada correctamente'
          : 'Solicitud rechazada correctamente';

      showSuccessToast(message);
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al gestionar solicitud');
    },
  });
};

/**
 * Hook para obtener los logs del grupo
 */
export function useGroupLogs(
  groupId: string,
  page: number = 1,
  pageSize: number = 20,
  options = {},
  actionType?: string
) {
  return useQuery({
    queryKey: ['group', 'logs', groupId, page, pageSize, actionType],
    queryFn: async () => {
      if (!groupId) return null;
      return await fetchGroupLogs(groupId, page, pageSize, actionType);
    },
    ...options,
  });
}
