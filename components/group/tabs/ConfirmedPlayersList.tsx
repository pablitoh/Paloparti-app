import React from 'react';
import { Avatar } from '@mui/material';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { ParticipantStatus } from '../../../types/group';

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  status?: ParticipantStatus;
}

interface ConfirmedPlayersListProps {
  confirmedPlayers: Player[];
  pendingPlayers?: Player[];
  declinedPlayers?: Player[];
  currentUserIsAdmin: boolean;
  onConfirmAttendance?: (userId: string) => Promise<void>;
  onDeclineAttendance?: (userId: string) => Promise<void>;
}

const ConfirmedPlayersList: React.FC<ConfirmedPlayersListProps> = ({
  confirmedPlayers,
  pendingPlayers = [],
  declinedPlayers = [],
  currentUserIsAdmin,
  onConfirmAttendance,
  onDeclineAttendance,
}) => {
  const handleConfirmAttendance = async (userId: string) => {
    if (onConfirmAttendance) {
      try {
        await onConfirmAttendance(userId);
      } catch (error) {
        console.error('Error confirming attendance:', error);
      }
    }
  };

  const handleDeclineAttendance = async (userId: string) => {
    if (onDeclineAttendance) {
      try {
        await onDeclineAttendance(userId);
      } catch (error) {
        console.error('Error declining attendance:', error);
      }
    }
  };

  return (
    <div className='space-y-6'>
      {/* Confirmed Players Section */}
      <div>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-medium text-gray-900'>
            Jugadores Confirmados
          </h3>
          <span className='px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full'>
            {confirmedPlayers.length} confirmados
          </span>
        </div>

        <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
          {confirmedPlayers.length > 0 ? (
            <ul className='divide-y divide-gray-100'>
              {confirmedPlayers.map((player) => (
                <li
                  key={player.id}
                  className='p-3 flex items-center justify-between'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar
                      src={player.avatar || ''}
                      alt={player.name || 'Jugador'}
                      className='h-10 w-10 rounded-full'
                    >
                      {player.name
                        ? player.name
                            .split(' ')
                            .map((n) => n[0])
                            .filter((char) => /[A-Za-z]/.test(char))
                            .join('')
                            .toUpperCase() || 'J'
                        : 'J'}
                    </Avatar>
                    <span className='font-medium text-gray-800'>
                      {player.name || 'Jugador sin nombre'}
                    </span>
                  </div>
                  <div className='flex items-center'>
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      <CheckCircleIcon className='mr-1 h-4 w-4' />
                      Confirmado
                    </span>

                    {currentUserIsAdmin && (
                      <button
                        onClick={() => handleDeclineAttendance(player.id)}
                        className='ml-2 text-xs text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded-full transition-colors'
                        title='Quitar asistencia'
                        aria-label='Quitar asistencia de este jugador'
                      >
                        <XCircleIcon className='h-5 w-5' />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className='p-4 text-center text-gray-500'>
              No hay jugadores confirmados
            </div>
          )}
        </div>
      </div>

      {/* Pending Players Section */}
      {pendingPlayers.length > 0 && (
        <div>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-lg font-medium text-gray-900'>
              Jugadores Pendientes
            </h3>
            <span className='px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full'>
              {pendingPlayers.length} pendientes
            </span>
          </div>

          <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
            <ul className='divide-y divide-gray-100'>
              {pendingPlayers.map((player) => (
                <li
                  key={player.id}
                  className='p-3 flex items-center justify-between'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar
                      src={player.avatar || ''}
                      alt={player.name || 'Jugador'}
                      className='h-10 w-10 rounded-full'
                    >
                      {player.name
                        ? player.name
                            .split(' ')
                            .map((n) => n[0])
                            .filter((char) => /[A-Za-z]/.test(char))
                            .join('')
                            .toUpperCase() || 'J'
                        : 'J'}
                    </Avatar>
                    <span className='font-medium text-gray-800'>
                      {player.name || 'Jugador sin nombre'}
                    </span>
                  </div>

                  {currentUserIsAdmin && (
                    <div className='flex space-x-1'>
                      <button
                        onClick={() => handleConfirmAttendance(player.id)}
                        className='inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-600 hover:bg-green-100'
                      >
                        <CheckCircleIcon className='mr-1 h-4 w-4' />
                        Confirmar
                      </button>
                      <button
                        onClick={() => handleDeclineAttendance(player.id)}
                        className='inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-600 hover:bg-red-100'
                      >
                        <XCircleIcon className='mr-1 h-4 w-4' />
                        Declinar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Declined Players Section */}
      {declinedPlayers.length > 0 && (
        <div>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-lg font-medium text-gray-900'>
              Jugadores que no asisten
            </h3>
            <span className='px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full'>
              {declinedPlayers.length} ausentes
            </span>
          </div>

          <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
            <ul className='divide-y divide-gray-100'>
              {declinedPlayers.map((player) => (
                <li
                  key={player.id}
                  className='p-3 flex items-center justify-between'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar
                      src={player.avatar || ''}
                      alt={player.name || 'Jugador'}
                      className='h-10 w-10 rounded-full'
                    >
                      {player.name
                        ? player.name
                            .split(' ')
                            .map((n) => n[0])
                            .filter((char) => /[A-Za-z]/.test(char))
                            .join('')
                            .toUpperCase() || 'J'
                        : 'J'}
                    </Avatar>
                    <span className='font-medium text-gray-500'>
                      {player.name || 'Jugador sin nombre'}
                    </span>
                  </div>

                  {currentUserIsAdmin && (
                    <button
                      onClick={() => handleConfirmAttendance(player.id)}
                      className='inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-600 hover:bg-green-100'
                    >
                      <CheckCircleIcon className='mr-1 h-4 w-4' />
                      Marcar asistencia
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmedPlayersList;
