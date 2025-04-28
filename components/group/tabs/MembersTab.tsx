import { useState } from 'react';
import { Avatar } from '@mui/material';
import type { GroupWithRelations, Member } from '../../../types/group';
import type { AuthUser } from '../../../types/auth';

interface MembersTabProps {
  group: GroupWithRelations;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  isLoading: boolean;
  handleConfirmAttendance: (memberId: string, userId: string) => Promise<void>;
  handleDeclineAttendance: (memberId: string, userId: string) => Promise<void>;
}

export default function MembersTab({
  group,
  user,
  currentUserIsAdmin,
  isLoading,
  handleConfirmAttendance,
  handleDeclineAttendance,
}: MembersTabProps) {
  const confirmedMembersCount =
    group?.nextMatchDetails?.confirmedPlayers?.length || 0;

  // Determinar si se alcanzó el límite de jugadores requeridos
  const requiredPlayers = group?.requiredPlayers || 10;
  const isMaxPlayersReached = confirmedMembersCount >= requiredPlayers;

  // Información de depuración
  const nextMatchInfo = group?.nextMatchDetails
    ? { id: group.nextMatchDetails.id, date: group.nextMatchDetails.date }
    : null;

  console.log('MembersTab - Datos importantes:', {
    nextMatchId: group?.nextMatchId,
    nextMatchInfo,
    confirmedPlayers: group?.nextMatchDetails?.confirmedPlayers?.map((p) => ({
      id: p.id,
      name: p.name,
    })),
    groupId: group?.id,
  });

  // Verificar si un miembro está confirmado para el próximo partido
  const isMemberConfirmedForNextMatch = (userId: string) => {
    if (!group?.nextMatchDetails?.confirmedPlayers) {
      console.log(`No confirmedPlayers found for userId: ${userId}`);
      return false;
    }

    const isConfirmed = group.nextMatchDetails.confirmedPlayers.some(
      (player) => player.id === userId
    );

    console.log(
      `Checking confirmation for user ${userId}: ${
        isConfirmed ? 'CONFIRMED' : 'NOT CONFIRMED'
      }`
    );

    return isConfirmed;
  };

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-semibold'>
          Miembros ({confirmedMembersCount} confirmados para el próximo partido)
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
              const isConfirmedForNextMatch = isMemberConfirmedForNextMatch(
                member.userId
              );

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
                    <div className='flex items-center'>
                      {isConfirmedForNextMatch ? (
                        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'>
                          Confirmado
                        </span>
                      ) : (
                        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800'>
                          Pendiente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {isCurrentUser ? (
                      <span className='text-sm text-gray-500 italic'>
                        Confirmar desde pestaña "Próximo Partido"
                      </span>
                    ) : (
                      // Botones para administradores - solo visible si el usuario es admin
                      currentUserIsAdmin && (
                        <>
                          {!isConfirmedForNextMatch && (
                            <button
                              onClick={() =>
                                handleConfirmAttendance(
                                  member.id,
                                  member.userId
                                )
                              }
                              className='text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-md mr-2'
                              disabled={
                                isLoading ||
                                (isMaxPlayersReached &&
                                  !isConfirmedForNextMatch) ||
                                !group?.nextMatchId
                              }
                            >
                              {isLoading ? (
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
                                  Procesando...
                                </span>
                              ) : !group?.nextMatchId ? (
                                'Sin partido'
                              ) : isMaxPlayersReached ? (
                                'Cupo completo'
                              ) : (
                                'Confirmar'
                              )}
                            </button>
                          )}
                          {isConfirmedForNextMatch && (
                            <button
                              onClick={() =>
                                handleDeclineAttendance(
                                  member.id,
                                  member.userId
                                )
                              }
                              className='text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-md'
                              disabled={isLoading || !group?.nextMatchId}
                            >
                              {isLoading ? (
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
                                  Procesando...
                                </span>
                              ) : (
                                'Cancelar asistencia'
                              )}
                            </button>
                          )}
                        </>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
