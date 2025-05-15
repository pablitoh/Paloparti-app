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

  // Si ya tiene los datos correctamente formateados, no los procesamos de nuevo
  if (
    match.tbdPlayers &&
    typeof match.tbdPlayers === 'object' &&
    !Array.isArray(match.tbdPlayers) &&
    match.tbdPlayers.teamA &&
    match.tbdPlayers.teamB &&
    match.tbdPlayers.teamA.every((p: any) => p.playerType === 'TBD') &&
    match.tbdPlayers.teamB.every((p: any) => p.playerType === 'TBD')
  ) {
    // Los datos ya están en formato correcto, no los procesamos
    return match;
  }

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

  try {
    // Process the next match details if present
    if (data.nextMatchDetails) {
      // Asegurémonos de que playersA y playersB estén disponibles
      if (data.nextMatchDetails.playersA) {
        // Si ya es un array, no lo procesamos
        if (!Array.isArray(data.nextMatchDetails.playersA)) {
          try {
            data.nextMatchDetails.playersA = JSON.parse(
              data.nextMatchDetails.playersA
            );
          } catch (e) {
            console.error('Error parsing playersA:', e);
            data.nextMatchDetails.playersA = [];
          }
        }
      }

      if (data.nextMatchDetails.playersB) {
        // Si ya es un array, no lo procesamos
        if (!Array.isArray(data.nextMatchDetails.playersB)) {
          try {
            data.nextMatchDetails.playersB = JSON.parse(
              data.nextMatchDetails.playersB
            );
          } catch (e) {
            console.error('Error parsing playersB:', e);
            data.nextMatchDetails.playersB = [];
          }
        }
      }

      // Procesar tbdPlayers para mantener consistencia
      data.nextMatchDetails = parseTbdPlayers(data.nextMatchDetails);
    }

    // Process all matches in the group
    if (data.matches && Array.isArray(data.matches)) {
      data.matches = data.matches.map((match: any) => {
        // Procesar playersA y playersB para cada partido
        if (match.playersA && !Array.isArray(match.playersA)) {
          try {
            match.playersA = JSON.parse(match.playersA);
          } catch (e) {
            match.playersA = [];
          }
        }

        if (match.playersB && !Array.isArray(match.playersB)) {
          try {
            match.playersB = JSON.parse(match.playersB);
          } catch (e) {
            match.playersB = [];
          }
        }

        return parseTbdPlayers(match);
      });
    }
  } catch (error) {
    console.error('Error normalizing group data:', error);
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
  status: string;
  groupId: string;
  userId: string;
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
  balanceByAge?: boolean;
  balanceByRole?: boolean;
  balanceByRating?: boolean;
  allowTbdPlayers?: boolean;
  useRandomAlgorithm?: boolean;
}

interface AttendanceMutationParams {
  matchId: string;
  status: string;
  groupId: string;
  userId: string;
}

interface ManualTeamFormationResponse {
  message: string;
  match: {
    groupId: string;
  };
}

interface ManualTeamFormationVariables {
  matchId: string;
  teamA: any[];
  teamB: any[];
}

interface CreateMatchParams {
  groupId: string;
  date?: string | Date;
  location?: string;
  balanceByAge?: boolean;
  teamA?: any[]; // Optional for manual mode
  teamB?: any[]; // Optional for manual mode
  mode?: 'auto' | 'manual'; // 'auto' for randomized teams, 'manual' for pre-defined teams
}

// Mutación para actualizar asistencia como admin
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
      if (variables.groupId) {
        // Invalidar y refetch la consulta del próximo partido
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', variables.groupId],
          exact: true,
          refetchType: 'active',
        });
      }

      showSuccessToast('Asistencia actualizada correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al actualizar asistencia');
    },
  });
};

// Mutación para actualizar asistencia del usuario
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
      groupId: string;
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar asistencia');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidar y refetch la consulta del próximo partido
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', variables.groupId],
        exact: true,
        refetchType: 'active',
      });

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
      // Actualizar el caché de grupos del usuario
      queryClient.setQueryData(['userGroups'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((group: any) => group.id !== groupId);
      });

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
      // Validate that we have required parameters
      if (!params.groupId) {
        throw new Error('Group ID is required');
      }

      if (!params.matchId) {
        throw new Error('Match ID is required');
      }

      // Añadir un timestamp aleatorio para evitar que se use una respuesta en caché
      const timestamp = Date.now() + Math.random();
      const response = await fetch(`/api/matches/create-match?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: params.groupId,
          matchId: params.matchId,
          mode: 'auto',
          isResort: true,
          forceNewShuffle: true, // Añadir parámetro para forzar un nuevo sorteo aleatorio
          balanceByAge:
            params.balanceByAge !== undefined ? params.balanceByAge : false, // Pasar el parámetro con valor por defecto false
          balanceByRole:
            params.balanceByRole !== undefined ? params.balanceByRole : true, // Pasar el parámetro con valor por defecto true
          balanceByRating:
            params.balanceByRating !== undefined
              ? params.balanceByRating
              : false, // Pasar el parámetro con valor por defecto false
          allowTbdPlayers:
            params.allowTbdPlayers !== undefined
              ? params.allowTbdPlayers
              : true, // Pasar el parámetro con valor por defecto true
          useRandomAlgorithm:
            params.useRandomAlgorithm !== undefined
              ? params.useRandomAlgorithm
              : false, // Pasar el parámetro con valor por defecto false
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al formar equipos');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Actualizar el caché del próximo partido directamente
      // This approach updates the cache without triggering a refetch
      const queryKey = ['group', 'nextMatch', variables.groupId];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;

        // Añadir log para depuración de promedios de edad
        console.log('Actualizando caché con promedios de edad:', {
          teamAAvgAge: data.teamAAvgAge,
          teamBAvgAge: data.teamBAvgAge,
          teamA: data.teamA?.map((p: any) => ({
            id: p.id,
            name: p.name,
            age: p.age,
          })),
          teamB: data.teamB?.map((p: any) => ({
            id: p.id,
            name: p.name,
            age: p.age,
          })),
        });

        return {
          ...oldData,
          nextMatchDetails: {
            ...oldData.nextMatchDetails,
            playersA: data.teamA,
            playersB: data.teamB,
            tbdPlayers: data.tbdPlayers,
            teamAAvgAge: data.teamAAvgAge, // Añadir promedios de edad al caché
            teamBAvgAge: data.teamBAvgAge, // Añadir promedios de edad al caché
            sortCount: 1, // Asegurar que el sortCount sea 1 después del sorteo
          },
        };
      });

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
      // Actualizar el caché del próximo partido
      const queryKey = ['group', 'nextMatch', variables.groupId];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          nextMatchDetails: null,
          userAttendance: undefined, // Clear attendance status
        };
      });

      // Invalidar la consulta para forzar una recarga cuando sea necesario
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', variables.groupId],
        refetchType: 'active', // Force active refetch
      });

      // Also invalidate any related queries to ensure consistent state
      queryClient.invalidateQueries({
        queryKey: ['group', 'basic', variables.groupId],
        refetchType: 'active',
      });

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
        `/api/matches/${params.matchId}/edit-match`,
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
            action: 'replace-tbd',
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al reemplazar jugador');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch the next match data
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', variables.groupId],
        refetchType: 'active',
      });

      // Also invalidate the group data to ensure everything is in sync
      queryClient.invalidateQueries({
        queryKey: ['group', 'details', variables.groupId],
        refetchType: 'active',
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
    onSuccess: (data, variables) => {
      // Actualizar el caché del próximo partido
      const queryKey = ['group', 'nextMatch', variables.groupId];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;

        const updatedData = {
          ...oldData,
          nextMatchDetails: {
            ...oldData.nextMatchDetails,
            ...data,
          },
        };

        return updatedData;
      });

      showSuccessToast('Asistencia reseteada correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al resetear asistencia');
    },
  });
};

export const useManualTeamFormationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      groupId,
      teamA,
      teamB,
    }: {
      matchId: string;
      groupId: string;
      teamA: Array<{ id: string; name: string | null; avatar: string | null }>;
      teamB: Array<{ id: string; name: string | null; avatar: string | null }>;
    }) => {
      const response = await fetch('/api/matches/create-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          groupId,
          teamA,
          teamB,
          mode: 'manual',
          isResort: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al formar equipos');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      try {
        // Parse player data if necessary
        let playersA = variables.teamA; // Default to what was sent
        let playersB = variables.teamB;

        // If the response includes parsed player data, use that instead
        if (data.match) {
          // Handle string data that needs parsing
          if (data.match.playersA && typeof data.match.playersA === 'string') {
            try {
              playersA = JSON.parse(data.match.playersA);
            } catch (e) {
              console.error('Error parsing playersA:', e);
            }
          } else if (data.match.playersA) {
            // Use array data directly
            playersA = data.match.playersA;
          }

          if (data.match.playersB && typeof data.match.playersB === 'string') {
            try {
              playersB = JSON.parse(data.match.playersB);
            } catch (e) {
              console.error('Error parsing playersB:', e);
            }
          } else if (data.match.playersB) {
            // Use array data directly
            playersB = data.match.playersB;
          }
        }

        // Make sure we have the data in the correct format
        // Update the cache directly - no need to removeQueries
        queryClient.setQueryData(
          ['group', 'nextMatch', variables.groupId],
          (oldData: any) => {
            if (!oldData) {
              // If there's no old data, create a new structure
              return {
                nextMatchDetails: {
                  ...data.match,
                  playersA: playersA,
                  playersB: playersB,
                },
                userAttendance: oldData?.userAttendance,
              };
            }

            // If we have old data, update it properly
            return {
              ...oldData,
              nextMatchDetails: {
                ...oldData.nextMatchDetails,
                ...data.match,
                playersA: playersA,
                playersB: playersB,
              },
            };
          }
        );

        // Force a refetch to make sure components get the latest data
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', variables.groupId],
          refetchType: 'active',
        });

        showSuccessToast('Equipos formados correctamente');
      } catch (error) {
        console.error('Error processing mutation response:', error);
        showErrorToast('Error al procesar la respuesta del servidor');
      }
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al formar equipos');
    },
  });
};

// Mutación para crear partido (unificado)
export const useCreateMatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMatchParams) => {
      const response = await fetch('/api/matches/create-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el partido');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch the group data
      queryClient.invalidateQueries({
        queryKey: ['group', variables.groupId],
        refetchType: 'active',
      });

      // Invalidate the next match data specifically
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', variables.groupId],
        refetchType: 'active',
      });

      // If we have team information, we can update the TeamsList directly
      if (data.teamA && data.teamB) {
        // Update the next match details with the newly created match
        const queryKey = ['group', 'nextMatch', variables.groupId];
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData) return oldData;

          // Return updated data with the new match
          return {
            ...oldData,
            nextMatchDetails: {
              ...data.match,
              playersA: data.teamA,
              playersB: data.teamB,
              tbdPlayers: data.tbdPlayers,
            },
          };
        });
      }

      showSuccessToast(data.message || 'Partido creado correctamente');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Error al crear el partido');
    },
  });
};
