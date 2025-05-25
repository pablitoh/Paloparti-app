import {
  ArrowPathIcon,
  PlusIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import Button from '../Button';
import { useState } from 'react';

interface TeamFormationNotificationProps {
  confirmedCount: number;
  requiredPlayers: number;
  sortCount: number;
  unassignedCount?: number;
  cancelledFromTeamsCount?: number;
  onRandomizeTeams: () => Promise<void>;
  isLoading?: boolean;
  currentUserIsAdmin: boolean;
  allowFillIn?: boolean;
  setAllowFillIn?: (value: boolean) => void;
  balanceByAge?: boolean;
  setBalanceByAge?: (value: boolean) => void;
  balanceByRole?: boolean;
  setBalanceByRole?: (value: boolean) => void;
  balanceByRating?: boolean;
  setBalanceByRating?: (value: boolean) => void;
}

const TeamFormationNotification = ({
  confirmedCount,
  requiredPlayers,
  sortCount,
  unassignedCount = 0,
  cancelledFromTeamsCount = 0,
  onRandomizeTeams,
  isLoading = false,
  currentUserIsAdmin,
  allowFillIn = false,
  setAllowFillIn,
  balanceByAge = false,
  setBalanceByAge,
  balanceByRole = true,
  setBalanceByRole,
  balanceByRating = false,
  setBalanceByRating,
}: TeamFormationNotificationProps) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Si no es admin, no mostrar nada
  if (!currentUserIsAdmin) return null;

  // Determinar colores, iconos y mensaje según el estado
  let backgroundColor = 'bg-gradient-to-r from-blue-50 to-indigo-50';
  let borderColor = 'border-blue-200';
  let textColor = 'text-blue-800';
  let iconColor = 'text-blue-500';
  let message = '';
  let emoji = '⚽';
  let StatusIcon = InformationCircleIcon;

  // Condición para mostrar el botón de sortear
  const canCreateTeams = confirmedCount > 1;
  const hasAllRequiredPlayers = confirmedCount >= requiredPlayers;

  // Si hay equipos formados pero sortCount = 0, significa que es un partido recién creado pero ya tiene equipos
  // Esto es para manejar partidos nuevos con sortCount=0 pero que ya tienen equipos
  const isInitialTeamFormation = sortCount === 0;

  // Si hay sortCount 0, mostrar mensaje sobre jugadores confirmados
  if (isInitialTeamFormation) {
    // Mensaje para cuando se acumulan jugadores pero aún no se sortean equipos
    if (confirmedCount === 0) {
      message = '¡Esperando jugadores! Aún no hay confirmaciones.';
      backgroundColor = 'bg-gradient-to-r from-gray-50 to-slate-50';
      borderColor = 'border-gray-200';
      textColor = 'text-gray-700';
      iconColor = 'text-gray-400';
      emoji = '⏳';
      StatusIcon = UserGroupIcon;
    } else if (confirmedCount < requiredPlayers) {
      message = `¡Vamos bien! ${confirmedCount}/${requiredPlayers} jugadores confirmados.`;
      backgroundColor = 'bg-gradient-to-r from-yellow-50 to-amber-50';
      borderColor = 'border-yellow-200';
      textColor = 'text-yellow-800';
      iconColor = 'text-yellow-500';
      emoji = '🔥';
      StatusIcon = ExclamationTriangleIcon;
    } else {
      message = `¡Perfecto! Todos confirmados. ¡Hora de sortear!`;
      backgroundColor = 'bg-gradient-to-r from-green-50 to-emerald-50';
      borderColor = 'border-green-200';
      textColor = 'text-green-800';
      iconColor = 'text-green-500';
      emoji = '🎉';
      StatusIcon = CheckCircleIcon;
    }
  } else {
    // Si ya se sortearon equipos (sortCount > 0), mostrar mensaje sobre jugadores sin asignar y cancelaciones
    if (cancelledFromTeamsCount > 0 && unassignedCount > 0) {
      // Caso: hay jugadores que cancelaron desde equipos Y jugadores sin asignar
      message = `¡Atención! ${cancelledFromTeamsCount} cancelaron + ${unassignedCount} nuevos sin asignar.`;
      backgroundColor = 'bg-gradient-to-r from-orange-50 to-red-50';
      borderColor = 'border-orange-200';
      textColor = 'text-orange-800';
      iconColor = 'text-orange-500';
      emoji = '⚠️';
      StatusIcon = ExclamationTriangleIcon;
    } else if (cancelledFromTeamsCount > 0) {
      // Caso: solo hay jugadores que cancelaron desde equipos
      message = `${cancelledFromTeamsCount} ${
        cancelledFromTeamsCount === 1
          ? 'jugador canceló'
          : 'jugadores cancelaron'
      } y ${
        cancelledFromTeamsCount === 1
          ? 'fue reemplazado'
          : 'fueron reemplazados'
      } con TBD. ¡Considera re-sortear!`;
      backgroundColor = 'bg-gradient-to-r from-orange-50 to-amber-50';
      borderColor = 'border-orange-200';
      textColor = 'text-orange-800';
      iconColor = 'text-orange-500';
      emoji = '🔄';
      StatusIcon = ArrowPathIcon;
    } else if (unassignedCount > 0) {
      // Caso: solo hay jugadores sin asignar (comportamiento original)
      message = `¡Nuevos jugadores! ${unassignedCount} ${
        unassignedCount === 1 ? 'jugador necesita' : 'jugadores necesitan'
      } asignación.`;
      backgroundColor = 'bg-gradient-to-r from-yellow-50 to-orange-50';
      borderColor = 'border-yellow-200';
      textColor = 'text-yellow-800';
      iconColor = 'text-yellow-500';
      emoji = '➕';
      StatusIcon = PlusIcon;
    } else {
      // Caso: todo está bien
      message = '¡Excelente! Todos asignados a equipos.';
      backgroundColor = 'bg-gradient-to-r from-green-50 to-teal-50';
      borderColor = 'border-green-200';
      textColor = 'text-green-800';
      iconColor = 'text-green-500';
      emoji = '✅';
      StatusIcon = CheckCircleIcon;
    }
  }

  // Función para manejar el click del botón sortear
  const handleSortClick = () => {
    if (hasAllRequiredPlayers) {
      // Si tiene todos los jugadores, sortear directamente
      onRandomizeTeams();
    } else {
      // Si no tiene todos los jugadores, mostrar modal de confirmación
      setShowConfirmModal(true);
    }
  };

  // Función para confirmar el sorteo con jugadores faltantes
  const handleConfirmSort = () => {
    setShowConfirmModal(false);
    // Temporalmente activar allowFillIn para este sorteo
    if (setAllowFillIn) {
      setAllowFillIn(true);
    }
    onRandomizeTeams();
  };

  // Función para renderizar un botón toggle
  const renderToggleButton = (
    checked: boolean,
    onChange: (checked: boolean) => void,
    title: string,
    icon: string
  ) => (
    <button
      onClick={() => onChange(!checked)}
      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${
        checked
          ? 'bg-blue-500 text-white border-blue-500 shadow-md hover:bg-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <span className='flex items-center'>
        <span className='mr-1.5'>{icon}</span>
        {title}
      </span>
    </button>
  );

  return (
    <>
      <div className='space-y-3'>
        <div
          className={`${backgroundColor} border ${borderColor} p-4 rounded-lg shadow-md`}
        >
          {/* Layout principal con flex para poner el botón a la derecha */}
          <div className='flex items-start justify-between'>
            {/* Contenido principal a la izquierda */}
            <div className='flex items-start flex-1 mr-4'>
              <div className='flex-shrink-0'>
                <div
                  className={`p-1.5 rounded-full ${
                    backgroundColor
                      .replace('from-', 'bg-')
                      .replace('to-', '')
                      .split(' ')[0]
                  }`}
                >
                  <StatusIcon className={`h-5 w-5 ${iconColor}`} />
                </div>
              </div>
              <div className='ml-3 flex-1'>
                <div className='flex items-center mb-2'>
                  <span className='text-lg mr-2'>{emoji}</span>
                  <h3 className={`text-sm font-bold ${textColor}`}>
                    Formación de Equipos
                  </h3>
                </div>
                <p className={`text-sm ${textColor} mb-3`}>{message}</p>

                {/* Opciones como botones toggle */}
                <div className='mb-3'>
                  <div className='flex flex-wrap gap-2'>
                    {/* Opción para equilibrar por rol */}
                    {setBalanceByRole &&
                      renderToggleButton(
                        balanceByRole,
                        setBalanceByRole,
                        'Por posición',
                        '⚽'
                      )}

                    {/* Opción para equilibrar por edad */}
                    {setBalanceByAge &&
                      renderToggleButton(
                        balanceByAge,
                        setBalanceByAge,
                        'Por edad',
                        '👥'
                      )}

                    {/* Opción para equilibrar por nivel */}
                    {setBalanceByRating &&
                      renderToggleButton(
                        balanceByRating,
                        setBalanceByRating,
                        'Por nivel',
                        '⭐'
                      )}
                  </div>

                  {/* Nota informativa compacta con asterisco */}
                  {setBalanceByAge &&
                    setBalanceByRole &&
                    setBalanceByRating && (
                      <div className='mt-2'>
                        <p className='text-xs text-gray-500'>
                          * Sin criterios = sorteo aleatorio
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Botón de sortear - A la derecha centrado verticalmente */}
            <div className='flex items-center'>
              <Button
                onClick={handleSortClick}
                disabled={isLoading || !canCreateTeams}
                className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 ${
                  isInitialTeamFormation
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                } text-white border-0`}
                size='sm'
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
                    ⚡ Procesando...
                  </span>
                ) : (
                  <span className='flex items-center'>
                    {isInitialTeamFormation ? (
                      <>
                        <PlusIcon className='mr-1.5 h-4 w-4' />
                        🎲 Sortear
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className='h-4 w-4 mr-1.5' />
                        🔄 Re-sortear
                      </>
                    )}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-xl shadow-2xl max-w-md w-full p-6'>
            <div className='flex items-center mb-4'>
              <div className='flex-shrink-0'>
                <ExclamationCircleIcon className='h-8 w-8 text-amber-500' />
              </div>
              <div className='ml-3'>
                <h3 className='text-lg font-semibold text-gray-900'>
                  ⚠️ Confirmar sorteo
                </h3>
              </div>
            </div>

            <div className='mb-6'>
              <p className='text-sm text-gray-600 mb-3'>
                Solo tienes{' '}
                <span className='font-semibold text-amber-600'>
                  {confirmedCount} jugadores confirmados
                </span>{' '}
                de los{' '}
                <span className='font-semibold'>
                  {requiredPlayers} requeridos
                </span>
                .
              </p>
              <p className='text-sm text-gray-600'>
                ¿Estás seguro que querés sortear los equipos sin todos los
                jugadores requeridos? Se completarán automáticamente con
                jugadores TBD.
              </p>
            </div>

            <div className='flex gap-3 justify-end'>
              <Button
                onClick={() => setShowConfirmModal(false)}
                className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors'
                size='sm'
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSort}
                className='px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg shadow-md transition-all duration-200'
                size='sm'
              >
                🎲 Sortear de todas formas
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamFormationNotification;
