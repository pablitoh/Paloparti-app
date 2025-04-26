import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useSession } from 'next-auth/react';
import Button from '../../components/Button';
import { Avatar } from '@mui/material';
import {
  UserGroupIcon,
  CalendarIcon,
  MapPinIcon,
  ChevronRightIcon,
  CheckCircleIcon as CheckCircleIconOutline,
  XCircleIcon as XCircleIconOutline,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,
  CheckCircleIcon,
  UserIcon,
  XCircleIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import type { PrismaClient } from '@prisma/client';
import { Box, Typography, Chip } from '@mui/material';
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

// Helper para mostrar toast
const showToast = (message: string, type: 'success' | 'error') => {
  if (type === 'success') {
    showSuccessToast(message);
  } else {
    showErrorToast(message);
  }
};

// Tipos para el componente
type GroupWithRelations = NonNullable<
  Awaited<ReturnType<PrismaClient['group']['findUnique']>>
> & {
  matches: NonNullable<Awaited<ReturnType<PrismaClient['match']['findMany']>>>;
  members: Array<
    NonNullable<
      Awaited<ReturnType<PrismaClient['groupMember']['findUnique']>>
    > & {
      user: NonNullable<
        Awaited<ReturnType<PrismaClient['user']['findUnique']>>
      >;
    }
  >;
  creator: NonNullable<Awaited<ReturnType<PrismaClient['user']['findUnique']>>>;
  nextMatchRef?: NonNullable<
    Awaited<ReturnType<PrismaClient['match']['findUnique']>>
  >;
  nextMatchId?: string;
  nextMatchDetails?: MatchInterface;
  message?: string;
  userStatus?: string;
};

interface MatchInterface {
  id: string;
  date: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Player[];
  playersB?: Player[];
  confirmedPlayers?: Player[];
  tbdPlayers?: Player[];
  goals?: Array<{
    id: string;
    isTeamA: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  groupId?: string;
  goalsA?: Array<{
    id: string;
    isTeamA: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
  goalsB?: Array<{
    id: string;
    isTeamA?: boolean;
    isTeamB?: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
}

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
  isTeamA?: boolean;
}

type ParticipantStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'DECLINED'
  | 'confirmed'
  | 'pending'
  | 'declined';

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

export default function GroupDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const user = session?.user;

  // Estados para la UI
  const [selectedTab, setSelectedTab] = useState(0);
  const [showTeams, setShowTeams] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(true);
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);
  const [isTeamsCollapsed, setIsTeamsCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [userAttendanceStatus, setUserAttendanceStatus] =
    useState<ParticipantStatus | null>(null);
  const [hasResorted, setHasResorted] = useState(false);
  const [balanceByAge, setBalanceByAge] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<MatchInterface | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchInterface | null>(null);
  const [sortTeamsLoading, setSortTeamsLoading] = useState(false);
  const [sortTeamsError, setSortTeamsError] = useState<string | null>(null);
  const [sortLocation, setSortLocation] = useState('');
  const [sortDate, setSortDate] = useState('');
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReplaceTbdModal, setShowReplaceTbdModal] = useState<string>('');
  const [hasVotedForResort, setHasVotedForResort] = useState(false);
  const [showConfirmResort, setShowConfirmResort] = useState(false);
  const [showNextMatchsConfirm, setShowNextMatchsConfirm] = useState(false);
  const [openGenerateTeamsDialog, setOpenGenerateTeamsDialog] = useState(false);
  const [isMatchHistoryCollapsed, setIsMatchHistoryCollapsed] = useState(false);
  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [tbdPlayersLoaded, setTbdPlayersLoaded] = useState(false);
  const [allowFillIn, setAllowFillIn] = useState(true);
  const [resetAttendanceLoading, setResetAttendanceLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [tbdRestored, setTbdRestored] = useState(false);
  const [isActiveUser, setIsActiveUser] = useState(false);
  const [key, setKey] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

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
  } = useGroupMembers(Array.isArray(id) ? id[0] : id);

  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useGroupStats(Array.isArray(id) ? id[0] : id);

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useGroupHistory(Array.isArray(id) ? id[0] : id, 1, 10);

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

    // Ensure we explicitly check and include admin status
    const isAdmin =
      membersData?.isAdmin === true || groupBasicData.isAdmin === true || false;

    console.log('GROUP ADMIN STATUS:');
    console.log('- membersData?.isAdmin:', membersData?.isAdmin);
    console.log('- groupBasicData.isAdmin:', groupBasicData.isAdmin);
    console.log('- combined isAdmin:', isAdmin);

    return {
      ...groupBasicData,
      nextMatchDetails: nextMatchData?.nextMatchDetails || null,
      userAttendanceStatus: nextMatchData?.userAttendance || null,
      members: membersData?.members || [],
      pendingRequests: membersData?.pendingRequests || [],
      isAdmin: isAdmin,
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
    // Check if user is in the members array
    if (membersData?.members) {
      return membersData.members.some(
        (member: any) =>
          member.userId === user.id &&
          (member.status === 'ACTIVE' || member.status === 'CONFIRMED')
      );
    }
    // Fallback to the legacy userStatus check
    return (
      groupBasicData.userStatus === 'ACTIVE' ||
      groupBasicData.userStatus === 'CONFIRMED'
    );
  }, [groupBasicData, user, membersData]);

  // Verificar si el usuario está pendiente de confirmación
  const isUserPendingInGroup = useMemo(() => {
    if (!user || !groupBasicData) return false;
    // Check if user is in the members array as pending
    if (membersData?.members) {
      return membersData.members.some(
        (member: any) =>
          member.userId === user.id && member.status === 'PENDING'
      );
    }
    // Fallback to the legacy userStatus check
    return groupBasicData.userStatus === 'PENDING';
  }, [groupBasicData, user, membersData]);

  const currentUserIsAdmin = useMemo(() => {
    if (!user || !groupBasicData) return false;

    // First check if we have explicit admin status from the API
    if (membersData?.isAdmin === true || groupBasicData.isAdmin === true) {
      return true;
    }

    // Check if user is in the members array as admin
    if (membersData?.members) {
      const isAdminInMembers = membersData.members.some(
        (member: any) =>
          member.userId === user.id &&
          member.role === 'ADMIN' &&
          member.status === 'ACTIVE'
      );

      if (isAdminInMembers) return true;
    }

    // Last resort - check if the user is the creator of the group
    return groupBasicData.createdBy === user.id;
  }, [groupBasicData, user, membersData]);

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

  // Refrescar todos los datos del grupo
  const refreshAllData = () => {
    refetchBasicInfo();
    refetchNextMatch();
    refetchMembers();
  };

  // Crear una función para analizar TBD players
  const parseTbdPlayers = (matchData: any) => {
    if (!matchData) return matchData;

    // Copia profunda del match para no mutar el original
    const match = JSON.parse(JSON.stringify(matchData));

    // Convertir tbdPlayers si existe y es un string
    if (match.tbdPlayers && typeof match.tbdPlayers === 'string') {
      try {
        match.tbdPlayers = JSON.parse(match.tbdPlayers);
      } catch (e) {
        console.error('Error parsing tbdPlayers:', e);
        match.tbdPlayers = [];
      }
    }

    return match;
  };

  // Esta función ahora simplemente llama al refetch() del hook
  const handleRefetchGroup = () => {
    refreshAllData();
  };

  // Process group data when it changes
  useEffect(() => {
    if (!group) return;

    // Buscar si hay un partido pendiente
    const pendingMatchData = nextMatchData?.nextMatchDetails || null;

    // Solo procesar si tenemos datos válidos
    if (pendingMatchData) {
      // Si hay partido pendiente con equipos, usarlo

      // Asegurarnos de que los nombres de los equipos estén correctos
      if (group.teamAName && group.teamBName) {
        pendingMatchData.teamA = pendingMatchData.teamA || group.teamAName;
        pendingMatchData.teamB = pendingMatchData.teamB || group.teamBName;
      }

      setPendingMatch(pendingMatchData);

      // Si tiene equipos A o B, mostrar los equipos formados
      const hasTeams =
        (pendingMatchData.playersA && pendingMatchData.playersA.length > 0) ||
        (pendingMatchData.playersB && pendingMatchData.playersB.length > 0);

      setShowTeams(hasTeams || false);
    } else {
      // No hay equipos sorteados, mostrar interfaz para sortear
      setPendingMatch(null);
      setShowTeams(false);
    }

    // Generate invite URL using the group ID directly
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    setInviteUrl(`${baseUrl}/invite/${id}`);

    // Verificar si el usuario actual está confirmado para el próximo partido
    if (user && nextMatchData?.nextMatchDetails?.confirmedPlayers) {
      const isConfirmed = nextMatchData.nextMatchDetails.confirmedPlayers.some(
        (player: any) => player.id === user.id
      );

      // Actualizar el estado de asistencia
      setUserAttendanceStatus(isConfirmed ? 'CONFIRMED' : 'DECLINED');
    } else {
      setUserAttendanceStatus(null);
    }

    try {
      // Recuperar jugadores TBD del partido actual
      if (group.nextMatchId && !tbdPlayersLoaded) {
        loadTbdPlayersFromAPI(group.nextMatchId);
        setTbdPlayersLoaded(true);
      }
    } catch (error) {
      console.error('Error loading TBD players:', error);
      setTbdPlayersLoaded(false);
    }

    // Track active user status
    if (group.userStatus === 'ACTIVE') {
      setIsActiveUser(true);
    }

    // Set invite URL if available
    if (group.inviteToken) {
      const baseUrl = window.location.origin;
      const fullInviteUrl = `${baseUrl}/invite/${group.inviteToken}`;
      setInviteUrl(fullInviteUrl);
    }

    // Log membership status for debugging
    console.log('USER MEMBERSHIP DEBUG:');
    console.log('- user?.id:', user?.id);
    console.log('- isUserInGroup calculated:', isUserInGroup);
    if (membersData?.members) {
      const foundMember = membersData.members.find(
        (member: any) => member.userId === user?.id
      );
      console.log('- user found in members array:', !!foundMember);
      if (foundMember) {
        console.log('- member status:', foundMember.status);
        console.log('- member role:', foundMember.role);
      }
    }
  }, [group, id, user, tbdPlayersLoaded, nextMatchData]);

  // Llamar a calculateStats cada vez que cambia el grupo
  useEffect(() => {
    if (statsData) {
      // No need to update goleadores or mvps here, as they are already managed by useMemo
    }
  }, [statsData]);

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

  // Función para recuperar los TBD players si no están disponibles
  const loadTbdPlayersFromAPI = async (matchId: string) => {
    try {
      console.log(`Attempting to load TBD players for match: ${matchId}`);

      // Check if user is authenticated before making the API call
      if (!session || !session.user) {
        console.error('Cannot load TBD players: User not authenticated');
        return null;
      }

      const response = await fetch(`/api/matches/${matchId}/tbd-players`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication error loading TBD players');
          return null;
        }

        const errorText = await response.text();
        console.error(
          `Error loading TBD players: ${response.status} ${response.statusText}`
        );
        throw new Error(
          `Failed to load TBD players: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.tbdPlayers) {
        console.log('TBD players loaded, refreshing group data');
        await handleRefetchGroup();
      }

      return data;
    } catch (error) {
      console.error('Error in loadTbdPlayersFromAPI:', error);
      return null;
    }
  };

  // Function to get tomorrow's date in YYYY-MM-DD format
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Set the default date to tomorrow when component loads
    setSortDate(getTomorrowDate());
  }, []);

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

  // Formar equipos aleatorios
  const handleRandomTeams = async () => {
    if (!group?.nextMatchDetails?.id || !id || Array.isArray(id)) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    await executeAction(async () => {
      // Obtener jugadores confirmados
      const confirmedPlayers = group.nextMatchDetails?.confirmedPlayers || [];

      // Crear el formato de jugadores que espera la API
      const players = confirmedPlayers.map((player: any) => ({
        userId: player.id,
        isTeamA: Math.random() > 0.5, // Distribuir aleatoriamente para la solicitud inicial
        name: player.name,
      }));

      // Crear también TBD players si es necesario
      const missingPlayers = Math.max(
        0,
        (group.requiredPlayers || 10) - players.length
      );
      let tbdPlayers: {
        teamA: Array<{
          id: string;
          name: string;
          avatar: null;
          isTeamA: boolean;
        }>;
        teamB: Array<{
          id: string;
          name: string;
          avatar: null;
          isTeamA: boolean;
        }>;
      } = {
        teamA: [],
        teamB: [],
      };

      if (allowFillIn && missingPlayers > 0) {
        // Crear jugadores TBD para completar equipos
        const tbdTeamA = [];
        const tbdTeamB = [];

        for (let i = 0; i < missingPlayers; i++) {
          const tbdPlayer = {
            id: `tbd-${Date.now()}-${i}`,
            name: `TBD ${i + 1}`,
            avatar: null,
            isTeamA: i % 2 === 0, // Alternar entre equipos
          };

          if (i % 2 === 0) {
            tbdTeamA.push(tbdPlayer);
          } else {
            tbdTeamB.push(tbdPlayer);
          }
        }

        tbdPlayers = {
          teamA: tbdTeamA,
          teamB: tbdTeamB,
        };
      }

      // Enviar solicitud al servidor
      const response = await fetch(
        `/api/matches/${group.nextMatchDetails.id}/resort`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            players,
            tbdPlayers,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al formar equipos');
      }

      // Refrescar los datos después de formar equipos
      await handleRefetchGroup();
      showSuccessToast('Equipos formados correctamente');
    });
  };

  // Eliminar un partido
  const handleDeleteMatch = async (matchId: string) => {
    if (!id || Array.isArray(id)) {
      showErrorToast('ID de grupo inválido');
      return;
    }

    await executeAction(async () => {
      await deleteMatchMutation.mutateAsync({
        matchId,
        groupId: id,
      });
    });
  };

  // Reemplazar jugador TBD
  const handleReplaceTbdPlayer = async (
    tbdPlayerId: string,
    userId: string,
    isTeamA: boolean
  ) => {
    if (!group?.nextMatchDetails?.id || !id || Array.isArray(id)) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    await executeAction(async () => {
      await replaceTbdPlayerMutation.mutateAsync({
        tbdPlayerId,
        userId,
        matchId: group.nextMatchDetails.id,
        isTeamA,
        groupId: id,
      });
    });
  };

  // Resetear asistencia
  const handleResetAttendance = async () => {
    if (!group?.nextMatchDetails?.id || !id || Array.isArray(id)) {
      showErrorToast(
        'No hay próximo partido configurado o ID de grupo inválido'
      );
      return;
    }

    await executeAction(async () => {
      await resetAttendanceMutation.mutateAsync({
        matchId: group.nextMatchDetails.id,
        groupId: id,
      });
    });
  };

  // Función para inicializar los goles de los jugadores
  const initializePlayerGoals = (match: MatchInterface) => {
    const players = [...(match.playersA || []), ...(match.playersB || [])];
    return players.reduce((acc: { [key: string]: number }, player) => {
      acc[player.id] = 0;
      return acc;
    }, {});
  };

  // Función para redirigir a la página de resultados
  const handleAddResults = () => {
    if (!group?.nextMatchId) {
      showToast('No hay un próximo partido para registrar resultados', 'error');
      return;
    }

    // Usar el ID del próximo partido del grupo en lugar de pendingMatch
    router.push(`/matches/${group.nextMatchId}/results?edit=true`);
  };

  /**
   * Formatea la fecha del partido
   */
  const formatMatchDate = (date: string | Date) => {
    if (!date) return 'No programado';

    // Ensure we have a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formattedDate;
  };

  // Función para calcular el puntaje de un equipo en un partido
  const getScoreForTeam = (match: MatchInterface, isTeamA: boolean): number => {
    if (!match) return 0;
    return isTeamA ? match.scoreA : match.scoreB;
  };

  // Keep the functions needed for the HistoryTab component
  const getPlayerGoals = (match: MatchInterface, playerId: string): number => {
    return (
      match.goals?.filter((goal) => goal.scorerId === playerId).length || 0
    );
  };

  // Function to render soccer ball icons based on goal count
  const renderGoalBalls = (count: number) => {
    if (count === 0) return null;

    return (
      <div className='flex space-x-1 ml-2'>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} role='img' aria-label='goal' className='text-sm'>
            ⚽
          </span>
        ))}
      </div>
    );
  };

  // Simple function to copy invite link
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

  // Definir una interfaz para los componentes de las pestañas
  interface TabComponent {
    label: string;
    component: React.ReactNode;
    adminOnly?: boolean;
  }

  // Modificar los componentes para manejar el tipo Group | null
  // Crear un wrapper para NextMatchTab que maneje el caso de grupo nulo
  const SafeNextMatchTab = ({ group, user, ...props }: any) => {
    if (!group) return <div>No hay información del grupo disponible</div>;
    return <NextMatchTab group={group} user={user} {...props} />;
  };

  // Definir las pestañas disponibles
  const tabComponents = useMemo(() => {
    const isAdmin = currentUserIsAdmin;

    console.log('ADMIN DEBUG INFO:');
    console.log('- currentUserIsAdmin:', currentUserIsAdmin);
    console.log('- group?.isAdmin:', group?.isAdmin);
    console.log('- membersData?.isAdmin:', membersData?.isAdmin);
    console.log('- user?.id:', user?.id);
    console.log('- group members:', membersData?.members);
    if (membersData?.members) {
      const adminCheck = membersData.members.some(
        (member: any) =>
          member.userId === user?.id &&
          member.role === 'ADMIN' &&
          member.status === 'ACTIVE'
      );
      console.log('- admin check calculation:', adminCheck);
      console.log(
        '- members with matching user ID:',
        membersData.members.filter((member: any) => member.userId === user?.id)
      );
    }

    const baseTabComponents: TabComponent[] = [
      {
        label: 'Próximo Partido',
        component: (
          <SafeNextMatchTab
            group={group}
            user={user}
            id={Array.isArray(id) ? id[0] : id}
            currentUserIsAdmin={currentUserIsAdmin}
            isUserInGroup={isUserInGroup}
            setShowReplaceTbdModal={setShowReplaceTbdModal}
            handleGroupAttendance={handleAttendance}
            handleSortTeams={handleRandomTeams}
            handleAddResults={handleAddResults}
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
            handleConfirmAttendance={async (memberId, userId) => {
              await executeAction(async () => {
                if (!group?.nextMatchDetails?.id) {
                  throw new Error('No hay próximo partido programado');
                }

                await adminAttendanceMutation.mutateAsync({
                  userId,
                  matchId: group.nextMatchDetails.id,
                  status: 'CONFIRMED',
                });
              }, 'Asistencia confirmada correctamente');
            }}
            handleDeclineAttendance={async (memberId, userId) => {
              await executeAction(async () => {
                if (!group?.nextMatchDetails?.id) {
                  throw new Error('No hay próximo partido programado');
                }

                await adminAttendanceMutation.mutateAsync({
                  userId,
                  matchId: group.nextMatchDetails.id,
                  status: 'DECLINED',
                });
              }, 'Asistencia cancelada correctamente');
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
        adminOnly: true, // Solo para administradores
      },
    ];

    // Filtrar las pestañas basadas en el rol del usuario
    return baseTabComponents.filter((tab) => !tab.adminOnly || isAdmin);
  }, [
    currentUserIsAdmin,
    group,
    user,
    id,
    isUserInGroup,
    handleAttendance,
    handleRandomTeams,
    handleAddResults,
    handleDeleteMatch,
    allowFillIn,
    completedMatches,
    formatMatchDate,
    getScoreForTeam,
    getPlayerGoals,
    renderGoalBalls,
    goleadores,
    mvps,
    isLoading,
    handleMembershipRequest,
  ]);

  // Create a modal component for replacing TBD player
  const ReplaceTbdPlayerModal = () => {
    const [selectedMember, setSelectedMember] = useState<string>('');
    const [isReplacing, setIsReplacing] = useState(false);

    // Get the TBD player details from the match details
    const tbdPlayer =
      showReplaceTbdModal && group?.nextMatchDetails?.tbdPlayers
        ? group.nextMatchDetails.tbdPlayers.find(
            (p: any) => p.id === showReplaceTbdModal
          )
        : null;

    // Get available members who are not already confirmed or assigned
    const confirmedPlayerIds = (
      group?.nextMatchDetails?.confirmedPlayers || []
    ).map((p: any) => p.id);

    const teamAIds = (group?.nextMatchDetails?.playersA || []).map(
      (p: any) => p.id
    );
    const teamBIds = (group?.nextMatchDetails?.playersB || []).map(
      (p: any) => p.id
    );

    const assignedPlayerIds = [...confirmedPlayerIds, ...teamAIds, ...teamBIds];

    const availableMembers =
      group?.members.filter(
        (member: any) => !assignedPlayerIds.includes(member.userId)
      ) || [];

    const handleReplace = async () => {
      if (!selectedMember || !showReplaceTbdModal || !tbdPlayer) return;

      setIsReplacing(true);
      try {
        // Call the API to replace TBD player with real user
        const isTeamA = tbdPlayer.isTeamA === true;
        await handleReplaceTbdPlayer(
          showReplaceTbdModal,
          selectedMember,
          isTeamA
        );
        setShowReplaceTbdModal('');
        showToast('Jugador reemplazado correctamente', 'success');
      } catch (error) {
        console.error('Error replacing TBD player:', error);
        showToast('Error al reemplazar jugador', 'error');
      } finally {
        setIsReplacing(false);
      }
    };

    if (!showReplaceTbdModal) return null;

    return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
        <div className='bg-white rounded-lg p-6 max-w-md w-full'>
          <div className='mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>
              Reemplazar Jugador TBD
            </h3>
            <p className='text-sm text-gray-500'>
              Selecciona un jugador para reemplazar a {tbdPlayer?.name || 'TBD'}
            </p>
          </div>

          <div className='py-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Seleccionar jugador
            </label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
            >
              <option value=''>-- Seleccionar jugador --</option>
              {availableMembers.map((member: any) => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.name || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>

          <div className='flex justify-end gap-2 mt-4'>
            <Button
              variant='outline'
              onClick={() => setShowReplaceTbdModal('')}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReplace}
              disabled={!selectedMember || isReplacing}
            >
              {isReplacing ? 'Procesando...' : 'Reemplazar'}
            </Button>
          </div>
        </div>
      </div>
    );
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
            {error instanceof Error ? error.message : String(error)}
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
              {tabComponents[selectedTab]?.component}
            </div>
          </div>
        ) : (
          <div className='text-center text-gray-600'>Grupo no encontrado</div>
        )}
      </div>

      {/* Include the modal at the component root level */}
      {showReplaceTbdModal && <ReplaceTbdPlayerModal />}
    </Layout>
  );
}
