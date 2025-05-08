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

// Define types directly in the component
interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
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
  handleGroupAttendance?: (status: ParticipantStatus) => Promise<void>;
  handleSortTeams?: () => Promise<void>;
  handleAddResults?: () => void;
  handleDeleteMatch?: (id: string) => void;
  userAttendanceStatus?: ParticipantStatus;
  allowFillIn: boolean;
  setAllowFillIn: (value: boolean) => void;
  setShowManualTeamFormationModal: (value: boolean) => void;
}

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
  const [balanceByAge, setBalanceByAge] = useState(true);

  // Local state to track attendance status
  const [localUserAttendanceStatus, setLocalUserAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);

  // Estados para almacenar promedios de edad después de un sorteo
  const [teamAAvgAge, setTeamAAvgAge] = useState<number | undefined>(undefined);
  const [teamBAvgAge, setTeamBAvgAge] = useState<number | undefined>(undefined);

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
      hour: '2-digit',
      minute: '2-digit',
    });

    // Capitalize first letter
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  };

  // Handle attendance
  const handleAttendance = async (
    status: ParticipantStatus,
    userId?: string
  ) => {
    // Check if there's a valid match with a valid ID and also check if the group has a nextMatchId
    if (!matchDetails?.id || !group?.nextMatchId) {
      showErrorToast('No hay un partido activo para actualizar la asistencia');
      return;
    }

    // Verify that the match ID matches the group's nextMatchId
    if (matchDetails.id !== group.nextMatchId) {
      console.error('Match ID mismatch after deletion, refreshing match data');
      // Refresh the data
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', id],
        exact: true,
      });
      showErrorToast(
        'La información del partido ha cambiado, por favor intente nuevamente'
      );
      return;
    }

    setAttendanceLoading(true);
    try {
      // For admin actions on other players
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        console.error('No user ID available for attendance update');
        return;
      }

      // Si tenemos un handler personalizado, lo usamos
      if (handleGroupAttendance) {
        await handleGroupAttendance(status);
        return;
      }

      // Si no, usamos la mutación directamente - the API handles getting the current user ID
      await userAttendanceMutation.mutateAsync({
        matchId: matchDetails.id,
        status,
        groupId: id,
      });

      // Update local state immediately for better UX
      if (!userId || userId === user?.id) {
        setLocalUserAttendanceStatus(status);
      }

      // Show success message
      const successMessage =
        status === 'CONFIRMED'
          ? 'Asistencia confirmada'
          : status === 'DECLINED'
          ? 'Has indicado que no asistirás'
          : 'Estado de asistencia actualizado';

      showSuccessToast(successMessage);
    } catch (error) {
      console.error('Error updating attendance:', error);
      showErrorToast('Error al actualizar asistencia');

      // In case of error, force refresh data - this helps recover from deleted matches
      queryClient.invalidateQueries({
        queryKey: ['group', 'nextMatch', id],
        exact: true,
      });
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
        await handleSortTeams();
        // The parent component handles invalidation/refetch
      } else {
        // Mostrar un estado de carga para mejorar la experiencia de usuario
        showLoadingToast('Sorteando equipos...');

        // Si no, usamos la mutación directamente
        // This mutation internally handles cache updates
        const response = await randomizeTeamsMutation.mutateAsync({
          groupId: id,
          matchId: matchDetails.id,
          balanceByAge: balanceByAge,
        });

        // Depurar respuesta para ver si incluye los promedios de edad
        console.log('Respuesta de sorteo con promedios de edad:', {
          teamAAvgAge: response?.teamAAvgAge,
          teamBAvgAge: response?.teamBAvgAge,
          fullResponse: response,
        });

        // Almacenar los equipos recibidos para mostrarlos inmediatamente
        if (response?.teamA) {
          setForcedTeamA(response.teamA);
        }
        if (response?.teamB) {
          setForcedTeamB(response.teamB);
        }

        // Guardar los promedios de edad si están disponibles
        if (response?.teamAAvgAge !== undefined) {
          console.log('Estableciendo teamAAvgAge:', response.teamAAvgAge);
          setTeamAAvgAge(response.teamAAvgAge);
        } else {
          // Si no vienen del servidor, calcular un valor aproximado para pruebas
          const avgAgeA = calculateApproximateAge(response?.teamA || []);
          console.log('Usando edad aproximada para equipo A:', avgAgeA);
          setTeamAAvgAge(avgAgeA);
        }

        if (response?.teamBAvgAge !== undefined) {
          console.log('Estableciendo teamBAvgAge:', response.teamBAvgAge);
          setTeamBAvgAge(response.teamBAvgAge);
        } else {
          // Si no vienen del servidor, calcular un valor aproximado para pruebas
          const avgAgeB = calculateApproximateAge(response?.teamB || []);
          console.log('Usando edad aproximada para equipo B:', avgAgeB);
          setTeamBAvgAge(avgAgeB);
        }

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
            'Actualizando caché después de sortear, setting sortCount=1'
          );

          // Crear una copia de los datos con sortCount incrementado
          return {
            ...oldData,
            nextMatchDetails: {
              ...oldData.nextMatchDetails,
              sortCount: 1, // Forzar a 1 explícitamente después de sortear
              // Si la respuesta incluye los equipos, actualizar también
              playersA: response?.teamA || oldData.nextMatchDetails.playersA,
              playersB: response?.teamB || oldData.nextMatchDetails.playersB,
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
  const calculateApproximateAge = (players: any[]): number => {
    // Si no hay jugadores, devolver un valor por defecto
    if (!players || players.length === 0) return 30;

    // Obtener edades disponibles
    const ages = players
      .filter((p) => p.age !== null && p.age !== undefined)
      .map((p) => p.age);

    // Si no hay edades disponibles, devolver valor por defecto
    if (ages.length === 0) return 30;

    // Calcular promedio
    return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
  };

  // Función para asegurar que todos los jugadores tengan una edad
  const ensurePlayerAges = (players: any[]): any[] => {
    return players.map((player) => {
      if (player.age !== undefined && player.age !== null) {
        return player;
      }
      // Añadir edad aleatoria entre 20 y 40 si no tiene
      return {
        ...player,
        age: Math.floor(Math.random() * 20) + 20,
      };
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
        setForcedTeamA(matchDetails.playersA);
      }
      if (matchDetails.playersB && matchDetails.playersB.length > 0) {
        setForcedTeamB(matchDetails.playersB);
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

  // Proceso de los equipos para asegurar que tengan edades
  // Usar any[] para evitar conflictos de tipo
  const processedPlayersA = playersA;
  const processedPlayersB = playersB;

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
              confirmedCount={confirmedCount}
              requiredPlayers={requiredPlayers}
              sortCount={matchDetails?.sortCount || 0}
              unassignedCount={unassignedPlayers.length}
              onRandomizeTeams={handleSortTeamsClick}
              isLoading={sortTeamsLoading}
              currentUserIsAdmin={currentUserIsAdmin}
              allowFillIn={allowFillIn}
              setAllowFillIn={setAllowFillIn}
              balanceByAge={balanceByAge}
              setBalanceByAge={setBalanceByAge}
            />
          )}

          {/* Sección de jugadores confirmados - Solo mostrar cuando no hay equipos formados (sortCount = 0) */}
          {(!matchDetails?.sortCount || matchDetails.sortCount === 0) &&
            !forceTeamsFormed && (
              <div className='mt-8'>
                <ConfirmedPlayersList
                  confirmedPlayers={confirmedPlayers}
                  pendingPlayers={pendingPlayers}
                  declinedPlayers={declinedPlayers}
                  currentUserIsAdmin={currentUserIsAdmin}
                  onConfirmAttendance={(userId) =>
                    handleAttendance('CONFIRMED', userId)
                  }
                  onDeclineAttendance={(userId) =>
                    handleAttendance('DECLINED', userId)
                  }
                />
              </div>
            )}

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
                  // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                  playersA={playersA}
                  // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                  playersB={playersB}
                  // @ts-ignore - Ignoramos los errores de tipo debido a conflictos entre definiciones
                  tbdPlayers={normalizedTbdPlayers}
                  teamAName={group.teamAName || 'Equipo A'}
                  teamBName={group.teamBName || 'Equipo B'}
                  currentUserIsAdmin={currentUserIsAdmin}
                  onReplaceTbd={(playerId) => setShowReplaceTbdModal(playerId)}
                  teamAAvgAge={matchDetails?.teamAAvgAge || teamAAvgAge}
                  teamBAvgAge={matchDetails?.teamBAvgAge || teamBAvgAge}
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
