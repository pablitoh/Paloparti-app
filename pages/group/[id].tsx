import { useRouter } from 'next/router';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
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

// Define types for the lazy tab components
interface LazyTabProps {
  groupId: string;
}

interface LazyNextMatchTabProps extends LazyTabProps {
  basicData: any;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  isUserInGroup: boolean;
  handleAttendance: (status: ParticipantStatus) => Promise<void>;
  handleRandomTeams: () => Promise<void>;
  handleDeleteMatch: (matchId: string) => Promise<void>;
  setShowReplaceTbdModal: (id: string) => void;
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  router: any;
}

interface LazyHistoryTabProps extends LazyTabProps {}

interface LazyStatsTabProps extends LazyTabProps {
  type: 'goals' | 'mvps';
}

interface LazyMembersTabProps extends LazyTabProps {
  basicData: any;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  handleAdminAttendanceUpdate: (
    userId: string,
    status: ParticipantStatus
  ) => Promise<void>;
}

interface LazyRequestsTabProps extends LazyTabProps {
  basicData: any;
  handleMembershipRequest: (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => Promise<void>;
}

interface TabConfig {
  label: string;
  showBadge?: boolean;
  badgeCount?: number;
}

// Components for each tab that handle their own data loading
const LazyNextMatchTab = ({
  groupId,
  basicData,
  user,
  currentUserIsAdmin,
  isUserInGroup,
  handleAttendance,
  handleRandomTeams,
  handleDeleteMatch,
  setShowReplaceTbdModal,
  allowFillIn,
  setAllowFillIn,
  router,
}: LazyNextMatchTabProps) => {
  const { data, isLoading } = useGroupNextMatch(groupId, {
    enabled: !!groupId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className='w-full py-20 flex justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  // Construct the group object expected by NextMatchTab
  const group = {
    ...basicData,
    nextMatchDetails: data?.nextMatchDetails || null,
    userAttendanceStatus: data?.userAttendance || null,
    nextMatchId: basicData?.nextMatchId,
  };

  // Create a handler function that wraps handleAttendance
  const handleGroupAttendance = async (status: ParticipantStatus) => {
    try {
      await handleAttendance(status);
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
    }
  };

  return (
    <NextMatchTab
      group={group}
      user={user}
      id={groupId}
      currentUserIsAdmin={currentUserIsAdmin}
      isUserInGroup={isUserInGroup}
      setShowReplaceTbdModal={setShowReplaceTbdModal}
      handleGroupAttendance={handleGroupAttendance}
      handleSortTeams={handleRandomTeams}
      handleAddResults={() =>
        router.push(`/matches/${group?.nextMatchId}/results?edit=true`)
      }
      handleDeleteMatch={handleDeleteMatch}
      userAttendanceStatus={data?.userAttendance || undefined}
      allowFillIn={allowFillIn}
      setAllowFillIn={setAllowFillIn}
    />
  );
};

const LazyHistoryTab = ({ groupId }: LazyHistoryTabProps) => {
  const { data, isLoading } = useGroupHistory(groupId, 1, 10, {
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className='w-full py-20 flex justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  const sortedMatches = data?.matches
    ? [...data.matches].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      })
    : [];

  return (
    <HistoryTab
      completedMatches={sortedMatches}
      id={groupId}
      formatMatchDate={formatMatchDate}
      getScoreForTeam={getScoreForTeam}
      getPlayerGoals={getPlayerGoals}
      renderGoalBalls={renderGoalBalls}
    />
  );
};

const LazyStatsTab = ({ groupId, type }: LazyStatsTabProps) => {
  const { data, isLoading } = useGroupStats(groupId, {
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className='w-full py-20 flex justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  if (type === 'goals') {
    return <GoalsTab goleadores={data?.goleadores || []} />;
  } else {
    return <MvpTab mvps={data?.mvps || []} />;
  }
};

const LazyMembersTab = ({
  groupId,
  basicData,
  user,
  currentUserIsAdmin,
  handleAdminAttendanceUpdate,
}: LazyMembersTabProps) => {
  const { data, isLoading } = useGroupMembers(groupId, {
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className='w-full py-20 flex justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  const groupWithMembers = {
    ...basicData,
    members: data?.members || [],
  };

  return (
    <MembersTab
      group={groupWithMembers}
      user={user}
      currentUserIsAdmin={currentUserIsAdmin}
      isLoading={false}
      handleConfirmAttendance={async (memberId: string, userId: string) => {
        await handleAdminAttendanceUpdate(userId, 'CONFIRMED');
      }}
      handleDeclineAttendance={async (memberId: string, userId: string) => {
        await handleAdminAttendanceUpdate(userId, 'DECLINED');
      }}
    />
  );
};

const LazyRequestsTab = ({
  groupId,
  basicData,
  handleMembershipRequest,
}: LazyRequestsTabProps) => {
  const { data, isLoading } = useGroupMembers(groupId, {
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className='w-full py-20 flex justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  const pendingRequests = data?.pendingRequests || [];

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-semibold text-gray-900'>
          Solicitudes pendientes
        </h3>
        <span className='text-sm text-gray-500'>
          {pendingRequests.length || 0} solicitudes
        </span>
      </div>

      {pendingRequests && pendingRequests.length > 0 ? (
        <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
          <ul className='divide-y divide-gray-200'>
            {pendingRequests.map((request: any) => (
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
                    >
                      <CheckCircleIcon className='h-4 w-4 mr-1' />
                      Aprobar
                    </button>
                    <button
                      onClick={() =>
                        handleMembershipRequest(request.userId, 'REJECT')
                      }
                      className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors'
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
            No tienes usuarios esperando aprobación para unirse al grupo en este
            momento.
          </p>
        </div>
      )}
    </div>
  );
};

export default function GroupDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const user = session?.user as AuthUser | null;
  const queryClient = useQueryClient();
  const hasRendered = useRef(false);

  // Estados para la UI
  const [selectedTab, setSelectedTab] = useState(0);
  const [showReplaceTbdModal, setShowReplaceTbdModal] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [allowFillIn, setAllowFillIn] = useState(true);

  // Refs para la funcionalidad de swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Normalize groupId to prevent unnecessary re-renders
  const groupId = useMemo(() => {
    return Array.isArray(id) ? id[0] : id || '';
  }, [id]);

  // Wait for router to be ready before enabling any queries
  const isRouterReady = router.isReady;

  // Fetch basic group info once and cache it for a long time
  // We'll use a much bigger staleTime to prevent unnecessary refetching
  const {
    data: groupBasicData,
    isLoading: isGroupBasicLoading,
    error: groupBasicError,
    refetch: refetchBasicInfo,
  } = useGroupBasicInfo(groupId, {
    enabled: !!groupId && isRouterReady,
    staleTime: 10 * 60 * 1000, // 10 minutes - much longer to prevent refetches
    cacheTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

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
    groupId,
    nextMatchId: groupBasicData?.nextMatchId,
    onSuccess: () => {},
    group: groupBasicData,
    allowFillIn: allowFillIn,
  });

  // Estados calculados
  const isUserInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    return (
      groupBasicData.userStatus === 'ACTIVE' ||
      groupBasicData.userStatus === 'CONFIRMED'
    );
  }, [groupBasicData, user]);

  const isUserPendingInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    return groupBasicData.userStatus === 'PENDING';
  }, [groupBasicData, user]);

  const currentUserIsAdmin = useMemo(() => {
    if (!user || !groupBasicData) return false;
    if (groupBasicData.isAdmin === true) {
      return true;
    }
    return groupBasicData.createdBy === user.id;
  }, [groupBasicData, user]);

  // Funciones para manejar el swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  // Prefetch basic group data to ensure it's always in cache
  useEffect(() => {
    if (!isRouterReady || !groupId || hasRendered.current) return;

    // Mark that we've done the initial prefetch
    hasRendered.current = true;

    // Prefetch basic info with a high priority and long cache time
    queryClient.prefetchQuery({
      queryKey: ['group', 'basic', groupId],
      queryFn: () => fetch(`/api/groups/${groupId}`).then((res) => res.json()),
      staleTime: 10 * 60 * 1000, // 10 minutes - much longer to prevent refetches
    });
  }, [groupId, isRouterReady, queryClient]);

  // Efecto para cargar pestaña desde URL
  useEffect(() => {
    if (!router.isReady) return;

    const tabParam = router.query.tab;
    if (tabParam && !isNaN(Number(tabParam))) {
      const tabIndex = Number(tabParam);
      const maxTabs = currentUserIsAdmin ? 6 : 5;
      if (tabIndex >= 0 && tabIndex < maxTabs) {
        // Only update if different to prevent unnecessary renders
        if (tabIndex !== selectedTab) {
          setSelectedTab(tabIndex);
        }
      }
    }
  }, [router.isReady, router.query.tab, selectedTab, currentUserIsAdmin]);

  // Simple tab change handler that only updates state and URL
  const handleTabChange = useCallback(
    (index: number) => {
      if (
        index >= 0 &&
        index < (currentUserIsAdmin ? 6 : 5) &&
        index !== selectedTab
      ) {
        // Just update local state first for responsive UI
        setSelectedTab(index);

        // Then update URL with shallow routing to minimize network activity
        router.replace(
          {
            pathname: router.pathname,
            query: { ...router.query, tab: index.toString() },
          },
          undefined,
          { shallow: true, scroll: false }
        );
      }
    },
    [router, selectedTab, currentUserIsAdmin]
  );

  const handleTouchEnd = () => {
    const swipeThreshold = 50; // Mínima distancia para considerar un swipe
    const swipeDistance = touchEndX.current - touchStartX.current;

    if (Math.abs(swipeDistance) > swipeThreshold) {
      // Swipe derecha (negativo) -> pestaña anterior
      if (swipeDistance < 0 && selectedTab < (currentUserIsAdmin ? 5 : 4)) {
        handleTabChange(selectedTab + 1);
      }
      // Swipe izquierda (positivo) -> pestaña siguiente
      else if (swipeDistance > 0 && selectedTab > 0) {
        handleTabChange(selectedTab - 1);
      }
    }
  };

  // Efecto para procesar datos del grupo
  useEffect(() => {
    if (!groupBasicData) return;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    setInviteUrl(`${baseUrl}/invite/${id}`);
  }, [groupBasicData, id]);

  // Función para copiar enlace de invitación
  const copyInviteLink = () => {
    if (!groupBasicData?.inviteToken && !id) return;

    setIsCopying(true);
    const baseUrl = window.location.origin;
    const urlToCopy = groupBasicData?.inviteToken
      ? `${baseUrl}/invite/${groupBasicData.inviteToken}`
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

  // Renderizar las pestañas disponibles según el rol del usuario
  const renderTabs = useMemo(() => {
    const tabs: TabConfig[] = [
      { label: 'Próximo Partido' },
      { label: 'Historial' },
      { label: 'Goleadores' },
      { label: 'MVPs' },
      { label: 'Miembros' },
    ];

    if (currentUserIsAdmin) {
      tabs.push({
        label: 'Solicitudes',
        showBadge: !!groupBasicData?.pendingRequestsCount,
        badgeCount: groupBasicData?.pendingRequestsCount || 0,
      });
    }

    return tabs.map((tab, index) => (
      <button
        key={index}
        onClick={() => handleTabChange(index)}
        className={`${
          selectedTab === index
            ? 'border-blue-500 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        } flex-1 whitespace-nowrap py-4 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm transition-all duration-200 relative min-w-[25%] sm:min-w-0`}
      >
        {tab.showBadge ? (
          <div className='inline-flex items-center'>
            <span>{tab.label}</span>
            {tab.badgeCount && tab.badgeCount > 0 && (
              <span className='ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full bg-red-500'>
                {tab.badgeCount}
              </span>
            )}
          </div>
        ) : (
          tab.label
        )}
      </button>
    ));
  }, [
    selectedTab,
    handleTabChange,
    currentUserIsAdmin,
    groupBasicData?.pendingRequestsCount,
  ]);

  // Renderizar el contenido de la pestaña seleccionada
  const renderTabContent = useMemo(() => {
    if (!groupBasicData) return null;

    switch (selectedTab) {
      case 0:
        return (
          <LazyNextMatchTab
            groupId={groupId}
            basicData={groupBasicData}
            user={user}
            currentUserIsAdmin={currentUserIsAdmin}
            isUserInGroup={isUserInGroup}
            handleAttendance={handleAttendance}
            handleRandomTeams={handleRandomTeams}
            handleDeleteMatch={handleDeleteMatch}
            setShowReplaceTbdModal={setShowReplaceTbdModal}
            allowFillIn={allowFillIn}
            setAllowFillIn={setAllowFillIn}
            router={router}
          />
        );
      case 1:
        return <LazyHistoryTab groupId={groupId} />;
      case 2:
        return <LazyStatsTab groupId={groupId} type='goals' />;
      case 3:
        return <LazyStatsTab groupId={groupId} type='mvps' />;
      case 4:
        return (
          <LazyMembersTab
            groupId={groupId}
            basicData={groupBasicData}
            user={user}
            currentUserIsAdmin={currentUserIsAdmin}
            handleAdminAttendanceUpdate={handleAdminAttendanceUpdate}
          />
        );
      case 5:
        if (currentUserIsAdmin) {
          return (
            <LazyRequestsTab
              groupId={groupId}
              basicData={groupBasicData}
              handleMembershipRequest={handleMembershipRequest}
            />
          );
        }
        return null;
      default:
        return null;
    }
  }, [
    selectedTab,
    groupId,
    groupBasicData,
    user,
    currentUserIsAdmin,
    isUserInGroup,
    handleAttendance,
    handleRandomTeams,
    handleDeleteMatch,
    handleMembershipRequest,
    handleAdminAttendanceUpdate,
    allowFillIn,
    setAllowFillIn,
    setShowReplaceTbdModal,
    router,
  ]);

  return (
    <Layout>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {isGroupBasicLoading ? (
          <div className='flex justify-center items-center min-h-screen'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          </div>
        ) : groupBasicError ? (
          <div className='text-center text-red-600'>
            {groupBasicError instanceof Error
              ? groupBasicError.message
              : String(groupBasicError)}
          </div>
        ) : groupBasicData ? (
          <div className='space-y-6'>
            <SimpleHeaderComponent
              group={groupBasicData}
              currentUserIsAdmin={currentUserIsAdmin}
              isUserInGroup={isUserInGroup}
              handleLeaveGroup={handleLeaveGroup}
              recurrenceText={getRecurrenceText(groupBasicData)}
              shortInviteUrl={inviteUrl}
              inviteUrl={inviteUrl}
              copyInviteLink={copyInviteLink}
              isCopying={isCopying}
              router={router}
            />

            <div className='bg-white rounded-xl shadow-sm mb-0'>
              <nav
                className='flex overflow-x-auto rounded-t-xl scrollbar-hide'
                aria-label='Tabs'
                ref={tabsContainerRef}
              >
                {renderTabs}
              </nav>
            </div>

            <div
              className='bg-white rounded-xl shadow-sm p-4 sm:p-6'
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {renderTabContent}
            </div>
          </div>
        ) : (
          <div className='text-center text-gray-600'>Grupo no encontrado</div>
        )}
      </div>

      {showReplaceTbdModal && groupBasicData && (
        <ReplaceTbdPlayerModal
          showReplaceTbdModal={showReplaceTbdModal}
          setShowReplaceTbdModal={setShowReplaceTbdModal}
          group={groupBasicData}
          handleReplaceTbdPlayer={handleReplaceTbdPlayer}
          onSuccessfulReplace={() => {
            refetchBasicInfo();
          }}
        />
      )}
    </Layout>
  );
}
