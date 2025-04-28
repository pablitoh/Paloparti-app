import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { showSuccessToast, showErrorToast } from './toastService';
import {
  updateAttendanceAsAdmin,
  updateUserAttendance,
  manageMembershipRequest,
  leaveGroup,
  randomizeTeams,
  deleteMatch,
  replaceTbdPlayer,
  resetAttendance,
  ParticipantStatus,
} from './groupService';

// Parsear jugadores TBD
export const parseTbdPlayers = (match: any) => {
  if (!match) return match;

  let parsedTbdPlayers: any[] = [];

  // Try to parse tbdPlayers if it exists
  if (match.tbdPlayers) {
    try {
      // If it's a string, try to parse as JSON
      if (typeof match.tbdPlayers === 'string') {
        parsedTbdPlayers = JSON.parse(match.tbdPlayers);
      }
      // If it's an object with teamA/teamB, extract and flatten the players
      else if (
        typeof match.tbdPlayers === 'object' &&
        (match.tbdPlayers.teamA || match.tbdPlayers.teamB)
      ) {
        const teamA = Array.isArray(match.tbdPlayers.teamA)
          ? match.tbdPlayers.teamA
          : [];
        const teamB = Array.isArray(match.tbdPlayers.teamB)
          ? match.tbdPlayers.teamB
          : [];

        // Mark players with their team and return as a flat array
        parsedTbdPlayers = [
          ...teamA.map((p: any) => ({
            ...p,
            isTeamA: true,
            playerType: 'TBD',
          })),
          ...teamB.map((p: any) => ({
            ...p,
            isTeamA: false,
            playerType: 'TBD',
          })),
        ];
      }
      // If it's already an array, use it directly
      else if (Array.isArray(match.tbdPlayers)) {
        parsedTbdPlayers = match.tbdPlayers;
      }

      // Ensure each player has the necessary properties
      parsedTbdPlayers = parsedTbdPlayers.map((player: any) => ({
        id:
          player.id ||
          `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: player.name || `TBD Player`,
        avatar: player.avatar || null,
        age: player.age || null,
        playerType: 'TBD',
        isTeamA: typeof player.isTeamA === 'boolean' ? player.isTeamA : true,
      }));
    } catch (error) {
      console.error('Error parsing tbdPlayers:', error);
      parsedTbdPlayers = [];
    }
  }

  // Return a copy of the match with properly formatted tbdPlayers
  return {
    ...match,
    tbdPlayers: parsedTbdPlayers,
  };
};

// Process all matches in the group to ensure tbdPlayers are normalized
const normalizeGroupData = (data: any) => {
  if (!data) return data;

  // Process the next match details if present
  if (data.nextMatchDetails) {
    data.nextMatchDetails = parseTbdPlayers(data.nextMatchDetails);
  }

  // Process all matches in the group
  if (data.matches && Array.isArray(data.matches)) {
    data.matches = data.matches.map((match: any) => parseTbdPlayers(match));
  }

  return data;
};

// Función para obtener los detalles del grupo
const fetchGroupDetails = async (groupId?: string | string[]) => {
  if (!groupId) {
    throw new Error('Group ID is required');
  }

  // Añadir timestamp para evitar caché del navegador
  const timestamp = new Date().getTime();
  console.log(`Fetching group details for ${groupId} at ${timestamp}`);

  const response = await fetch(`/api/groups/${groupId}?t=${timestamp}`, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al cargar los datos del grupo');
  }

  const data = await response.json();
  return normalizeGroupData(data);
};

// Hook para obtener detalles del grupo
export const useGroupDetailsQuery = (groupId?: string | string[]) => {
  const queryClient = useQueryClient();

  // Usar queryKey como array para mejor manejo de la caché
  const queryKey = [
    'group',
    typeof groupId === 'string'
      ? groupId
      : Array.isArray(groupId)
      ? groupId[0]
      : undefined,
  ];

  return useQuery({
    queryKey,
    queryFn: () => fetchGroupDetails(groupId),
    enabled: !!groupId,
    staleTime: 0, // Considerar los datos como obsoletos inmediatamente
    gcTime: 60000, // 1 minuto de tiempo de caché para evitar refetches innecesarios
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
  });
};

// Define la interfaz para respuesta de mutación
interface MutationResponse {
  success: boolean;
  groupId?: string;
}

interface UserAttendanceParams {
  matchId: string;
  status: ParticipantStatus;
  groupId: string;
}

interface AdminAttendanceParams {
  userId: string;
  matchId: string;
  status: ParticipantStatus;
  groupId: string;
}

interface MembershipRequestParams {
  groupId: string;
  userId: string;
  action: 'APPROVE' | 'REJECT';
}

interface DeleteMatchParams {
  matchId: string;
  groupId: string;
}

interface ReplaceTbdPlayerParams {
  tbdPlayerId: string;
  userId: string;
  matchId: string;
  isTeamA: boolean;
  groupId: string;
}

interface ResetAttendanceParams {
  matchId: string;
  groupId: string;
}

interface RandomizeTeamsParams {
  matchId: string;
  groupId: string;
}

// Mutación para actualizar asistencia como admin
export const useAdminAttendanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AdminAttendanceParams) => {
      try {
        const response = await fetch(
          `/api/matches/${params.matchId}/admin-attendance`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: params.userId,
              status: params.status,
              groupId: params.groupId,
            }),
          }
        );

        // Verificar si la respuesta es JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('La respuesta del servidor no es JSON válido');
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error al actualizar asistencia');
        }

        return response.json();
      } catch (error: any) {
        console.error('Error en adminAttendanceMutation:', error);
        throw new Error(error.message || 'Error al actualizar asistencia');
      }
    },
    onSuccess: (data: MutationResponse) => {
      // Invalidar caché específica del grupo
      if (data && data.groupId) {
        // Invalidate both the nextMatch and members queries
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', data.groupId],
        });
        queryClient.invalidateQueries({
          queryKey: ['group', 'members', data.groupId],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['group'] });
      }
      showSuccessToast('Asistencia actualizada correctamente');
    },
    onError: (error: Error) => {
      console.error('Error en adminAttendanceMutation:', error);
      showErrorToast(error.message || 'Error al actualizar asistencia');
    },
  });
};

// Mutación para actualizar asistencia del usuario
export const useUserAttendanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UserAttendanceParams) => {
      const response = await fetch(
        `/api/matches/${params.matchId}/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: params.status,
            groupId: params.groupId,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar asistencia');
      }
      return response.json();
    },
    onSuccess: (data: MutationResponse) => {
      console.log('Attendance updated successfully');

      // Invalidar caché específica del grupo
      if (data && data.groupId) {
        queryClient.invalidateQueries({ queryKey: ['group', data.groupId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['group'] });
      }
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
    mutationFn: async (params: MembershipRequestParams) => {
      const response = await fetch(
        `/api/groups/${params.groupId}/membership-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: params.userId,
            action: params.action,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al procesar solicitud');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      showSuccessToast(
        `Solicitud ${
          variables.action === 'APPROVE' ? 'aprobada' : 'rechazada'
        } correctamente`
      );
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al gestionar la solicitud');
    },
  });
};

// Mutación para abandonar grupo
export const useLeaveGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al abandonar grupo');
      }
      return response.json();
    },
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['userGroups'] }); // Invalida también la lista de grupos del usuario
      showSuccessToast('Has abandonado el grupo correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al abandonar el grupo');
    },
  });
};

// Mutación para aleatorizar equipos
export const useRandomizeTeamsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RandomizeTeamsParams) => {
      const response = await fetch(`/api/matches/${params.matchId}/resort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: params.groupId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al formar equipos');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      showSuccessToast('Equipos formados aleatoriamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al formar equipos');
    },
  });
};

// Mutación para eliminar partido
export const useDeleteMatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteMatchParams) => {
      const response = await fetch(`/api/matches/${params.matchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: params.groupId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar partido');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      showSuccessToast('Partido eliminado correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al eliminar el partido');
    },
  });
};

// Mutación para reemplazar jugador TBD
export const useReplaceTbdPlayerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReplaceTbdPlayerParams) => {
      const response = await fetch(
        `/api/matches/${params.matchId}/replace-tbd`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tbdPlayerId: params.tbdPlayerId,
            userId: params.userId,
            isTeamA: params.isTeamA,
            groupId: params.groupId,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al reemplazar jugador');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalida todas las consultas relevantes para asegurar que la UI se actualice
      console.log('Invalidating queries after replacing TBD player');

      // Invalidar la consulta del grupo
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });

      // Invalidar específicamente las consultas del partido y próximo partido
      queryClient.invalidateQueries({
        queryKey: ['nextMatch', variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ['match', variables.matchId] });

      // Forzar una recarga completa de los datos del grupo
      queryClient.refetchQueries({ queryKey: ['group', variables.groupId] });
      queryClient.refetchQueries({
        queryKey: ['nextMatch', variables.groupId],
      });

      showSuccessToast('Jugador reemplazado correctamente');
    },
    onError: (error: Error) => {
      console.error('Error replacing TBD player:', error);
      showErrorToast(error.message || 'Error al reemplazar jugador');
    },
  });
};

// Mutación para resetear asistencia
export const useResetAttendanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResetAttendanceParams) => {
      const response = await fetch(
        `/api/matches/${params.matchId}/reset-attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: params.groupId,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al resetear asistencia');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      showSuccessToast('Asistencia reseteada correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al resetear asistencia');
    },
  });
};
