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
} from '@heroicons/react/24/outline';
import Button from '../../../components/Button';
import { useState, useEffect } from 'react';
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

// Import our new components
import TeamsList from './TeamsList';
import ConfirmedPlayersList from './ConfirmedPlayersList';
import ReplaceTbdPlayerModal from '../modals/ReplaceTbdPlayerModal';
import AttendanceConfirmation from '../AttendanceConfirmation';
import TeamFormationNotification from '../TeamFormationNotification';
import UnassignedPlayersManager from '../UnassignedPlayersManager';

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
  playerRoles?: string[]; // Roles del jugador
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
  handleGroupAttendance?: (
    status: ParticipantStatus,
    playerRoles?: string[]
  ) => Promise<void>;
  handleSortTeams?: () => Promise<void>;
  handleAddResults?: () => void;
  handleDeleteMatch?: (id: string) => void;
  userAttendanceStatus?: ParticipantStatus;
  userRoles?: string[];
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  setShowManualTeamFormationModal: (value: boolean) => void;
}

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (playerRoles?: string[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Encontrar el rol con la prioridad más alta (número más bajo tiene mayor prioridad)
  return playerRoles.reduce((primaryRole, currentRole) => {
    const primaryPriority =
      PLAYER_ROLE_PRIORITY[primaryRole as keyof typeof PLAYER_ROLE_PRIORITY] ??
      999;
    const currentPriority =
      PLAYER_ROLE_PRIORITY[currentRole as keyof typeof PLAYER_ROLE_PRIORITY] ??
      999;
    return currentPriority < primaryPriority ? currentRole : primaryRole;
  }, playerRoles[0]);
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

  // Local state to track attendance status
  const [localUserAttendanceStatus, setLocalUserAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);

  // Estados para almacenar promedios de edad después de un sorteo
  const [teamAAvgAge, setTeamAAvgAge] = useState<number | undefined>(undefined);
  const [teamBAvgAge, setTeamBAvgAge] = useState<number | undefined>(undefined);

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

  // Extract and normalize TBD players
  useEffect(() => {
    if (!matchDetails) {
      setNormalizedTbdPlayers([]);
      return;
    }

    let tbdPlayers: TbdPlayer[] = [];

    // Handle different formats that might come from the API
    if (matchDetails.tbdPlayers) {
      console.log('Processing tbdPlayers:', matchDetails.tbdPlayers);

      // If it's already an array
      if (Array.isArray(matchDetails.tbdPlayers)) {
        tbdPlayers = matchDetails.tbdPlayers;
      }
      // If it's a string, try to parse it
      else if (typeof matchDetails.tbdPlayers === 'string') {
        try {
          const parsed = JSON.parse(matchDetails.tbdPlayers);

          // Si el resultado parseado es un objeto con teamA/teamB
          if (
            parsed &&
            typeof parsed === 'object' &&
            (parsed.teamA || parsed.teamB)
          ) {
            const teamA = parsed.teamA || [];
            const teamB = parsed.teamB || [];

            tbdPlayers = [
              ...teamA.map((p: any) => ({
                ...p,
                isTeamA: true,
                playerType: 'TBD',
              })),
              ...teamB.map((p: any) => ({
                ...p,
                isTeamA: false,
                playerType: 'TBD',
              })),
            ];
          } else if (Array.isArray(parsed)) {
            // Si ya es un array, usarlo directamente
            tbdPlayers = parsed;
          }
        } catch (e) {
          console.error('Failed to parse TBD players string:', e);
        }
      }
      // If it's an object with teamA/teamB properties
      else if (
        typeof matchDetails.tbdPlayers === 'object' &&
        matchDetails.tbdPlayers !== null
      ) {
        // Type cast to an object with teamA and teamB properties
        const tbdPlayerObj = matchDetails.tbdPlayers as {
          teamA?: Array<any>;
          teamB?: Array<any>;
        };

        if (tbdPlayerObj.teamA || tbdPlayerObj.teamB) {
          const teamA = tbdPlayerObj.teamA || [];
          const teamB = tbdPlayerObj.teamB || [];

          tbdPlayers = [
            ...teamA.map((p: any) => ({
              ...p,
              isTeamA: true,
              playerType: 'TBD',
            })),
            ...teamB.map((p: any) => ({
              ...p,
              isTeamA: false,
              playerType: 'TBD',
            })),
          ];
        }
      }
    }

    console.log('Normalized TBD players:', tbdPlayers);
    setNormalizedTbdPlayers(tbdPlayers);
  }, [matchDetails, matchDetails?.tbdPlayers]);

  // Process match details
  const confirmedPlayers = matchDetails?.confirmedPlayers || [];
  const pendingPlayers = matchDetails?.pendingPlayers || [];
  const declinedPlayers = matchDetails?.declinedPlayers || [];
  // Usar los equipos forzados si están disponibles, de lo contrario usar los del matchDetails
  const playersA =
    forcedTeamA.length > 0 && forceTeamsFormed
      ? forcedTeamA
      : matchDetails?.playersA || [];
  const playersB =
    forcedTeamB.length > 0 && forceTeamsFormed
      ? forcedTeamB
      : matchDetails?.playersB || [];
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
  }, [matchDetails, user, confirmedPlayers, declinedPlayers, pendingPlayers]);

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

  // Debug teams state - remove in production
  useEffect(() => {
    if (matchDetails) {
      console.log('Teams state updated:', {
        teamsFormed,
        hasTbdTeams,
        playersACount: playersA?.length || 0,
        playersBCount: playersB?.length || 0,
        tbdPlayersTeamACount: tbdPlayersTeamA.length,
        tbdPlayersTeamBCount: tbdPlayersTeamB.length,
        tbdPlayers: matchDetails.tbdPlayers,
        matchDetails,
      });
    }
  }, [
    matchDetails,
    teamsFormed,
    playersA,
    playersB,
    tbdPlayersTeamA,
    tbdPlayersTeamB,
    hasTbdTeams,
  ]);

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
    playerRoles?: string[]
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
        if (response?.teamAAvgAge !== undefined) {
          console.log('Estableciendo teamAAvgAge:', response.teamAAvgAge);
          setTeamAAvgAge(response.teamAAvgAge);
        }

        if (response?.teamBAvgAge !== undefined) {
          console.log('Estableciendo teamBAvgAge:', response.teamBAvgAge);
          setTeamBAvgAge(response.teamBAvgAge);
        }

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
            'Actualizando caché después de sortear, setting sortCount=1, con promedios de edad:',
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

          // Crear una copia de los datos con sortCount incrementado
          return {
            ...oldData,
            nextMatchDetails: {
              ...oldData.nextMatchDetails,
              sortCount: 1, // Forzar a 1 explícitamente después de sortear
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
  const onDeleteMatch = async () => {
    if (!matchDetails?.id) return;

    if (
      !window.confirm('¿Estás seguro de que quieres eliminar este partido?')
    ) {
      return;
    }

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

      // No need to invalidate queries here as the mutation already does that
      showSuccessToast('Partido eliminado correctamente');
    } catch (error) {
      console.error('Error deleting match:', error);
      showErrorToast('Error al eliminar el partido');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.min(
    Math.round((confirmedCount / requiredPlayers) * 100),
    100
  );

  // Calcular jugadores sin asignar
  useEffect(() => {
    if (!confirmedPlayers || !playersA || !playersB) {
      setUnassignedPlayers([]);
      return;
    }

    // Obtener todos los IDs de jugadores asignados a equipos
    const assignedPlayerIds = [...playersA, ...playersB].map(
      (player) => player.id
    );

    // Filtrar jugadores confirmados que no estén en ningún equipo
    const unassignedPlayersArr = confirmedPlayers.filter(
      (player) => !assignedPlayerIds.includes(player.id)
    );

    setUnassignedPlayers(unassignedPlayersArr);
  }, [confirmedPlayers, playersA, playersB]);

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
        // Ordenar jugadores por posición antes de establecerlos
        setForcedTeamA(sortPlayersByRole(matchDetails.playersA));
      }
      if (matchDetails.playersB && matchDetails.playersB.length > 0) {
        // Ordenar jugadores por posición antes de establecerlos
        setForcedTeamB(sortPlayersByRole(matchDetails.playersB));
      }
    }
  }, [matchDetails?.playersA, matchDetails?.playersB, matchDetails?.sortCount]);

  // Efecto para sincronizar promedios de edad cuando cambia matchDetails
  useEffect(() => {
    if (matchDetails) {
      if (matchDetails.teamAAvgAge !== undefined) {
        setTeamAAvgAge(matchDetails.teamAAvgAge);
      }
      if (matchDetails.teamBAvgAge !== undefined) {
        setTeamBAvgAge(matchDetails.teamBAvgAge);
      }
    }
  }, [matchDetails?.teamAAvgAge, matchDetails?.teamBAvgAge]);

  // Process player ages in useEffect
  useEffect(() => {
    if (playersA && playersA.length > 0) {
      // Usar any[] para evitar conflictos de tipo
      const avgA = calculateApproximateAge(playersA as any[]);
      console.log('Calculando edad promedio para equipo A:', avgA);
      setTeamAAvgAge(avgA);
    }

    if (playersB && playersB.length > 0) {
      // Usar any[] para evitar conflictos de tipo
      const avgB = calculateApproximateAge(playersB as any[]);
      console.log('Calculando edad promedio para equipo B:', avgB);
      setTeamBAvgAge(avgB);
    }
  }, [playersA, playersB]);

  // Proceso de los equipos para asegurar que tengan edades definidas correctamente
  // y ordenarlos por posición
  const processedPlayersA = sortPlayersByRole(ensurePlayerAges(playersA));
  const processedPlayersB = sortPlayersByRole(ensurePlayerAges(playersB));

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

        if (newTeamAAvgAge !== undefined) {
          setTeamAAvgAge(newTeamAAvgAge);
        }

        if (newTeamBAvgAge !== undefined) {
          setTeamBAvgAge(newTeamBAvgAge);
        }
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
  }, [id, queryClient]);

  return (
    <div className='space-y-4'>
      {matchDetails ? (
        <>
          {/* Cabecera con información del partido */}
          <div className='bg-white rounded-lg overflow-hidden'>
            <div className='bg-blue-600 px-4 py-3 flex justify-between items-center'>
              <div>
                <h3 className='text-lg font-semibold text-white'>
                  Próximo partido
                </h3>
                <p className='text-blue-100 mt-1'>
                  {matchDetails.date && formatNextMatchDate(matchDetails.date)}
                </p>
                <p className='text-blue-100 mt-1 flex items-center'>
                  <MapPinIcon className='mr-1 h-4 w-4 flex-shrink-0' />
                  <span>
                    {matchDetails.location || group.location || 'Sin ubicación'}
                  </span>
                </p>
              </div>
              {currentUserIsAdmin && (
                <Button
                  variant='outline'
                  className='bg-blue-500 text-white border-blue-400 hover:bg-blue-700'
                  onClick={() => {
                    // Abrir modal de edición
                    window.open(
                      `/matches/edit/${matchDetails.id}?groupId=${id}`,
                      '_self'
                    );
                  }}
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
                </Button>
              )}
            </div>

            <div className='p-4'>
              <div className='grid grid-cols-1 gap-4'>
                {/* Estado de la asistencia */}
                <div className='bg-gray-50 rounded-lg p-3'>
                  <h4 className='text-md font-medium text-gray-800 mb-3'>
                    Estado
                  </h4>

                  <div className='flex flex-col sm:flex-row gap-4'>
                    {/* Barra de progreso */}
                    <div className='flex-1'>
                      <div className='flex justify-between text-xs font-medium text-gray-700 mb-1'>
                        <span>
                          Confirmados: {confirmedCount}/{requiredPlayers}
                        </span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className='bg-gray-200 rounded-full h-2.5 mt-1.5'>
                        <div
                          className='bg-green-500 h-2.5 rounded-full transition-all duration-500'
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
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
            </div>
          </div>

          {/* Notificación de formación de equipos - Se muestra siempre que el usuario sea admin */}
          {currentUserIsAdmin && (
            <TeamFormationNotification
              confirmedCount={
                matchDetails?.confirmedPlayers?.length || confirmedCount || 0
              }
              requiredPlayers={group?.requiredPlayers || 10}
              sortCount={matchDetails?.sortCount || 0}
              unassignedCount={unassignedPlayers.length}
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

          {/* Sección de equipos formados - Solo mostrar cuando sortCount > 0 o se forzó la formación de equipos */}
          {(forceTeamsFormed ||
            (matchDetails?.sortCount && matchDetails.sortCount > 0)) && (
            <div className='bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200'>
              <div className='px-3 py-4 sm:px-4 border-b border-gray-200 flex justify-between items-center'>
                <div>
                  <h3 className='text-md font-medium leading-6 text-gray-900'>
                    Equipos
                  </h3>
                  <p className='mt-1 max-w-2xl text-sm text-gray-500'>
                    Equipos para el próximo partido
                  </p>
                </div>

                {/* Admin actions for the teams section */}
                {currentUserIsAdmin && (
                  <div className='flex space-x-2'>
                    <Button
                      variant='primary'
                      onClick={handleAddResults}
                      className={`flex items-center text-xs ${
                        !teamsHavePlayers
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : ''
                      }`}
                      size='sm'
                      disabled={!teamsHavePlayers}
                    >
                      Terminar partido
                    </Button>

                    <Button
                      variant='danger'
                      onClick={() =>
                        handleDeleteMatch && handleDeleteMatch(matchDetails.id)
                      }
                      className='p-1.5 rounded-full'
                      size='sm'
                      title='Eliminar partido'
                    >
                      <TrashIcon className='h-5 w-5' />
                    </Button>
                  </div>
                )}
              </div>

              <div className='px-3 py-4'>
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
                  teamAAvgAge={teamAAvgAge}
                  teamBAvgAge={teamBAvgAge}
                />
              </div>
            </div>
          )}

          {/* Mostrar el gestor de jugadores sin asignar solo si sortCount > 0 */}
          {matchDetails?.sortCount &&
            matchDetails.sortCount > 0 &&
            unassignedPlayers.length > 0 && (
              <div className='mt-4'>
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
            )}
        </>
      ) : (
        <div className='bg-white rounded-lg p-8 text-center'>
          <div className='mb-6'>
            <svg
              className='mx-auto h-12 w-12 text-gray-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1}
                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
          </div>
          <h3 className='text-lg font-medium text-gray-900'>
            No hay próximo partido
          </h3>
          <p className='mt-2 text-sm text-gray-500'>
            Actualmente no hay un partido programado para este grupo.
          </p>

          {currentUserIsAdmin && (
            <div className='mt-6'>
              <Button
                variant='primary'
                onClick={() => router.push(`/matches/create?groupId=${id}`)}
              >
                <PlusIcon className='h-5 w-5 mr-2' />
                Programar partido
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
