import { useRouter } from 'next/router';
import { showSuccessToast, showErrorToast } from '../services/toastService';
import type { ParticipantStatus } from '../types/group';
import { useQueryClient } from '@tanstack/react-query';
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

interface UseGroupActionsProps {
  groupId: string;
  nextMatchId?: string;
  onSuccess?: () => void;
  group?: any;
  allowFillIn?: boolean;
}

export const useGroupActions = ({
  groupId,
  nextMatchId,
  onSuccess,
  group,
  allowFillIn = true,
}: UseGroupActionsProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Mutaciones
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
    // Use a sequence of invalidations to prevent race conditions
    const invalidationPromises = [];

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

      const basicData = queryClient.getQueryData(['group', 'basic', groupId]);
      if (!basicData) {
        await queryClient.invalidateQueries({
          queryKey: ['group', 'basic', groupId],
          exact: true,
          refetchType: 'active',
        });
      }

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

  const handleAttendance = async (status: ParticipantStatus): Promise<void> => {
    if (!groupId) {
      console.error('ID de grupo inválido');
      showErrorToast('ID de grupo inválido');
      return;
    }

    try {
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

      const response = await fetch(`/api/attendances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: currentMatchId,
          status,
          groupId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update attendance');
      }

      const data = await response.json();

      // Forzar la invalidación de todas las consultas relevantes
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', groupId],
          exact: true,
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['group', 'members', groupId],
          exact: true,
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['group', 'basic', groupId],
          exact: true,
          refetchType: 'active',
        }),
      ]);

      // Actualizar manualmente el caché con los nuevos datos si están disponibles
      if (data.nextMatchDetails) {
        queryClient.setQueryData(
          ['group', 'nextMatch', groupId],
          (oldData: any) => ({
            ...oldData,
            nextMatchDetails: data.nextMatchDetails,
            userAttendance: status,
          })
        );
      }

      // Show appropriate message
      const successMessage =
        status === 'CONFIRMED'
          ? 'Asistencia confirmada'
          : status === 'DECLINED'
          ? 'Has indicado que no asistirás'
          : 'Estado de asistencia actualizado';

      showSuccessToast(successMessage);

      if (onSuccess) {
        onSuccess();
      }

      return data;
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
      throw error; // Re-throw the error to be handled by the component
    }
  };

  const handleAdminAttendanceUpdate = async (
    userId: string,
    status: ParticipantStatus
  ) => {
    if (!groupId) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    try {
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

      const response = await fetch(`/api/attendances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          matchId: currentMatchId,
          status,
          groupId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      const data = await response.json();

      // Solo invalidamos la consulta del próximo partido ya que es lo único que cambia
      await invalidateRelevantQueries('nextMatch');

      // Show appropriate message
      const successMessage =
        status === 'CONFIRMED'
          ? 'Asistencia confirmada'
          : status === 'DECLINED'
          ? 'Asistencia rechazada'
          : 'Estado de asistencia actualizado';

      showSuccessToast(successMessage);

      if (onSuccess) {
        onSuccess();
      }

      return data;
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
      throw error;
    }
  };

  const handleMembershipRequest = async (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => {
    if (!groupId) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    try {
      await membershipRequestMutation.mutateAsync({
        groupId,
        userId,
        action,
      });

      // Only invalidate members data
      await invalidateRelevantQueries('members');

      const message =
        action === 'APPROVE'
          ? 'Solicitud aprobada correctamente'
          : 'Solicitud rechazada correctamente';

      showSuccessToast(message);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error executing action:', error);
      showErrorToast(error.message || 'Ocurrió un error inesperado');
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    await executeAction(async () => {
      await leaveGroupMutation.mutateAsync(groupId);
      router.push('/groups');
    }, 'Has abandonado el grupo correctamente');
  };

  const handleRandomTeams = async (providedConfirmedPlayers?: any[]) => {
    if (!nextMatchId || !groupId) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    try {
      // Use provided confirmed players if available, otherwise fall back to group data
      const confirmedPlayers =
        providedConfirmedPlayers ||
        group?.nextMatchDetails?.confirmedPlayers ||
        [];

      // Verificar que los jugadores estén efectivamente confirmados
      console.log(
        'Jugadores confirmados antes del filtro:',
        confirmedPlayers.length
      );

      // Crear el formato de jugadores que espera la API
      const players = confirmedPlayers.map((player: any) => ({
        userId: player.id,
        name: player.name,
      }));

      console.log('Jugadores enviados para sorteo:', players.length);

      if (players.length < 2) {
        showErrorToast(
          'Se necesitan al menos 2 jugadores confirmados para sortear equipos'
        );
        return;
      }

      // Crear jugadores TBD si es necesario
      const requiredPlayers = group?.requiredPlayers || 10;
      const missingPlayers = Math.max(0, requiredPlayers - players.length);

      // Formato correcto para tbdPlayers que evita el error de prisma
      const tbdPlayersData = {
        teamA: [] as any[],
        teamB: [] as any[],
      };

      if (allowFillIn && missingPlayers > 0) {
        // Decidir cuántos jugadores TBD van a cada equipo
        const halfMissing = Math.ceil(missingPlayers / 2);

        for (let i = 0; i < halfMissing; i++) {
          tbdPlayersData.teamA.push({
            id: `tbd-${Date.now()}-a-${i}`,
            name: `TBD A${i + 1}`,
            avatar: null,
            isTeamA: true,
            playerType: 'TBD',
          });
        }

        for (let i = 0; i < missingPlayers - halfMissing; i++) {
          tbdPlayersData.teamB.push({
            id: `tbd-${Date.now()}-b-${i}`,
            name: `TBD B${i + 1}`,
            avatar: null,
            isTeamA: false,
            playerType: 'TBD',
          });
        }
      }

      console.log('Sending team formation request with:', {
        players,
        tbdPlayers: tbdPlayersData,
      });

      const response = await fetch(`/api/matches/create-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          matchId: nextMatchId,
          mode: 'auto',
          isResort: true,
          players,
          tbdPlayers: tbdPlayersData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al formar equipos');
      }

      const result = await response.json();
      console.log('Create match API response:', result);

      // Here's the issue - we should only invalidate if needed
      // Check if the result has proper team data
      if (!result.teamA || !result.teamB) {
        // Only invalidate if we didn't get complete data back
        await queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', groupId],
          exact: true,
        });
      } else {
        // Otherwise, update the cache directly without triggering a refetch
        queryClient.setQueryData(
          ['group', 'nextMatch', groupId],
          (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              nextMatchDetails: {
                ...oldData.nextMatchDetails,
                playersA: result.teamA,
                playersB: result.teamB,
                tbdPlayers: result.tbdPlayers,
              },
            };
          }
        );
      }

      showSuccessToast('Equipos formados correctamente');

      if (onSuccess) {
        onSuccess();
      }

      return result;
    } catch (error: any) {
      console.error('Error executing action:', error);
      showErrorToast(error.message || 'Ocurrió un error inesperado');
      return null;
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!groupId) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    await executeAction(async () => {
      await deleteMatchMutation.mutateAsync({
        matchId,
        groupId,
      });
    }, 'Partido eliminado correctamente');
  };

  const handleReplaceTbdPlayer = async (
    tbdPlayerId: string,
    userId: string,
    isTeamA: boolean
  ) => {
    if (!nextMatchId || !groupId) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    try {
      await replaceTbdPlayerMutation.mutateAsync({
        tbdPlayerId,
        userId,
        matchId: nextMatchId,
        isTeamA,
        groupId,
      });

      // Invalidar tanto nextMatch como members para actualizar ambas pestañas
      await invalidateRelevantQueries('all');

      showSuccessToast('Jugador reemplazado exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error replacing TBD player:', error);
      showErrorToast('Error al reemplazar jugador TBD');
    }
  };

  const handleResetAttendance = async () => {
    if (!nextMatchId || !groupId) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    await executeAction(async () => {
      await resetAttendanceMutation.mutateAsync({
        matchId: nextMatchId,
        groupId,
      });
    });
  };

  return {
    handleAttendance,
    handleAdminAttendanceUpdate,
    handleMembershipRequest,
    handleLeaveGroup,
    handleRandomTeams,
    handleDeleteMatch,
    handleReplaceTbdPlayer,
    handleResetAttendance,
  };
};
