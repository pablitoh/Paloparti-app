import { useState, useEffect } from 'react';
import { Avatar } from '@mui/material';
import type { GroupWithRelations, Member } from '../../../types/group';
import type { AuthUser } from '../../../types/auth';
import {
  CheckIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface MembersTabProps {
  group: GroupWithRelations;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  isLoading: boolean;
  handleConfirmAttendance: (memberId: string, userId: string) => Promise<void>;
  handleDeclineAttendance: (memberId: string, userId: string) => Promise<void>;
  handleLeaveGroup?: () => Promise<void>;
}

interface ActionButtonsProps {
  member: Member;
  isConfirmedForNextMatch: boolean;
  isCurrentUser: boolean | null;
}

export default function MembersTab({
  group,
  user,
  currentUserIsAdmin,
  isLoading,
  handleConfirmAttendance,
  handleDeclineAttendance,
  handleLeaveGroup,
}: MembersTabProps) {
  // Estado local para mantener el estado de confirmación de cada miembro
  const [membersConfirmationStatus, setMembersConfirmationStatus] = useState<
    Record<string, boolean>
  >({});
  // Estado local para el contador de confirmados
  const [localConfirmedCount, setLocalConfirmedCount] = useState(0);
  // Estado para el botón que está siendo procesado
  const [processingButton, setProcessingButton] = useState<{
    id: string;
    action: 'confirm' | 'decline';
  } | null>(null);

  // Inicializar el estado local con los datos del grupo
  useEffect(() => {
    const initialStatus: Record<string, boolean> = {};
    const confirmedCount =
      group?.nextMatchDetails?.confirmedPlayers?.length || 0;
    setLocalConfirmedCount(confirmedCount);

    group?.members?.forEach((member) => {
      initialStatus[member.userId] = isMemberConfirmedForNextMatch(
        member.userId
      );
    });
    setMembersConfirmationStatus(initialStatus);
  }, [group?.members, group?.nextMatchDetails?.confirmedPlayers]);

  // Determinar si se alcanzó el límite de jugadores requeridos
  const requiredPlayers = group?.requiredPlayers || 10;
  const isMaxPlayersReached = localConfirmedCount >= requiredPlayers;

  // Verificar si un miembro está confirmado para el próximo partido
  const isMemberConfirmedForNextMatch = (userId: string) => {
    if (!group?.nextMatchDetails?.confirmedPlayers) {
      return false;
    }

    return group.nextMatchDetails.confirmedPlayers.some(
      (player) => player.id === userId
    );
  };

  // Componente para los botones de acciones
  const ActionButtons: React.FC<ActionButtonsProps> = ({
    member,
    isConfirmedForNextMatch,
    isCurrentUser,
  }) => {
    const handleConfirm = async () => {
      if (isMaxPlayersReached && !isConfirmedForNextMatch) return;

      setProcessingButton({ id: member.id, action: 'confirm' });
      try {
        await handleConfirmAttendance(member.id, member.userId);
        setMembersConfirmationStatus((prev) => ({
          ...prev,
          [member.userId]: true,
        }));
        setLocalConfirmedCount((prev) => prev + 1);
      } finally {
        setProcessingButton(null);
      }
    };

    const handleDecline = async () => {
      setProcessingButton({ id: member.id, action: 'decline' });
      try {
        await handleDeclineAttendance(member.id, member.userId);
        setMembersConfirmationStatus((prev) => ({
          ...prev,
          [member.userId]: false,
        }));
        setLocalConfirmedCount((prev) => prev - 1);
      } finally {
        setProcessingButton(null);
      }
    };

    if (isCurrentUser) {
      return (
        <span className='text-sm text-gray-500 italic block mt-1 md:mt-0 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100'>
          Confirmar desde pestaña "Próximo Partido"
        </span>
      );
    }

    if (!currentUserIsAdmin) {
      return null;
    }

    const isConfirmed =
      membersConfirmationStatus[member.userId] ?? isConfirmedForNextMatch;
    const isProcessing = processingButton?.id === member.id;

    return (
      <div className='flex gap-2 mt-2 md:mt-0 flex-wrap justify-end'>
        {!isConfirmed && (
          <button
            onClick={handleConfirm}
            className='text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1.5 md:py-1 rounded-md text-xs md:text-sm flex items-center min-w-[90px] justify-center'
            disabled={
              isLoading ||
              (isMaxPlayersReached && !isConfirmed) ||
              !group?.nextMatchId ||
              processingButton !== null
            }
          >
            {isProcessing && processingButton?.action === 'confirm' ? (
              <span className='flex items-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-green-700'
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
                <span className='whitespace-nowrap'>Procesando...</span>
              </span>
            ) : !group?.nextMatchId ? (
              'Sin partido'
            ) : isMaxPlayersReached ? (
              'Cupo completo'
            ) : (
              <>
                <CheckIcon className='h-4 w-4 mr-1' />
                Confirmar
              </>
            )}
          </button>
        )}
        {isConfirmed && (
          <button
            onClick={handleDecline}
            className='text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1.5 md:py-1 rounded-md text-xs md:text-sm flex items-center min-w-[90px] justify-center'
            disabled={
              isLoading || !group?.nextMatchId || processingButton !== null
            }
          >
            {isProcessing && processingButton?.action === 'decline' ? (
              <span className='flex items-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-red-700'
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
                <span className='whitespace-nowrap'>Procesando...</span>
              </span>
            ) : (
              <>
                <XMarkIcon className='h-4 w-4 mr-1' />
                Cancelar
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2'>
        <h3 className='text-lg font-semibold'>
          Miembros ({localConfirmedCount} confirmados para el próximo partido)
        </h3>
      </div>
      {isMaxPlayersReached && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4'>
          <p className='text-sm text-yellow-700'>
            Se ha alcanzado el cupo máximo de {requiredPlayers} jugadores para
            este partido.
          </p>
        </div>
      )}
      {!group?.nextMatchId && (
        <div className='bg-amber-50 border border-amber-200 rounded-md p-3 mb-4'>
          <p className='text-sm text-amber-700'>
            No hay un próximo partido programado para este grupo.
          </p>
        </div>
      )}
      {/* Vista de tabla para pantallas medianas y grandes */}
      <div className='hidden md:block'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Nombre
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Estado para el próximo partido
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  {currentUserIsAdmin ? 'Acciones' : ''}
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {group?.members?.map((member: Member) => {
                // Determinar el estado para el próximo partido específicamente
                const isConfirmedForNextMatch =
                  membersConfirmationStatus[member.userId] ??
                  isMemberConfirmedForNextMatch(member.userId);

                // Verificar si el usuario actual es el dueño de esta fila
                const isCurrentUser = user && member.userId === user.id;

                return (
                  <tr key={member.id}>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-10 w-10'>
                          <Avatar
                            alt={member.name || 'Usuario sin nombre'}
                            src={member.avatar || ''}
                            className='h-10 w-10 rounded-full'
                          />
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>
                            {member.name || 'Usuario sin nombre'}
                            {member.role === 'ADMIN' && (
                              <span className='ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isConfirmedForNextMatch
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isConfirmedForNextMatch ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                      <ActionButtons
                        member={member}
                        isConfirmedForNextMatch={isConfirmedForNextMatch}
                        isCurrentUser={isCurrentUser}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista móvil mejorada */}
      <div className='md:hidden space-y-3'>
        {/* Sección de estadísticas móvil */}
        <div className='sticky top-0 z-10 bg-white pb-2'>
          <div className='flex justify-between items-center mb-2 bg-gray-50 p-3 rounded-md shadow-sm'>
            <span className='text-sm font-medium text-gray-600'>
              Total: {group?.members?.length || 0}
            </span>
            <span className='text-sm font-medium text-green-600'>
              {localConfirmedCount} confirmados
            </span>
          </div>
        </div>

        {group?.members?.map((member: Member) => {
          const isConfirmedForNextMatch =
            membersConfirmationStatus[member.userId] ??
            isMemberConfirmedForNextMatch(member.userId);
          const isCurrentUser = user && member.userId === user.id;

          return (
            <div
              key={member.id}
              className='bg-white shadow rounded-lg p-3 flex flex-col border border-gray-100'
            >
              <div className='flex items-center justify-between'>
                <div className='flex items-center flex-1'>
                  <Avatar
                    alt={member.name || 'Usuario sin nombre'}
                    src={member.avatar || ''}
                    className='h-10 w-10 rounded-full'
                  />
                  <div className='ml-3 min-w-0 flex-1'>
                    <div className='flex items-center flex-wrap gap-1'>
                      <span className='text-sm font-medium text-gray-900 truncate'>
                        {member.name || 'Usuario sin nombre'}
                      </span>
                      {member.role === 'ADMIN' && (
                        <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                          Admin
                        </span>
                      )}
                    </div>
                    <div className='mt-1'>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isConfirmedForNextMatch
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isConfirmedForNextMatch ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {(currentUserIsAdmin || isCurrentUser) && (
                <div className='mt-2 flex justify-end'>
                  <ActionButtons
                    member={member}
                    isConfirmedForNextMatch={isConfirmedForNextMatch}
                    isCurrentUser={isCurrentUser}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón de salir del grupo */}
      {handleLeaveGroup && user && (
        <div className='pt-4 border-t border-gray-200 mt-6'>
          <button
            onClick={() => {
              if (
                window.confirm(
                  '¿Estás seguro de que quieres salir de este grupo?'
                )
              ) {
                handleLeaveGroup();
              }
            }}
            className='w-full flex items-center justify-center px-4 py-3 border border-red-600 rounded-md shadow-sm text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 transition-all duration-200 md:py-2 md:w-auto'
          >
            <ArrowRightOnRectangleIcon className='h-5 w-5 mr-2' />
            Salir del grupo
          </button>
        </div>
      )}
    </div>
  );
}
