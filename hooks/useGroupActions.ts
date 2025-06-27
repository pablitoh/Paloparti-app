import { useRouter } from 'next/router';
import { showSuccessToast, showErrorToast } from '../services/toastService';
import type { ParticipantStatus } from '../types/group';
import { useQueryClient } from '@tanstack/react-query';
import { PLAYER_ROLES } from '../components/group/AttendanceConfirmation';
import { PlayerRole, normalizePlayerRoles } from '../lib/teambuilder';
import {
  useUserAttendanceMutation,
  useAdminAttendanceMutation,
  useMembershipRequestMutation,
  useLeaveGroupMutation,
  useRandomizeTeamsMutation,
  useDeleteMatchMutation,
  useReplaceTbdPlayerMutation,
  useResetAttendanceMutation,
} from '../services/reactQueryHooks';
import { useState } from 'react';

export interface UseGroupActionsProps {
  groupId: string;
  nextMatchId?: string;
  onSuccess?: () => void;
  group?: any;
  allowFillIn?: boolean;
}

// Función para convertir formato antiguo a nuevo
const convertLegacyRoles = (roles: string[] | PlayerRole[]): PlayerRole[] => {
  if (!roles || roles.length === 0) return [];

  // Si ya está en formato nuevo (PlayerRole[])
  if (
    Array.isArray(roles) &&
    roles.length > 0 &&
    typeof roles[0] === 'object' &&
    'priority' in roles[0] &&
    'role' in roles[0] &&
    typeof roles[0].role === 'string'
  ) {
    return roles as PlayerRole[];
  }

  // Si es array de strings (formato antiguo)
  if (
    Array.isArray(roles) &&
    roles.length > 0 &&
    typeof roles[0] === 'string'
  ) {
    const stringRoles = roles as string[];
    return stringRoles.map((role, index) => ({
      role: role as any,
      priority: index + 1,
    }));
  }

  return [];
};

export const useGroupActions = ({
  groupId,
  nextMatchId,
  onSuccess,
  group,
  allowFillIn = true,
}: UseGroupActionsProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Hook mutations
  const userAttendanceMutation = useUserAttendanceMutation();
  const adminAttendanceMutation = useAdminAttendanceMutation();
  const membershipRequestMutation = useMembershipRequestMutation();
  const leaveGroupMutation = useLeaveGroupMutation();
  const randomizeTeamsMutation = useRandomizeTeamsMutation();
  const deleteMatchMutation = useDeleteMatchMutation();
  const replaceTbdPlayerMutation = useReplaceTbdPlayerMutation();
  const resetAttendanceMutation = useResetAttendanceMutation();

  // Helper function to invalidate relevant queries without page reload
  const invalidateRelevantQueries = async (
    scope: 'all' | 'nextMatch' | 'members' = 'all'
  ) => {
    const invalidationPromises = [
      // Siempre invalidar el caché del próximo partido
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', groupId],
        exact: true,
        refetchType: 'active',
      }),
      // Siempre invalidar el caché de miembros
      queryClient.invalidateQueries({
        queryKey: ['group', 'members', groupId],
        exact: true,
        refetchType: 'active',
      }),
      // Siempre invalidar el caché básico del grupo para reflejar cambios en colores/nombres
      queryClient.invalidateQueries({
        queryKey: ['group', 'basic', groupId],
        exact: true,
        refetchType: 'active',
      }),
    ];

    if (scope === 'all' || scope === 'nextMatch') {
      // Solo invalidar si no hay datos en caché
      const nextMatchData = queryClient.getQueryData([
        'group',
        'nextMatch',
        groupId,
      ]);
      if (!nextMatchData) {
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: ['group', 'nextMatch', groupId],
            exact: true,
            refetchType: 'active',
          })
        );
      }
    }

    if (scope === 'all' || scope === 'members') {
      // Solo invalidar si no hay datos en caché
      const membersData = queryClient.getQueryData([
        'group',
        'members',
        groupId,
      ]);
      if (!membersData) {
        invalidationPromises.push(
          queryClient.invalidateQueries({
            queryKey: ['group', 'members', groupId],
            exact: true,
            refetchType: 'active',
          })
        );
      }
    }

    // Solo invalidar estos si es necesario y no hay datos en caché
    if (scope === 'all') {
      // Wait for previous invalidations before proceeding
      await Promise.all(invalidationPromises);

      const historyData = queryClient.getQueryData([
        'group',
        'history',
        groupId,
      ]);
      if (!historyData) {
        await queryClient.invalidateQueries({
          queryKey: ['group', 'history', groupId],
          exact: false,
          refetchType: 'active',
        });
      }

      const statsData = queryClient.getQueryData(['group', 'stats', groupId]);
      if (!statsData) {
        await queryClient.invalidateQueries({
          queryKey: ['group', 'stats', groupId],
          exact: true,
          refetchType: 'active',
        });
      }
    } else {
      // For targeted updates, just wait for the specified invalidations
      await Promise.all(invalidationPromises);
    }
  };

  const executeAction = async (
    actionFn: () => Promise<any>,
    successMessage?: string
  ): Promise<void> => {
    try {
      await actionFn();

      // Invalidate relevant queries
      await invalidateRelevantQueries();

      if (successMessage) {
        showSuccessToast(successMessage);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error executing action:', error);
      showErrorToast(error.message || 'Ocurrió un error inesperado');
    }
  };

  // Handler for user attendance
  const handleAttendance = async (
    status: ParticipantStatus,
    playerRoles?: string[] | PlayerRole[]
  ) => {
    try {
      console.log('======= FRONTEND HOOK =======');
      console.log('ATTENDANCE STATUS:', status);
      console.log('PLAYER ROLES (raw):', playerRoles);
      console.log('PLAYER ROLES TYPE:', typeof playerRoles);
      console.log('PLAYER ROLES IS ARRAY:', Array.isArray(playerRoles));

      // Normalizar roles al nuevo formato
      let effectiveRoles: PlayerRole[] = [];
      if (status === 'CONFIRMED') {
        if (playerRoles && playerRoles.length > 0) {
          // Normalizar roles (convierte formato antiguo si es necesario)
          const convertedRoles = convertLegacyRoles(playerRoles);
          effectiveRoles = normalizePlayerRoles(convertedRoles);
          console.log('NORMALIZED ROLES:', effectiveRoles);
        } else {
          // Si no se proporcionan roles, usar recuperar del localStorage
          const savedRoles = localStorage.getItem('paloparti_selected_roles');
          if (savedRoles) {
            try {
              const parsedRoles = JSON.parse(savedRoles);
              const convertedRoles = convertLegacyRoles(parsedRoles);
              effectiveRoles = normalizePlayerRoles(convertedRoles);
              console.log('ROLES FROM LOCALSTORAGE:', effectiveRoles);
            } catch (e) {
              console.error('Error parsing localStorage roles:', e);
              effectiveRoles = [{ role: PLAYER_ROLES.WILDCARD, priority: 1 }];
            }
          } else {
            effectiveRoles = [{ role: PLAYER_ROLES.WILDCARD, priority: 1 }];
          }
        }

        // Validar que haya al menos un rol seleccionado
        if (effectiveRoles.length === 0) {
          console.error('No se proporcionaron roles');
          showErrorToast(
            'Selecciona al menos una posición para confirmar asistencia'
          );
          return;
        }
      }

      // First, ensure we have the latest match ID by fetching it if necessary
      let currentMatchId = nextMatchId;
      if (!currentMatchId) {
        try {
          // Get the latest match ID from the API
          const matchResponse = await fetch(
            `/api/groups/${groupId}/next-match`
          );
          if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            if (matchData?.nextMatchDetails?.id) {
              currentMatchId = matchData.nextMatchDetails.id;
            } else {
              throw new Error('No hay un partido activo para este grupo');
            }
          } else {
            throw new Error('Error al obtener información del partido');
          }
        } catch (error) {
          console.error('Error fetching match data:', error);
          showErrorToast('No hay un partido programado para este grupo');
          return;
        }
      }

      // Construir el payload
      const payload: any = { status };

      // Solo añadir playerRoles si status es CONFIRMED
      if (status === 'CONFIRMED') {
        payload.playerRoles = effectiveRoles;
      }

      console.log('Enviando payload al servidor:', payload);

      const response = await fetch(
        `/api/matches/${currentMatchId}/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      // Parsear la respuesta
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Error en la respuesta del servidor');
      }

      if (!response.ok) {
        console.error('Server response error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: data,
        });
        throw new Error(data?.error || data?.message || 'Error del servidor');
      }

      console.log('Respuesta exitosa del servidor:', data);

      // Invalidar caché para forzar actualización
      await queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', groupId],
      });

      // Show success message
      const statusMessage = status === 'CONFIRMED' ? 'confirmada' : 'cancelada';
      showSuccessToast(`Asistencia ${statusMessage} exitosamente`);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleAttendance:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al actualizar asistencia: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for admin attendance (confirming other users)
  const handleAdminAttendance = async (
    status: ParticipantStatus,
    userId: string,
    targetUserId?: string,
    playerRoles?: string[] | PlayerRole[]
  ) => {
    try {
      // Normalizar roles si se proporcionan
      let effectiveRoles: PlayerRole[] = [];
      if (status === 'CONFIRMED' && playerRoles && playerRoles.length > 0) {
        const convertedRoles = convertLegacyRoles(playerRoles);
        effectiveRoles = normalizePlayerRoles(convertedRoles);
      }

      await adminAttendanceMutation.mutateAsync({
        groupId,
        matchId: nextMatchId || '',
        userId,
        status,
        playerRoles: effectiveRoles,
      });

      const statusMessage = status === 'CONFIRMED' ? 'confirmada' : 'cancelada';
      showSuccessToast(`Asistencia ${statusMessage} exitosamente`);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleAdminAttendance:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al actualizar asistencia: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for membership requests
  const handleMembershipRequest = async (
    action: 'accept' | 'reject',
    memberId: string
  ) => {
    try {
      // Convertir formato para que coincida con la interfaz
      const actionFormat = action === 'accept' ? 'APPROVE' : 'REJECT';

      await membershipRequestMutation.mutateAsync({
        groupId,
        userId: memberId,
        action: actionFormat,
      });

      showSuccessToast(
        action === 'accept'
          ? 'Solicitud aceptada exitosamente'
          : 'Solicitud rechazada exitosamente'
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleMembershipRequest:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al procesar solicitud: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for leaving group
  const handleLeaveGroup = async () => {
    try {
      await leaveGroupMutation.mutateAsync(groupId);
      showSuccessToast('Has salido del grupo exitosamente');
      router.push('/groups');
    } catch (error) {
      console.error('Error in handleLeaveGroup:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al salir del grupo: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for randomizing teams
  const handleRandomizeTeams = async (
    options: {
      balanceByAge?: boolean;
      balanceByRole?: boolean;
      balanceByRating?: boolean;
    } = {}
  ) => {
    try {
      if (!nextMatchId) {
        throw new Error('No hay un partido programado');
      }

      // CORREGIDO: Leer variables globales si no se proporcionan opciones directas
      const globalBalanceByAge = (window as any).__balanceByAge;
      const globalBalanceByRole = (window as any).__balanceByRole;
      const globalBalanceByRating = (window as any).__balanceByRating;
      const globalUseRandomAlgorithm = (window as any).__isRandomMode;
      const globalAllowTbdPlayers = (window as any).__allowTbdPlayers;

      const finalOptions = {
        balanceByAge:
          globalBalanceByAge !== undefined
            ? globalBalanceByAge
            : options.balanceByAge ?? false,
        balanceByRole:
          globalBalanceByRole !== undefined
            ? globalBalanceByRole
            : options.balanceByRole ?? true,
        balanceByRating:
          globalBalanceByRating !== undefined
            ? globalBalanceByRating
            : options.balanceByRating ?? false,
      };

      const useRandomAlgorithm =
        globalUseRandomAlgorithm !== undefined
          ? globalUseRandomAlgorithm
          : false;
      const allowTbdPlayersFromGlobal =
        globalAllowTbdPlayers !== undefined
          ? globalAllowTbdPlayers
          : allowFillIn;

      // Debug log to track all values
      console.log('🔍 handleRandomizeTeams - valores finales:', {
        // Variables globales raw
        globalBalanceByAge,
        globalBalanceByRole,
        globalBalanceByRating,
        globalUseRandomAlgorithm,
        globalAllowTbdPlayers,
        // Opciones directas
        options,
        // Valores finales calculados
        finalOptions,
        useRandomAlgorithm,
        allowTbdPlayersFromGlobal,
        allowFillIn,
      });

      await randomizeTeamsMutation.mutateAsync({
        matchId: nextMatchId,
        groupId,
        allowTbdPlayers: allowTbdPlayersFromGlobal,
        useRandomAlgorithm,
        ...finalOptions,
      });

      // Limpiar variables globales después del uso
      if ((window as any).__balanceByAge !== undefined)
        delete (window as any).__balanceByAge;
      if ((window as any).__balanceByRole !== undefined)
        delete (window as any).__balanceByRole;
      if ((window as any).__balanceByRating !== undefined)
        delete (window as any).__balanceByRating;
      if ((window as any).__isRandomMode !== undefined)
        delete (window as any).__isRandomMode;
      if ((window as any).__allowTbdPlayers !== undefined)
        delete (window as any).__allowTbdPlayers;

      // Asegurar que las queries se actualicen
      console.log('🔄 useGroupActions - Forzando refetch de datos');

      // Invalidar múltiples queries para asegurar actualización
      const queriesToInvalidate = [
        ['group', 'nextMatch', groupId],
        ['group', 'basic', groupId],
        ['group', 'details', groupId],
      ];

      queriesToInvalidate.forEach((queryKey) => {
        queryClient.invalidateQueries({
          queryKey,
          refetchType: 'all',
        });
      });

      showSuccessToast('Equipos formados exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleRandomizeTeams:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al formar equipos: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for deleting match
  const handleDeleteMatch = async () => {
    try {
      if (!nextMatchId) {
        throw new Error('No hay un partido para eliminar');
      }

      await deleteMatchMutation.mutateAsync({
        matchId: nextMatchId,
        groupId,
      });

      showSuccessToast('Partido eliminado exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleDeleteMatch:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al eliminar partido: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for replacing TBD player
  const handleReplaceTbdPlayer = async (
    tbdPlayerId: string,
    replacementUserId: string
  ) => {
    try {
      if (!nextMatchId) {
        throw new Error('No hay un partido activo');
      }

      await replaceTbdPlayerMutation.mutateAsync({
        matchId: nextMatchId,
        tbdPlayerId,
        userId: replacementUserId,
        isTeamA: true, // Este valor deberá ser determinado por la lógica del negocio
        groupId,
      });

      showSuccessToast('Jugador reemplazado exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleReplaceTbdPlayer:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al reemplazar jugador: ${errorMessage}`);
      throw error;
    }
  };

  // Handler for resetting attendance
  const handleResetAttendance = async () => {
    try {
      if (!nextMatchId) {
        throw new Error('No hay un partido activo');
      }

      await resetAttendanceMutation.mutateAsync({
        matchId: nextMatchId,
        groupId,
      });

      showSuccessToast('Asistencia reiniciada exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error in handleResetAttendance:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      showErrorToast(`Error al reiniciar asistencia: ${errorMessage}`);
      throw error;
    }
  };

  return {
    handleAttendance,
    handleAdminAttendance,
    handleMembershipRequest,
    handleLeaveGroup,
    handleRandomizeTeams,
    handleDeleteMatch,
    handleReplaceTbdPlayer,
    handleResetAttendance,
    isLoading: {
      attendance: userAttendanceMutation.isPending,
      adminAttendance: adminAttendanceMutation.isPending,
      membershipRequest: membershipRequestMutation.isPending,
      leaveGroup: leaveGroupMutation.isPending,
      randomizeTeams: randomizeTeamsMutation.isPending,
      deleteMatch: deleteMatchMutation.isPending,
      replaceTbdPlayer: replaceTbdPlayerMutation.isPending,
      resetAttendance: resetAttendanceMutation.isPending,
    },
  };
};
