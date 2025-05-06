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
} from '../../../services/toastService';
import type { ParticipantStatus } from '../../../types/group';

// Import our new components
import TeamsList from './TeamsList';
import ConfirmedPlayersList from './ConfirmedPlayersList';
import ReplaceTbdPlayerModal from '../modals/ReplaceTbdPlayerModal';
import UnassignedPlayersManager from '../UnassignedPlayersManager';
import AttendanceConfirmation from '../AttendanceConfirmation';

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

  // Local state to track attendance status
  const [localUserAttendanceStatus, setLocalUserAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);

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
      // If it's already an array
      if (Array.isArray(matchDetails.tbdPlayers)) {
        tbdPlayers = matchDetails.tbdPlayers;
      }
      // If it's a string, try to parse it
      else if (typeof matchDetails.tbdPlayers === 'string') {
        try {
          tbdPlayers = JSON.parse(matchDetails.tbdPlayers);
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
            ...teamA.map((p: any) => ({ ...p, isTeamA: true })),
            ...teamB.map((p: any) => ({ ...p, isTeamA: false })),
          ];
        }
      }
    }

    setNormalizedTbdPlayers(tbdPlayers);
  }, [matchDetails]);

  // Process match details
  const confirmedPlayers = matchDetails?.confirmedPlayers || [];
  const pendingPlayers = matchDetails?.pendingPlayers || [];
  const declinedPlayers = matchDetails?.declinedPlayers || [];
  const playersA = matchDetails?.playersA || [];
  const playersB = matchDetails?.playersB || [];
  const requiredPlayers = group?.requiredPlayers || 10;
  const confirmedCount = confirmedPlayers.length;

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
  const teamsFormed = !!(
    (playersA?.length > 0 ||
      tbdPlayersTeamA.length > 0 ||
      (hasTbdTeams && (matchDetails?.tbdPlayers as any)?.teamA?.length > 0)) &&
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

      // Si tenemos un handler personalizado, lo usamos
      if (handleSortTeams) {
        await handleSortTeams();
        // The parent component handles invalidation/refetch
      } else {
        // Si no, usamos la mutación directamente
        // This mutation internally handles cache updates
        await randomizeTeamsMutation.mutateAsync({
          groupId: id,
          matchId: matchDetails.id,
        });
        // No need to invalidate queries here as the mutation already does that
      }
    } catch (error) {
      console.error('Error sorting teams:', error);
      showErrorToast('Error al formar equipos');
    } finally {
      setSortTeamsLoading(false);
    }
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

      // No need to invalidate queries here as the mutation already does that
      // Just reset local state
      setLocalUserAttendanceStatus(undefined);
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

          {/* Use UnassignedPlayersManager instead of direct unassigned notification */}
          <UnassignedPlayersManager
            confirmedPlayers={confirmedPlayers}
            playersA={playersA}
            playersB={playersB}
            teamsFormed={teamsFormed || false}
            currentUserIsAdmin={currentUserIsAdmin}
            onRandomizeTeams={handleSortTeamsClick}
            isLoading={sortTeamsLoading}
          />

          {/* Sección de jugadores confirmados */}
          {!teamsFormed && (
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

              {currentUserIsAdmin && (
                <div className='mt-4 space-y-4'>
                  <div className='flex items-start'>
                    <input
                      type='checkbox'
                      id='allowFillIn'
                      className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1'
                      checked={allowFillIn}
                      onChange={(e) => setAllowFillIn(e.target.checked)}
                    />
                    <label
                      htmlFor='allowFillIn'
                      className='ml-3 text-sm text-gray-700'
                    >
                      Completar equipos automáticamente con jugadores TBD
                    </label>
                  </div>

                  <div className='flex justify-end space-x-2'>
                    <Button
                      onClick={handleSortTeamsClick}
                      variant='primary'
                      disabled={
                        sortTeamsLoading ||
                        confirmedCount < 1 ||
                        (confirmedCount < requiredPlayers && !allowFillIn)
                      }
                      className='flex items-center'
                    >
                      {sortTeamsLoading ? (
                        <span className='flex items-center'>
                          <svg
                            className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
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
                        <>
                          <PlusIcon className='mr-1 h-5 w-5' />
                          Sortear equipos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección de equipos formados */}
          {teamsFormed && (
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
                      variant='outline'
                      onClick={handleSortTeamsClick}
                      className='flex items-center text-xs'
                      size='sm'
                    >
                      <ArrowPathIcon className='h-4 w-4 mr-1' />
                      Sortear
                    </Button>

                    <Button
                      variant='primary'
                      onClick={handleAddResults}
                      className='flex items-center text-xs'
                      size='sm'
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
                {/* Use our new TeamsList component */}
                <TeamsList
                  playersA={playersA}
                  playersB={playersB}
                  tbdPlayers={normalizedTbdPlayers}
                  teamAName={group.teamAName || 'Equipo A'}
                  teamBName={group.teamBName || 'Equipo B'}
                  currentUserIsAdmin={currentUserIsAdmin}
                  onReplaceTbd={(playerId) => setShowReplaceTbdModal(playerId)}
                />
              </div>
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
