import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '../Button';

interface UnassignedPlayersNotificationProps {
  unassignedCount: number;
  onRandomizeTeams: () => Promise<void>;
  isLoading?: boolean;
}

const UnassignedPlayersNotification = ({
  unassignedCount,
  onRandomizeTeams,
  isLoading = false,
}: UnassignedPlayersNotificationProps) => {
  const hasUnassignedPlayers = unassignedCount > 0;
  const backgroundColor = hasUnassignedPlayers ? 'bg-yellow-50' : 'bg-blue-50';
  const borderColor = hasUnassignedPlayers
    ? 'border-yellow-400'
    : 'border-blue-400';
  const textColor = hasUnassignedPlayers ? 'text-yellow-700' : 'text-blue-700';
  const iconColor = hasUnassignedPlayers ? 'text-yellow-400' : 'text-blue-400';

  return (
    <div
      className={`${backgroundColor} border-l-4 ${borderColor} p-4 mb-4 rounded-md`}
    >
      <div className='flex items-start'>
        <div className='flex-shrink-0'>
          {hasUnassignedPlayers ? (
            <svg
              className={`h-5 w-5 ${iconColor}`}
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              <path
                fillRule='evenodd'
                d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
          ) : (
            <svg
              className={`h-5 w-5 ${iconColor}`}
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                clipRule='evenodd'
              />
            </svg>
          )}
        </div>
        <div className='ml-3 flex-1 md:flex md:justify-between'>
          <p className={`text-sm ${textColor}`}>
            {hasUnassignedPlayers ? (
              <>
                Hay {unassignedCount}{' '}
                {unassignedCount === 1
                  ? 'jugador confirmado'
                  : 'jugadores confirmados'}{' '}
                que no{' '}
                {unassignedCount === 1 ? 'está asignado' : 'están asignados'} a
                ningún equipo.
              </>
            ) : (
              <>Todos los jugadores confirmados están asignados a equipos.</>
            )}
          </p>
          <div className='mt-3 text-sm md:mt-0 md:ml-6'>
            <Button
              onClick={onRandomizeTeams}
              disabled={isLoading}
              className='inline-flex items-center'
              size='sm'
            >
              <ArrowPathIcon className='h-4 w-4 mr-1' />
              {isLoading ? 'Sorteando...' : 'Sortear equipos'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnassignedPlayersNotification;
