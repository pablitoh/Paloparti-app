import { useState, useEffect } from 'react';
import Button from '../../Button';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';

interface ReplaceTbdPlayerModalProps {
  showReplaceTbdModal: string;
  setShowReplaceTbdModal: (id: string) => void;
  group: any;
  handleReplaceTbdPlayer: (
    tbdPlayerId: string,
    userId: string,
    isTeamA: boolean
  ) => Promise<void>;
  onSuccessfulReplace?: () => void;
}

const ReplaceTbdPlayerModal = ({
  showReplaceTbdModal,
  setShowReplaceTbdModal,
  group,
  handleReplaceTbdPlayer,
  onSuccessfulReplace,
}: ReplaceTbdPlayerModalProps) => {
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);

  // Get the TBD player details from the match details
  const tbdPlayer =
    showReplaceTbdModal && group?.nextMatchDetails?.tbdPlayers
      ? group.nextMatchDetails.tbdPlayers.find(
          (p: any) => p.id === showReplaceTbdModal
        )
      : null;

  // Process available members when the modal is shown
  useEffect(() => {
    if (!group || !group.nextMatchDetails) {
      console.log('No group or nextMatchDetails available');
      return;
    }

    // Log important debug information
    console.log('Modal Debug Info:');
    console.log('- Group ID:', group.id);
    console.log('- Group name:', group.name);
    console.log('- Next match ID:', group.nextMatchDetails?.id);
    console.log('- Has members array:', !!group.members);
    console.log('- Members array length:', group.members?.length || 0);
    console.log(
      '- Has confirmed players:',
      !!group.nextMatchDetails.confirmedPlayers
    );
    console.log(
      '- Confirmed players:',
      group.nextMatchDetails.confirmedPlayers?.length || 0
    );

    // Get players already in teams A and B
    const playersAIds = (group.nextMatchDetails.playersA || []).map(
      (p: any) => p.id
    );
    const playersBIds = (group.nextMatchDetails.playersB || []).map(
      (p: any) => p.id
    );

    console.log('- Players in Team A:', playersAIds.length);
    console.log('- Players in Team B:', playersBIds.length);

    // Create a list of players who are confirmed but not assigned to a team
    const confirmedButUnassigned = (
      group.nextMatchDetails.confirmedPlayers || []
    ).filter((player: any) => {
      const isInTeamA = playersAIds.includes(player.id);
      const isInTeamB = playersBIds.includes(player.id);
      return !isInTeamA && !isInTeamB;
    });

    console.log(
      '- Confirmed but unassigned players:',
      confirmedButUnassigned.length
    );
    console.log(
      '- Unassigned player IDs:',
      confirmedButUnassigned.map((p: any) => p.id)
    );

    // Use confirmed but unassigned players as available options
    setAvailableMembers(confirmedButUnassigned);
  }, [group, showReplaceTbdModal]);

  const handleReplace = async () => {
    if (!selectedMember || !showReplaceTbdModal || !tbdPlayer) return;

    setIsReplacing(true);
    try {
      // Call the API to replace TBD player with real user
      const isTeamA = tbdPlayer.isTeamA === true;
      await handleReplaceTbdPlayer(
        showReplaceTbdModal,
        selectedMember,
        isTeamA
      );
      setShowReplaceTbdModal('');
      showSuccessToast('Jugador reemplazado correctamente');

      // Call the callback function to refresh data after successful replacement
      if (onSuccessfulReplace) {
        console.log('Calling refresh callback after replacement');
        onSuccessfulReplace();
      }
    } catch (error) {
      console.error('Error replacing TBD player:', error);
      showErrorToast('Error al reemplazar jugador');
    } finally {
      setIsReplacing(false);
    }
  };

  if (!showReplaceTbdModal) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 max-w-md w-full'>
        <div className='mb-4'>
          <h3 className='text-lg font-medium text-gray-900'>
            Reemplazar Jugador TBD
          </h3>
          <p className='text-sm text-gray-500'>
            Selecciona un jugador para reemplazar a {tbdPlayer?.name || 'TBD'}
          </p>
        </div>

        <div className='py-4'>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Seleccionar jugador
          </label>
          {availableMembers.length > 0 ? (
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
            >
              <option value=''>-- Seleccionar jugador --</option>
              {availableMembers.map((player: any) => (
                <option key={player.id} value={player.id}>
                  {player.name || 'Sin nombre'}
                </option>
              ))}
            </select>
          ) : (
            <p className='text-sm text-gray-500 italic py-2'>
              No hay jugadores disponibles para reemplazar. Todos los jugadores
              confirmados ya están asignados a equipos.
            </p>
          )}
        </div>

        <div className='flex justify-end gap-2 mt-4'>
          <Button variant='outline' onClick={() => setShowReplaceTbdModal('')}>
            Cancelar
          </Button>
          <Button
            onClick={handleReplace}
            disabled={
              !selectedMember || isReplacing || availableMembers.length === 0
            }
          >
            {isReplacing ? 'Procesando...' : 'Reemplazar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReplaceTbdPlayerModal;
