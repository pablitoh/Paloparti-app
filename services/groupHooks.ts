import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { showSuccessToast, showErrorToast } from './toastService';
import { parseTbdPlayers } from './reactQueryHooks';

// Funciones para los endpoints
const fetchGroupBasicInfo = async (groupId: string) => {
  const response = await fetch(`/api/groups/${groupId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener información del grupo');
  }
  return response.json();
};

const fetchGroupNextMatch = async (groupId: string) => {
  const response = await fetch(`/api/groups/${groupId}/next-match`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener próximo partido');
  }
  const data = await response.json();

  // Ensure TBD players are properly formatted
  if (data.nextMatchDetails) {
    data.nextMatchDetails = parseTbdPlayers(data.nextMatchDetails);
  }

  return data;
};

const fetchGroupMembers = async (groupId: string) => {
  const response = await fetch(`/api/groups/${groupId}/members`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener miembros del grupo');
  }
  return response.json();
};

const fetchGroupStats = async (groupId: string) => {
  const response = await fetch(`/api/groups/${groupId}/stats`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener estadísticas del grupo');
  }
  return response.json();
};

const fetchGroupHistory = async (groupId: string, page = 1, limit = 10) => {
  const response = await fetch(
    `/api/groups/${groupId}/history?page=${page}&limit=${limit}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener historial de partidos');
  }
  return response.json();
};

// Hooks para consumir los endpoints

// Hook para obtener información básica del grupo
export const useGroupBasicInfo = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['group', 'basic', groupId],
    queryFn: () => fetchGroupBasicInfo(groupId as string),
    enabled: !!groupId,
  });
};

// Hook para obtener el próximo partido del grupo
export const useGroupNextMatch = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['group', 'nextMatch', groupId],
    queryFn: () => fetchGroupNextMatch(groupId as string),
    enabled: !!groupId,
  });
};

// Hook para obtener los miembros del grupo
export const useGroupMembers = (
  groupId: string | undefined,
  options?: { enabled?: boolean }
) => {
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  return useQuery({
    queryKey: ['group', 'members', groupId],
    queryFn: () => fetchGroupMembers(groupId as string),
    enabled,
  });
};

// Hook para obtener las estadísticas del grupo
export const useGroupStats = (
  groupId: string | undefined,
  options?: { enabled?: boolean }
) => {
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  return useQuery({
    queryKey: ['group', 'stats', groupId],
    queryFn: () => fetchGroupStats(groupId as string),
    enabled,
  });
};

// Hook para obtener el historial de partidos con paginación
export const useGroupHistory = (
  groupId: string | undefined,
  page = 1,
  limit = 10,
  options?: { enabled?: boolean }
) => {
  const queryClient = useQueryClient();
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!groupId : !!groupId;

  return useQuery({
    queryKey: ['group', 'history', groupId, page, limit],
    queryFn: () => fetchGroupHistory(groupId as string, page, limit),
    enabled,
    // Usar placeholderData en lugar de keepPreviousData para React Query v5
    placeholderData: (previousData) => previousData,
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
      // Invalidar consultas relacionadas
      const matchId = variables.matchId;
      queryClient.invalidateQueries({ queryKey: ['group', 'nextMatch'] });

      // Mensaje personalizado según el estado seleccionado
      let message = '';
      if (variables.status === 'CONFIRMED') {
        message = '¡Tu asistencia ha sido confirmada!';
      } else if (variables.status === 'DECLINED') {
        message = 'Has rechazado la asistencia al partido';
      } else {
        message = 'Tu estado de asistencia ha sido actualizado';
      }
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
      // More specific query invalidation using groupId when available
      if (variables.groupId) {
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', variables.groupId],
        });
      } else {
        // Fallback to more general invalidation if no groupId is provided
        queryClient.invalidateQueries({ queryKey: ['group', 'nextMatch'] });
      }

      showSuccessToast('Asistencia actualizada correctamente');
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
      queryClient.invalidateQueries({
        queryKey: ['group', 'members', variables.groupId],
      });

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
