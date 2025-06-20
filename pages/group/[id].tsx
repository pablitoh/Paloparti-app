import { useRouter } from 'next/router';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import GroupHeader from '../../components/group/GroupHeader';
import ReplaceTbdPlayerModal from '../../components/group/modals/ReplaceTbdPlayerModal';
import MembersTab from '../../components/group/tabs/MembersTab';
import NextMatchTab from '../../components/group/tabs/NextMatchTab';
import HistoryTab from '../../components/group/tabs/HistoryTab';
import GoalsTab from '../../components/group/tabs/GoalsTab';
import MvpTab from '../../components/group/tabs/MvpTab';
import LogsTab from '../../components/group/tabs/LogsTab';
import RequestsTab from '../../components/group/tabs/RequestsTab';
import MobileDrawer from '../../components/group/MobileDrawer';
import { Avatar } from '@mui/material';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
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
import type { Group, ParticipantStatus } from '../../types/group';
import type { MatchInterface } from '../../types/match';
import ManualTeamFormationModal from '../../components/group/modals/ManualTeamFormationModal';
import SwapPlayersModal from '../../components/group/modals/SwapPlayersModal';
import Link from 'next/link';
import { PlayerRole } from '../../lib/teambuilder/constants';

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
  basicData: GroupWithRelations;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  isUserInGroup: boolean;
  handleAttendance: (status: ParticipantStatus) => Promise<void>;
  handleRandomizeTeams: (confirmedPlayers?: any[]) => Promise<void>;
  handleDeleteMatch: (matchId: string) => Promise<void>;
  setShowReplaceTbdModal: (id: string) => void;
  setShowSwapPlayersModal: (value: boolean) => void;
  setPreSelectedPlayer: (
    player: { playerId: string; isTeamA: boolean } | null
  ) => void;
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  router: any;
  setShowManualTeamFormationModal: (value: boolean) => void;
}

interface LazyHistoryTabProps extends LazyTabProps {
  currentUserIsAdmin: boolean;
}

interface LazyStatsTabProps extends LazyTabProps {
  type: 'goals' | 'mvps';
}

interface LazyMembersTabProps extends LazyTabProps {
  basicData: any;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  handleAdminAttendance: (
    userId: string,
    status: ParticipantStatus,
    playerRoles?: PlayerRole[]
  ) => Promise<void>;
  handleLeaveGroup: () => Promise<void>;
}

interface LazyRequestsTabProps extends LazyTabProps {
  basicData: any;
  handleMembershipRequest: (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => Promise<void>;
}

interface LazyLogsTabProps extends LazyTabProps {}

interface TabConfig {
  label: string;
  showBadge?: boolean;
  badgeCount?: number;
}

interface GroupBasicData {
  id: string;
  name: string;
  description: string;
  teamAName: string;
  teamBName: string;
  nextMatchId: string;
  nextMatchDetails?: {
    id: string;
    confirmedPlayers: Array<{
      id: string;
      name: string;
      image?: string | null;
    }>;
  };
}

interface GroupWithRelations {
  id: string;
  name: string;
  sport?: string;
  location?: string;
  requiredPlayers?: number;
  teamAName?: string;
  teamBName?: string;
  nextMatchDetails?: MatchInterface;
  nextMatchId?: string;
  members?: any[];
  userStatus?: string;
  isAdmin?: boolean;
  createdBy?: string;
  inviteToken?: string;
  pendingRequestsCount?: number;
  userAttendanceStatus?: ParticipantStatus;
}

interface ApiResponse {
  nextMatchDetails?: MatchInterface;
  userAttendance?: ParticipantStatus;
  userRoles?: string[];
}

// Components for each tab that handle their own data loading
const LazyNextMatchTab = ({
  groupId,
  basicData,
  user,
  currentUserIsAdmin,
  isUserInGroup,
  handleAttendance,
  handleRandomizeTeams,
  handleDeleteMatch,
  setShowReplaceTbdModal,
  setShowSwapPlayersModal,
  setPreSelectedPlayer,
  allowFillIn,
  setAllowFillIn,
  router,
  setShowManualTeamFormationModal,
}: LazyNextMatchTabProps) => {
  const [isTeamsSorting, setIsTeamsSorting] = useState(false);
  const { data, isLoading, refetch } = useGroupNextMatch(groupId, {
    enabled: !!groupId,
    staleTime: isTeamsSorting ? 0 : 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Permitir refetch al montar para cargar datos al recargar la página
  });

  // Construct the group object expected by NextMatchTab
  const apiData = data as ApiResponse | undefined;
  const group: GroupWithRelations = {
    ...basicData,
    nextMatchDetails: apiData?.nextMatchDetails,
    userAttendanceStatus: apiData?.userAttendance,
    nextMatchId: apiData?.nextMatchDetails?.id || basicData?.nextMatchId,
  };

  // Only refetch once on initial mount to ensure we have the latest data
  useEffect(() => {
    // Initial data load - no need to refetch on every render
    // The delete and other operations will trigger their own refetches
  }, []);

  // Create a handler function that wraps handleAttendance
  const handleGroupAttendance = async (status: ParticipantStatus) => {
    try {
      await handleAttendance(status);
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
    }
  };

  // Wrap handleRandomTeams to ensure we refetch after team sorting
  const handleTeamSorting = async () => {
    try {
      setIsTeamsSorting(true);

      // Check if we have a valid match with an ID
      if (!apiData?.nextMatchDetails?.id) {
        showErrorToast('No hay un partido válido para sortear equipos');
        return;
      }

      // Pass the current next match data to make sure we have the confirmed players
      await handleRandomizeTeams(apiData?.nextMatchDetails?.confirmedPlayers);
      // Don't refetch here as the mutation already handles it
      // This prevents double calls to the API
    } catch (error) {
      console.error('Error sorting teams:', error);
      showErrorToast('Error al formar equipos');
    } finally {
      setIsTeamsSorting(false);
    }
  };

  // Wrap handleDeleteMatch to ensure we refetch after match deletion
  const handleMatchDeletion = async (matchId: string) => {
    try {
      await handleDeleteMatch(matchId);
      // Don't refetch here as the mutation already handles it
      // This prevents double calls to the API
    } catch (error) {
      console.error('Error deleting match:', error);
      showErrorToast('Error al eliminar el partido');
    }
  };

  return (
    <div className='relative min-h-[300px]'>
      {isLoading ? (
        <div className='absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      ) : null}

      <NextMatchTab
        group={group}
        user={user}
        id={groupId}
        currentUserIsAdmin={currentUserIsAdmin}
        isUserInGroup={isUserInGroup}
        setShowReplaceTbdModal={setShowReplaceTbdModal}
        setShowSwapPlayersModal={setShowSwapPlayersModal}
        setPreSelectedPlayer={setPreSelectedPlayer}
        handleGroupAttendance={handleGroupAttendance}
        handleSortTeams={handleTeamSorting}
        handleAddResults={() =>
          router.push(`/matches/${group?.nextMatchId}/results?edit=true`)
        }
        handleDeleteMatch={handleMatchDeletion}
        userAttendanceStatus={(data as ApiResponse)?.userAttendance}
        userRoles={(data as ApiResponse)?.userRoles || []}
        allowFillIn={allowFillIn}
        setAllowFillIn={setAllowFillIn}
        setShowManualTeamFormationModal={setShowManualTeamFormationModal}
      />
    </div>
  );
};

const LazyHistoryTab = ({
  groupId,
  currentUserIsAdmin,
}: LazyHistoryTabProps) => {
  const { data, isLoading } = useGroupHistory(groupId, 1, 10, {
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const sortedMatches = data?.matches
    ? [...data.matches].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      })
    : [];

  return (
    <div className='relative min-h-[300px]'>
      {isLoading ? (
        <div className='absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      ) : null}

      <HistoryTab
        completedMatches={sortedMatches}
        id={groupId}
        formatMatchDate={formatMatchDate}
        getScoreForTeam={getScoreForTeam}
        getPlayerGoals={getPlayerGoals}
        renderGoalBalls={renderGoalBalls}
        currentUserIsAdmin={currentUserIsAdmin}
      />
    </div>
  );
};

const LazyStatsTab = ({ groupId, type }: LazyStatsTabProps) => {
  const { data, isLoading } = useGroupStats(groupId, {
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <div className='relative min-h-[300px]'>
      {isLoading ? (
        <div className='absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      ) : null}

      {type === 'goals' ? (
        <GoalsTab goleadores={data?.goleadores || []} />
      ) : (
        <MvpTab mvps={data?.mvps || []} />
      )}
    </div>
  );
};

const LazyMembersTab = ({
  groupId,
  basicData,
  user,
  currentUserIsAdmin,
  handleAdminAttendance,
  handleLeaveGroup,
}: LazyMembersTabProps) => {
  const { data: nextMatchData, isLoading: isNextMatchLoading } =
    useGroupNextMatch(groupId, {
      enabled: !!groupId,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  const { data: membersData, isLoading: isMembersLoading } = useGroupMembers(
    groupId,
    {
      enabled: !!groupId,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const groupWithMembers = {
    ...basicData,
    members: membersData?.members || [],
    nextMatchDetails:
      (nextMatchData as ApiResponse | undefined)?.nextMatchDetails ||
      basicData.nextMatchDetails,
  };

  return (
    <div className='relative min-h-[300px]'>
      {isNextMatchLoading || isMembersLoading ? (
        <div className='absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      ) : null}

      <MembersTab
        group={groupWithMembers}
        user={user}
        currentUserIsAdmin={currentUserIsAdmin}
        isLoading={isNextMatchLoading || isMembersLoading}
        handleConfirmAttendance={async (
          memberId: string,
          userId: string,
          playerRoles?: PlayerRole[]
        ) => {
          await handleAdminAttendance(
            'CONFIRMED',
            userId,
            undefined,
            playerRoles
          );
        }}
        handleDeclineAttendance={async (memberId: string, userId: string) => {
          await handleAdminAttendance('DECLINED', userId);
        }}
        handleLeaveGroup={handleLeaveGroup}
      />
    </div>
  );
};

const LazyRequestsTab = ({
  groupId,
  basicData,
  handleMembershipRequest,
}: LazyRequestsTabProps) => {
  const { data, isLoading, refetch } = useGroupMembers(groupId, {
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Forzar refetch cuando el componente se monta para asegurar que tenemos datos frescos
  useEffect(() => {
    // Cuando el componente se monta, forzamos un refetch para garantizar datos actualizados
    refetch();
  }, [refetch]);

  const pendingRequests = data?.pendingRequests || [];

  return (
    <div className='relative min-h-[300px]'>
      {isLoading ? (
        <div className='absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      ) : null}

      <RequestsTab
        pendingRequests={pendingRequests}
        isLoading={isLoading}
        handleMembershipRequest={handleMembershipRequest}
      />
    </div>
  );
};

const LazyLogsTab = ({ groupId }: LazyLogsTabProps) => {
  return <LogsTab groupId={groupId} />;
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
  const [showSwapPlayersModal, setShowSwapPlayersModal] =
    useState<boolean>(false);
  const [preSelectedPlayer, setPreSelectedPlayer] = useState<{
    playerId: string;
    isTeamA: boolean;
  } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [allowFillIn, setAllowFillIn] = useState(false);
  const [showManualTeamFormationModal, setShowManualTeamFormationModal] =
    useState(false);

  // Normalize groupId to prevent unnecessary re-renders
  const groupId = useMemo(() => {
    return Array.isArray(id) ? id[0] : id || '';
  }, [id]);

  // Wait for router to be ready before enabling any queries
  const isRouterReady = router.isReady;

  // Fetch basic group info once and cache it for a long time
  const {
    data: groupBasicData,
    isLoading: isGroupBasicLoading,
    error: groupBasicError,
    refetch: refetchBasicInfo,
  } = useGroupBasicInfo(groupId, {
    enabled: !!groupId && isRouterReady,
    staleTime: 30 * 60 * 1000, // 30 minutes - much longer to prevent refetches
    cacheTime: 60 * 60 * 1000, // 60 minutes cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-green-soft'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          {isGroupBasicLoading ? (
            <div className='flex justify-center items-center min-h-screen'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4'></div>
                <p className='text-primary-700 font-medium'>
                  Cargando grupo...
                </p>
              </div>
            </div>
          ) : groupBasicError ? (
            <div className='flex justify-center items-center min-h-screen'>
              <div className='bg-white rounded-2xl shadow-green-lg p-8 max-w-md mx-auto text-center'>
                <div className='w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-8 h-8 text-error-500'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                    />
                  </svg>
                </div>
                <div className='text-center text-error-600'>
                  {groupBasicError instanceof Error
                    ? groupBasicError.message
                    : String(groupBasicError)}
                </div>
              </div>
            </div>
          ) : groupBasicData ? (
            <GroupContent
              groupBasicData={groupBasicData as GroupWithRelations}
              groupId={groupId}
              user={user}
              router={router}
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
              showReplaceTbdModal={showReplaceTbdModal}
              setShowReplaceTbdModal={setShowReplaceTbdModal}
              showSwapPlayersModal={showSwapPlayersModal}
              setShowSwapPlayersModal={setShowSwapPlayersModal}
              preSelectedPlayer={preSelectedPlayer}
              setPreSelectedPlayer={setPreSelectedPlayer}
              allowFillIn={allowFillIn}
              setAllowFillIn={setAllowFillIn}
              onRefreshData={refetchBasicInfo}
              showManualTeamFormationModal={showManualTeamFormationModal}
              setShowManualTeamFormationModal={setShowManualTeamFormationModal}
            />
          ) : (
            <div className='flex justify-center items-center min-h-screen'>
              <div className='bg-white rounded-2xl shadow-green-lg p-8 text-center'>
                <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-8 h-8 text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47.938-6.018 2.472M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                    />
                  </svg>
                </div>
                <div className='text-center text-gray-600 font-medium'>
                  Grupo no encontrado
                </div>
                <p className='text-gray-500 text-sm mt-2'>
                  El grupo que buscas no existe o no tienes acceso a él
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Separate component to ensure stable rendering
const GroupContent = ({
  groupBasicData,
  groupId,
  user,
  router,
  selectedTab,
  setSelectedTab,
  showReplaceTbdModal,
  setShowReplaceTbdModal,
  showSwapPlayersModal,
  setShowSwapPlayersModal,
  preSelectedPlayer,
  setPreSelectedPlayer,
  allowFillIn,
  setAllowFillIn,
  onRefreshData,
  showManualTeamFormationModal,
  setShowManualTeamFormationModal,
}: {
  groupBasicData: GroupWithRelations;
  groupId: string;
  user: AuthUser | null;
  router: any;
  selectedTab: number;
  setSelectedTab: (tab: number) => void;
  showReplaceTbdModal: string;
  setShowReplaceTbdModal: (id: string) => void;
  showSwapPlayersModal: boolean;
  setShowSwapPlayersModal: (value: boolean) => void;
  preSelectedPlayer: { playerId: string; isTeamA: boolean } | null;
  setPreSelectedPlayer: (
    player: { playerId: string; isTeamA: boolean } | null
  ) => void;
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  onRefreshData: () => void;
  showManualTeamFormationModal: boolean;
  setShowManualTeamFormationModal: (value: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const isUserInGroup = !!groupBasicData?.userStatus;
  const currentUserIsAdmin = !!groupBasicData?.isAdmin;

  // Estado para controlar el drawer de navegación móvil
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  // Hook de acciones del grupo
  const {
    handleAttendance,
    handleAdminAttendance,
    handleMembershipRequest,
    handleLeaveGroup,
    handleRandomizeTeams,
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
  const isUserPendingInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    return groupBasicData.userStatus === 'PENDING';
  }, [groupBasicData, user]);

  // Efecto para procesar datos del grupo
  useEffect(() => {
    if (!groupBasicData) return;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    setInviteUrl(`${baseUrl}/invite/${groupId}`);
  }, [groupBasicData, groupId]);

  // Efecto para leer la pestaña de la URL y sincronizar con el estado local
  useEffect(() => {
    if (!router.isReady) return;

    const tabParam = router.query.tab;
    if (tabParam && !isNaN(Number(tabParam))) {
      const tabIndex = Number(tabParam);
      // Corregir el maxTabs para incluir la pestaña de solicitudes cuando es admin
      const maxTabs = currentUserIsAdmin ? 7 : 6;

      if (tabIndex >= 0 && tabIndex < maxTabs) {
        setSelectedTab(tabIndex);
      }
    }
  }, [router.isReady, router.query.tab, currentUserIsAdmin, setSelectedTab]);

  // Función para copiar enlace de invitación
  const copyInviteLink = () => {
    if (!groupBasicData?.inviteToken && !groupId) return;

    setIsCopying(true);
    const baseUrl = window.location.origin;
    const urlToCopy = groupBasicData?.inviteToken
      ? `${baseUrl}/invite/${groupBasicData.inviteToken}`
      : `${baseUrl}/invite/${groupId}`;

    // Try using the clipboard API first
    try {
      navigator.clipboard
        .writeText(urlToCopy)
        .then(() => {
          showSuccessToast('Enlace copiado al portapapeles');
          setTimeout(() => {
            setIsCopying(false);
          }, 2000);
        })
        .catch((err) => {
          // If clipboard API fails, use fallback method
          console.error('Error al copiar enlace:', err);

          // Fallback: Create temporary input element
          const tempInput = document.createElement('input');
          tempInput.value = urlToCopy;
          document.body.appendChild(tempInput);
          tempInput.focus();
          tempInput.select();

          let success = false;
          try {
            // Execute copy command
            success = document.execCommand('copy');
          } catch (e) {
            console.error('Fallback copy method failed:', e);
          }

          // Clean up
          document.body.removeChild(tempInput);

          if (success) {
            showSuccessToast('Enlace copiado al portapapeles');
          } else {
            showErrorToast('Error al copiar enlace');
          }

          setIsCopying(false);
        });
    } catch (err) {
      // Handle any synchronous errors
      console.error('Error al acceder al portapapeles:', err);
      showErrorToast('Error al copiar enlace');
      setIsCopying(false);
    }
  };

  // Configuración de pestañas
  const tabs: TabConfig[] = useMemo(() => {
    const baseTabs: TabConfig[] = [
      { label: 'Próximo Partido' },
      { label: 'Historial' },
      { label: 'Goleadores' },
      { label: 'MVPs' },
      { label: 'Miembros' },
      { label: 'Logs' },
    ];

    if (currentUserIsAdmin) {
      baseTabs.push({
        label: 'Solicitudes',
        showBadge: !!groupBasicData?.pendingRequestsCount,
        badgeCount: groupBasicData?.pendingRequestsCount || 0,
      });
    }

    return baseTabs;
  }, [currentUserIsAdmin, groupBasicData?.pendingRequestsCount]);

  // Simple tab change handler that only updates state and URL
  const handleTabChange = useCallback(
    (index: number) => {
      // Verificar que la pestaña a la que intentamos ir existe
      const maxTabIndex = tabs.length;

      if (index >= 0 && index < maxTabIndex) {
        // Just update local state first for responsive UI
        setSelectedTab(index);

        // Invalidate appropriate queries based on selected tab
        if (index === 0 && groupId) {
          queryClient.invalidateQueries({
            queryKey: ['group', 'nextMatch', groupId],
          });
        }

        // Invalidate members query when selecting the Requests tab (índice 6 para administradores)
        if (index === 6 && groupId && currentUserIsAdmin) {
          queryClient.invalidateQueries({
            queryKey: ['group', 'members', groupId],
          });
        }

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
    [router, tabs.length, groupId, queryClient, currentUserIsAdmin]
  );

  // Renderizar las pestañas disponibles según el rol del usuario
  const renderTabs = useMemo(() => {
    return tabs.map((tab, index) => (
      <button
        key={index}
        onClick={() => handleTabChange(index)}
        className={`${
          selectedTab === index
            ? 'border-primary-500 text-primary-600 bg-primary-50'
            : 'border-transparent text-gray-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50'
        } flex-1 whitespace-nowrap py-4 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm transition-all duration-200 relative min-w-[25%] sm:min-w-0`}
      >
        {tab.showBadge ? (
          <div className='inline-flex items-center'>
            <span>{tab.label}</span>
            {tab.badgeCount && tab.badgeCount > 0 && (
              <span className='ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full bg-gradient-green shadow-green'>
                {tab.badgeCount}
              </span>
            )}
          </div>
        ) : (
          tab.label
        )}
      </button>
    ));
  }, [tabs, selectedTab, handleTabChange]);

  // Renderizar el contenido de la pestaña seleccionada
  const renderTabContent = useMemo(() => {
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
            handleRandomizeTeams={handleRandomizeTeams}
            handleDeleteMatch={handleDeleteMatch}
            setShowReplaceTbdModal={setShowReplaceTbdModal}
            setShowSwapPlayersModal={setShowSwapPlayersModal}
            setPreSelectedPlayer={setPreSelectedPlayer}
            allowFillIn={allowFillIn}
            setAllowFillIn={setAllowFillIn}
            router={router}
            setShowManualTeamFormationModal={setShowManualTeamFormationModal}
          />
        );
      case 1:
        return (
          <LazyHistoryTab
            groupId={groupId}
            currentUserIsAdmin={currentUserIsAdmin}
          />
        );
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
            handleAdminAttendance={handleAdminAttendance}
            handleLeaveGroup={handleLeaveGroup}
          />
        );
      case 5:
        return <LazyLogsTab groupId={groupId} />;
      case 6:
        if (currentUserIsAdmin) {
          // Usar key con timestamp para forzar re-renderizado completo cuando se selecciona la pestaña
          return (
            <LazyRequestsTab
              key={`requests-tab-${Date.now()}`}
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
    handleRandomizeTeams,
    handleDeleteMatch,
    handleMembershipRequest,
    handleAdminAttendance,
    handleLeaveGroup,
    allowFillIn,
    setAllowFillIn,
    setShowReplaceTbdModal,
    setShowSwapPlayersModal,
    router,
    setShowManualTeamFormationModal,
  ]);

  // Agregar la consulta del próximo partido
  const { data: nextMatchData } = useGroupNextMatch(groupId, {
    enabled: !!groupId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Permitir refetch al montar para cargar datos al recargar la página
  });

  // Ensure nextMatchId is always up to date
  useEffect(() => {
    // Re-fetch groupBasicData when a match is deleted to get updated matchId
    if (groupBasicData?.nextMatchId === null) {
      onRefreshData();
    }
  }, [groupBasicData?.nextMatchId, onRefreshData]);

  return (
    <div className='space-y-6'>
      <GroupHeader
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

      {/* Tabs de navegación - ocultos en móvil */}
      <div className='hidden md:block bg-white rounded-2xl shadow-green-lg mb-0'>
        <nav
          className='flex overflow-x-auto rounded-t-2xl scrollbar-hide'
          aria-label='Tabs'
        >
          {renderTabs}
        </nav>
      </div>

      {/* Mobile drawer para navegación en móvil */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={(index) => {
          console.log('Mobile drawer - changing tab to:', index);
          handleTabChange(index);
          setIsDrawerOpen(false);
        }}
      />

      {/* Área de contenido principal */}
      <div>{renderTabContent}</div>

      {showReplaceTbdModal && groupBasicData && (
        <ReplaceTbdPlayerModal
          showReplaceTbdModal={showReplaceTbdModal}
          setShowReplaceTbdModal={setShowReplaceTbdModal}
          group={{
            ...groupBasicData,
            nextMatchDetails:
              (nextMatchData as ApiResponse | undefined)?.nextMatchDetails ||
              groupBasicData.nextMatchDetails,
          }}
          handleReplaceTbdPlayer={handleReplaceTbdPlayer}
          onSuccessfulReplace={onRefreshData}
        />
      )}

      {showManualTeamFormationModal && groupBasicData && (
        <ManualTeamFormationModal
          isOpen={showManualTeamFormationModal}
          onClose={() => setShowManualTeamFormationModal(false)}
          matchId={groupBasicData.nextMatchId || ''}
          groupId={groupId}
          confirmedPlayers={(
            (nextMatchData as ApiResponse)?.nextMatchDetails
              ?.confirmedPlayers || []
          ).map(
            (player: {
              id: string;
              name: string | null;
              avatar: string | null;
            }) => ({
              id: player.id,
              name: player.name || '',
              avatar: player.avatar,
              image: player.avatar,
            })
          )}
          onSuccess={() => {
            // Force refresh of all relevant data
            console.log('Manual team formation successful, refreshing data...');
            // First explicitly invalidate the next match query to guarantee a refetch
            queryClient.invalidateQueries({
              queryKey: ['group', 'nextMatch', groupId],
              exact: true,
              refetchType: 'all', // Force immediate refetch
            });

            // Then call the generic refresh function
            onRefreshData();

            // Set a small delay and check if the UI updated
            setTimeout(() => {
              const currentData = queryClient.getQueryData([
                'group',
                'nextMatch',
                groupId,
              ]);
              console.log(
                'Current next match data after refresh:',
                currentData
              );
            }, 500);
          }}
        />
      )}

      {showSwapPlayersModal && groupBasicData && (
        <SwapPlayersModal
          isOpen={showSwapPlayersModal}
          onClose={() => {
            setShowSwapPlayersModal(false);
            setPreSelectedPlayer(null);
          }}
          group={{
            ...groupBasicData,
            nextMatchDetails:
              (nextMatchData as ApiResponse | undefined)?.nextMatchDetails ||
              groupBasicData.nextMatchDetails,
          }}
          preSelectedPlayer={preSelectedPlayer}
          onSuccess={() => {
            console.log('Player swap successful, refreshing data...');
            // Invalidate the next match query to refresh team data
            queryClient.invalidateQueries({
              queryKey: ['group', 'nextMatch', groupId],
              exact: true,
              refetchType: 'all',
            });

            // Call the generic refresh function
            onRefreshData();

            // Reset pre-selected player
            setPreSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
};
