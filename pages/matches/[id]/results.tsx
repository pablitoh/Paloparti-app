import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession, getSession } from 'next-auth/react';
import Layout from '../../../components/Layout';
import { Match } from '@prisma/client';
import { toast } from 'react-hot-toast';
import { GetServerSideProps } from 'next';

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
  age: number | null;
}

interface MatchWithPlayers extends Match {
  matchPlayers: {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      age: number | null;
    };
    isTeamA: boolean;
  }[];
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.query;

  if (!id || typeof id !== 'string') {
    return {
      notFound: true,
    };
  }

  try {
    // Get the session server-side
    const session = await getSession(context);

    if (!session) {
      return {
        redirect: {
          destination: '/auth/signin',
          permanent: false,
        },
      };
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/matches/${id}`, {
      headers: {
        Cookie: context.req.headers.cookie || '',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al cargar el partido');
    }

    const match = await response.json();

    // Check if current user is admin
    const isAdmin = match.isAdmin || false;

    return {
      props: {
        match,
        id,
        isAdmin,
      },
    };
  } catch (error) {
    console.error('Error fetching match:', error);
    return {
      props: {
        id,
        error:
          error instanceof Error
            ? error.message
            : 'Error al cargar los datos del partido',
      },
    };
  }
};

interface ResultsProps {
  match?: MatchWithPlayers;
  id: string;
  error?: string;
  isAdmin?: boolean;
}

export default function MatchResults({
  match: initialMatch,
  id,
  error: initialError,
  isAdmin = false,
}: ResultsProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [match, setMatch] = useState<MatchWithPlayers | null>(
    initialMatch || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [editMode, setEditMode] = useState(false);
  const [scoreA, setScoreA] = useState(initialMatch?.scoreA || 0);
  const [scoreB, setScoreB] = useState(initialMatch?.scoreB || 0);
  const [goalsA, setGoalsA] = useState<Goal[]>([]);
  const [goalsB, setGoalsB] = useState<Goal[]>([]);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  // Solo redirigir si definitivamente no hay sesión
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

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
      if (match.matchPlayers && match.matchPlayers.length > 0) {
        // Process Team A players
        match.matchPlayers
          .filter((p) => p.isTeamA)
          .forEach((player) => {
            const goalCount = teamAGoalsByPlayer[player.user.id] || 0;
            console.log(
              `Team A Player ${player.user.name} has ${goalCount} goals`
            );

            // For each goal scored by this player, create a goal object
            for (let i = 0; i < goalCount; i++) {
              processedGoalsA.push({
                id: `temp-a-${player.user.id}-${i}`,
                userId: player.user.id,
                scorerId: player.user.id,
                isTeamA: true,
                minute: null,
                scorerName: player.user.name,
                scorerAvatar: player.user.image,
                scorer: player.user,
              });
            }
          });

        // Process Team B players
        match.matchPlayers
          .filter((p) => !p.isTeamA)
          .forEach((player) => {
            const goalCount = teamBGoalsByPlayer[player.user.id] || 0;
            console.log(
              `Team B Player ${player.user.name} has ${goalCount} goals`
            );

            // For each goal scored by this player, create a goal object
            for (let i = 0; i < goalCount; i++) {
              processedGoalsB.push({
                id: `temp-b-${player.user.id}-${i}`,
                userId: player.user.id,
                scorerId: player.user.id,
                isTeamA: false,
                minute: null,
                scorerName: player.user.name,
                scorerAvatar: player.user.image,
                scorer: player.user,
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

  useEffect(() => {
    const fetchMatch = async () => {
      if (!initialMatch && !loading && !error) {
        setLoading(true);
        try {
          const response = await fetch(`/api/matches/${id}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al cargar el partido');
          }
          const data = await response.json();
          setMatch(data);
          setError(null);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error al cargar los datos del partido'
          );
          setMatch(null);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMatch();
  }, [id, initialMatch, loading, error]);

  // Add goal for Team A
  const addGoalA = (playerId: string) => {
    if (!match) return;

    console.log(`Adding goal for Team A player ${playerId}`);

    // Only add goal if current total is less than the score
    if (goalsA.length < scoreA) {
      const player = match.matchPlayers.find(
        (p) => p.user.id === playerId
      )?.user;

      if (player) {
        console.log(`Found player for Team A: ${player.name}`);

        const newGoal: Goal = {
          id: `temp-${Date.now()}-${playerId}`,
          userId: playerId,
          scorerId: playerId,
          isTeamA: true,
          minute: null,
          scorerName: player.name || null,
          scorerAvatar: player.image || null,
          scorer: player,
        };

        const updatedGoals = [...goalsA, newGoal];
        console.log(`Team A goals updated: ${updatedGoals.length} goals`);
        setGoalsA(updatedGoals);
      } else {
        console.warn(`Player not found for Team A with ID: ${playerId}`);
      }
    } else {
      console.warn(
        `Cannot add more goals: scoreA (${scoreA}) <= goalsA.length (${goalsA.length})`
      );
    }
  };

  // Add goal for Team B
  const addGoalB = (playerId: string) => {
    if (!match) return;

    console.log(`Adding goal for Team B player ${playerId}`);

    // Only add goal if current total is less than the score
    if (goalsB.length < scoreB) {
      const player = match.matchPlayers.find(
        (p) => p.user.id === playerId && !p.isTeamA
      )?.user;

      if (player) {
        console.log(`Found player for Team B: ${player.name}`);

        const newGoal: Goal = {
          id: `temp-${Date.now()}-${playerId}`,
          userId: playerId,
          scorerId: playerId,
          isTeamA: false,
          minute: null,
          scorerName: player.name || null,
          scorerAvatar: player.image || null,
          scorer: player,
        };

        const updatedGoals = [...goalsB, newGoal];
        console.log(`Team B goals updated: ${updatedGoals.length} goals`);
        setGoalsB(updatedGoals);
      } else {
        console.warn(`Player not found for Team B with ID: ${playerId}`);
      }
    } else {
      console.warn(
        `Cannot add more goals: scoreB (${scoreB}) <= goalsB.length (${goalsB.length})`
      );
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
    } else {
      console.warn(`No goals found to remove for Team B player ${playerId}`);
    }
  };

  // Function to save match results
  const handleSave = async () => {
    try {
      setSaving(true);

      // Calculate total goals for each team
      const totalGoalsA = goalsA.length;
      const totalGoalsB = goalsB.length;

      // Validate that score matches the number of goals
      if (totalGoalsA !== scoreA || totalGoalsB !== scoreB) {
        toast.error(
          'El número de goles asignados debe coincidir con el marcador'
        );
        return;
      }

      const response = await fetch(`/api/matches/${id}/result`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scoreA,
          scoreB,
          goals: [...goalsA, ...goalsB].map((goal) => ({
            userId: goal.userId || goal.scorerId,
            isTeamA: goal.isTeamA,
            minute: goal.minute,
          })),
          status: 'COMPLETED',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar los resultados');
      }

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

  return (
    <Layout>
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-3xl font-bold mb-6'>Resultados del Partido</h1>

        <div className='bg-white shadow-lg rounded-lg p-6 mb-6'>
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

          {/* Header with score */}
          <div className='flex justify-between items-center mb-4'>
            <div className='text-xl font-semibold'>{match.teamA}</div>
            {editMode ? (
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => {
                    if (scoreA > 0) {
                      setScoreA(scoreA - 1);
                      if (scoreA <= goalsA.length) {
                        const updatedGoals = [...goalsA];
                        updatedGoals.pop();
                        setGoalsA(updatedGoals);
                      }
                    }
                  }}
                  className='px-2 py-1 bg-gray-200 rounded'
                >
                  -
                </button>
                <span className='text-2xl font-bold'>{scoreA}</span>
                <button
                  onClick={() => setScoreA(scoreA + 1)}
                  className='px-2 py-1 bg-gray-200 rounded'
                >
                  +
                </button>
                <span className='mx-2'>-</span>
                <button
                  onClick={() => {
                    if (scoreB > 0) {
                      setScoreB(scoreB - 1);
                      if (scoreB <= goalsB.length) {
                        const updatedGoals = [...goalsB];
                        updatedGoals.pop();
                        setGoalsB(updatedGoals);
                      }
                    }
                  }}
                  className='px-2 py-1 bg-gray-200 rounded'
                >
                  -
                </button>
                <span className='text-2xl font-bold'>{scoreB}</span>
                <button
                  onClick={() => setScoreB(scoreB + 1)}
                  className='px-2 py-1 bg-gray-200 rounded'
                >
                  +
                </button>
              </div>
            ) : (
              <div className='text-2xl font-bold'>
                {match.scoreA} - {match.scoreB}
              </div>
            )}
            <div className='text-xl font-semibold'>{match.teamB}</div>
          </div>

          {/* Grid for teams and goals */}
          <div className='grid grid-cols-2 gap-8 mb-6'>
            {/* Team A players and goals */}
            <div>
              <ul className='space-y-2'>
                {match.matchPlayers
                  .filter((p) => p.isTeamA)
                  .map((player) => {
                    const playerGoalCount = getPlayerGoalsA(player.user.id);
                    console.log(
                      `Rendering Team A Player ${player.user.name} with ${playerGoalCount} goals`
                    );

                    return (
                      <li
                        key={player.user.id}
                        className='flex justify-between items-center space-x-2 border-b border-gray-100 pb-2'
                      >
                        <div className='flex items-center space-x-2'>
                          {player.user.image && (
                            <img
                              src={player.user.image}
                              alt={player.user.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          )}
                          <span>{player.user.name}</span>
                        </div>

                        {/* Goals display or controls */}
                        {editMode ? (
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() => removeGoalA(player.user.id)}
                              className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                              disabled={playerGoalCount <= 0}
                            >
                              -
                            </button>
                            <span className='w-6 text-center'>
                              {playerGoalCount}
                            </span>
                            <button
                              onClick={() => addGoalA(player.user.id)}
                              className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                              disabled={scoreA <= goalsA.length}
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
                  })}
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
            <div>
              <ul className='space-y-2'>
                {match.matchPlayers
                  .filter((p) => !p.isTeamA)
                  .map((player) => {
                    const playerGoalCount = getPlayerGoalsB(player.user.id);
                    console.log(
                      `Rendering Team B Player ${player.user.name} with ${playerGoalCount} goals`
                    );

                    return (
                      <li
                        key={player.user.id}
                        className='flex justify-between items-center space-x-2 border-b border-gray-100 pb-2'
                      >
                        <div className='flex items-center space-x-2'>
                          {player.user.image && (
                            <img
                              src={player.user.image}
                              alt={player.user.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          )}
                          <span>{player.user.name}</span>
                        </div>

                        {/* Goals display or controls */}
                        {editMode ? (
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() => removeGoalB(player.user.id)}
                              className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                              disabled={playerGoalCount <= 0}
                            >
                              -
                            </button>
                            <span className='w-6 text-center'>
                              {playerGoalCount}
                            </span>
                            <button
                              onClick={() => addGoalB(player.user.id)}
                              className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                              disabled={scoreB <= goalsB.length}
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
                  })}
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

          <div className='mt-6 flex justify-between'>
            <button
              onClick={() => router.back()}
              className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
            >
              Volver al Grupo
            </button>

            {isAdmin &&
              (editMode ? (
                <div className='space-x-2'>
                  <button
                    onClick={() => setEditMode(false)}
                    className='bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded'
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className='bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50'
                  >
                    {saving ? 'Guardando...' : 'Guardar Resultado'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className='bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded'
                >
                  Editar Resultado
                </button>
              ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
