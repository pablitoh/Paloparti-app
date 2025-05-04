import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import { XCircleIcon as XCircleIconSolid } from '@heroicons/react/24/solid';
import type { ParticipantStatus } from '../../types/group';

interface AttendanceConfirmationProps {
  userAttendanceStatus: ParticipantStatus | undefined;
  handleGroupAttendance: (status: ParticipantStatus) => Promise<void>;
  disabled?: boolean;
  confirmedCount?: number;
  requiredPlayers?: number;
  matchId?: string;
}

const AttendanceConfirmation: React.FC<AttendanceConfirmationProps> = ({
  userAttendanceStatus,
  handleGroupAttendance,
  disabled = false,
  confirmedCount = 0,
  requiredPlayers = 0,
  matchId,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [localAttendanceStatus, setLocalAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);

  // Update local state when props change or match ID changes
  useEffect(() => {
    // Reset local status when match ID changes (new match)
    if (matchId) {
      setLocalAttendanceStatus(userAttendanceStatus);
    }
  }, [userAttendanceStatus, matchId]);

  // Normalized status check function to handle both uppercase and lowercase variants
  const isStatus = (
    status: string,
    checkStatus: ParticipantStatus
  ): boolean => {
    return status?.toUpperCase() === checkStatus.toUpperCase();
  };

  const isConfirmed =
    localAttendanceStatus && isStatus(localAttendanceStatus, 'CONFIRMED');
  const isDeclined =
    localAttendanceStatus && isStatus(localAttendanceStatus, 'DECLINED');
  const isPending =
    localAttendanceStatus && isStatus(localAttendanceStatus, 'PENDING');

  // Check if all spots are filled (excluding the current user if they're already confirmed)
  const allSpotsFilled =
    requiredPlayers > 0 && confirmedCount >= requiredPlayers && !isConfirmed;

  // Get status color
  const getStatusColor = () => {
    if (isConfirmed) return 'bg-green-100 border-green-200';
    if (isDeclined) return 'bg-red-100 border-red-200';
    if (isPending) return 'bg-yellow-100 border-yellow-200';
    return 'bg-gray-100 border-gray-200';
  };

  // Get status text
  const getStatusText = () => {
    if (isConfirmed) return 'Has confirmado tu asistencia';
    if (isDeclined) return 'Has indicado que no asistirás';
    if (isPending) return 'Aún no has decidido';
    return 'Confirma tu asistencia';
  };

  // Handle attendance with loading state
  const handleAttendance = async (status: ParticipantStatus) => {
    if (status === 'CONFIRMED') {
      setIsConfirming(true);
    } else {
      setIsDeclining(true);
    }

    try {
      await handleGroupAttendance(status);

      // Update local status immediately
      setLocalAttendanceStatus(status);
    } catch (error) {
      console.error('Error updating attendance:', error);
      // No need to show error toast as it's handled in the hook
    } finally {
      if (status === 'CONFIRMED') {
        setIsConfirming(false);
      } else {
        setIsDeclining(false);
      }
    }
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${getStatusColor()}`}>
      {/* Status indicator */}
      <div className='flex items-center mb-4'>
        <div
          className={`rounded-full p-2 mr-3 ${
            isConfirmed
              ? 'bg-green-500'
              : isDeclined
              ? 'bg-red-500'
              : 'bg-gray-500'
          }`}
        >
          {isConfirmed && (
            <CheckCircleIconSolid className='h-6 w-6 text-white' />
          )}
          {isDeclined && <XCircleIconSolid className='h-6 w-6 text-white' />}
          {!isConfirmed && !isDeclined && (
            <QuestionMarkCircleIcon className='h-6 w-6 text-white' />
          )}
        </div>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            {getStatusText()}
          </h3>
          <p className='text-sm text-gray-600'>
            {confirmedCount} de {requiredPlayers} jugadores confirmados
          </p>
        </div>
      </div>

      {allSpotsFilled && (
        <div className='mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start'>
          <ExclamationTriangleIcon className='h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5' />
          <p className='text-sm text-amber-800'>
            El partido ya tiene todos los jugadores confirmados. Puedes indicar
            que no asistirás o esperar a que se libere un lugar.
          </p>
        </div>
      )}

      <div className='flex flex-col sm:flex-row gap-3'>
        <button
          onClick={() => handleAttendance('CONFIRMED')}
          disabled={
            disabled ||
            isConfirmed ||
            allSpotsFilled ||
            isConfirming ||
            isDeclining
          }
          className={`flex-1 py-2.5 px-4 rounded-md shadow-sm text-sm font-medium flex items-center justify-center transition-all ${
            isConfirmed
              ? 'bg-green-100 text-green-800 border border-green-300 cursor-default'
              : allSpotsFilled
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          }`}
        >
          {isConfirming ? (
            <span className='flex items-center'>
              <svg
                className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              Procesando...
            </span>
          ) : isConfirmed ? (
            <>
              <CheckCircleIconSolid className='h-5 w-5 mr-2' />
              <span>Confirmado</span>
            </>
          ) : (
            <>
              <CheckCircleIcon className='h-5 w-5 mr-2' />
              <span>Confirmar</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleAttendance('DECLINED')}
          disabled={disabled || isDeclined || isConfirming || isDeclining}
          className={`flex-1 py-2.5 px-4 rounded-md shadow-sm text-sm font-medium flex items-center justify-center transition-all ${
            isDeclined
              ? 'bg-red-100 text-red-800 border border-red-300 cursor-default'
              : 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
          }`}
        >
          {isDeclining ? (
            <span className='flex items-center'>
              <svg
                className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              Procesando...
            </span>
          ) : isDeclined ? (
            <>
              <XCircleIconSolid className='h-5 w-5 mr-2' />
              <span>No asistiré</span>
            </>
          ) : (
            <>
              <XCircleIcon className='h-5 w-5 mr-2' />
              <span>No puedo ir</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AttendanceConfirmation;
