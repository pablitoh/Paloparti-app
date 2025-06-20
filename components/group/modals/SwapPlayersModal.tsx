import { useState, useEffect, useMemo } from 'react';
import Button from '../../Button';
import { Avatar } from '@mui/material';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';
import {
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { normalizeTbdPlayers } from '../../../utils/tbdPlayersUtils';

interface Player {
  id: string;
  name: string;
  avatar?: string | null;
  isTeamA: boolean;
  playerType?: string;
}

interface SwapPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: any;
  onSuccess?: () => void;
  preSelectedPlayer?: { playerId: string; isTeamA: boolean } | null;
}

const SwapPlayersModal = ({
  isOpen,
  onClose,
  group,
  onSuccess,
  preSelectedPlayer,
}: SwapPlayersModalProps) => {
  const [selectedPlayer1, setSelectedPlayer1] = useState<Player | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Get all players from both teams
  const allPlayers = useMemo(() => {
    if (!group?.nextMatchDetails) return { teamA: [], teamB: [] };

    const playersA = group.nextMatchDetails.playersA || [];
    const playersB = group.nextMatchDetails.playersB || [];

    // Normalize TBD players from the match details using the utility
    const normalizedTbdPlayers = normalizeTbdPlayers(
      group.nextMatchDetails.tbdPlayers
    );

    // Convert to flat array and separate by team
    const tbdPlayersArray = [
      ...normalizedTbdPlayers.teamA.map((p: any) => ({
        ...p,
        isTeamA: true,
        playerType: 'TBD',
      })),
      ...normalizedTbdPlayers.teamB.map((p: any) => ({
        ...p,
        isTeamA: false,
        playerType: 'TBD',
      })),
    ];

    const tbdPlayersA = tbdPlayersArray.filter((p: Player) => p.isTeamA);
    const tbdPlayersB = tbdPlayersArray.filter((p: Player) => !p.isTeamA);

    return {
      teamA: [
        ...playersA.map((p: any) => ({
          ...p,
          playerType: 'REAL',
          isTeamA: true,
        })),
        ...tbdPlayersA,
      ],
      teamB: [
        ...playersB.map((p: any) => ({
          ...p,
          playerType: 'REAL',
          isTeamA: false,
        })),
        ...tbdPlayersB,
      ],
    };
  }, [group?.nextMatchDetails]);

  // Reset selections when modal opens/closes and handle pre-selection
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayer1(null);
      setSelectedPlayer2(null);
    } else {
      // Reset selections first
      setSelectedPlayer1(null);
      setSelectedPlayer2(null);

      // Pre-select player if provided
      if (preSelectedPlayer) {
        // Find the player in allPlayers
        const teamPlayers = preSelectedPlayer.isTeamA
          ? allPlayers.teamA
          : allPlayers.teamB;
        const player = teamPlayers.find(
          (p) => p.id === preSelectedPlayer.playerId
        );
        if (player) {
          setSelectedPlayer1(player);
        }
      }
    }
  }, [isOpen, preSelectedPlayer, allPlayers]);

  const handleSwap = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) {
      showErrorToast('Debes seleccionar dos jugadores para intercambiar');
      return;
    }

    if (selectedPlayer1.isTeamA === selectedPlayer2.isTeamA) {
      showErrorToast('Los jugadores deben estar en equipos diferentes');
      return;
    }

    if (!group?.nextMatchDetails?.id) {
      showErrorToast('No se pudo encontrar el partido');
      return;
    }

    setIsSwapping(true);

    try {
      const response = await fetch(
        `/api/matches/${group.nextMatchDetails.id}/swap-players`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            player1Id: selectedPlayer1.id,
            player2Id: selectedPlayer2.id,
            player1IsTeamA: selectedPlayer1.isTeamA,
            player2IsTeamA: selectedPlayer2.isTeamA,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al intercambiar jugadores');
      }

      showSuccessToast('Jugadores intercambiados correctamente');

      // Call the callback function to refresh data first
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a small delay to ensure data refresh
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      console.error('Error swapping players:', error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : 'Error al intercambiar jugadores'
      );
    } finally {
      setIsSwapping(false);
    }
  };

  const renderPlayerList = (
    players: Player[],
    teamName: string,
    isTeamA: boolean
  ) => (
    <div className='space-y-2'>
      <h4 className='font-medium text-gray-900 mb-3'>{teamName}</h4>
      {players.length === 0 ? (
        <p className='text-sm text-gray-500 italic'>
          No hay jugadores en este equipo
        </p>
      ) : (
        players.map((player) => {
          const isSelected =
            selectedPlayer1?.id === player.id ||
            selectedPlayer2?.id === player.id;
          const isDisabled =
            isSelected &&
            ((selectedPlayer1?.id === player.id &&
              selectedPlayer2?.isTeamA === isTeamA) ||
              (selectedPlayer2?.id === player.id &&
                selectedPlayer1?.isTeamA === isTeamA));

          return (
            <div
              key={player.id}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (isDisabled) return;

                if (isSelected) {
                  // Deselect
                  if (selectedPlayer1?.id === player.id) {
                    setSelectedPlayer1(null);
                  } else if (selectedPlayer2?.id === player.id) {
                    setSelectedPlayer2(null);
                  }
                } else {
                  // Select
                  if (!selectedPlayer1) {
                    setSelectedPlayer1(player);
                  } else if (
                    !selectedPlayer2 &&
                    selectedPlayer1.isTeamA !== isTeamA
                  ) {
                    setSelectedPlayer2(player);
                  } else if (selectedPlayer1.isTeamA === isTeamA) {
                    // Replace player1 if same team
                    setSelectedPlayer1(player);
                  }
                }
              }}
            >
              <div className='flex items-center flex-1'>
                {player.avatar ? (
                  <Avatar
                    src={player.avatar}
                    className='mr-3'
                    sx={{ width: 32, height: 32 }}
                  />
                ) : (
                  <div className='w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3'>
                    <span className='text-xs text-gray-600'>
                      {player.playerType === 'TBD'
                        ? '?'
                        : player.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div className='flex-1'>
                  <span className='text-sm font-medium text-gray-900'>
                    {player.name || 'Jugador sin nombre'}
                  </span>
                  {player.playerType === 'TBD' && (
                    <span className='ml-2 text-xs text-gray-500 italic'>
                      (TBD)
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div className='w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center'>
                    <span className='text-white text-xs font-bold'>
                      {selectedPlayer1?.id === player.id ? '1' : '2'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]'>
      <div className='bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-green-lg border border-primary-100'>
        <div className='mb-6'>
          <div className='flex justify-between items-start'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 flex items-center'>
                <ArrowsRightLeftIcon className='h-5 w-5 mr-2' />
                Intercambiar Jugadores Entre Equipos
              </h3>
              <p className='text-sm text-gray-500 mt-1'>
                Selecciona un jugador de cada equipo para intercambiarlos de
                posición
              </p>
            </div>
            <Button
              variant='secondary'
              onClick={onClose}
              disabled={isSwapping}
              className='ml-4'
              size='sm'
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Selection Summary */}
        {(selectedPlayer1 || selectedPlayer2) && (
          <div className='mb-6 p-4 bg-gradient-to-r from-primary-50 to-lime-50 rounded-xl border border-primary-200'>
            <div className='flex items-center justify-center space-x-4'>
              <div className='text-center'>
                <div className='text-xs text-gray-500 mb-1'>Jugador 1</div>
                {selectedPlayer1 ? (
                  <div className='flex items-center'>
                    {selectedPlayer1.avatar ? (
                      <Avatar
                        src={selectedPlayer1.avatar}
                        sx={{ width: 24, height: 24 }}
                        className='mr-2'
                      />
                    ) : (
                      <div className='w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2'>
                        <span className='text-xs'>
                          {selectedPlayer1.playerType === 'TBD'
                            ? '?'
                            : selectedPlayer1.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <span className='text-sm font-medium'>
                      {selectedPlayer1.name} (
                      {selectedPlayer1.isTeamA ? 'Equipo A' : 'Equipo B'})
                    </span>
                  </div>
                ) : (
                  <span className='text-sm text-gray-400'>No seleccionado</span>
                )}
              </div>

              <ArrowsRightLeftIcon className='h-6 w-6 text-primary-500' />

              <div className='text-center'>
                <div className='text-xs text-gray-500 mb-1'>Jugador 2</div>
                {selectedPlayer2 ? (
                  <div className='flex items-center'>
                    {selectedPlayer2.avatar ? (
                      <Avatar
                        src={selectedPlayer2.avatar}
                        sx={{ width: 24, height: 24 }}
                        className='mr-2'
                      />
                    ) : (
                      <div className='w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2'>
                        <span className='text-xs'>
                          {selectedPlayer2.playerType === 'TBD'
                            ? '?'
                            : selectedPlayer2.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <span className='text-sm font-medium'>
                      {selectedPlayer2.name} (
                      {selectedPlayer2.isTeamA ? 'Equipo A' : 'Equipo B'})
                    </span>
                  </div>
                ) : (
                  <span className='text-sm text-gray-400'>No seleccionado</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Teams */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
          <div className='border border-primary-200 rounded-xl p-4 bg-primary-50/30'>
            {renderPlayerList(
              allPlayers.teamA,
              group?.teamAName || 'Equipo A',
              true
            )}
          </div>
          <div className='border border-coral-200 rounded-xl p-4 bg-coral-50/30'>
            {renderPlayerList(
              allPlayers.teamB,
              group?.teamBName || 'Equipo B',
              false
            )}
          </div>
        </div>

        {/* Warning */}
        <div className='mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md'>
          <div className='flex'>
            <ExclamationTriangleIcon className='h-5 w-5 text-yellow-400 mr-2 flex-shrink-0' />
            <div className='text-sm text-yellow-800'>
              <strong>Importante:</strong> Esta acción intercambiará
              permanentemente los jugadores entre equipos. La acción quedará
              registrada en los logs del grupo.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className='flex justify-end space-x-3'>
          <Button variant='secondary' onClick={onClose} disabled={isSwapping}>
            Cancelar
          </Button>
          <Button
            variant='primary'
            onClick={handleSwap}
            disabled={!selectedPlayer1 || !selectedPlayer2 || isSwapping}
            className='flex items-center'
          >
            {isSwapping ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
                Intercambiando...
              </>
            ) : (
              <>
                <ArrowsRightLeftIcon className='h-4 w-4 mr-2' />
                Intercambiar Jugadores
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SwapPlayersModal;
