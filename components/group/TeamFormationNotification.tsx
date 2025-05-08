import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import Button from '../Button';

interface TeamFormationNotificationProps {
  confirmedCount: number;
  requiredPlayers: number;
  sortCount: number;
  unassignedCount?: number;
  onRandomizeTeams: () => Promise<void>;
  isLoading?: boolean;
  currentUserIsAdmin: boolean;
  allowFillIn?: boolean;
  setAllowFillIn?: (value: boolean) => void;
  balanceByAge?: boolean;
  setBalanceByAge?: (value: boolean) => void;
}

const TeamFormationNotification = ({
  confirmedCount,
  requiredPlayers,
  sortCount,
  unassignedCount = 0,
  onRandomizeTeams,
  isLoading = false,
  currentUserIsAdmin,
  allowFillIn = false,
  setAllowFillIn,
  balanceByAge = false,
  setBalanceByAge,
}: TeamFormationNotificationProps) => {
  // Si no es admin, no mostrar nada
  if (!currentUserIsAdmin) return null;

  // Determinar colores y mensaje según el estado
  let backgroundColor = 'bg-blue-50';
  let borderColor = 'border-blue-400';
  let textColor = 'text-blue-700';
  let iconColor = 'text-blue-400';
  let message = '';

  // Condición para mostrar el botón de sortear
  const canCreateTeams =
    confirmedCount > 1 && (allowFillIn || confirmedCount >= requiredPlayers);

  // Si hay equipos formados pero sortCount = 0, significa que es un partido recién creado pero ya tiene equipos
  // Esto es para manejar partidos nuevos con sortCount=0 pero que ya tienen equipos
  const isInitialTeamFormation = sortCount === 0;

  // Si hay sortCount 0, mostrar mensaje sobre jugadores confirmados
  if (isInitialTeamFormation) {
    // Mensaje para cuando se acumulan jugadores pero aún no se sortean equipos
    if (confirmedCount === 0) {
      message = 'Aún no hay jugadores confirmados para este partido.';
      backgroundColor = 'bg-gray-50';
      borderColor = 'border-gray-400';
      textColor = 'text-gray-700';
      iconColor = 'text-gray-400';
    } else if (confirmedCount < requiredPlayers) {
      message = `Hay ${confirmedCount} ${
        confirmedCount === 1 ? 'jugador confirmado' : 'jugadores confirmados'
      } de ${requiredPlayers} requeridos.`;
      backgroundColor = 'bg-yellow-50';
      borderColor = 'border-yellow-400';
      textColor = 'text-yellow-700';
      iconColor = 'text-yellow-400';
    } else {
      message = `¡Ya están todos los jugadores confirmados! Puedes sortear los equipos.`;
      backgroundColor = 'bg-green-50';
      borderColor = 'border-green-400';
      textColor = 'text-green-700';
      iconColor = 'text-green-400';
    }
  } else {
    // Si ya se sortearon equipos (sortCount > 0), mostrar mensaje sobre jugadores sin asignar
    if (unassignedCount > 0) {
      message = `Hay ${unassignedCount} ${
        unassignedCount === 1 ? 'jugador confirmado' : 'jugadores confirmados'
      } que no ${
        unassignedCount === 1 ? 'está asignado' : 'están asignados'
      } a ningún equipo.`;
      backgroundColor = 'bg-yellow-50';
      borderColor = 'border-yellow-400';
      textColor = 'text-yellow-700';
      iconColor = 'text-yellow-400';
    } else {
      message = 'Todos los jugadores confirmados están asignados a equipos.';
      backgroundColor = 'bg-green-50';
      borderColor = 'border-green-400';
      textColor = 'text-green-700';
      iconColor = 'text-green-400';
    }
  }

  return (
    <div className='space-y-3'>
      <div
        className={`${backgroundColor} border-l-4 ${borderColor} p-4 mb-2 rounded-md`}
      >
        <div className='flex items-start'>
          <div className='flex-shrink-0'>
            <svg
              className={`h-5 w-5 ${iconColor}`}
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              {backgroundColor.includes('yellow') ? (
                <path
                  fillRule='evenodd'
                  d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              ) : (
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              )}
            </svg>
          </div>
          <div className='ml-3 flex-1 md:flex md:justify-between'>
            <p className={`text-sm ${textColor}`}>{message}</p>
            <div className='mt-3 text-sm md:mt-0 md:ml-6'>
              <Button
                onClick={onRandomizeTeams}
                disabled={isLoading || !canCreateTeams}
                className='inline-flex items-center'
                size='sm'
                variant={isInitialTeamFormation ? 'primary' : 'outline'}
              >
                {isLoading ? (
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
                ) : (
                  <>
                    {isInitialTeamFormation ? (
                      <PlusIcon className='mr-1 h-5 w-5' />
                    ) : (
                      <ArrowPathIcon className='h-4 w-4 mr-1' />
                    )}
                    {isInitialTeamFormation
                      ? 'Sortear equipos'
                      : 'Re-sortear equipos'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkbox para completar equipos - visible siempre que se pueda modificar */}
      {setAllowFillIn && (
        <div className='flex flex-col gap-2 px-4'>
          <div className='flex items-start'>
            <input
              type='checkbox'
              id='allowFillIn'
              className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1'
              checked={allowFillIn}
              onChange={(e) => setAllowFillIn(e.target.checked)}
            />
            <label htmlFor='allowFillIn' className='ml-3 text-sm text-gray-700'>
              Completar equipos automáticamente con jugadores TBD
            </label>
          </div>
        </div>
      )}

      {/* Checkbox para equilibrar por edad - visible siempre que se pueda modificar */}
      {setBalanceByAge && (
        <div className='flex flex-col gap-2 px-4'>
          <div className='flex items-start'>
            <input
              type='checkbox'
              id='balanceByAge'
              className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1'
              checked={balanceByAge}
              onChange={(e) => setBalanceByAge(e.target.checked)}
            />
            <label
              htmlFor='balanceByAge'
              className='ml-3 text-sm text-gray-700'
            >
              Equilibrar equipos por edad
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamFormationNotification;
