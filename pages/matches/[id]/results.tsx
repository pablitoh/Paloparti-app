import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Layout from '../../../components/Layout';
import { Match } from '@prisma/client';
import { toast } from 'react-hot-toast';

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
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900'></div>
        </div>
      </Layout>
    );
  }

  if (error || !match) {
    return (
      <Layout>
        <div className='flex flex-col items-center justify-center min-h-screen'>
          <h1 className='text-2xl font-bold mb-4'>
            {error || 'Partido no encontrado'}
          </h1>
          <button
            onClick={() => router.back()}
            className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
          >
            Volver
          </button>
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
        <div className='container mx-auto px-4 py-8'>
          <div className='flex justify-center items-center min-h-screen'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500'></div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (error) {
    return (
      <Layout>
        <div className='container mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
            <p className='text-gray-600 mb-4'>{error}</p>
            <button
              onClick={() => router.back()}
              className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
            >
              Volver
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Show not found state
  if (!match) {
    return (
      <Layout>
        <div className='container mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-600 mb-4'>
              Partido no encontrado
            </h1>
            <button
              onClick={() => router.back()}
              className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
            >
              Volver
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-3xl font-bold mb-6'>Resultados del Partido</h1>

        <div className='bg-white shadow-lg rounded-lg p-4 sm:p-6 mb-6'>
          {/* Match info */}
          <div className='text-center mb-6'>
            <p className='text-gray-600'>{match.group?.name || 'Grupo'}</p>
            <p className='text-sm text-gray-500'>
              {new Date(match.date).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className='text-sm text-gray-600 mt-1'>{match.location}</p>
          </div>

          {/* Marcador de TV style */}
          <div className='bg-green-800 text-white p-4 rounded-lg mb-6'>
            <div className='grid grid-cols-2 gap-8 items-center'>
              {/* Equipo A */}
              <div className='text-center'>
                <div className='font-bold text-xl sm:text-2xl mb-3'>
                  Equipo A
                </div>
                {editMode ? (
                  <div className='flex justify-center items-center gap-1'>
                    <button
                      onClick={() => {
                        if (scoreA > 0) {
                          // No permitir reducir el marcador por debajo del número de goles ya asignados
                          if (goalsA.length >= scoreA) {
                            toast.error(
                              'Primero debes quitar los goles asignados a los jugadores'
                            );
                            return;
                          }
                          setScoreA(scoreA - 1);
                        }
                      }}
                      className='w-10 h-10 flex items-center justify-center bg-green-700 hover:bg-green-600 rounded text-xl'
                      disabled={scoreA <= 0 || goalsA.length >= scoreA}
                    >
                      -
                    </button>
                    <div className='bg-white text-black text-3xl sm:text-5xl font-bold px-4 py-2 rounded mx-2 min-w-16 text-center'>
                      {scoreA}
                    </div>
                    <button
                      onClick={() => setScoreA(scoreA + 1)}
                      className='w-10 h-10 flex items-center justify-center bg-green-700 hover:bg-green-600 rounded text-xl'
                      disabled={scoreA >= 99}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className='flex justify-center items-center'>
                    <div className='bg-white text-black text-3xl sm:text-5xl font-bold px-4 py-2 rounded'>
                      {match.scoreA}
                    </div>
                  </div>
                )}
              </div>

              {/* Equipo B */}
              <div className='text-center'>
                <div className='font-bold text-xl sm:text-2xl mb-3'>
                  Equipo B
                </div>
                {editMode ? (
                  <div className='flex justify-center items-center gap-1'>
                    <button
                      onClick={() => {
                        if (scoreB > 0) {
                          // No permitir reducir el marcador por debajo del número de goles ya asignados
                          if (goalsB.length >= scoreB) {
                            toast.error(
                              'Primero debes quitar los goles asignados a los jugadores'
                            );
                            return;
                          }
                          setScoreB(scoreB - 1);
                        }
                      }}
                      className='w-10 h-10 flex items-center justify-center bg-green-700 hover:bg-green-600 rounded text-xl'
                      disabled={scoreB <= 0 || goalsB.length >= scoreB}
                    >
                      -
                    </button>
                    <div className='bg-white text-black text-3xl sm:text-5xl font-bold px-4 py-2 rounded mx-2 min-w-16 text-center'>
                      {scoreB}
                    </div>
                    <button
                      onClick={() => setScoreB(scoreB + 1)}
                      className='w-10 h-10 flex items-center justify-center bg-green-700 hover:bg-green-600 rounded text-xl'
                      disabled={scoreB >= 99}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className='flex justify-center items-center'>
                    <div className='bg-white text-black text-3xl sm:text-5xl font-bold px-4 py-2 rounded'>
                      {match.scoreB}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!editMode && (
              <div className='flex justify-center items-center mt-4'>
                <div className='text-xl sm:text-2xl'>-</div>
              </div>
            )}
          </div>

          {/* Grid for teams and goals */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6'>
            {/* Team A players and goals */}
            <div className='border-r-0 sm:border-r border-gray-200 pr-0 sm:pr-4'>
              <h3 className='text-lg font-semibold mb-4 text-center'>
                Equipo A
              </h3>
              <ul className='space-y-2'>
                {Array.isArray(match.teamA) ? (
                  match.teamA.map((player) => {
                    const playerGoalCount = getPlayerGoalsA(player.id);
                    console.log(
                      `Rendering Team A Player ${player.name} with ${playerGoalCount} goals`
                    );

                    return (
                      <li
                        key={player.id}
                        className='flex justify-between items-center space-x-2 border-b border-gray-100 pb-2'
                      >
                        <div className='flex items-center space-x-2 min-w-0'>
                          {player.avatar && (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full flex-shrink-0'
                            />
                          )}
                          <span className='truncate'>{player.name}</span>
                        </div>

                        {/* Goals display or controls */}
                        {editMode ? (
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() => removeGoalA(player.id)}
                              className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                              disabled={playerGoalCount <= 0}
                            >
                              -
                            </button>
                            <span className='w-6 text-center'>
                              {playerGoalCount}
                            </span>
                            <button
                              onClick={() => addGoalA(player.id)}
                              className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                              disabled={goalsA.length >= scoreA}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <div className='flex items-center'>
                            {playerGoalCount > 0 && (
                              <div className='flex items-center gap-1'>
                                <span className='text-yellow-500'>
                                  {'⚽'.repeat(playerGoalCount)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li className='text-gray-500 text-center'>
                    No hay jugadores en el Equipo A
                  </li>
                )}
              </ul>

              {/* Goals for Team A */}
              {!editMode && goalsA.length > 0 && (
                <div className='mt-4'>
                  <h3 className='text-md font-medium mb-2'>Goles</h3>
                  <ul className='space-y-1 text-sm'>
                    {goalsA.map((goal) => (
                      <li key={goal.id} className='flex items-center space-x-2'>
                        <span className='text-gray-500'>
                          {goal.minute ? `${goal.minute}'` : ''}
                        </span>
                        <span>{goal.scorerName || 'Goleador'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Team B players and goals */}
            <div className='pl-0 sm:pl-4'>
              <h3 className='text-lg font-semibold mb-4 text-center'>
                Equipo B
              </h3>
              <ul className='space-y-2'>
                {Array.isArray(match.teamB) ? (
                  match.teamB.map((player) => {
                    const playerGoalCount = getPlayerGoalsB(player.id);
                    console.log(
                      `Rendering Team B Player ${player.name} with ${playerGoalCount} goals`
                    );

                    return (
                      <li
                        key={player.id}
                        className='flex justify-between items-center space-x-2 border-b border-gray-100 pb-2'
                      >
                        <div className='flex items-center space-x-2 min-w-0'>
                          {player.avatar && (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full flex-shrink-0'
                            />
                          )}
                          <span className='truncate'>{player.name}</span>
                        </div>

                        {/* Goals display or controls */}
                        {editMode ? (
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() => removeGoalB(player.id)}
                              className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                              disabled={playerGoalCount <= 0}
                            >
                              -
                            </button>
                            <span className='w-6 text-center'>
                              {playerGoalCount}
                            </span>
                            <button
                              onClick={() => addGoalB(player.id)}
                              className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                              disabled={goalsB.length >= scoreB}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <div className='flex items-center'>
                            {playerGoalCount > 0 && (
                              <div className='flex items-center gap-1'>
                                <span className='text-yellow-500'>
                                  {'⚽'.repeat(playerGoalCount)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li className='text-gray-500 text-center'>
                    No hay jugadores en el Equipo B
                  </li>
                )}
              </ul>

              {/* Goals for Team B */}
              {!editMode && goalsB.length > 0 && (
                <div className='mt-4'>
                  <h3 className='text-md font-medium mb-2'>Goles</h3>
                  <ul className='space-y-1 text-sm'>
                    {goalsB.map((goal) => (
                      <li key={goal.id} className='flex items-center space-x-2'>
                        <span className='text-gray-500'>
                          {goal.minute ? `${goal.minute}'` : ''}
                        </span>
                        <span>{goal.scorerName || 'Goleador'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className='mt-6 flex flex-col sm:flex-row justify-between gap-4'>
            <button
              onClick={() => router.back()}
              className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto'
            >
              {editMode ? 'Cancelar' : 'Volver al Grupo'}
            </button>
            {isAdmin && editMode && (
              <button
                onClick={handleSave}
                disabled={saving}
                className='bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto'
              >
                {saving ? 'Guardando...' : 'Guardar Resultado'}
              </button>
            )}
            {isAdmin && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                className='bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto'
              >
                Editar Resultado
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
