import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { Avatar } from '@mui/material';
import { Box, Typography, Chip } from '@mui/material';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import { showSuccessToast, showErrorToast } from '../../services/toastService';

// Import the tab components
import MembersTab from '../../components/group/tabs/MembersTab';
import NextMatchTab from '../../components/group/tabs/NextMatchTab';
import HistoryTab from '../../components/group/tabs/HistoryTab';
import GoalsTab from '../../components/group/tabs/GoalsTab';
import MvpTab from '../../components/group/tabs/MvpTab';
import SimpleHeaderComponent from '../../components/group/SimpleHeader';

// Importar los nuevos hooks
import {
  useGroupBasicInfo,
  useGroupNextMatch,
  useGroupMembers,
  useGroupStats,
  useGroupHistory,
  useUserAttendanceMutation,
  useAdminAttendanceMutation,
  useMembershipRequestMutation,
} from '../../services/groupHooks';

import {
  useLeaveGroupMutation,
  useRandomizeTeamsMutation,
  useDeleteMatchMutation,
  useReplaceTbdPlayerMutation,
  useResetAttendanceMutation,
} from '../../services/reactQueryHooks';

// Tipos
type ParticipantStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'DECLINED'
  | 'confirmed'
  | 'pending'
  | 'declined';

export default function ModularGroupDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const user = session?.user;

  // Estados para la UI
  const [selectedTab, setSelectedTab] = useState(0);
  const [showReplaceTbdModal, setShowReplaceTbdModal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [showTeams, setShowTeams] = useState(false);
  const [allowFillIn, setAllowFillIn] = useState(true);

  // Consultas React Query
  const {
    data: groupBasicData,
    isLoading: isGroupBasicLoading,
    error: groupBasicError,
    refetch: refetchBasicInfo,
  } = useGroupBasicInfo(id as string);

  const {
    data: nextMatchData,
    isLoading: isNextMatchLoading,
    error: nextMatchError,
    refetch: refetchNextMatch,
  } = useGroupNextMatch(id as string);

  const {
    data: membersData,
    isLoading: isMembersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useGroupMembers(id as string);

  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useGroupStats(id as string);

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useGroupHistory(id as string, 1, 10);

  // Mutaciones
  const userAttendanceMutation = useUserAttendanceMutation();
  const adminAttendanceMutation = useAdminAttendanceMutation();
  const membershipRequestMutation = useMembershipRequestMutation();
  const leaveGroupMutation = useLeaveGroupMutation();
  const randomizeTeamsMutation = useRandomizeTeamsMutation();
  const deleteMatchMutation = useDeleteMatchMutation();
  const replaceTbdPlayerMutation = useReplaceTbdPlayerMutation();
  const resetAttendanceMutation = useResetAttendanceMutation();

  // Datos procesados del grupo
  const group = useMemo(() => {
    if (!groupBasicData) return null;

    return {
      ...groupBasicData,
      nextMatchDetails: nextMatchData?.nextMatchDetails || null,
      userAttendanceStatus: nextMatchData?.userAttendance || null,
      members: membersData?.members || [],
      pendingRequests: membersData?.pendingRequests || [],
      isAdmin: membersData?.isAdmin || groupBasicData.isAdmin || false,
    };
  }, [groupBasicData, nextMatchData, membersData]);

  // Datos procesados de estadísticas
  const { goleadores, mvps } = useMemo(() => {
    return {
      goleadores: statsData?.goleadores || [],
      mvps: statsData?.mvps || [],
    };
  }, [statsData]);

  // Datos procesados de historial
  const completedMatches = useMemo(() => {
    return historyData?.matches || [];
  }, [historyData]);

  // Estados calculados
  const isUserInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    return groupBasicData.userStatus === 'ACTIVE';
  }, [groupBasicData, user]);

  const isUserPendingInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    return groupBasicData.userStatus === 'PENDING';
  }, [groupBasicData, user]);

  const currentUserIsAdmin = useMemo(() => {
    if (!groupBasicData) return false;
    return groupBasicData.isAdmin;
  }, [groupBasicData]);

  // Combinar todos los estados de carga para la UI
  const isLoading =
    isGroupBasicLoading ||
    isNextMatchLoading ||
    isMembersLoading ||
    isStatsLoading ||
    isHistoryLoading ||
    isSubmitting;

  // Combinar todos los errores para mostrar
  const error =
    groupBasicError ||
    nextMatchError ||
    membersError ||
    statsError ||
    historyError;

  // Refrescar todos los datos
  const refreshAllData = () => {
    refetchBasicInfo();
    refetchNextMatch();
    refetchMembers();
  };

  // Montar URL de invitación
  useEffect(() => {
    if (group?.inviteToken) {
      const baseUrl = window.location.origin;
      setInviteUrl(`${baseUrl}/invite/${group.inviteToken}`);
    } else if (id) {
      const baseUrl = window.location.origin;
      setInviteUrl(`${baseUrl}/invite/${id}`);
    }
  }, [group, id]);

  // Actualizar el estado de showTeams basado en nextMatchData
  useEffect(() => {
    if (nextMatchData?.nextMatchDetails) {
      const match = nextMatchData.nextMatchDetails;
      const hasTeams =
        (match.playersA && match.playersA.length > 0) ||
        (match.playersB && match.playersB.length > 0);

      setShowTeams(hasTeams);
    } else {
      setShowTeams(false);
    }
  }, [nextMatchData]);

  // Función reutilizable para ejecutar acciones
  const executeAction = async (
    actionFn: () => Promise<any>,
    successMessage?: string
  ): Promise<void> => {
    setIsSubmitting(true);
    try {
      await actionFn();
      if (successMessage) {
        showSuccessToast(successMessage);
      }
    } catch (error: any) {
      console.error('Error executing action:', error);
      showErrorToast(error.message || 'Ocurrió un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador de asistencia para administrador
  const handleAdminAttendanceUpdate = async (
    userId: string,
    status: ParticipantStatus
  ) => {
    if (!group?.nextMatchDetails?.id) {
      showErrorToast('No hay próximo partido configurado');
      return;
    }

    await executeAction(async () => {
      await adminAttendanceMutation.mutateAsync({
        userId,
        matchId: group.nextMatchDetails.id,
        status,
      });
    });
  };

  // Manejador de asistencia para usuario
  const handleAttendance = async (status: ParticipantStatus): Promise<void> => {
    if (!group?.nextMatchDetails?.id) {
      showErrorToast('No hay próximo partido configurado');
      return;
    }

    await executeAction(async () => {
      await userAttendanceMutation.mutateAsync({
        matchId: group.nextMatchDetails.id,
        status,
      });
    });
  };

  // Manejar solicitudes de membresía
  const handleMembershipRequest = async (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => {
    if (!id || Array.isArray(id)) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    await executeAction(async () => {
      await membershipRequestMutation.mutateAsync({
        groupId: id,
        userId,
        action,
      });
    });
  };

  // Abandonar el grupo
  const handleLeaveGroup = async () => {
    if (!id || Array.isArray(id)) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    await executeAction(async () => {
      await leaveGroupMutation.mutateAsync(id);
      router.push('/groups');
    }, 'Has abandonado el grupo correctamente');
  };

  // Copiar invitación
  const copyInviteLink = () => {
    if (!inviteUrl) return;

    setIsCopying(true);
    navigator.clipboard
      .writeText(inviteUrl)
      .then(() => {
        showSuccessToast('Enlace copiado al portapapeles');
        // Reset copying state after 2 seconds
        setTimeout(() => {
          setIsCopying(false);
        }, 2000);
      })
      .catch((err) => {
        console.error('Error al copiar enlace:', err);
        showErrorToast('Error al copiar enlace');
        setIsCopying(false);
      });
  };

  // Definir las pestañas disponibles
  const tabComponents = useMemo(() => {
    const isAdmin = currentUserIsAdmin;

    const tabs = [
      {
        label: 'Próximo Partido',
        component: (
          <NextMatchTab
            group={group}
            user={user}
            id={id as string}
            currentUserIsAdmin={currentUserIsAdmin}
            isUserInGroup={isUserInGroup}
            setShowReplaceTbdModal={setShowReplaceTbdModal}
            handleGroupAttendance={handleAttendance}
            handleSortTeams={() => {}}
            handleAddResults={() => {}}
            handleDeleteMatch={() => {}}
            userAttendanceStatus={nextMatchData?.userAttendance}
            allowFillIn={allowFillIn}
            setAllowFillIn={setAllowFillIn}
          />
        ),
      },
      {
        label: 'Historial',
        component: (
          <HistoryTab
            completedMatches={completedMatches}
            id={id as string}
            formatMatchDate={(date) => new Date(date).toLocaleDateString()}
            getScoreForTeam={(match, isTeamA) =>
              isTeamA ? match.scoreA : match.scoreB
            }
            getPlayerGoals={() => 0}
            renderGoalBalls={() => null}
          />
        ),
      },
      {
        label: 'Goleadores',
        component: <GoalsTab goleadores={goleadores} />,
      },
      {
        label: 'MVPs',
        component: <MvpTab mvps={mvps} />,
      },
      {
        label: 'Miembros',
        component: (
          <MembersTab
            group={group}
            user={user}
            currentUserIsAdmin={currentUserIsAdmin}
            isLoading={isLoading}
            handleConfirmAttendance={async () => {}}
            handleDeclineAttendance={async () => {}}
          />
        ),
      },
    ];

    // Añadir pestaña de solicitudes solo para administradores
    if (isAdmin) {
      tabs.push({
        label: 'Solicitudes',
        component: (
          <div className='space-y-6'>
            <div className='flex justify-between items-center'>
              <h3 className='text-xl font-semibold text-gray-900'>
                Solicitudes pendientes
              </h3>
              <span className='text-sm text-gray-500'>
                {group?.pendingRequests?.length || 0} solicitudes
              </span>
            </div>

            {group?.pendingRequests && group.pendingRequests.length > 0 ? (
              <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
                <ul className='divide-y divide-gray-200'>
                  {group.pendingRequests.map((request) => (
                    <li
                      key={request.id}
                      className='hover:bg-gray-50 transition-colors'
                    >
                      <div className='px-6 py-4 flex items-center justify-between'>
                        <div className='flex items-center'>
                          <div className='flex-shrink-0 h-10 w-10'>
                            <Avatar
                              className='h-10 w-10 rounded-full'
                              src={request.avatar || ''}
                              alt={request.name || ''}
                            />
                          </div>
                          <div className='ml-4'>
                            <div className='flex items-center'>
                              <div className='text-sm font-medium text-gray-900'>
                                {request.name}
                              </div>
                              <span className='ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700'>
                                Pendiente
                              </span>
                            </div>
                            {request.email && (
                              <div className='text-sm text-gray-500'>
                                {request.email}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className='flex space-x-2'>
                          <button
                            onClick={() =>
                              handleMembershipRequest(request.userId, 'APPROVE')
                            }
                            className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors'
                            disabled={isSubmitting}
                          >
                            <CheckCircleIcon className='h-4 w-4 mr-1' />
                            Aprobar
                          </button>
                          <button
                            onClick={() =>
                              handleMembershipRequest(request.userId, 'REJECT')
                            }
                            className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors'
                            disabled={isSubmitting}
                          >
                            <XCircleIcon className='h-4 w-4 mr-1' />
                            Rechazar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className='bg-white rounded-lg p-6 text-center border border-gray-200 shadow-sm'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-12 w-12 mx-auto text-gray-400 mb-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1}
                    d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
                  />
                </svg>
                <h3 className='text-lg font-medium text-gray-900 mb-2'>
                  No hay solicitudes pendientes
                </h3>
                <p className='text-gray-500 max-w-md mx-auto'>
                  No tienes usuarios esperando aprobación para unirse al grupo
                  en este momento.
                </p>
              </div>
            )}
          </div>
        ),
      });
    }

    return tabs;
  }, [
    group,
    user,
    id,
    currentUserIsAdmin,
    isUserInGroup,
    nextMatchData,
    completedMatches,
    goleadores,
    mvps,
    isLoading,
    allowFillIn,
    handleAttendance,
    handleMembershipRequest,
  ]);

  // Función para obtener el texto de recurrencia de forma simplificada
  const getRecurrenceText = () => {
    if (!group) return '';

    const dayNames = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];

    if (!group.recurrenceType || group.recurrenceType === 'NONE') {
      return '';
    }

    let frequencyText = '';
    if (group.recurrenceType === 'WEEKLY') {
      frequencyText = 'Semanal';
    } else if (group.recurrenceType === 'BIWEEKLY') {
      frequencyText = 'Quincenal';
    } else if (group.recurrenceType === 'MONTHLY') {
      frequencyText = 'Mensual';
    }

    let daysText = '';
    if (group.recurrenceDays && group.recurrenceDays.length > 0) {
      daysText = group.recurrenceDays
        .map((day: number) => dayNames[day])
        .map((day: string) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(', ');
    }

    let timeText = '';
    if (group.recurrenceTime) {
      timeText = `${group.recurrenceTime}hs`;
    }

    return `${frequencyText} - ${daysText} ${timeText}`;
  };

  return (
    <Layout>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {isLoading ? (
          <div className='flex justify-center items-center min-h-screen'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          </div>
        ) : error ? (
          <div className='text-center text-red-600'>
            {error instanceof Error ? error.message : 'Error desconocido'}
          </div>
        ) : group ? (
          <div className='space-y-6'>
            {/* Simplified Header */}
            <SimpleHeaderComponent
              group={group}
              currentUserIsAdmin={currentUserIsAdmin}
              isUserInGroup={isUserInGroup}
              handleLeaveGroup={handleLeaveGroup}
              recurrenceText={getRecurrenceText()}
              shortInviteUrl={inviteUrl}
              inviteUrl={inviteUrl}
              copyInviteLink={copyInviteLink}
              isCopying={isCopying}
              router={router}
            />

            {/* Navigation tabs - Improved design */}
            <div className='bg-white rounded-xl shadow-sm mb-0'>
              <nav
                className='flex overflow-x-auto rounded-t-xl'
                aria-label='Tabs'
              >
                {tabComponents.map((tab, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedTab(index)}
                    className={`${
                      selectedTab === index
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    } flex-1 whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-all duration-200 relative`}
                  >
                    {tab.label === 'Solicitudes' ? (
                      <div className='inline-flex items-center'>
                        <span>{tab.label}</span>
                        {group.pendingRequests &&
                          group.pendingRequests.length > 0 && (
                            <span className='ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full bg-red-500'>
                              {group.pendingRequests.length}
                            </span>
                          )}
                      </div>
                    ) : (
                      tab.label
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Contenido de las pestañas */}
            <div className='bg-white rounded-xl shadow-sm p-6'>
              {tabComponents[selectedTab].component}
            </div>
          </div>
        ) : (
          <div className='text-center text-gray-600'>Grupo no encontrado</div>
        )}
      </div>

      {/* Modal para reemplazar jugador TBD */}
      {showReplaceTbdModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full'>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              Reemplazar Jugador TBD
            </h3>
            <div className='py-4'>
              <p className='text-gray-500 mb-4'>
                Selecciona un jugador para reemplazar a este TBD.
              </p>
              <Button onClick={() => setShowReplaceTbdModal('')}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
