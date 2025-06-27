import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { Match } from '@prisma/client';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface Goal {
  id: string;
  userId?: string;
  scorerId?: string;
  isTeamA: boolean;
  minute: number | null;
  scorerName: string | null;
  scorerAvatar: string | null;
  scorer?: {
    id?: string;
    name?: string | null;
    image?: string | null;
  };
}

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  age?: number | null;
  birthdate?: string | Date | null;
  playerRoles?: Array<{
    role: string;
    priority: number;
  }>;
  starRating?: number | null;
  assignedRole?: string | null;
  positionForced?: boolean;
}

interface MatchWithPlayers extends Omit<Match, 'teamA' | 'teamB'> {
  teamA: Player[]; // Ahora es un array de jugadores como en next-match
  teamB: Player[]; // Ahora es un array de jugadores como en next-match
  matchPlayers?: {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      age: number | null;
    };
    isTeamA: boolean;
  }[]; // Mantenemos para compatibilidad
  group?: {
    id: string;
    name: string;
    teamAName?: string;
    teamBName?: string;
  };
  goals?: {
    id: string;
    scorerId: string;
    isTeamA: boolean;
    minute: number | null;
    scorerName: string | null;
    scorerAvatar: string | null;
  }[];
}

interface ResultsProps {}

export default function MatchResults() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { id } = router.query;

  const [match, setMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goalsA, setGoalsA] = useState<Goal[]>([]);
  const [goalsB, setGoalsB] = useState<Goal[]>([]);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Fetch match data
  useEffect(() => {
    const fetchMatch = async () => {
      if (!id || !session?.user) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/matches/${id}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al cargar el partido');
        }

        const matchData = await response.json();
        setMatch(matchData);
        setIsAdmin(matchData.isAdmin || false);
        setScoreA(matchData.scoreA || 0);
        setScoreB(matchData.scoreB || 0);
      } catch (error) {
        console.error('Error fetching match:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'Error al cargar los datos del partido'
        );
      } finally {
        setLoading(false);
      }
    };

    if (session?.user && id) {
      fetchMatch();
    }
  }, [id, session]);

  // Set edit mode on mount if edit=true in the query
  useEffect(() => {
    if (router.query.edit === 'true' && isAdmin) {
      setEditMode(true);
    }
  }, [router.query, isAdmin]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Initialize goals from match data
  useEffect(() => {
    if (match && match.goals) {
      console.log('Original match goals:', match.goals);

      // Handle Team A goals with proper userId/scorerId mapping
      const teamAGoals = match.goals
        .filter((goal) => goal.isTeamA)
        .map((goal) => {
          // Use type assertion to handle the mixed types
          const enhancedGoal = {
            ...goal,
            userId: (goal as any).userId || goal.scorerId,
            scorerId: goal.scorerId || (goal as any).userId,
          };
          return enhancedGoal;
        });

      // Handle Team B goals with proper userId/scorerId mapping
      const teamBGoals = match.goals
        .filter((goal) => !goal.isTeamA)
        .map((goal) => {
          // Use type assertion to handle the mixed types
          const enhancedGoal = {
            ...goal,
            userId: (goal as any).userId || goal.scorerId,
            scorerId: goal.scorerId || (goal as any).userId,
          };
          return enhancedGoal;
        });

      console.log('Filtered goals:', { teamAGoals, teamBGoals });

      // Create appropriate number of goals for each player
      let processedGoalsA: Goal[] = [];
      let processedGoalsB: Goal[] = [];

      // Direct mapping of goals to players with counts
      const teamAGoalsByPlayer: Record<string, number> = {};
      const teamBGoalsByPlayer: Record<string, number> = {};

      // Count goals by player ID - check both userId and scorerId fields
      teamAGoals.forEach((goal) => {
        const playerId = goal.userId || goal.scorerId;
        if (playerId) {
          teamAGoalsByPlayer[playerId] =
            (teamAGoalsByPlayer[playerId] || 0) + 1;
        }
      });

      teamBGoals.forEach((goal) => {
        const playerId = goal.userId || goal.scorerId;
        if (playerId) {
          teamBGoalsByPlayer[playerId] =
            (teamBGoalsByPlayer[playerId] || 0) + 1;
        }
      });

      console.log('Goals by player:', {
        teamAGoalsByPlayer,
        teamBGoalsByPlayer,
      });

      // Process Team A goals by player
      if (Array.isArray(match.teamA) && match.teamA.length > 0) {
        // Process Team A players
        match.teamA.forEach((player) => {
          const goalCount = teamAGoalsByPlayer[player.id] || 0;
          console.log(`Team A Player ${player.name} has ${goalCount} goals`);

          // For each goal scored by this player, create a goal object
          for (let i = 0; i < goalCount; i++) {
            processedGoalsA.push({
              id: `temp-a-${player.id}-${i}`,
              userId: player.id,
              scorerId: player.id,
              isTeamA: true,
              minute: null,
              scorerName: player.name,
              scorerAvatar: player.avatar,
              scorer: {
                id: player.id,
                name: player.name,
                image: player.avatar,
              },
            });
          }
        });

        // Process Team B players
        match.teamB.forEach((player) => {
          const goalCount = teamBGoalsByPlayer[player.id] || 0;
          console.log(`Team B Player ${player.name} has ${goalCount} goals`);

          // For each goal scored by this player, create a goal object
          for (let i = 0; i < goalCount; i++) {
            processedGoalsB.push({
              id: `temp-b-${player.id}-${i}`,
              userId: player.id,
              scorerId: player.id,
              isTeamA: false,
              minute: null,
              scorerName: player.name,
              scorerAvatar: player.avatar,
              scorer: {
                id: player.id,
                name: player.name,
                image: player.avatar,
              },
            });
          }
        });
      }

      // If we have no processed goals but have original goals, use them
      if (processedGoalsA.length === 0 && teamAGoals.length > 0) {
        processedGoalsA = teamAGoals;
      }

      if (processedGoalsB.length === 0 && teamBGoals.length > 0) {
        processedGoalsB = teamBGoals;
      }

      setGoalsA(processedGoalsA);
      setGoalsB(processedGoalsB);

      // Log for debugging
      console.log('Goals processed:', {
        processedGoalsA,
        processedGoalsB,
      });
    }
  }, [match]);

  // Set scores when match data is loaded
  useEffect(() => {
    if (match) {
      setScoreA(match.scoreA);
      setScoreB(match.scoreB);
    }
  }, [match]);

  // This useEffect is no longer needed as we handle fetch in the main useEffect above

  // Add goal for Team A
  const addGoalA = (playerId: string) => {
    if (!match) return;

    console.log(`Adding goal for Team A player ${playerId}`);

    // Verificar que no se excedan los goles permitidos por el contador global
    if (goalsA.length >= scoreA) {
      toast.error('No puedes asignar más goles que el total del marcador');
      return;
    }

    const player =
      (Array.isArray(match.teamA)
        ? match.teamA.find((p) => p.id === playerId)
        : null) ||
      (Array.isArray(match.teamB)
        ? match.teamB.find((p) => p.id === playerId)
        : null);

    if (player) {
      console.log(`Found player for Team A: ${player.name}`);

      const newGoal: Goal = {
        id: `temp-${Date.now()}-${playerId}`,
        userId: playerId,
        scorerId: playerId,
        isTeamA: true,
        minute: null,
        scorerName: player.name || null,
        scorerAvatar: player.avatar || null,
        scorer: {
          id: player.id,
          name: player.name,
          image: player.avatar,
        },
      };

      const updatedGoals = [...goalsA, newGoal];
      console.log(`Team A goals updated: ${updatedGoals.length} goals`);
      setGoalsA(updatedGoals);

      // Ya no incrementamos el contador global aquí, porque solo estamos
      // asignando goles que ya están contabilizados en el marcador
    } else {
      console.warn(`Player not found for Team A with ID: ${playerId}`);
    }
  };

  // Add goal for Team B
  const addGoalB = (playerId: string) => {
    if (!match) return;

    console.log(`Adding goal for Team B player ${playerId}`);

    // Verificar que no se excedan los goles permitidos por el contador global
    if (goalsB.length >= scoreB) {
      toast.error('No puedes asignar más goles que el total del marcador');
      return;
    }

    const player = Array.isArray(match.teamB)
      ? match.teamB.find((p) => p.id === playerId)
      : null;

    if (player) {
      console.log(`Found player for Team B: ${player.name}`);

      const newGoal: Goal = {
        id: `temp-${Date.now()}-${playerId}`,
        userId: playerId,
        scorerId: playerId,
        isTeamA: false,
        minute: null,
        scorerName: player.name || null,
        scorerAvatar: player.avatar || null,
        scorer: {
          id: player.id,
          name: player.name,
          image: player.avatar,
        },
      };

      const updatedGoals = [...goalsB, newGoal];
      console.log(`Team B goals updated: ${updatedGoals.length} goals`);
      setGoalsB(updatedGoals);

      // Ya no incrementamos el contador global aquí, porque solo estamos
      // asignando goles que ya están contabilizados en el marcador
    } else {
      console.warn(`Player not found for Team B with ID: ${playerId}`);
    }
  };

  // Remove goal from Team A
  const removeGoalA = (playerId: string) => {
    console.log(`Removing goal for Team A player ${playerId}`);

    const goalIndex = goalsA.findIndex(
      (goal) => goal.userId === playerId || goal.scorerId === playerId
    );

    if (goalIndex !== -1) {
      const updatedGoals = [...goalsA];
      updatedGoals.splice(goalIndex, 1);
      console.log(`Team A goals updated: ${updatedGoals.length} goals`);
      setGoalsA(updatedGoals);

      // Ya no decrementamos el contador global aquí, mantener
      // la separación entre el contador y la asignación de goles
    } else {
      console.warn(`No goals found to remove for Team A player ${playerId}`);
    }
  };

  // Remove goal from Team B
  const removeGoalB = (playerId: string) => {
    console.log(`Removing goal for Team B player ${playerId}`);

    const goalIndex = goalsB.findIndex(
      (goal) => goal.userId === playerId || goal.scorerId === playerId
    );

    if (goalIndex !== -1) {
      const updatedGoals = [...goalsB];
      updatedGoals.splice(goalIndex, 1);
      console.log(`Team B goals updated: ${updatedGoals.length} goals`);
      setGoalsB(updatedGoals);

      // Ya no decrementamos el contador global aquí, mantener
      // la separación entre el contador y la asignación de goles
    } else {
      console.warn(`No goals found to remove for Team B player ${playerId}`);
    }
  };

  // Function to save match results
  const handleSave = async () => {
    try {
      setSaving(true);

      if (!match) {
        toast.error('No hay información del partido');
        setSaving(false);
        return;
      }

      // Verificar que todos los goles estén asignados
      if (goalsA.length < scoreA) {
        toast.error(
          `Faltan ${scoreA - goalsA.length} goles por asignar al Equipo A`
        );
        setSaving(false);
        return;
      }

      if (goalsB.length < scoreB) {
        toast.error(
          `Faltan ${scoreB - goalsB.length} goles por asignar al Equipo B`
        );
        setSaving(false);
        return;
      }

      // Prepare request data
      const requestData = {
        scoreA,
        scoreB,
        goals: [...goalsA, ...goalsB]
          .filter((goal) => {
            // Verify the goal has a valid userId
            const hasValidId = !!(goal.userId || goal.scorerId);
            if (!hasValidId) {
              console.warn('Filtering out goal with no valid ID:', goal);
            }
            return hasValidId;
          })
          .map((goal) => ({
            userId: goal.userId || goal.scorerId,
            isTeamA: goal.isTeamA,
            minute: goal.minute,
          })),
        status: 'COMPLETED',
      };

      const response = await fetch(`/api/matches/${id}/result`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        // Try to parse as JSON first
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || 'Error al guardar los resultados'
          );
        } else {
          // If not JSON, get the text
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`Error del servidor (${response.status})`);
        }
      }

      const data = await response.json();
      toast.success('Resultados guardados exitosamente');

      // Get the group ID to redirect back to
      const groupId = match?.group?.id;

      // Redirect to the group page with history tab selected
      if (groupId) {
        router.push(`/group/${groupId}?tab=1`);
      } else {
        // If no group ID, just go back to the match page
        router.push(`/matches/${id}`);
      }
    } catch (error) {
      console.error('Error saving match results:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al guardar los resultados'
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
          <div className='container mx-auto px-4 py-8'>
            <div className='flex justify-center items-center min-h-[400px]'>
              <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500'></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !match) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
          <div className='container mx-auto px-4 py-8'>
            <div className='bg-white rounded-xl shadow-lg p-8 text-center'>
              <div className='w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                <span className='text-error-500 text-2xl'>⚠️</span>
              </div>
              <h1 className='text-2xl font-heading text-error-600 mb-4'>
                Error
              </h1>
              <p className='text-gray-600 mb-6'>{error}</p>
              <Button onClick={() => router.back()} variant='primary'>
                <ArrowLeftIcon className='w-5 h-5 mr-2' />
                Volver
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Get player goals count - check all possible ID fields
  const getPlayerGoalsA = (playerId: string) => {
    const count = goalsA.filter((goal) => {
      // Check all possible ID fields
      const matchesUserId = goal.userId === playerId;
      const matchesScorerId = goal.scorerId === playerId;
      const matchesScorerObjectId = goal.scorer && goal.scorer.id === playerId;

      return matchesUserId || matchesScorerId || matchesScorerObjectId;
    }).length;
    return count;
  };

  const getPlayerGoalsB = (playerId: string) => {
    const count = goalsB.filter((goal) => {
      // Check all possible ID fields
      const matchesUserId = goal.userId === playerId;
      const matchesScorerId = goal.scorerId === playerId;
      const matchesScorerObjectId = goal.scorer && goal.scorer.id === playerId;

      return matchesUserId || matchesScorerId || matchesScorerObjectId;
    }).length;
    return count;
  };

  // Show loading state
  if (loading) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
          <div className='container mx-auto px-4 py-8'>
            <div className='flex justify-center items-center min-h-[400px]'>
              <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500'></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (error) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
          <div className='container mx-auto px-4 py-8'>
            <div className='bg-white rounded-xl shadow-lg p-8 text-center'>
              <div className='w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                <span className='text-error-500 text-2xl'>⚠️</span>
              </div>
              <h1 className='text-2xl font-heading text-error-600 mb-4'>
                Error
              </h1>
              <p className='text-gray-600 mb-6'>{error}</p>
              <Button onClick={() => router.back()} variant='primary'>
                <ArrowLeftIcon className='w-5 h-5 mr-2' />
                Volver
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show not found state
  if (!match) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
          <div className='container mx-auto px-4 py-8'>
            <div className='bg-white rounded-xl shadow-lg p-8 text-center'>
              <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                <span className='text-gray-400 text-2xl'>🔍</span>
              </div>
              <h1 className='text-2xl font-heading text-gray-600 mb-4'>
                Partido no encontrado
              </h1>
              <Button onClick={() => router.back()} variant='primary'>
                <ArrowLeftIcon className='w-5 h-5 mr-2' />
                Volver
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-to-br from-primary-50 to-accent-50'>
        <div className='w-full px-2 sm:px-4 py-4 sm:py-8'>
          {/* Header with back button */}
          <div className='flex items-center mb-4 sm:mb-6'>
            <Button
              onClick={() => router.back()}
              variant='outline'
              size='sm'
              className='mr-3 sm:mr-4 flex items-center justify-center'
            >
              <ArrowLeftIcon className='w-4 h-4 mr-1 flex-shrink-0' />
              Volver
            </Button>
            <h1 className='text-xl sm:text-3xl font-heading text-gray-800 flex-1'>
              Resultados del Partido
            </h1>
            {editMode && (
              <PencilIcon className='w-5 h-5 sm:w-6 sm:h-6 text-primary-500 ml-2' />
            )}
          </div>

          <div className='bg-white shadow-xl rounded-xl sm:rounded-2xl overflow-hidden'>
            {/* Match info header */}
            <div className='bg-gradient-green text-white p-4 sm:p-6'>
              <div className='text-center'>
                <h2 className='text-lg sm:text-xl font-heading text-white mb-2'>
                  {match.group?.name || 'Grupo'}
                </h2>
                <div className='flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-green-100'>
                  <div className='flex items-center gap-1'>
                    <CalendarIcon className='w-3 h-3 sm:w-4 sm:h-4' />
                    <span>
                      {new Date(match.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <MapPinIcon className='w-3 h-3 sm:w-4 sm:h-4' />
                    <span>{match.location}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Marcador moderno */}
            <div className='bg-gradient-to-r from-primary-500 to-accent-500 text-white p-4 sm:p-8 relative'>
              <div className='grid grid-cols-2 gap-4 sm:gap-8 items-center'>
                {/* Equipo A */}
                <div className='text-center'>
                  <div className='font-heading text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 text-white'>
                    {match.group?.teamAName || 'Equipo A'}
                  </div>
                  {editMode ? (
                    <div className='flex justify-center items-center gap-1 sm:gap-2'>
                      <button
                        onClick={() => {
                          if (scoreA > 0) {
                            if (goalsA.length >= scoreA) {
                              toast.error(
                                'Primero debes quitar los goles asignados a los jugadores'
                              );
                              return;
                            }
                            setScoreA(scoreA - 1);
                          }
                        }}
                        className='w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg sm:rounded-xl text-lg sm:text-xl font-bold transition-all'
                        disabled={scoreA <= 0 || goalsA.length >= scoreA}
                      >
                        -
                      </button>
                      <div className='bg-white text-primary-600 text-2xl sm:text-4xl lg:text-6xl font-bold px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl mx-2 sm:mx-3 min-w-12 sm:min-w-20 text-center shadow-lg'>
                        {scoreA}
                      </div>
                      <button
                        onClick={() => setScoreA(scoreA + 1)}
                        className='w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg sm:rounded-xl text-lg sm:text-xl font-bold transition-all'
                        disabled={scoreA >= 99}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className='flex justify-center items-center'>
                      <div className='bg-white text-primary-600 text-2xl sm:text-4xl lg:text-6xl font-bold px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl shadow-lg'>
                        {match.scoreA}
                      </div>
                    </div>
                  )}
                </div>

                {/* Equipo B */}
                <div className='text-center'>
                  <div className='font-heading text-lg sm:text-xl lg:text-2xl mb-3 sm:mb-4 text-white'>
                    {match.group?.teamBName || 'Equipo B'}
                  </div>
                  {editMode ? (
                    <div className='flex justify-center items-center gap-1 sm:gap-2'>
                      <button
                        onClick={() => {
                          if (scoreB > 0) {
                            if (goalsB.length >= scoreB) {
                              toast.error(
                                'Primero debes quitar los goles asignados a los jugadores'
                              );
                              return;
                            }
                            setScoreB(scoreB - 1);
                          }
                        }}
                        className='w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg sm:rounded-xl text-lg sm:text-xl font-bold transition-all'
                        disabled={scoreB <= 0 || goalsB.length >= scoreB}
                      >
                        -
                      </button>
                      <div className='bg-white text-primary-600 text-2xl sm:text-4xl lg:text-6xl font-bold px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl mx-2 sm:mx-3 min-w-12 sm:min-w-20 text-center shadow-lg'>
                        {scoreB}
                      </div>
                      <button
                        onClick={() => setScoreB(scoreB + 1)}
                        className='w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg sm:rounded-xl text-lg sm:text-xl font-bold transition-all'
                        disabled={scoreB >= 99}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className='flex justify-center items-center'>
                      <div className='bg-white text-primary-600 text-2xl sm:text-4xl lg:text-6xl font-bold px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl shadow-lg'>
                        {match.scoreB}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VS divider centrado */}
              <div className='absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden sm:block'>
                <div className='bg-white/20 rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center'>
                  <span className='text-white font-bold text-sm sm:text-lg'>
                    VS
                  </span>
                </div>
              </div>
            </div>

            {/* Grid for teams and goals */}
            <div className='p-3 sm:p-6 lg:p-8'>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8'>
                {/* Team A players and goals */}
                <div className='bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg sm:rounded-xl p-3 sm:p-6'>
                  <h3 className='text-lg sm:text-xl font-heading text-primary-800 mb-3 sm:mb-6 text-center'>
                    {match.group?.teamAName || 'Equipo A'}
                  </h3>
                  <div className='space-y-2 sm:space-y-3'>
                    {Array.isArray(match.teamA) ? (
                      match.teamA.map((player) => {
                        const playerGoalCount = getPlayerGoalsA(player.id);

                        return (
                          <div
                            key={player.id}
                            className='flex justify-between items-center bg-white rounded-lg p-2 sm:p-4 shadow-sm hover:shadow-md transition-shadow'
                          >
                            <div className='flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1'>
                              {player.avatar && (
                                <img
                                  src={player.avatar}
                                  alt={player.name || ''}
                                  className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary-200 flex-shrink-0'
                                />
                              )}
                              <span className='font-medium text-gray-800 truncate text-sm sm:text-base'>
                                {player.name}
                              </span>
                            </div>

                            {/* Goals display or controls */}
                            {editMode ? (
                              <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0'>
                                <button
                                  onClick={() => removeGoalA(player.id)}
                                  className='w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center bg-error-100 hover:bg-error-200 text-error-600 rounded-lg transition-colors'
                                  disabled={playerGoalCount <= 0}
                                >
                                  -
                                </button>
                                <span className='w-6 sm:w-8 text-center font-bold text-base sm:text-lg'>
                                  {playerGoalCount}
                                </span>
                                <button
                                  onClick={() => addGoalA(player.id)}
                                  className='w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center bg-success-100 hover:bg-success-200 text-success-600 rounded-lg transition-colors'
                                  disabled={goalsA.length >= scoreA}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className='flex items-center flex-shrink-0'>
                                {playerGoalCount > 0 && (
                                  <div className='flex items-center gap-1'>
                                    <span className='text-lg sm:text-2xl'>
                                      {'⚽'.repeat(playerGoalCount)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className='text-gray-500 text-center py-6 sm:py-8 bg-white rounded-lg text-sm sm:text-base'>
                        No hay jugadores en el{' '}
                        {match.group?.teamAName || 'Equipo A'}
                      </div>
                    )}
                  </div>

                  {/* Goals for Team A */}
                  {!editMode && goalsA.length > 0 && (
                    <div className='mt-4 sm:mt-6'>
                      <h4 className='text-sm sm:text-md font-medium mb-2 sm:mb-3 text-primary-700'>
                        Goles
                      </h4>
                      <div className='space-y-1 sm:space-y-2'>
                        {goalsA.map((goal) => (
                          <div
                            key={goal.id}
                            className='flex items-center space-x-2 text-xs sm:text-sm bg-white/50 rounded-lg p-2'
                          >
                            <span className='text-primary-600 font-medium'>
                              {goal.minute ? `${goal.minute}'` : ''}
                            </span>
                            <span className='text-gray-700'>
                              {goal.scorerName || 'Goleador'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team B players and goals */}
                <div className='bg-gradient-to-br from-accent-50 to-accent-100 rounded-lg sm:rounded-xl p-3 sm:p-6'>
                  <h3 className='text-lg sm:text-xl font-heading text-accent-800 mb-3 sm:mb-6 text-center'>
                    {match.group?.teamBName || 'Equipo B'}
                  </h3>
                  <div className='space-y-2 sm:space-y-3'>
                    {Array.isArray(match.teamB) ? (
                      match.teamB.map((player) => {
                        const playerGoalCount = getPlayerGoalsB(player.id);

                        return (
                          <div
                            key={player.id}
                            className='flex justify-between items-center bg-white rounded-lg p-2 sm:p-4 shadow-sm hover:shadow-md transition-shadow'
                          >
                            <div className='flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1'>
                              {player.avatar && (
                                <img
                                  src={player.avatar}
                                  alt={player.name || ''}
                                  className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-accent-200 flex-shrink-0'
                                />
                              )}
                              <span className='font-medium text-gray-800 truncate text-sm sm:text-base'>
                                {player.name}
                              </span>
                            </div>

                            {/* Goals display or controls */}
                            {editMode ? (
                              <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0'>
                                <button
                                  onClick={() => removeGoalB(player.id)}
                                  className='w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center bg-error-100 hover:bg-error-200 text-error-600 rounded-lg transition-colors'
                                  disabled={playerGoalCount <= 0}
                                >
                                  -
                                </button>
                                <span className='w-6 sm:w-8 text-center font-bold text-base sm:text-lg'>
                                  {playerGoalCount}
                                </span>
                                <button
                                  onClick={() => addGoalB(player.id)}
                                  className='w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center bg-success-100 hover:bg-success-200 text-success-600 rounded-lg transition-colors'
                                  disabled={goalsB.length >= scoreB}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className='flex items-center flex-shrink-0'>
                                {playerGoalCount > 0 && (
                                  <div className='flex items-center gap-1'>
                                    <span className='text-lg sm:text-2xl'>
                                      {'⚽'.repeat(playerGoalCount)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className='text-gray-500 text-center py-6 sm:py-8 bg-white rounded-lg text-sm sm:text-base'>
                        No hay jugadores en el{' '}
                        {match.group?.teamBName || 'Equipo B'}
                      </div>
                    )}
                  </div>

                  {/* Goals for Team B */}
                  {!editMode && goalsB.length > 0 && (
                    <div className='mt-4 sm:mt-6'>
                      <h4 className='text-sm sm:text-md font-medium mb-2 sm:mb-3 text-accent-700'>
                        Goles
                      </h4>
                      <div className='space-y-1 sm:space-y-2'>
                        {goalsB.map((goal) => (
                          <div
                            key={goal.id}
                            className='flex items-center space-x-2 text-xs sm:text-sm bg-white/50 rounded-lg p-2'
                          >
                            <span className='text-accent-600 font-medium'>
                              {goal.minute ? `${goal.minute}'` : ''}
                            </span>
                            <span className='text-gray-700'>
                              {goal.scorerName || 'Goleador'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className='mt-6 sm:mt-8 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4'>
                <Button
                  onClick={() => router.back()}
                  variant='outline'
                  className='w-full sm:w-auto flex items-center justify-center'
                >
                  <ArrowLeftIcon className='w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0' />
                  Volver al Grupo
                </Button>

                <div className='flex flex-col sm:flex-row gap-3 w-full sm:w-auto'>
                  {isAdmin && editMode && (
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      variant='success'
                      className='w-full sm:w-auto'
                    >
                      {saving ? 'Guardando...' : 'Guardar Resultado'}
                    </Button>
                  )}

                  {isAdmin && !editMode && (
                    <Button
                      onClick={() => setEditMode(true)}
                      variant='primary'
                      className='w-full sm:w-auto flex items-center justify-center'
                    >
                      <PencilIcon className='w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0' />
                      Editar Resultado
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
