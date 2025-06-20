import { useRouter } from 'next/router';
import { Avatar } from '@mui/material';
import {
  MapPinIcon,
  CalendarIcon,
  CheckCircleIcon,
  UserIcon,
  PlusIcon,
  XCircleIcon,
  TrashIcon,
  ArrowPathIcon,
  UserGroupIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import Button from '../../../components/Button';
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRandomizeTeamsMutation,
  useDeleteMatchMutation,
} from '../../../services/reactQueryHooks';
import { useUserAttendanceMutation } from '../../../services/groupHooks';
import {
  showSuccessToast,
  showErrorToast,
  showLoadingToast,
} from '../../../services/toastService';
import type { ParticipantStatus } from '../../../types/group';
import { normalizeTbdPlayers } from '../../../utils/tbdPlayersUtils';
import { PlayerRole } from '../../../lib/teambuilder/constants';

// Import our new components
import TeamsList from './TeamsList';
import ConfirmedPlayersList from './ConfirmedPlayersList';
import ReplaceTbdPlayerModal from '../modals/ReplaceTbdPlayerModal';
import AttendanceConfirmation from '../AttendanceConfirmation';
import TeamFormationNotification from '../TeamFormationNotification';
import UnassignedPlayersManager from '../UnassignedPlayersManager';
import DeleteMatchModal from '../modals/DeleteMatchModal';
import { useScreenshotShare } from '../../../hooks/useScreenshotShare';

// Definición de roles de jugador para ordenar por posición
const PLAYER_ROLE_PRIORITY = {
  GOALKEEPER: 0,
  DEFENDER: 1,
  MIDFIELDER: 2,
  FORWARD: 3,
  WILDCARD: 4,
};

// Define types directly in the component
interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  playerRoles?: PlayerRole[]; // Roles del jugador
  assignedRole?: string; // Rol asignado específicamente para el partido
  age?: number | null;
  isTeamA?: boolean;
}

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
}

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
  tbdPlayers?: TbdPlayer[];
  pendingPlayers?: Player[];
  declinedPlayers?: Player[];
  sortCount?: number; // Contador de sorteos
  teamAAvgAge?: number; // Promedio de edad del equipo A
  teamBAvgAge?: number; // Promedio de edad del equipo B
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
}

interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Add a type for the attendance mutation params
interface AttendanceMutationParams {
  matchId: string;
  status: string;
  groupId: string;
  userId?: string;
}

interface NextMatchTabProps {
  group: GroupWithRelations;
  user: AuthUser | null;
  id: string;
  currentUserIsAdmin: boolean;
  isUserInGroup: boolean;
  setShowReplaceTbdModal: (id: string) => void;
  setShowSwapPlayersModal: (value: boolean) => void;
  setPreSelectedPlayer: (
    player: { playerId: string; isTeamA: boolean } | null
  ) => void;
  handleGroupAttendance?: (
    status: ParticipantStatus,
    playerRoles?: PlayerRole[]
  ) => Promise<void>;
  handleSortTeams?: () => Promise<void>;
  handleAddResults?: () => void;
  handleDeleteMatch?: (id: string) => void;
  userAttendanceStatus?: ParticipantStatus;
  userRoles?: PlayerRole[];
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  setShowManualTeamFormationModal: (value: boolean) => void;
}

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (playerRoles?: PlayerRole[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Ordenar por prioridad (1 = mayor prioridad)
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0]?.role;
};

// Función para ordenar jugadores por rol
const sortPlayersByRole = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => {
    const roleA = getPrimaryRole(a.playerRoles);
    const roleB = getPrimaryRole(b.playerRoles);

    // Si algún jugador no tiene rol, ponerlo al final
    if (!roleA && !roleB) return 0;
    if (!roleA) return 1;
    if (!roleB) return -1;

    // Ordenar por tipo de posición (prioridad)
    const priorityA =
      PLAYER_ROLE_PRIORITY[roleA as keyof typeof PLAYER_ROLE_PRIORITY] ?? 999;
    const priorityB =
      PLAYER_ROLE_PRIORITY[roleB as keyof typeof PLAYER_ROLE_PRIORITY] ?? 999;

    return priorityA - priorityB;
  });
};

export default function NextMatchTab({
  group,
  user,
  id,
  currentUserIsAdmin,
  isUserInGroup,
  setShowReplaceTbdModal,
  setShowSwapPlayersModal,
  setPreSelectedPlayer,
  handleGroupAttendance,
  handleSortTeams,
  handleAddResults,
  handleDeleteMatch,
  userAttendanceStatus,
  userRoles,
  allowFillIn,
  setAllowFillIn,
  setShowManualTeamFormationModal,
}: NextMatchTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sortTeamsLoading, setSortTeamsLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { shareTeamsScreenshot } = useScreenshotShare();
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);
  // Estado controlado para teamsFormed
  const [forceTeamsFormed, setForceTeamsFormed] = useState(false);
  // Estados para almacenar equipos después de un sorteo
  const [forcedTeamA, setForcedTeamA] = useState<Player[]>([]);
  const [forcedTeamB, setForcedTeamB] = useState<Player[]>([]);
  // Estado para balance por edad
  const [balanceByAge, setBalanceByAge] = useState(false);
  // Estado para balance por rol
  const [balanceByRole, setBalanceByRole] = useState(true);
  // Estado para balance por star rating
  const [balanceByRating, setBalanceByRating] = useState(false);

  // Estado para el modal de eliminar partido
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Estado para el dropdown de acciones
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  // Cerrar dropdown cuando se hace clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showActionsDropdown && !target?.closest('[data-actions-dropdown]')) {
        setShowActionsDropdown(false);
      }
    };

    if (showActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsDropdown]);

  // Local state to track attendance status
  const [localUserAttendanceStatus, setLocalUserAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);

  // Estados para almacenar promedios de edad después de un sorteo
  // Las edades promedio ahora se calculan directamente con useMemo

  // Añadir un estado para la clave de renderizado del componente TeamsList
  const [teamsListKey, setTeamsListKey] = useState<number>(0);

  // Update local state when props change
  useEffect(() => {
    setLocalUserAttendanceStatus(userAttendanceStatus);
  }, [userAttendanceStatus]);

  // Usar mutaciones de React Query
  const userAttendanceMutation = useUserAttendanceMutation();
  const randomizeTeamsMutation = useRandomizeTeamsMutation();
  const deleteMatchMutation = useDeleteMatchMutation();

  // Get match details from group
  const matchDetails = group?.nextMatchDetails || null;

  // Track if we have TBD players
  const [normalizedTbdPlayers, setNormalizedTbdPlayers] = useState<TbdPlayer[]>(
    []
  );

  // Extract and normalize TBD players using our utility
  useEffect(() => {
    if (!matchDetails) {
      setNormalizedTbdPlayers([]);
      return;
    }

    // Use our utility function to normalize TBD players
    const normalizedData = normalizeTbdPlayers(matchDetails.tbdPlayers);

    // Convert to flat array format expected by this component
    const tbdPlayers: TbdPlayer[] = [
      ...normalizedData.teamA.map((p) => ({
        ...p,
        avatar: p.avatar || null,
      })),
      ...normalizedData.teamB.map((p) => ({
        ...p,
        avatar: p.avatar || null,
      })),
    ];

    setNormalizedTbdPlayers(tbdPlayers);
  }, [matchDetails?.id, matchDetails?.tbdPlayers]);

  // Process match details
  const confirmedPlayers = matchDetails?.confirmedPlayers || [];
  const pendingPlayers = matchDetails?.pendingPlayers || [];
  const declinedPlayers = matchDetails?.declinedPlayers || [];

  // Usar useMemo para estabilizar playersA y playersB y evitar bucles infinitos
  const playersA = useMemo(() => {
    return forcedTeamA.length > 0 && forceTeamsFormed
      ? forcedTeamA
      : matchDetails?.playersA || [];
  }, [forcedTeamA, forceTeamsFormed, matchDetails?.playersA]);

  const playersB = useMemo(() => {
    return forcedTeamB.length > 0 && forceTeamsFormed
      ? forcedTeamB
      : matchDetails?.playersB || [];
  }, [forcedTeamB, forceTeamsFormed, matchDetails?.playersB]);
  const requiredPlayers = group?.requiredPlayers || 10;
  const confirmedCount = confirmedPlayers.length;
  const teamsHavePlayers = playersA.length > 0 || playersB.length > 0;

  // Normalize participant status string to uppercase
  const normalizeStatus = (
    status: string | undefined
  ): ParticipantStatus | undefined => {
    if (!status) return undefined;

    // Convert to uppercase to ensure consistency
    const upperStatus = status.toUpperCase();

    if (
      upperStatus === 'CONFIRMED' ||
      upperStatus === 'PENDING' ||
      upperStatus === 'DECLINED'
    ) {
      return upperStatus as ParticipantStatus;
    }

    return status as ParticipantStatus;
  };

  // Check if the current user is confirmed - use localUserAttendanceStatus for this
  const isCurrentUserConfirmed =
    confirmedPlayers.some((player: Player) => player.id === user?.id) ||
    normalizeStatus(localUserAttendanceStatus) === 'CONFIRMED';

  // Make sure we sync user attendance status with the match details
  useEffect(() => {
    if (matchDetails && user) {
      // Check direct match details first for most accurate status
      const isUserConfirmed = confirmedPlayers.some(
        (player: Player) => player.id === user.id
      );

      const isUserDeclined = declinedPlayers.some(
        (player: Player) => player.id === user.id
      );

      const isUserPending = pendingPlayers.some(
        (player: Player) => player.id === user.id
      );

      // Update local status based on actual match data
      if (isUserConfirmed && localUserAttendanceStatus !== 'CONFIRMED') {
        setLocalUserAttendanceStatus('CONFIRMED');
      } else if (isUserDeclined && localUserAttendanceStatus !== 'DECLINED') {
        setLocalUserAttendanceStatus('DECLINED');
      } else if (isUserPending && localUserAttendanceStatus !== 'PENDING') {
        setLocalUserAttendanceStatus('PENDING');
      } else if (
        !isUserConfirmed &&
        !isUserDeclined &&
        !isUserPending &&
        localUserAttendanceStatus
      ) {
        // If user isn't in any list but has a status, reset it
        setLocalUserAttendanceStatus(undefined);
      }
    }
  }, [
    matchDetails?.id,
    user?.id,
    confirmedPlayers?.length,
    declinedPlayers?.length,
    pendingPlayers?.length,
    localUserAttendanceStatus,
  ]);

  // Get TBD players by team
  const tbdPlayersTeamA = normalizedTbdPlayers.filter(
    (p) => p.isTeamA === true
  );
  const tbdPlayersTeamB = normalizedTbdPlayers.filter(
    (p) => p.isTeamA === false
  );

  // Check if we have TBD players in the original structure
  const hasTbdTeams = !!(
    matchDetails?.tbdPlayers &&
    ((typeof matchDetails.tbdPlayers === 'object' &&
      ((matchDetails.tbdPlayers as any).teamA?.length > 0 ||
        (matchDetails.tbdPlayers as any).teamB?.length > 0)) ||
      (Array.isArray(matchDetails.tbdPlayers) &&
        matchDetails.tbdPlayers.length > 0))
  );

  // Check if teams are formed - consider both regular players and TBD players
  const teamsFormed =
    forceTeamsFormed ||
    !!(
      (playersA?.length > 0 ||
        tbdPlayersTeamA.length > 0 ||
        (hasTbdTeams &&
          (matchDetails?.tbdPlayers as any)?.teamA?.length > 0)) &&
      (playersB?.length > 0 ||
        tbdPlayersTeamB.length > 0 ||
        (hasTbdTeams && (matchDetails?.tbdPlayers as any)?.teamB?.length > 0))
    );

  // Format date for next match display
  const formatNextMatchDate = (date: string | Date) => {
    if (!date) return 'No programado';

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Format date in Spanish
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    // Format time separately to avoid seconds
    const formattedTime = dateObj.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Capitalize first letter and combine date and time
    return (
      formattedDate.charAt(0).toUpperCase() +
      formattedDate.slice(1) +
      ' ' +
      formattedTime
    );
  };

  // Handle attendance for the current user
  const handleAttendance = async (
    status: ParticipantStatus,
    playerRoles?: PlayerRole[]
  ) => {
    if (!user?.id) {
      console.error('No user ID available for attendance update');
      return;
    }

    if (!matchDetails?.id) {
      console.error('No match ID available for attendance update');
      return;
    }

    try {
      setAttendanceLoading(true);

      console.log('Actualizando asistencia:', {
        status,
        playerRoles,
        matchId: matchDetails.id,
      });

      // Si se proporcionó una función de manejo externa, usar esa
      if (handleGroupAttendance) {
        await handleGroupAttendance(status, playerRoles);

        // Actualizar estado local inmediatamente para mostrar feedback al usuario
        setLocalUserAttendanceStatus(status);

        // Forzar la recarga de los datos del partido desde el servidor
        const response = await fetch(`/api/groups/${id}/next-match`);
        if (response.ok) {
          const data = await response.json();

          // Actualizar la caché de React Query directamente
          queryClient.setQueryData(['group', 'nextMatch', id], data);

          console.log(
            'Datos actualizados después de confirmar asistencia:',
            data
          );
        }

        return;
      }

      // Si no hay función externa, implementar la lógica localmente
      // Almacenar los roles en localStorage para que el backend pueda recuperarlos
      if (
        status === 'CONFIRMED' &&
        Array.isArray(playerRoles) &&
        playerRoles.length > 0
      ) {
        localStorage.setItem(
          'paloparti_selected_roles',
          JSON.stringify(playerRoles)
        );
      }

      await fetch(`/api/matches/${matchDetails.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          playerRoles: playerRoles || [],
        }),
      });

      // Actualizar el estado local inmediatamente
      setLocalUserAttendanceStatus(status);

      // Forzar la recarga desde el servidor para asegurar que tenemos datos actualizados
      await queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', id],
        exact: true,
      });

      showSuccessToast(
        status === 'CONFIRMED'
          ? 'Asistencia confirmada'
          : 'Asistencia rechazada'
      );
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Handle attendance updates by admin for other users
  const handleAdminAttendance = async (
    status: ParticipantStatus,
    userId: string
  ) => {
    if (!matchDetails?.id || !currentUserIsAdmin) {
      return;
    }

    setAttendanceLoading(true);
    try {
      // Call the admin attendance endpoint
      const attendanceEndpoint = `/api/matches/${matchDetails.id}/attendance/${userId}`;

      const attendanceResponse = await fetch(attendanceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!attendanceResponse.ok) {
        const errorData = await attendanceResponse.json();
        throw new Error(errorData.message || 'Error al actualizar asistencia');
      }

      // Show success message
      showSuccessToast('Estado de asistencia actualizado');

      // Refresh data
      await queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', id],
        exact: true,
      });
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Handle sorting teams
  const handleSortTeamsClick = async () => {
    if (!matchDetails?.id) return;

    try {
      setSortTeamsLoading(true);

      // Forzar la visualización de los equipos inmediatamente
      setForceTeamsFormed(true);

      // Si tenemos un handler personalizado, lo usamos
      if (handleSortTeams) {
        // Pasar el estado balanceByAge como contexto al handler personalizado
        // a través del contexto global, ya que no podemos modificar la firma de la función
        (window as any).__balanceByAge = balanceByAge;
        // Pasar el estado balanceByRole de la misma manera
        (window as any).__balanceByRole = balanceByRole;
        // Pasar el estado balanceByRating de la misma manera
        (window as any).__balanceByRating = balanceByRating;
        // Pasar el estado allowFillIn de la misma manera
        (window as any).__allowTbdPlayers = allowFillIn;
        await handleSortTeams();
        // The parent component handles invalidation/refetch
      } else {
        // Mostrar un estado de carga para mejorar la experiencia de usuario
        showLoadingToast('Sorteando equipos...');

        // Si no, usamos la mutación directamente
        // This mutation internally handles cache updates
        const useRandomAlgorithm =
          !balanceByAge && !balanceByRole && !balanceByRating;

        // Ensure we have a valid matchId before proceeding
        if (!matchDetails?.id) {
          showErrorToast(
            'Error: No hay un partido válido para sortear equipos'
          );
          return;
        }

        const response = await randomizeTeamsMutation.mutateAsync({
          groupId: id,
          matchId: matchDetails.id,
          balanceByAge: balanceByAge,
          balanceByRole: balanceByRole,
          balanceByRating: balanceByRating,
          allowTbdPlayers: allowFillIn,
          useRandomAlgorithm: useRandomAlgorithm, // Si no hay criterios de balance, usar algoritmo aleatorio
        });

        console.log(
          'Depurar respuesta para ver si incluye los promedios de edad:',
          {
            teamAAvgAge: response?.teamAAvgAge,
            teamBAvgAge: response?.teamBAvgAge,
            fullResponse: response,
          }
        );

        // Almacenar los equipos recibidos para mostrarlos inmediatamente
        if (response?.teamA) {
          // Asegurar que todos los jugadores tengan edades
          const processedTeamA = ensurePlayerAges(response.teamA);
          // Ordenar los jugadores por posición
          setForcedTeamA(sortPlayersByRole(processedTeamA));
        }

        if (response?.teamB) {
          // Asegurar que todos los jugadores tengan edades
          const processedTeamB = ensurePlayerAges(response.teamB);
          // Ordenar los jugadores por posición
          setForcedTeamB(sortPlayersByRole(processedTeamB));
        }

        // Guardar los promedios de edad siempre que estén disponibles en la respuesta
        // Las edades promedio se calculan automáticamente
        console.log('Edades promedio del sorteo:', {
          teamAAvgAge: response?.teamAAvgAge,
          teamBAvgAge: response?.teamBAvgAge,
        });

        // Incrementar la clave para forzar un nuevo renderizado del componente TeamsList
        setTeamsListKey((prevKey) => prevKey + 1);

        // Disparar evento personalizado para notificar la actualización de los promedios de edad
        window.dispatchEvent(
          new CustomEvent('teams-sorted', {
            detail: {
              teamAAvgAge:
                response?.teamAAvgAge !== undefined
                  ? response.teamAAvgAge
                  : calculateApproximateAge(response?.teamA || []),
              teamBAvgAge:
                response?.teamBAvgAge !== undefined
                  ? response.teamBAvgAge
                  : calculateApproximateAge(response?.teamB || []),
            },
          })
        );

        // Actualizar manualmente el caché de React Query para reflejar el cambio inmediatamente
        queryClient.setQueryData(['group', 'nextMatch', id], (oldData: any) => {
          if (!oldData) return oldData;

          // Procesar tbdPlayers de la respuesta
          let updatedTbdPlayers = oldData.nextMatchDetails.tbdPlayers;

          if (response?.tbdPlayers) {
            // Si la respuesta incluye tbdPlayers en formato {teamA, teamB}
            if (response.tbdPlayers.teamA || response.tbdPlayers.teamB) {
              const teamATbd = response.tbdPlayers.teamA || [];
              const teamBTbd = response.tbdPlayers.teamB || [];

              // Convertir al formato de array plano con isTeamA
              updatedTbdPlayers = [
                ...teamATbd.map((p: any) => ({
                  ...p,
                  isTeamA: true,
                  playerType: 'TBD',
                })),
                ...teamBTbd.map((p: any) => ({
                  ...p,
                  isTeamA: false,
                  playerType: 'TBD',
                })),
              ];
            } else {
              // Si ya es un array, usarlo directamente
              updatedTbdPlayers = response.tbdPlayers;
            }
          }

          console.log(
            'Actualizando caché después de sortear, incrementando sortCount, con promedios de edad:',
            response?.teamAAvgAge,
            response?.teamBAvgAge
          );

          // Ordenar los equipos antes de guardarlos en la caché
          let sortedPlayersA =
            response?.teamA || oldData.nextMatchDetails.playersA;
          let sortedPlayersB =
            response?.teamB || oldData.nextMatchDetails.playersB;

          if (sortedPlayersA && sortedPlayersA.length > 0) {
            sortedPlayersA = sortPlayersByRole(sortedPlayersA);
          }

          if (sortedPlayersB && sortedPlayersB.length > 0) {
            sortedPlayersB = sortPlayersByRole(sortedPlayersB);
          }

          // Incrementar sortCount en lugar de forzarlo a 1
          const currentSortCount = oldData.nextMatchDetails.sortCount || 0;
          const newSortCount = currentSortCount + 1;

          // Crear una copia de los datos con sortCount incrementado
          return {
            ...oldData,
            nextMatchDetails: {
              ...oldData.nextMatchDetails,
              sortCount: newSortCount, // Incrementar sortCount correctamente
              // Si la respuesta incluye los equipos, actualizar también
              playersA: sortedPlayersA,
              playersB: sortedPlayersB,
              tbdPlayers: updatedTbdPlayers,
              teamAAvgAge: response?.teamAAvgAge,
              teamBAvgAge: response?.teamBAvgAge,
            },
          };
        });

        // Invalidar todas las consultas relacionadas con este grupo y partido para forzar la actualización eventual
        queryClient.invalidateQueries({
          queryKey: ['group', 'nextMatch', id],
          exact: true,
        });

        // Notificar al usuario que los equipos han sido sorteados
        showSuccessToast('Equipos sorteados exitosamente');
      }
    } catch (error) {
      console.error('Error sorting teams:', error);
      showErrorToast('Error al formar equipos');
    } finally {
      setSortTeamsLoading(false);
    }
  };

  // Función auxiliar para calcular edad aproximada (sólo para depuración)
  const calculateApproximateAge = (players: any[]): number | undefined => {
    // Si no hay jugadores, devolver undefined
    if (!players || players.length === 0) return undefined;

    // Obtener edades disponibles
    const ages = players
      .filter((p) => p.age !== null && p.age !== undefined)
      .map((p) => p.age);

    // Si no hay edades disponibles, devolver undefined
    if (ages.length === 0) return undefined;

    // Calcular promedio
    return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
  };

  // Función para asegurar que todos los jugadores tengan una edad
  const ensurePlayerAges = (players: any[]): any[] => {
    return players.map((player) => {
      // Si ya tiene una edad definida, no modificarla
      if (player.age !== undefined && player.age !== null) {
        return player;
      }
      // No asignar edades aleatorias, dejar como undefined para que se muestre correctamente
      return player;
    });
  };

  // Handle deleting match
  // Función para formatear texto de jugador
  const formatPlayerText = (player: any): string => {
    const name = player.name || 'Sin nombre';

    const roleEmojis: { [key: string]: string } = {
      // Inglés (para compatibilidad)
      goalkeeper: '🧤',
      defender: '🛡️',
      midfielder: '⚽',
      forward: '👟',
      wildcard: '🔄',
      // Español (como viene del backend)
      Arquero: '🧤',
      Defensor: '🛡️',
      Mediocampo: '⚽',
      Delantero: '👟',
      Comodín: '🔄',
    };

    const roleNames: { [key: string]: string } = {
      // Inglés (para compatibilidad)
      goalkeeper: 'Arquero',
      defender: 'Defensor',
      midfielder: 'Mediocampo',
      forward: 'Delantero',
      wildcard: 'Comodín',
      // Español (como viene del backend)
      Arquero: 'Arquero',
      Defensor: 'Defensor',
      Mediocampo: 'Mediocampo',
      Delantero: 'Delantero',
      Comodín: 'Comodín',
    };

    // Usar assignedRole que es la posición asignada específicamente para el partido
    const role =
      player.assignedRole ||
      (player.playerRoles && player.playerRoles.length > 0
        ? player.playerRoles[0].role
        : null);

    const roleEmoji = role ? roleEmojis[role] || '' : '';
    const roleName = role ? roleNames[role] || role : '';

    if (roleEmoji && roleName) {
      return `${roleEmoji} ${name} (${roleName})`;
    } else if (roleEmoji) {
      return `${roleEmoji} ${name}`;
    } else {
      return name;
    }
  };

  // Función para compartir como imagen
  const handleShareImage = async () => {
    setShowActionsDropdown(false);

    try {
      const shareData = {
        text: `Equipos sorteados en ${group.name}`,
        groupName: group.name || 'Grupo',
        teamAName: group.teamAName || 'Equipo A',
        teamBName: group.teamBName || 'Equipo B',
      };

      await shareTeamsScreenshot(matchDetails?.sortCount || 0, shareData);
    } catch (error) {
      console.error('Error sharing image:', error);
      showErrorToast('Error al compartir imagen');
    }
  };

  // Función para compartir como texto
  const handleShareText = async () => {
    setShowActionsDropdown(false);

    try {
      const teamAText =
        processedPlayersA.length > 0
          ? processedPlayersA.map(formatPlayerText).join('\n')
          : 'Sin jugadores asignados';

      const teamBText =
        processedPlayersB.length > 0
          ? processedPlayersB.map(formatPlayerText).join('\n')
          : 'Sin jugadores asignados';

      const message = `⚽ *Equipos sorteados en ${group.name}*

*${group.teamAName || 'Equipo A'}* (${processedPlayersA.length} jugadores)
${teamAText}

*${group.teamBName || 'Equipo B'}* (${processedPlayersB.length} jugadores)
${teamBText}

¡Que gane el mejor equipo! 💪

_Generado con Paloparti_ 🚀`;

      if (navigator.share) {
        await navigator.share({
          title: 'Equipos Formados',
          text: message,
        });
        showSuccessToast('📱 Equipos compartidos exitosamente');
      } else {
        await navigator.clipboard.writeText(message);
        showSuccessToast('📋 Texto copiado al portapapeles');
      }
    } catch (error) {
      console.error('Error sharing text:', error);
      showErrorToast('Error al compartir texto');
    }
  };

  const onDeleteMatch = async () => {
    if (!matchDetails?.id) return;

    setDeleteLoading(true);
    try {
      // Si tenemos un handler personalizado, lo usamos
      if (handleDeleteMatch) {
        await handleDeleteMatch(matchDetails.id);
      } else {
        // Si no, usamos la mutación directamente
        await deleteMatchMutation.mutateAsync({
          matchId: matchDetails.id,
          groupId: id,
        });
      }

      // Actualizar manualmente el caché para reiniciar el sortCount
      queryClient.setQueryData(['group', 'nextMatch', id], (oldData: any) => {
        if (!oldData) return oldData;

        // Si no hay nextMatchDetails en la respuesta, mantener null
        if (!oldData.nextMatchDetails) return oldData;

        // Crear una copia con sortCount reiniciado a 0
        return {
          ...oldData,
          nextMatchDetails: oldData.nextMatchDetails
            ? {
                ...oldData.nextMatchDetails,
                sortCount: 0, // Reiniciar el contador a 0
              }
            : null,
        };
      });

      // Reset local state
      setForceTeamsFormed(false);
      setLocalUserAttendanceStatus(undefined);
      setShowDeleteModal(false);

      // No need to invalidate queries here as the mutation already does that
      showSuccessToast('Partido eliminado correctamente');
    } catch (error) {
      console.error('Error deleting match:', error);
      showErrorToast('Error al eliminar el partido');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.min(
    Math.round((confirmedCount / requiredPlayers) * 100),
    100
  );

  // Calcular jugadores sin asignar usando useMemo para evitar recálculos innecesarios
  const unassignedPlayersCalculated = useMemo(() => {
    if (!confirmedPlayers || !playersA || !playersB) {
      return [];
    }

    // Obtener todos los IDs de jugadores asignados a equipos
    const assignedPlayerIds = [...playersA, ...playersB].map(
      (player) => player.id
    );

    // Filtrar jugadores confirmados que no estén en ningún equipo
    return confirmedPlayers.filter(
      (player) => !assignedPlayerIds.includes(player.id)
    );
  }, [confirmedPlayers, playersA, playersB]);

  // Calcular jugadores que cancelaron desde equipos (representados por jugadores TBD)
  const cancelledFromTeamsCount = useMemo(() => {
    // Solo contar si ya se sortearon equipos (sortCount > 0)
    if (!matchDetails?.sortCount || matchDetails.sortCount === 0) {
      return 0;
    }

    // Si sortCount es 1 (primer sorteo o re-sorteo reciente), no contar como cancelaciones
    // porque los TBD pueden estar ahí por falta de jugadores confirmados
    if (matchDetails.sortCount === 1) {
      return 0;
    }

    // Solo contar jugadores TBD como cancelaciones si sortCount > 1
    // y hay suficientes jugadores confirmados para llenar los equipos
    const hasEnoughPlayers = confirmedCount >= requiredPlayers;

    if (hasEnoughPlayers) {
      // Si hay suficientes jugadores pero aún hay TBD, son cancelaciones
      return normalizedTbdPlayers.length;
    } else {
      // Si no hay suficientes jugadores, los TBD no son cancelaciones
      return 0;
    }
  }, [
    matchDetails?.sortCount,
    normalizedTbdPlayers,
    confirmedCount,
    requiredPlayers,
  ]);

  // Actualizar el estado solo cuando el cálculo cambie
  useEffect(() => {
    setUnassignedPlayers(unassignedPlayersCalculated);
  }, [unassignedPlayersCalculated]);

  // Reset forceTeamsFormed when matchDetails.id changes
  useEffect(() => {
    if (matchDetails?.sortCount) {
      setForceTeamsFormed(false);
    }

    // Resetear los equipos forzados cuando cambia el ID del partido
    setForcedTeamA([]);
    setForcedTeamB([]);
  }, [matchDetails?.id]);

  // Efecto para sincronizar forzadamente el estado cuando cambia matchDetails
  useEffect(() => {
    // Si matchDetails tiene equipos y sortCount > 0, actualizar también los equipos forzados
    if (matchDetails?.sortCount && matchDetails.sortCount > 0) {
      if (matchDetails.playersA && matchDetails.playersA.length > 0) {
        // Solo actualizar si realmente ha cambiado
        setForcedTeamA((prevTeam) => {
          const newTeam = sortPlayersByRole(matchDetails.playersA || []);
          // Comparar si realmente cambió usando longitud y IDs
          const prevIds = prevTeam
            .map((p) => p.id)
            .sort()
            .join(',');
          const newIds = newTeam
            .map((p) => p.id)
            .sort()
            .join(',');
          if (prevIds !== newIds) {
            return newTeam;
          }
          return prevTeam;
        });
      }
      if (matchDetails.playersB && matchDetails.playersB.length > 0) {
        // Solo actualizar si realmente ha cambiado
        setForcedTeamB((prevTeam) => {
          const newTeam = sortPlayersByRole(matchDetails.playersB || []);
          // Comparar si realmente cambió usando longitud y IDs
          const prevIds = prevTeam
            .map((p) => p.id)
            .sort()
            .join(',');
          const newIds = newTeam
            .map((p) => p.id)
            .sort()
            .join(',');
          if (prevIds !== newIds) {
            return newTeam;
          }
          return prevTeam;
        });
      }
    } else {
      // Si no hay sortCount, limpiar los equipos forzados solo si no están ya vacíos
      setForcedTeamA((prevTeam) => (prevTeam.length > 0 ? [] : prevTeam));
      setForcedTeamB((prevTeam) => (prevTeam.length > 0 ? [] : prevTeam));
    }
  }, [
    matchDetails?.id,
    matchDetails?.sortCount,
    matchDetails?.playersA?.length,
    matchDetails?.playersB?.length,
  ]);

  // Las edades promedio ahora se calculan directamente usando useMemo

  // Calcular edades promedio usando useMemo para evitar bucles infinitos
  const calculatedTeamAAvgAge = useMemo(() => {
    if (playersA && playersA.length > 0) {
      const avgA = calculateApproximateAge(playersA as any[]);
      return avgA;
    }
    return undefined;
  }, [playersA?.length]);

  const calculatedTeamBAvgAge = useMemo(() => {
    if (playersB && playersB.length > 0) {
      const avgB = calculateApproximateAge(playersB as any[]);
      return avgB;
    }
    return undefined;
  }, [playersB?.length]);

  // Usar las edades calculadas directamente o las del matchDetails si están disponibles
  const finalTeamAAvgAge =
    matchDetails?.teamAAvgAge !== undefined
      ? matchDetails.teamAAvgAge
      : calculatedTeamAAvgAge;

  const finalTeamBAvgAge =
    matchDetails?.teamBAvgAge !== undefined
      ? matchDetails.teamBAvgAge
      : calculatedTeamBAvgAge;

  // Proceso de los equipos para asegurar que tengan edades definidas correctamente
  // y ordenarlos por posición - usando useMemo para evitar recálculos innecesarios
  const processedPlayersA = useMemo(() => {
    return sortPlayersByRole(ensurePlayerAges(playersA));
  }, [playersA?.length]);

  const processedPlayersB = useMemo(() => {
    return sortPlayersByRole(ensurePlayerAges(playersB));
  }, [playersB?.length]);

  // Añadir un useEffect específico para observar cambios en los promedios de edad después de un sort
  useEffect(() => {
    // Cuando se recibe una respuesta de sorteo, actualizar inmediatamente los estados locales
    const handleTeamSort = (event: any) => {
      if (event && event.detail) {
        const { teamAAvgAge: newTeamAAvgAge, teamBAvgAge: newTeamBAvgAge } =
          event.detail;
        console.log('Evento de sorteo recibido con promedios de edad:', {
          teamAAvgAge: newTeamAAvgAge,
          teamBAvgAge: newTeamBAvgAge,
        });

        // Las edades promedio ahora se calculan automáticamente
        // No necesitamos actualizar el estado manualmente
      }
    };

    // Añadir listener para evento personalizado
    window.addEventListener('teams-sorted', handleTeamSort);

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('teams-sorted', handleTeamSort);
    };
  }, []);

  // Agregar un efecto para forzar actualización cuando cambian los star ratings
  useEffect(() => {
    // Escuchar eventos de actualización de star rating
    const handleRatingUpdate = () => {
      // Forzar recarga de los datos cuando star ratings cambian
      queryClient.invalidateQueries({ queryKey: ['group', 'nextMatch', id] });
      // Incrementar la clave para forzar un nuevo renderizado del componente TeamsList
      setTeamsListKey((prevKey) => prevKey + 1);
    };

    // Agregar el listener
    window.addEventListener('rating-updated', handleRatingUpdate);

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('rating-updated', handleRatingUpdate);
    };
  }, [id]); // Removido queryClient de las dependencias para evitar re-renders infinitos

  return (
    <div className='space-y-4'>
      {matchDetails ? (
        <>
          {/* Cabecera con información del partido */}
          <div className='overflow-hidden'>
            <div className='bg-gradient-green px-4 py-3 sm:py-4'>
              <div className='space-y-2'>
                <h3 className='text-xl sm:text-2xl font-bold text-white flex items-center'>
                  <svg
                    className='w-6 h-6 mr-2 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                    />
                  </svg>
                  Próximo partido
                  {currentUserIsAdmin && (
                    <button
                      className='ml-3 p-1.5 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200'
                      onClick={() => {
                        window.open(
                          `/matches/edit/${matchDetails.id}?groupId=${id}`,
                          '_self'
                        );
                      }}
                      title='Editar partido'
                    >
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'
                        className='w-5 h-5'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
                        />
                      </svg>
                    </button>
                  )}
                </h3>
                <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-primary-100'>
                  <p className='flex items-center text-sm sm:text-base bg-white bg-opacity-10 px-3 py-1 rounded-lg'>
                    <CalendarIcon className='mr-2 h-4 w-4 flex-shrink-0' />
                    <span className='font-medium'>
                      {matchDetails.date &&
                        formatNextMatchDate(matchDetails.date)}
                    </span>
                  </p>
                  <p className='flex items-center text-sm sm:text-base bg-white bg-opacity-10 px-3 py-1 rounded-lg'>
                    <MapPinIcon className='mr-2 h-4 w-4 flex-shrink-0' />
                    <span className='font-medium'>
                      {matchDetails.location ||
                        group.location ||
                        'Sin ubicación'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Estado de la asistencia */}
            <div className='bg-gradient-green-soft rounded-2xl p-6 w-full border border-primary-100 shadow-green'>
              <h4 className='text-lg font-semibold text-gray-800 mb-4 flex items-center'>
                <svg
                  className='w-5 h-5 mr-2 text-primary-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                  />
                </svg>
                Estado de Asistencia
              </h4>

              <div className='flex flex-col sm:flex-row gap-6'>
                {/* Barra de progreso */}
                <div className='flex-1'>
                  <div className='flex justify-between items-end mb-3'>
                    <div className='flex items-center text-base font-semibold text-gray-800'>
                      <UserGroupIcon className='h-5 w-5 mr-2 text-primary-500' />
                      <span>
                        {confirmedCount}/{requiredPlayers} jugadores
                      </span>
                    </div>
                    <span className='ml-2 text-sm font-bold text-primary-700 bg-primary-100 px-2 py-1 rounded-lg'>
                      {progressPercentage}%
                    </span>
                  </div>
                  <div className='relative w-full h-8 bg-white rounded-full overflow-hidden shadow-green border border-primary-200'>
                    <div
                      className='absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out bg-gradient-green shadow-green'
                      style={{
                        width: `${progressPercentage}%`,
                      }}
                    ></div>
                    {/* Porcentaje centrado y legible dentro de la barra */}
                    <span
                      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold select-none pointer-events-none z-20 transition-colors duration-300 ${
                        progressPercentage > 50
                          ? 'text-white drop-shadow-lg'
                          : 'text-gray-700'
                      }`}
                      style={{
                        textShadow:
                          progressPercentage > 50
                            ? '0 2px 4px rgba(0,0,0,0.3)'
                            : 'none',
                      }}
                    >
                      {progressPercentage}%
                    </span>
                  </div>
                </div>

                {/* Toggle de asistencia */}
                {isUserInGroup && (
                  <div className='flex-1'>
                    <AttendanceConfirmation
                      userAttendanceStatus={normalizeStatus(
                        localUserAttendanceStatus
                      )}
                      handleGroupAttendance={handleAttendance}
                      disabled={attendanceLoading || !matchDetails?.id}
                      confirmedCount={confirmedCount}
                      requiredPlayers={requiredPlayers}
                      matchId={matchDetails?.id}
                      initialPlayerRoles={userRoles || []}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notificación de formación de equipos - Se muestra siempre que el usuario sea admin */}
          {currentUserIsAdmin && (
            <div className='mb-6'>
              <TeamFormationNotification
                confirmedCount={
                  matchDetails?.confirmedPlayers?.length || confirmedCount || 0
                }
                requiredPlayers={group?.requiredPlayers || 10}
                sortCount={matchDetails?.sortCount || 0}
                unassignedCount={unassignedPlayers.length}
                cancelledFromTeamsCount={cancelledFromTeamsCount}
                onRandomizeTeams={handleSortTeamsClick}
                isLoading={sortTeamsLoading}
                currentUserIsAdmin={currentUserIsAdmin}
                allowFillIn={allowFillIn}
                setAllowFillIn={setAllowFillIn}
                balanceByAge={balanceByAge}
                setBalanceByAge={setBalanceByAge}
                balanceByRole={balanceByRole}
                setBalanceByRole={setBalanceByRole}
                balanceByRating={balanceByRating}
                setBalanceByRating={setBalanceByRating}
              />
            </div>
          )}

          {/* Sección de jugadores confirmados - Solo mostrar cuando no hay equipos formados (sortCount = 0) */}
          {(!matchDetails?.sortCount || matchDetails.sortCount === 0) &&
            !forceTeamsFormed && (
              <div className='mt-8'>
                <ConfirmedPlayersList
                  confirmedPlayers={confirmedPlayers || []}
                  pendingPlayers={pendingPlayers || []}
                  declinedPlayers={declinedPlayers || []}
                  currentUserIsAdmin={currentUserIsAdmin}
                  onConfirmAttendance={(userId) =>
                    handleAdminAttendance('CONFIRMED', userId)
                  }
                  onDeclineAttendance={(userId) =>
                    handleAdminAttendance('DECLINED', userId)
                  }
                />
              </div>
            )}

          {/* Este div vacío ayudará a capturar cualquier renderizado suelto */}
          <div className='hidden'></div>

          {/* Sección de equipos formados */}
          {forceTeamsFormed ||
          (matchDetails?.sortCount && matchDetails.sortCount > 0) ? (
            <div className='space-y-4'>
              {/* Header with actions */}
              <div className='mb-4'>
                <div className='flex justify-between items-center gap-2'>
                  <div>
                    <h3 className='text-lg font-semibold leading-6 text-gray-900 flex items-center'>
                      <svg
                        className='w-5 h-5 mr-2 text-primary-600'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                        />
                      </svg>
                      Equipos
                    </h3>
                  </div>

                  {/* Admin actions - responsive */}
                  {currentUserIsAdmin && (
                    <div className='flex items-center gap-2'>
                      {/* Add Results Button - minimal design */}
                      <button
                        onClick={handleAddResults}
                        disabled={!teamsHavePlayers}
                        className={`
                          flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${
                            !teamsHavePlayers
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }
                        `}
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='currentColor'
                          className='w-4 h-4 flex-shrink-0'
                        >
                          <path
                            fillRule='evenodd'
                            d='M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z'
                            clipRule='evenodd'
                          />
                        </svg>
                        <span className='hidden sm:inline'>
                          Agregar resultado
                        </span>
                        <span className='sm:hidden'>Resultado</span>
                      </button>

                      {/* Actions Dropdown */}
                      <div className='relative' data-actions-dropdown>
                        <button
                          onClick={() =>
                            setShowActionsDropdown(!showActionsDropdown)
                          }
                          className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors'
                          title='Más opciones'
                        >
                          <svg
                            className='w-4 h-4'
                            fill='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path d='M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z' />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {showActionsDropdown && (
                          <div className='absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[99999]'>
                            {/* Share as image option */}
                            <button
                              onClick={handleShareImage}
                              className='w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center'
                            >
                              <PhotoIcon className='h-4 w-4 mr-2 text-gray-500' />
                              Compartir como imagen
                            </button>

                            {/* Share as text option */}
                            <button
                              onClick={handleShareText}
                              className='w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center'
                            >
                              <ChatBubbleLeftRightIcon className='h-4 w-4 mr-2 text-gray-500' />
                              Compartir como texto
                            </button>

                            {/* Divider */}
                            <div className='my-1 border-t border-gray-200'></div>

                            {/* Delete option */}
                            <button
                              onClick={() => {
                                setShowDeleteModal(true);
                                setShowActionsDropdown(false);
                              }}
                              className='w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center'
                              disabled={deleteLoading}
                            >
                              <TrashIcon className='h-4 w-4 mr-2' />
                              Eliminar partido
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TeamsList component */}
              <TeamsList
                key={teamsListKey}
                // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                playersA={processedPlayersA}
                // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                playersB={processedPlayersB}
                // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                tbdPlayers={normalizedTbdPlayers}
                teamAName={group.teamAName || 'Equipo A'}
                teamBName={group.teamBName || 'Equipo B'}
                currentUserIsAdmin={currentUserIsAdmin}
                onReplaceTbd={(playerId) => setShowReplaceTbdModal(playerId)}
                onSwapPlayer={(playerId, isTeamA) => {
                  setPreSelectedPlayer({ playerId, isTeamA });
                  setShowSwapPlayersModal(true);
                }}
                teamAAvgAge={finalTeamAAvgAge}
                teamBAvgAge={finalTeamBAvgAge}
                sortCount={matchDetails?.sortCount || 0}
              />
            </div>
          ) : null}

          {/* Mostrar el gestor de jugadores sin asignar solo si sortCount > 0 */}
          {matchDetails?.sortCount &&
          matchDetails.sortCount > 0 &&
          unassignedPlayers.length > 0 ? (
            <div>
              <UnassignedPlayersManager
                confirmedPlayers={confirmedPlayers}
                playersA={playersA}
                playersB={playersB}
                teamsFormed={teamsFormed}
                currentUserIsAdmin={currentUserIsAdmin}
                onRandomizeTeams={handleSortTeamsClick}
                isLoading={sortTeamsLoading}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className='p-8 text-center'>
          <div className='mb-6'>
            <div className='w-20 h-20 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='h-10 w-10 text-primary-600'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                />
              </svg>
            </div>
          </div>
          <h3 className='text-xl font-semibold text-gray-900 mb-2'>
            No hay próximo partido
          </h3>
          <p className='mt-2 text-sm text-gray-600 max-w-md mx-auto'>
            Actualmente no hay un partido programado para este grupo. ¡Es hora
            de organizar el próximo encuentro!
          </p>

          {currentUserIsAdmin && (
            <div className='mt-8'>
              <Button
                variant='primary'
                onClick={() => router.push(`/matches/create?groupId=${id}`)}
                className='shadow-green flex items-center justify-center'
              >
                <PlusIcon className='h-5 w-5 mr-2 flex-shrink-0' />
                <span>Programar partido</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal de eliminar partido */}
      <DeleteMatchModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDeleteMatch}
        matchDate={
          matchDetails?.date
            ? formatNextMatchDate(matchDetails.date)
            : undefined
        }
        isDeleting={deleteLoading}
      />
    </div>
  );
}
