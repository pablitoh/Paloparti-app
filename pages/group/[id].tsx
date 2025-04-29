import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import SimpleHeaderComponent from '../../components/group/SimpleHeader';
import ReplaceTbdPlayerModal from '../../components/group/modals/ReplaceTbdPlayerModal';
import MembersTab from '../../components/group/tabs/MembersTab';
import NextMatchTab from '../../components/group/tabs/NextMatchTab';
import HistoryTab from '../../components/group/tabs/HistoryTab';
import GoalsTab from '../../components/group/tabs/GoalsTab';
import MvpTab from '../../components/group/tabs/MvpTab';
import { Avatar } from '@mui/material';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { showSuccessToast, showErrorToast } from '../../services/toastService';
import {
  useGroupBasicInfo,
  useGroupNextMatch,
  useGroupMembers,
  useGroupStats,
  useGroupHistory,
} from '../../services/groupHooks';
import { useGroupActions } from '../../hooks/useGroupActions';
import {
  formatMatchDate,
  getScoreForTeam,
  getPlayerGoals,
  renderGoalBalls,
  getRecurrenceText,
} from '../../utils/groupUtils';
import type {
  Group,
  MatchInterface,
  ParticipantStatus,
} from '../../types/group';

// Add AuthUser interface
interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  birthdate?: Date | null;
}

export default function GroupDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const user = session?.user as AuthUser | null;

  // Estados para la UI
  const [selectedTab, setSelectedTab] = useState(0);
  const [showReplaceTbdModal, setShowReplaceTbdModal] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [allowFillIn, setAllowFillIn] = useState(true);

  // Consultas React Query
  const {
    data: groupBasicData,
    isLoading: isGroupBasicLoading,
    error: groupBasicError,
    refetch: refetchBasicInfo,
  } = useGroupBasicInfo(Array.isArray(id) ? id[0] : id);

  const {
    data: nextMatchData,
    isLoading: isNextMatchLoading,
    error: nextMatchError,
    refetch: refetchNextMatch,
  } = useGroupNextMatch(Array.isArray(id) ? id[0] : id);

  const {
    data: membersData,
    isLoading: isMembersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useGroupMembers(Array.isArray(id) ? id[0] : id, {
    enabled: selectedTab === 4 || selectedTab === 5,
  });

  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useGroupStats(Array.isArray(id) ? id[0] : id, {
    enabled: selectedTab === 2 || selectedTab === 3,
  });

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useGroupHistory(Array.isArray(id) ? id[0] : id, 1, 10, {
    enabled: selectedTab === 1,
  });

  // Datos procesados del grupo
  const group = useMemo(() => {
    if (!groupBasicData) return null;

    const isAdmin =
      membersData?.isAdmin === true || groupBasicData.isAdmin === true || false;

    const members =
      selectedTab === 4 || selectedTab === 5 ? membersData?.members || [] : [];
    const pendingRequests =
      selectedTab === 4 || selectedTab === 5
        ? membersData?.pendingRequests || []
        : [];

    return {
      ...groupBasicData,
      nextMatchDetails: nextMatchData?.nextMatchDetails || null,
      userAttendanceStatus: nextMatchData?.userAttendance || null,
      members,
      pendingRequests,
      isAdmin,
    };
  }, [groupBasicData, nextMatchData, membersData, selectedTab]);

  // Hook de acciones del grupo
  const {
    handleAttendance,
    handleAdminAttendanceUpdate,
    handleMembershipRequest,
    handleLeaveGroup,
    handleRandomTeams,
    handleDeleteMatch,
    handleReplaceTbdPlayer,
    handleResetAttendance,
  } = useGroupActions({
    groupId: Array.isArray(id) ? id[0] : id || '',
    nextMatchId: groupBasicData?.nextMatchId,
    onSuccess: () => {
      // Force full refetch of all data with no-cache
      refetchBasicInfo({ cancelRefetch: true });
      refetchNextMatch({ cancelRefetch: true });
      refetchMembers({ cancelRefetch: true });

      // No page reload needed as React Query will handle refreshing the UI
    },
    group: group,
    allowFillIn: allowFillIn,
  });

  // Custom handler for attendance that ensures complete refresh
  const handleGroupAttendanceWithRefresh = async (
    status: ParticipantStatus
  ) => {
    try {
      await handleAttendance(status);

      // Force immediate refetches without page reload
      await refetchBasicInfo({ cancelRefetch: true });
      await refetchNextMatch({ cancelRefetch: true });
      await refetchMembers({ cancelRefetch: true });

      // No need to reload the page - React Query will update the UI
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
    }
  };

  // Datos procesados de estadísticas
  const { goleadores, mvps } = useMemo(() => {
    return {
      goleadores: statsData?.goleadores || [],
      mvps: statsData?.mvps || [],
    };
  }, [statsData]);

  // Datos procesados de historial
  const completedMatches = useMemo(() => {
    const matches = historyData?.matches || [];
    return [...matches].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }, [historyData]);

  // Estados calculados
  const isUserInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    if (membersData?.members) {
      return membersData.members.some(
        (member: any) =>
          member.userId === user.id &&
          (member.status === 'ACTIVE' || member.status === 'CONFIRMED')
      );
    }
    return (
      groupBasicData.userStatus === 'ACTIVE' ||
      groupBasicData.userStatus === 'CONFIRMED'
    );
  }, [groupBasicData, user, membersData]);

  const isUserPendingInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    if (membersData?.members) {
      return membersData.members.some(
        (member: any) =>
          member.userId === user.id && member.status === 'PENDING'
      );
    }
    return groupBasicData.userStatus === 'PENDING';
  }, [groupBasicData, user, membersData]);

  const currentUserIsAdmin = useMemo(() => {
    if (!user || !groupBasicData) return false;
    if (membersData?.isAdmin === true || groupBasicData.isAdmin === true) {
      return true;
    }
    if (membersData?.members) {
      const isAdminInMembers = membersData.members.some(
        (member: any) =>
          member.userId === user.id &&
          member.role === 'ADMIN' &&
          member.status === 'ACTIVE'
      );
      if (isAdminInMembers) return true;
    }
    return groupBasicData.createdBy === user.id;
  }, [groupBasicData, user, membersData]);

  // Combinar todos los estados de carga para la UI
  const isLoading = useMemo(() => {
    const baseLoading =
      isGroupBasicLoading || isNextMatchLoading || isMembersLoading;

    if (selectedTab === 1) {
      return baseLoading || isHistoryLoading;
    } else if (selectedTab === 2 || selectedTab === 3) {
      return baseLoading || isStatsLoading;
    }
    return baseLoading;
  }, [
    isGroupBasicLoading,
    isNextMatchLoading,
    isMembersLoading,
    isStatsLoading,
    isHistoryLoading,
    selectedTab,
  ]);

  // Combinar todos los errores para mostrar
  const error = useMemo(() => {
    const baseError = groupBasicError || nextMatchError || membersError;
    if (selectedTab === 1) {
      return baseError || historyError;
    } else if (selectedTab === 2 || selectedTab === 3) {
      return baseError || statsError;
    }
    return baseError;
  }, [
    groupBasicError,
    nextMatchError,
    membersError,
    statsError,
    historyError,
    selectedTab,
  ]);

  // Efecto para cargar pestaña desde URL
  useEffect(() => {
    const tabParam = router.query.tab;
    if (tabParam && !isNaN(Number(tabParam))) {
      const tabIndex = Number(tabParam);
      if (tabComponents && tabIndex >= 0 && tabIndex < tabComponents.length) {
        setSelectedTab(tabIndex);
      }
    }
  }, [router.query]);

  // Efecto para procesar datos del grupo
  useEffect(() => {
    if (!group) return;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    setInviteUrl(`${baseUrl}/invite/${id}`);
  }, [group, id]);

  // Función para copiar enlace de invitación
  const copyInviteLink = () => {
    if (!group?.inviteToken && !id) return;

    setIsCopying(true);
    const baseUrl = window.location.origin;
    const urlToCopy = group?.inviteToken
      ? `${baseUrl}/invite/${group.inviteToken}`
      : `${baseUrl}/invite/${id}`;

    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => {
        showSuccessToast('Enlace copiado al portapapeles');
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

    const baseTabComponents = [
      {
        label: 'Próximo Partido',
        component: (
          <NextMatchTab
            group={group}
            user={user}
            id={Array.isArray(id) ? id[0] : id || ''}
            currentUserIsAdmin={currentUserIsAdmin}
            isUserInGroup={isUserInGroup}
            setShowReplaceTbdModal={setShowReplaceTbdModal}
            handleGroupAttendance={handleGroupAttendanceWithRefresh}
            handleSortTeams={handleRandomTeams}
            handleAddResults={() =>
              router.push(`/matches/${group?.nextMatchId}/results?edit=true`)
            }
            handleDeleteMatch={handleDeleteMatch}
            userAttendanceStatus={nextMatchData?.userAttendance || undefined}
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
            id={id?.toString() || ''}
            formatMatchDate={formatMatchDate}
            getScoreForTeam={getScoreForTeam}
            getPlayerGoals={getPlayerGoals}
            renderGoalBalls={renderGoalBalls}
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
            handleConfirmAttendance={async (
              memberId: string,
              userId: string
            ) => {
              await handleAdminAttendanceUpdate(userId, 'CONFIRMED');
            }}
            handleDeclineAttendance={async (
              memberId: string,
              userId: string
            ) => {
              await handleAdminAttendanceUpdate(userId, 'DECLINED');
            }}
          />
        ),
      },
      {
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
                  {group.pendingRequests.map((request: any) => (
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
                            disabled={isLoading}
                          >
                            <CheckCircleIcon className='h-4 w-4 mr-1' />
                            Aprobar
                          </button>
                          <button
                            onClick={() =>
                              handleMembershipRequest(request.userId, 'REJECT')
                            }
                            className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors'
                            disabled={isLoading}
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
        adminOnly: true,
      },
    ];

    return baseTabComponents.filter((tab) => !tab.adminOnly || isAdmin);
  }, [
    currentUserIsAdmin,
    group,
    user,
    id,
    isUserInGroup,
    handleGroupAttendanceWithRefresh,
    handleRandomTeams,
    handleDeleteMatch,
    completedMatches,
    formatMatchDate,
    getScoreForTeam,
    getPlayerGoals,
    renderGoalBalls,
    goleadores,
    mvps,
    isLoading,
    handleMembershipRequest,
    handleAdminAttendanceUpdate,
    allowFillIn,
    setAllowFillIn,
  ]);

  return (
    <Layout>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {isLoading ? (
          <div className='flex justify-center items-center min-h-screen'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          </div>
        ) : error ? (
          <div className='text-center text-red-600'>
            {error instanceof Error ? error.message : String(error)}
          </div>
        ) : group ? (
          <div className='space-y-6'>
            <SimpleHeaderComponent
              group={group}
              currentUserIsAdmin={currentUserIsAdmin}
              isUserInGroup={isUserInGroup}
              handleLeaveGroup={handleLeaveGroup}
              recurrenceText={getRecurrenceText(group)}
              shortInviteUrl={inviteUrl}
              inviteUrl={inviteUrl}
              copyInviteLink={copyInviteLink}
              isCopying={isCopying}
              router={router}
            />

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

            <div className='bg-white rounded-xl shadow-sm p-6'>
              {tabComponents[selectedTab]?.component}
            </div>
          </div>
        ) : (
          <div className='text-center text-gray-600'>Grupo no encontrado</div>
        )}
      </div>

      {showReplaceTbdModal && group && (
        <ReplaceTbdPlayerModal
          showReplaceTbdModal={showReplaceTbdModal}
          setShowReplaceTbdModal={setShowReplaceTbdModal}
          group={group}
          handleReplaceTbdPlayer={handleReplaceTbdPlayer}
          onSuccessfulReplace={() => {
            refetchBasicInfo();
            refetchNextMatch();
            refetchMembers();
          }}
        />
      )}
    </Layout>
  );
}
