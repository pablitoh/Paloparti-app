import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { useAuth } from '../../../contexts/AuthContext';

interface Goal {
  id: string;
  userId: string;
  isTeamA: boolean;
  minute: number | null;
  scorerName: string | null;
  scorerAvatar: string | null;
}

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
}

interface Match {
  id: string;
  date: string;
  location: string;
  groupId: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA: Player[];
  playersB: Player[];
  goals: Goal[];
  group: {
    id: string;
    name: string;
  };
  isAdmin: boolean;
}

export default function MatchResult() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goalsA, setGoalsA] = useState<Goal[]>([]);
  const [goalsB, setGoalsB] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Referencia para saber si se navegó desde "registrar resultado"
  const fromRegisterResult = router.query.register === 'true';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (id && user) {
      fetchMatchData();
    }
  }, [id, user]);

  // Activar modo edición automáticamente si es un partido pendiente o si se llega desde "registrar resultado"
  useEffect(() => {
    if (match) {
      setEditMode(match.status === 'PENDING' || fromRegisterResult);
    }
  }, [match, fromRegisterResult]);

  const fetchMatchData = async () => {
    try {
      const response = await fetch(`/api/matches/${id}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/signin');
          return;
        }
        throw new Error('Failed to fetch match data');
      }

      const data = await response.json();
      setMatch(data);
      setScoreA(data.scoreA || 0);
      setScoreB(data.scoreB || 0);

      // Inicializar los goles desde los datos del partido
      const initialGoalsA =
        data.goals?.filter((goal: Goal) => goal.isTeamA) || [];
      const initialGoalsB =
        data.goals?.filter((goal: Goal) => !goal.isTeamA) || [];
      setGoalsA(initialGoalsA);
      setGoalsB(initialGoalsB);

      setIsAdmin(data.isAdmin || false);
    } catch (error) {
      console.error('Error fetching match data:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to fetch match data'
      );
    } finally {
      setLoading(false);
    }
  };

  // Add goal for Team A
  const addGoalA = (playerId: string) => {
    if (!match) return;

    // Calculate current total goals for team A
    const currentTotalGoals = goalsA.length;

    // Only add goal if current total is less than the score
    if (currentTotalGoals < scoreA) {
      // Create a new goal with a temporary ID
      const newGoal: Goal = {
        id: `temp-${Date.now()}`,
        userId: playerId,
        isTeamA: true,
        minute: null,
        scorerName: null,
        scorerAvatar: null,
      };

      setGoalsA([...goalsA, newGoal]);
    }
  };

  // Add goal for Team B
  const addGoalB = (playerId: string) => {
    if (!match) return;

    // Calculate current total goals for team B
    const currentTotalGoals = goalsB.length;

    // Only add goal if current total is less than the score
    if (currentTotalGoals < scoreB) {
      // Create a new goal with a temporary ID
      const newGoal: Goal = {
        id: `temp-${Date.now()}`,
        userId: playerId,
        isTeamA: false,
        minute: null,
        scorerName: null,
        scorerAvatar: null,
      };

      setGoalsB([...goalsB, newGoal]);
    }
  };

  // Remove goal from Team A
  const removeGoalA = (playerId: string) => {
    const updatedGoals = [...goalsA];
    const filteredGoals = updatedGoals.filter(
      (goal) => goal.userId !== playerId
    );
    setGoalsA(filteredGoals);
    // Don't modify the score when removing goals
  };

  // Remove goal from Team B
  const removeGoalB = (playerId: string) => {
    const updatedGoals = [...goalsB];
    const filteredGoals = updatedGoals.filter(
      (goal) => goal.userId !== playerId
    );
    setGoalsB(filteredGoals);
    // Don't modify the score when removing goals
  };

  // Update score for Team A
  const updateScoreA = (newScore: number) => {
    if (newScore < 0) return; // Don't allow negative scores
    setScoreA(newScore);

    // If new score is less than current goals, remove excess goals
    if (newScore < goalsA.length) {
      setGoalsA(goalsA.slice(0, newScore));
    }
  };

  // Update score for Team B
  const updateScoreB = (newScore: number) => {
    if (newScore < 0) return; // Don't allow negative scores
    setScoreB(newScore);

    // If new score is less than current goals, remove excess goals
    if (newScore < goalsB.length) {
      setGoalsB(goalsB.slice(0, newScore));
    }
  };

  // Update goal scorer for Team A
  const updateGoalScorerA = (index: number, playerId: string) => {
    if (!match) return;

    const player = match.playersA.find((p) => p.id === playerId);
    if (!player) return;

    const updatedGoals = [...goalsA];
    updatedGoals[index] = {
      ...updatedGoals[index],
      userId: playerId,
      scorerName: player.name,
      scorerAvatar: player.avatar,
    };

    setGoalsA(updatedGoals);
  };

  // Update goal scorer for Team B
  const updateGoalScorerB = (index: number, playerId: string) => {
    if (!match) return;

    const player = match.playersB.find((p) => p.id === playerId);
    if (!player) return;

    const updatedGoals = [...goalsB];
    updatedGoals[index] = {
      ...updatedGoals[index],
      userId: playerId,
      scorerName: player.name,
      scorerAvatar: player.avatar,
    };

    setGoalsB(updatedGoals);
  };

  // Update goal minute for Team A
  const updateGoalMinuteA = (index: number, minute: number) => {
    const updatedGoals = [...goalsA];
    updatedGoals[index] = {
      ...updatedGoals[index],
      minute,
    };

    setGoalsA(updatedGoals);
  };

  // Update goal minute for Team B
  const updateGoalMinuteB = (index: number, minute: number) => {
    const updatedGoals = [...goalsB];
    updatedGoals[index] = {
      ...updatedGoals[index],
      minute,
    };

    setGoalsB(updatedGoals);
  };

  // Save match result
  const handleSave = async () => {
    if (!match) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/matches/${id}/result`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scoreA,
          scoreB,
          goals: [...goalsA, ...goalsB],
          status: 'COMPLETED',
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/signin');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save match result');
      }

      // Si el partido era pendiente, informar que se han reseteado los estados de confirmación
      if (match.status === 'PENDING') {
        alert(
          'Resultado guardado. Los estados de confirmación de los miembros han sido reseteados.'
        );
      } else {
        alert('Resultado actualizado correctamente.');
      }

      router.push(`/group/${match.groupId}`);
    } catch (error) {
      console.error('Error saving match result:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to save match result'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  if (error || !match) {
    return (
      <Layout>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-gray-900 mb-4'>Error</h2>
          <p className='text-gray-500 mb-6'>{error || 'Match not found'}</p>
          <Button onClick={() => router.back()} variant='primary'>
            Back
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='flex items-center justify-between gap-4 mb-6'>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              onClick={() => router.back()}
              className='flex items-center gap-2'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                  clipRule='evenodd'
                />
              </svg>
              Volver
            </Button>
            <h1 className='text-2xl font-bold text-gray-800'>
              {match?.status === 'PENDING'
                ? 'Registrar Resultado'
                : editMode
                ? 'Editar Resultado'
                : 'Detalle del Partido'}
            </h1>
          </div>

          {/* Botón Editar - Solo visible para admins cuando no está en modo edición */}
          {isAdmin && !editMode && (
            <Button
              variant='primary'
              onClick={() => setEditMode(true)}
              className='flex items-center gap-1'
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
                  d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
                />
              </svg>
              Editar
            </Button>
          )}
        </div>

        <div className='bg-white rounded-xl shadow-md p-6 mb-6'>
          <div className='text-center mb-6'>
            <p className='text-gray-600'>{match?.group.name}</p>
            <p className='text-sm text-gray-500'>
              {match?.date &&
                new Date(match.date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
            </p>
            <p className='text-sm text-gray-600 mt-1'>{match?.location}</p>
          </div>

          <div className='grid grid-cols-3 gap-2 mb-4'>
            {/* Equipo A */}
            <div className='text-center'>
              <h3 className='text-sm font-medium text-gray-700 mb-2'>
                {match?.teamA}
              </h3>
              <div className='text-center mb-2'>
                {isAdmin && editMode ? (
                  <div className='flex justify-center items-center gap-2'>
                    <button
                      onClick={() => updateScoreA(Math.max(0, scoreA - 1))}
                      className='w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded'
                      disabled={scoreA <= 0}
                    >
                      -
                    </button>
                    <input
                      type='number'
                      min='0'
                      value={scoreA}
                      onChange={(e) =>
                        updateScoreA(parseInt(e.target.value) || 0)
                      }
                      className='w-16 text-center border rounded-md'
                    />
                    <button
                      onClick={() => updateScoreA(scoreA + 1)}
                      className='w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded'
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className='text-3xl font-bold text-gray-800'>
                    {match?.scoreA}
                  </span>
                )}
              </div>
            </div>

            {/* VS */}
            <div className='flex items-center justify-center'>
              <span className='text-xl font-semibold text-gray-400'>VS</span>
            </div>

            {/* Equipo B */}
            <div className='text-center'>
              <h3 className='text-sm font-medium text-gray-700 mb-2'>
                {match?.teamB}
              </h3>
              <div className='text-center mb-2'>
                {isAdmin && editMode ? (
                  <div className='flex justify-center items-center gap-2'>
                    <button
                      onClick={() => updateScoreB(Math.max(0, scoreB - 1))}
                      className='w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded'
                      disabled={scoreB <= 0}
                    >
                      -
                    </button>
                    <input
                      type='number'
                      min='0'
                      value={scoreB}
                      onChange={(e) =>
                        updateScoreB(parseInt(e.target.value) || 0)
                      }
                      className='w-16 text-center border rounded-md'
                    />
                    <button
                      onClick={() => updateScoreB(scoreB + 1)}
                      className='w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded'
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className='text-3xl font-bold text-gray-800'>
                    {match?.scoreB}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controles de goles - Solo en modo edición para admins */}
          {isAdmin && editMode && (
            <div className='grid grid-cols-2 gap-6 mb-6'>
              {/* Goles Equipo A */}
              <div>
                <h3 className='text-sm font-medium text-gray-700 mb-4'>
                  Goles de {match?.teamA}
                </h3>
                <div className='space-y-3'>
                  {match?.playersA?.map((player) => {
                    const playerGoals = goalsA.filter(
                      (goal) => goal.userId === player.id
                    ).length;
                    return (
                      <div
                        key={player.id}
                        className='flex items-center justify-between gap-2'
                      >
                        <div className='flex items-center gap-2'>
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          ) : (
                            <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center'>
                              <span className='text-sm text-gray-500'>
                                {player.name?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <span className='text-sm text-gray-700'>
                            {player.name || 'Sin nombre'}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <button
                            onClick={() => removeGoalA(player.id)}
                            className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                            disabled={playerGoals <= 0}
                          >
                            -
                          </button>
                          <span className='w-8 text-center'>{playerGoals}</span>
                          <button
                            onClick={() => addGoalA(player.id)}
                            className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                            disabled={playerGoals >= scoreA}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Goles Equipo B */}
              <div>
                <h3 className='text-sm font-medium text-gray-700 mb-4'>
                  Goles de {match?.teamB}
                </h3>
                <div className='space-y-3'>
                  {match?.playersB?.map((player) => {
                    const playerGoals = goalsB.filter(
                      (goal) => goal.userId === player.id
                    ).length;
                    return (
                      <div
                        key={player.id}
                        className='flex items-center justify-between gap-2'
                      >
                        <div className='flex items-center gap-2'>
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          ) : (
                            <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center'>
                              <span className='text-sm text-gray-500'>
                                {player.name?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <span className='text-sm text-gray-700'>
                            {player.name || 'Sin nombre'}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <button
                            onClick={() => removeGoalB(player.id)}
                            className='w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded'
                            disabled={playerGoals <= 0}
                          >
                            -
                          </button>
                          <span className='w-8 text-center'>{playerGoals}</span>
                          <button
                            onClick={() => addGoalB(player.id)}
                            className='w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded'
                            disabled={playerGoals >= scoreB}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Modo visualización - Mostrar goles por jugador */}
          {!editMode && (
            <div className='grid grid-cols-2 gap-6 mb-6'>
              {/* Goles Equipo A */}
              <div>
                <h3 className='text-sm font-medium text-gray-700 mb-4'>
                  Jugadores de {match?.teamA}
                </h3>
                <div className='space-y-3'>
                  {match?.playersA?.map((player) => {
                    const playerGoals =
                      match.goals?.filter(
                        (goal) => goal.userId === player.id && goal.isTeamA
                      )?.length || 0;
                    return (
                      <div
                        key={player.id}
                        className='flex items-center justify-between gap-2'
                      >
                        <div className='flex items-center gap-2'>
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          ) : (
                            <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center'>
                              <span className='text-sm text-gray-500'>
                                {player.name?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <span className='text-sm text-gray-700'>
                            {player.name || 'Sin nombre'}
                          </span>
                        </div>
                        {playerGoals > 0 && (
                          <div className='flex items-center gap-1'>
                            {Array.from({ length: playerGoals }).map(
                              (_, idx) => (
                                <span key={idx} className='text-yellow-500'>
                                  ⚽
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Goles Equipo B */}
              <div>
                <h3 className='text-sm font-medium text-gray-700 mb-4'>
                  Jugadores de {match?.teamB}
                </h3>
                <div className='space-y-3'>
                  {match?.playersB?.map((player) => {
                    const playerGoals =
                      match.goals?.filter(
                        (goal) => goal.userId === player.id && !goal.isTeamA
                      )?.length || 0;
                    return (
                      <div
                        key={player.id}
                        className='flex items-center justify-between gap-2'
                      >
                        <div className='flex items-center gap-2'>
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className='w-8 h-8 rounded-full'
                            />
                          ) : (
                            <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center'>
                              <span className='text-sm text-gray-500'>
                                {player.name?.[0] || '?'}
                              </span>
                            </div>
                          )}
                          <span className='text-sm text-gray-700'>
                            {player.name || 'Sin nombre'}
                          </span>
                        </div>
                        {playerGoals > 0 && (
                          <div className='flex items-center gap-1'>
                            {Array.from({ length: playerGoals }).map(
                              (_, idx) => (
                                <span key={idx} className='text-yellow-500'>
                                  ⚽
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className='flex justify-center gap-4'>
            <Button
              variant='outline'
              onClick={() => router.back()}
              disabled={saving}
            >
              {editMode ? 'Cancelar' : 'Volver'}
            </Button>
            {isAdmin && editMode && (
              <Button variant='primary' onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Resultado'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
