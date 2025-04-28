import React from 'react';
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
}

const AttendanceConfirmation: React.FC<AttendanceConfirmationProps> = ({
  userAttendanceStatus,
  handleGroupAttendance,
  disabled = false,
  confirmedCount = 0,
  requiredPlayers = 0,
}) => {
  // Normalized status check function to handle both uppercase and lowercase variants
  const isStatus = (
    status: string,
    checkStatus: ParticipantStatus
  ): boolean => {
    return status?.toUpperCase() === checkStatus.toUpperCase();
  };

  const isConfirmed =
    userAttendanceStatus && isStatus(userAttendanceStatus, 'CONFIRMED');
  const isDeclined =
    userAttendanceStatus && isStatus(userAttendanceStatus, 'DECLINED');
  const isPending =
    userAttendanceStatus && isStatus(userAttendanceStatus, 'PENDING');

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
          onClick={() => handleGroupAttendance('CONFIRMED')}
          disabled={disabled || isConfirmed || allSpotsFilled}
          className={`flex-1 py-2.5 px-4 rounded-md shadow-sm text-sm font-medium flex items-center justify-center transition-all ${
            isConfirmed
              ? 'bg-green-100 text-green-800 border border-green-300 cursor-default'
              : allSpotsFilled
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          }`}
        >
          {isConfirmed ? (
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
          onClick={() => handleGroupAttendance('DECLINED')}
          disabled={disabled || isDeclined}
          className={`flex-1 py-2.5 px-4 rounded-md shadow-sm text-sm font-medium flex items-center justify-center transition-all ${
            isDeclined
              ? 'bg-red-100 text-red-800 border border-red-300 cursor-default'
              : 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
          }`}
        >
          {isDeclined ? (
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
