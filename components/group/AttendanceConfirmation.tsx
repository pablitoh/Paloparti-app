import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
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
  const [isLoading, setIsLoading] = useState(false);
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

  // Check if all spots are filled (excluding the current user if they're already confirmed)
  const allSpotsFilled =
    requiredPlayers > 0 && confirmedCount >= requiredPlayers && !isConfirmed;

  // Handle attendance with loading state
  const handleAttendance = async (status: ParticipantStatus) => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await handleGroupAttendance(status);
      // Update local status immediately
      setLocalAttendanceStatus(status);
    } catch (error) {
      console.error('Error updating attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className=''>
      {allSpotsFilled && (
        <div className='mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start'>
          <ExclamationTriangleIcon className='h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5' />
          <p className='text-sm text-amber-800'>
            El partido ya tiene todos los jugadores confirmados. Puedes indicar
            que no asistirás o esperar a que se libere un lugar.
          </p>
        </div>
      )}

      <div className='flex flex-col sm:flex-row items-center gap-4'>
        {/* Toggle control para confirmación de asistencia */}
        <div className='flex-1 w-full sm:w-auto'>
          <div className='flex rounded-md shadow-sm'>
            <button
              onClick={() => handleAttendance('CONFIRMED')}
              disabled={
                disabled || isLoading || (allSpotsFilled && !isConfirmed)
              }
              className={`flex items-center justify-center px-4 py-2 rounded-l-md border text-sm font-medium transition-colors flex-1 ${
                isConfirmed
                  ? 'bg-green-500 text-white border-green-500'
                  : allSpotsFilled && !isConfirmed
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-green-50 border-gray-300'
              }`}
            >
              {isLoading && localAttendanceStatus === 'CONFIRMED' ? (
                <svg
                  className='animate-spin h-4 w-4 mr-1'
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
              ) : (
                <CheckCircleIcon
                  className={`h-4 w-4 mr-1 ${isConfirmed ? 'text-white' : ''}`}
                />
              )}
              <span>Asistiré</span>
            </button>

            <button
              onClick={() => handleAttendance('DECLINED')}
              disabled={disabled || isLoading}
              className={`flex items-center justify-center px-4 py-2 rounded-r-md border text-sm font-medium transition-colors flex-1 ${
                isDeclined
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-700 hover:bg-red-50 border-gray-300'
              }`}
            >
              {isLoading && localAttendanceStatus === 'DECLINED' ? (
                <svg
                  className='animate-spin h-4 w-4 mr-1'
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
              ) : (
                <XCircleIcon
                  className={`h-4 w-4 mr-1 ${isDeclined ? 'text-white' : ''}`}
                />
              )}
              <span>No puedo ir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceConfirmation;
