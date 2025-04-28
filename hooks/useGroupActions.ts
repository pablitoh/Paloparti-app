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
  const invalidateRelevantQueries = async () => {
    // Invalidate all group-related queries
    await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    await queryClient.invalidateQueries({
      queryKey: ['group', 'nextMatch', groupId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['group', 'members', groupId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['group', 'history', groupId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['group', 'stats', groupId],
    });

    // Also invalidate the general queries
    await queryClient.invalidateQueries({ queryKey: ['group', 'nextMatch'] });
    await queryClient.invalidateQueries({ queryKey: ['group', 'members'] });
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
    try {
      const response = await fetch(`/api/attendances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: nextMatchId,
          status,
          groupId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      const data = await response.json();

      // Invalidate relevant queries
      await invalidateRelevantQueries();

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
      throw error;
    }
  };

  const handleAdminAttendanceUpdate = async (
    userId: string,
    status: ParticipantStatus
  ) => {
    try {
      const response = await fetch(`/api/attendances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          matchId: nextMatchId,
          status,
          groupId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      const data = await response.json();

      // Invalidate relevant queries
      await invalidateRelevantQueries();

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

    await executeAction(async () => {
      await membershipRequestMutation.mutateAsync({
        groupId,
        userId,
        action,
      });
    });
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

  const handleRandomTeams = async () => {
    if (!nextMatchId || !groupId) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    await executeAction(async () => {
      // Obtener los jugadores confirmados del grupo
      const confirmedPlayers = group?.nextMatchDetails?.confirmedPlayers || [];

      // Crear el formato de jugadores que espera la API
      const players = confirmedPlayers.map((player: any) => ({
        userId: player.id,
        name: player.name,
      }));

      // Crear jugadores TBD si es necesario
      const requiredPlayers = group?.requiredPlayers || 10;
      const missingPlayers = Math.max(0, requiredPlayers - players.length);
      const tbdPlayers = [];

      if (allowFillIn && missingPlayers > 0) {
        for (let i = 0; i < missingPlayers; i++) {
          tbdPlayers.push({
            id: `tbd-${Date.now()}-${i}`,
            name: `TBD ${i + 1}`,
            avatar: null,
          });
        }
      }

      const response = await fetch(`/api/matches/${nextMatchId}/resort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          players,
          tbdPlayers,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al formar equipos');
      }

      return response.json();
    }, 'Equipos formados correctamente');
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

      // Invalidate queries to refresh UI
      await invalidateRelevantQueries();

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
