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
        <div className='mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            Jugadores Confirmados
          </h3>
        </div>

        {confirmedPlayers.length > 0 ? (
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4'>
            {confirmedPlayers.map((player) => (
              <div
                key={player.id}
                className='flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200'
              >
                <Avatar
                  src={player.avatar || ''}
                  alt={player.name || 'Jugador'}
                  className='h-12 w-12 mb-2 border-2 border-green-200'
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
                <span className='text-sm font-medium text-gray-800 text-center leading-tight'>
                  {player.name || 'Jugador'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className='p-8 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
            <div className='w-12 h-12 mx-auto mb-3 text-gray-400'>
              <CheckCircleIcon />
            </div>
            <p className='text-sm font-medium'>No hay jugadores confirmados</p>
            <p className='text-xs text-gray-400 mt-1'>
              Los jugadores confirmados aparecerán aquí
            </p>
          </div>
        )}
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
