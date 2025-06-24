import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { Avatar } from '@mui/material';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';
import {
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';

interface Player {
  id: string;
  name: string | null;
  image: string | null;
  isTeamA: boolean;
}

interface Goal {
  id: string;
  scorerId: string;
  scorerName: string | null;
  isTeamA: boolean;
  minute?: number;
}

interface MatchPlayer {
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

interface Match {
  id: string;
  date: string;
  location: string;
  teamA: MatchPlayer[]; // Ahora es un array como en el nuevo formato
  teamB: MatchPlayer[]; // Ahora es un array como en el nuevo formato
  scoreA: number;
  scoreB: number;
  status: string;
  group: {
    id: string;
    name: string;
  };
  matchPlayers?: {
    userId: string;
    isTeamA: boolean;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[]; // Mantenemos para compatibilidad
  goals: {
    id: string;
    scorerId: string;
    isTeamA: boolean;
    minute?: number;
    scorer: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[];
}

export default function EditMatchHistory() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado único para modo de edición
  const [editingMode, setEditingMode] = useState(false);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  // Estado para intercambio de jugadores
  const [swapMode, setSwapMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  // Estado para edición de goles
  const [goals, setGoals] = useState<Goal[]>([]);

  // Estado para modal de confirmación de intercambio
  const [showSwapConfirmModal, setShowSwapConfirmModal] = useState(false);
  const [swapImpact, setSwapImpact] = useState<{
    player1: Player;
    player2: Player;
    currentScore: { scoreA: number; scoreB: number };
    newScore: { scoreA: number; scoreB: number };
    affectedGoals: Goal[];
  } | null>(null);

  useEffect(() => {
    if (session === null) {
      // Solo redirigir si definitivamente no hay sesión
      router.push('/auth/signin');
      return;
    }

    if (session?.user && id && typeof id === 'string') {
      fetchMatch();
    }
  }, [id, session]);

  const handleGoBack = () => {
    if (match?.group?.id) {
      // Invalidar la cache del historial para que se actualice cuando regrese
      queryClient.invalidateQueries({
        queryKey: ['group', 'history', match.group.id],
        exact: false,
        refetchType: 'active',
      });
    }
    router.back();
  };

  const fetchMatch = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      setLoading(true);
      const response = await fetch(`/api/matches/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          showErrorToast('Partido no encontrado');
          return;
        }
        throw new Error('Error al cargar el partido');
      }

      const data = await response.json();

      if (!data) {
        throw new Error('No se recibieron datos del partido');
      }

      setMatch(data);
      setScoreA(data.scoreA || 0);
      setScoreB(data.scoreB || 0);

      // Debug: Ver qué datos llegan del backend
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Datos del match:', data);
        console.log('🔍 Goles raw del backend:', data.goals);
        if (data.goals && data.goals.length > 0) {
          console.log('🔍 Primer gol:', data.goals[0]);
        }
      }

      // Formatear goles - usar userId o el ID del scorer como fallback
      const formattedGoals =
        data.goals?.map((goal: any) => ({
          id: goal.id,
          scorerId: goal.userId || goal.scorer?.id || null,
          scorerName: goal.scorer?.name || null,
          isTeamA: goal.isTeamA,
          minute: goal.minute,
        })) || [];

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Goles formateados:', formattedGoals);
      }

      setGoals(formattedGoals);
    } catch (error) {
      console.error('Error fetching match:', error);
      showErrorToast('Error al cargar el partido');
      // NO redirigir automáticamente, dejar que el usuario decida
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScore = async () => {
    if (!match) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/matches/${id}/edit-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-score',
          scoreA,
          scoreB,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar puntajes');
      }

      const data = await response.json();
      setMatch(data.match);

      // Actualizar goles también
      const formattedGoals =
        data.match.goals?.map((goal: any) => ({
          id: goal.id,
          scorerId: goal.userId || goal.scorer?.id || null,
          scorerName: goal.scorer?.name || null,
          isTeamA: goal.isTeamA,
          minute: goal.minute,
        })) || [];
      setGoals(formattedGoals);

      showSuccessToast('Puntajes actualizados correctamente');
    } catch (error) {
      console.error('Error updating score:', error);
      showErrorToast(
        error instanceof Error ? error.message : 'Error al actualizar puntajes'
      );
    } finally {
      setSaving(false);
    }
  };

  const calculateSwapImpact = (player1: Player, player2: Player) => {
    // Debug logs (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧮 Calculando impacto...');
      console.log(
        'Player1 ID:',
        player1.id,
        'Name:',
        player1.name,
        'Team:',
        player1.isTeamA ? 'A' : 'B'
      );
      console.log(
        'Player2 ID:',
        player2.id,
        'Name:',
        player2.name,
        'Team:',
        player2.isTeamA ? 'A' : 'B'
      );
      console.log('Scores actuales: A =', scoreA, 'B =', scoreB);
      console.log('Todos los goles:', goals);
      console.log(
        'IDs de scorers en goles:',
        goals.map((g) => ({
          id: g.scorerId,
          name: g.scorerName,
          team: g.isTeamA ? 'A' : 'B',
        }))
      );
    }

    // Contar goles de cada jugador
    const player1Goals = goals.filter((g) => g.scorerId === player1.id);
    const player2Goals = goals.filter((g) => g.scorerId === player2.id);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        'Goles Player1 (' + player1.name + '):',
        player1Goals.length,
        player1Goals
      );
      console.log(
        'Goles Player2 (' + player2.name + '):',
        player2Goals.length,
        player2Goals
      );
    }

    const affectedGoals = [...player1Goals, ...player2Goals];

    if (process.env.NODE_ENV === 'development') {
      console.log('Goles afectados:', affectedGoals);
    }

    if (affectedGoals.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No hay goles afectados');
      }
      return null; // No hay impacto en el resultado
    }

    // Calcular el nuevo puntaje después del intercambio
    // Usar los valores actuales de estado, no los del match original
    let newScoreA = scoreA;
    let newScoreB = scoreB;

    if (process.env.NODE_ENV === 'development') {
      console.log('🔢 Iniciando cálculo:');
      console.log('Score inicial: A =', newScoreA, 'B =', newScoreB);
    }

    // Restar goles actuales de sus equipos originales
    player1Goals.forEach((goal) => {
      if (goal.isTeamA) {
        newScoreA--;
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Restando gol de',
            player1.name,
            'del Team A:',
            newScoreA
          );
        }
      } else {
        newScoreB--;
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Restando gol de',
            player1.name,
            'del Team B:',
            newScoreB
          );
        }
      }
    });

    player2Goals.forEach((goal) => {
      if (goal.isTeamA) {
        newScoreA--;
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Restando gol de',
            player2.name,
            'del Team A:',
            newScoreA
          );
        }
      } else {
        newScoreB--;
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Restando gol de',
            player2.name,
            'del Team B:',
            newScoreB
          );
        }
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Después de restar: A =', newScoreA, 'B =', newScoreB);
    }

    // Sumar goles en los nuevos equipos (intercambiados)
    // player1 cambia de equipo: si estaba en A va a B, si estaba en B va a A
    player1Goals.forEach((goal) => {
      if (goal.isTeamA) {
        // Estaba en A, ahora va a B
        newScoreB++;
        if (process.env.NODE_ENV === 'development') {
          console.log(player1.name, 'gol va de A → B:', newScoreB);
        }
      } else {
        // Estaba en B, ahora va a A
        newScoreA++;
        if (process.env.NODE_ENV === 'development') {
          console.log(player1.name, 'gol va de B → A:', newScoreA);
        }
      }
    });

    // player2 también cambia de equipo
    player2Goals.forEach((goal) => {
      if (goal.isTeamA) {
        // Estaba en A, ahora va a B
        newScoreB++;
        if (process.env.NODE_ENV === 'development') {
          console.log(player2.name, 'gol va de A → B:', newScoreB);
        }
      } else {
        // Estaba en B, ahora va a A
        newScoreA++;
        if (process.env.NODE_ENV === 'development') {
          console.log(player2.name, 'gol va de B → A:', newScoreA);
        }
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Resultado final: A =', newScoreA, 'B =', newScoreB);
    }

    return {
      player1,
      player2,
      currentScore: { scoreA: scoreA, scoreB: scoreB },
      newScore: { scoreA: newScoreA, scoreB: newScoreB },
      affectedGoals,
    };
  };

  const handleSwapPlayers = () => {
    if (selectedPlayers.length !== 2) {
      showErrorToast('Debes seleccionar exactamente 2 jugadores');
      return;
    }

    const [player1, player2] = selectedPlayers;

    if (player1.isTeamA === player2.isTeamA) {
      showErrorToast('Los jugadores deben estar en equipos diferentes');
      return;
    }

    // Debug logs (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Verificando impacto del intercambio...');
      console.log('Player 1:', player1);
      console.log('Player 2:', player2);
      console.log('Goals actuales:', goals);
    }

    // Verificar si hay goles involucrados y mostrar modal de confirmación
    const impact = calculateSwapImpact(player1, player2);

    if (process.env.NODE_ENV === 'development') {
      console.log('Impact calculado:', impact);
    }

    if (impact && impact.affectedGoals.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Mostrando modal de confirmación');
      }
      setSwapImpact(impact);
      setShowSwapConfirmModal(true);
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('❌ No hay goles afectados, ejecutando directamente');
    }
    // Si no hay goles involucrados, ejecutar directamente
    executeSwapPlayers();
  };

  const executeSwapPlayers = async () => {
    const [player1, player2] = selectedPlayers;

    try {
      setSaving(true);
      const response = await fetch(`/api/matches/${id}/edit-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'swap-players',
          player1Id: player1.id,
          player2Id: player2.id,
          player1IsTeamA: player1.isTeamA,
          player2IsTeamA: player2.isTeamA,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al intercambiar jugadores');
      }

      const data = await response.json();
      setMatch(data.match);

      // Actualizar goles también
      const formattedGoals =
        data.match.goals?.map((goal: any) => ({
          id: goal.id,
          scorerId: goal.userId || goal.scorer?.id || null,
          scorerName: goal.scorer?.name || null,
          isTeamA: goal.isTeamA,
          minute: goal.minute,
        })) || [];
      setGoals(formattedGoals);

      // Actualizar los scores en el estado local
      setScoreA(data.match.scoreA);
      setScoreB(data.match.scoreB);

      setSelectedPlayers([]);
      setSwapMode(false);
      setShowSwapConfirmModal(false); // Cerrar modal
      showSuccessToast('Jugadores intercambiados correctamente');
    } catch (error) {
      console.error('Error swapping players:', error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : 'Error al intercambiar jugadores'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateGoals = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/matches/${id}/edit-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-goals',
          goals: goals.map((goal) => ({
            scorerId: goal.scorerId,
            isTeamA: goal.isTeamA,
            minute: goal.minute,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar goles');
      }

      const data = await response.json();
      setMatch(data.match);

      // Actualizar goles también
      const formattedGoals =
        data.match.goals?.map((goal: any) => ({
          id: goal.id,
          scorerId: goal.userId || goal.scorer?.id || null,
          scorerName: goal.scorer?.name || null,
          isTeamA: goal.isTeamA,
          minute: goal.minute,
        })) || [];
      setGoals(formattedGoals);

      showSuccessToast('Goles actualizados correctamente');
    } catch (error) {
      console.error('Error updating goals:', error);
      showErrorToast(
        error instanceof Error ? error.message : 'Error al actualizar goles'
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePlayerSelection = (player: Player) => {
    if (selectedPlayers.some((p) => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
    } else if (selectedPlayers.length < 2) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const addGoal = (playerId: string, isTeamA: boolean) => {
    // Buscar el jugador en teamA y teamB primero, luego en matchPlayers como fallback
    let playerName = null;

    if (Array.isArray(match?.teamA) && match.teamA.length > 0) {
      const teamAPlayer = match.teamA.find((p) => p.id === playerId);
      if (teamAPlayer) {
        playerName = teamAPlayer.name;
      }
    }

    if (!playerName && Array.isArray(match?.teamB) && match.teamB.length > 0) {
      const teamBPlayer = match.teamB.find((p) => p.id === playerId);
      if (teamBPlayer) {
        playerName = teamBPlayer.name;
      }
    }

    // Fallback a matchPlayers
    if (!playerName && match?.matchPlayers) {
      const matchPlayer = match.matchPlayers.find(
        (mp) => mp.userId === playerId
      );
      if (matchPlayer) {
        playerName = matchPlayer.user?.name || null;
      }
    }

    if (!playerName) {
      console.error('Jugador no encontrado:', playerId);
      return;
    }

    const newGoal: Goal = {
      id: `temp-${Date.now()}`,
      scorerId: playerId,
      scorerName: playerName,
      isTeamA,
      minute: undefined,
    };

    setGoals([...goals, newGoal]);
  };

  const removeGoal = (goalId: string) => {
    setGoals(goals.filter((g) => g.id !== goalId));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className='flex items-center justify-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-green-600'></div>
        </div>
      </Layout>
    );
  }

  if (!match || !match.group) {
    return (
      <Layout>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>
              {!match
                ? 'Partido no encontrado'
                : 'Error al cargar datos del partido'}
            </h1>
            <Button onClick={handleGoBack}>Volver</Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Usar teamA y teamB directamente del nuevo formato, con fallback a matchPlayers
  const playersA =
    Array.isArray(match?.teamA) && match.teamA.length > 0
      ? match.teamA.map((player) => ({
          id: player.id,
          name: player.name,
          image: player.avatar,
          isTeamA: true,
        }))
      : match?.matchPlayers
          ?.filter((mp) => mp.isTeamA)
          ?.map((mp) => ({
            id: mp.userId,
            name: mp.user?.name || null,
            image: mp.user?.image || null,
            isTeamA: true,
          })) || [];

  const playersB =
    Array.isArray(match?.teamB) && match.teamB.length > 0
      ? match.teamB.map((player) => ({
          id: player.id,
          name: player.name,
          image: player.avatar,
          isTeamA: false,
        }))
      : match?.matchPlayers
          ?.filter((mp) => !mp.isTeamA)
          ?.map((mp) => ({
            id: mp.userId,
            name: mp.user?.name || null,
            image: mp.user?.image || null,
            isTeamA: false,
          })) || [];

  const goalsA = goals.filter((g) => g.isTeamA);
  const goalsB = goals.filter((g) => !g.isTeamA);

  return (
    <Layout>
      <div className='max-w-6xl mx-auto px-4 py-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='mb-4'>
            <Button
              variant='outline'
              onClick={handleGoBack}
              className='flex items-center space-x-2'
            >
              <ArrowLeftIcon className='h-5 w-5' />
              <span>Volver</span>
            </Button>
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>
              Editar Partido
              {match?.group?.name ? ` - ${match.group.name}` : ''}
            </h1>
            <p className='text-gray-600'>
              {match?.date ? formatDate(match.date) : ''}{' '}
              {match?.location ? `• ${match.location}` : ''}
            </p>
          </div>
        </div>

        {/* Score Section */}
        <div className='bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-4 sm:p-6 mb-8'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
            <h2 className='text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-2'>
              <span className='w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0'>
                <span className='text-white text-sm font-bold'>⚽</span>
              </span>
              <span className='truncate'>Resultado del Partido</span>
            </h2>
            <Button
              variant={editingMode ? 'danger' : 'outline'}
              onClick={() => {
                if (editingMode) {
                  setScoreA(match?.scoreA || 0);
                  setScoreB(match?.scoreB || 0);
                }
                setEditingMode(!editingMode);
              }}
              className={`flex items-center justify-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 w-full sm:w-auto rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 shadow-lg ${
                editingMode
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-red-500 transform hover:scale-105'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-indigo-500 transform hover:scale-105'
              }`}
            >
              {editingMode ? (
                <>
                  <XMarkIcon className='h-4 w-4 sm:h-5 sm:w-5' />
                  <span>Cancelar Edición</span>
                </>
              ) : (
                <>
                  <PencilIcon className='h-4 w-4 sm:h-5 sm:w-5' />
                  <span>Editar Partido</span>
                </>
              )}
            </Button>
          </div>

          <div className='flex items-center justify-center space-x-4 sm:space-x-8'>
            {/* Team A */}
            <div className='text-center flex-1 max-w-[120px]'>
              <div className='bg-gradient-to-r from-green-400 to-green-500 text-white px-2 sm:px-4 py-2 rounded-lg mb-3 sm:mb-4 shadow-md'>
                <h3 className='text-sm sm:text-lg font-semibold truncate'>
                  Equipo A
                </h3>
              </div>
              {editingMode ? (
                <input
                  type='number'
                  min='0'
                  max='99'
                  value={scoreA}
                  onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
                  className='w-16 h-16 sm:w-24 sm:h-24 text-3xl sm:text-5xl font-bold text-center border-4 border-green-300 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-200 shadow-lg transition-all duration-200'
                />
              ) : (
                <div className='w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200 rounded-xl shadow-lg border-2 border-green-300 mx-auto'>
                  <span className='text-3xl sm:text-5xl font-bold text-green-800'>
                    {match?.scoreA || 0}
                  </span>
                </div>
              )}
            </div>

            {/* VS */}
            <div className='text-xl sm:text-3xl font-bold text-gray-500 bg-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg shadow-md border border-gray-200 flex-shrink-0'>
              VS
            </div>

            {/* Team B */}
            <div className='text-center flex-1 max-w-[120px]'>
              <div className='bg-gradient-to-r from-blue-400 to-blue-500 text-white px-2 sm:px-4 py-2 rounded-lg mb-3 sm:mb-4 shadow-md'>
                <h3 className='text-sm sm:text-lg font-semibold truncate'>
                  Equipo B
                </h3>
              </div>
              {editingMode ? (
                <input
                  type='number'
                  min='0'
                  max='99'
                  value={scoreB}
                  onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
                  className='w-16 h-16 sm:w-24 sm:h-24 text-3xl sm:text-5xl font-bold text-center border-4 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 shadow-lg transition-all duration-200'
                />
              ) : (
                <div className='w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl shadow-lg border-2 border-blue-300 mx-auto'>
                  <span className='text-3xl sm:text-5xl font-bold text-blue-800'>
                    {match?.scoreB || 0}
                  </span>
                </div>
              )}
            </div>
          </div>

          {editingMode && (
            <div className='flex justify-center mt-6 sm:mt-8 px-4 sm:px-0'>
              <Button
                variant='primary'
                onClick={handleUpdateScore}
                disabled={saving}
                className='flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto max-w-xs rounded-xl font-bold text-base sm:text-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-70'
              >
                {saving ? (
                  <>
                    <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white'></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className='h-5 w-5 sm:h-6 sm:w-6' />
                    <span>Guardar Puntajes</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row gap-4 justify-center mb-8'>
          <div className='flex flex-col sm:flex-row gap-4 w-full sm:w-auto'>
            {/* Player Swap Button */}
            <Button
              variant={swapMode ? 'danger' : 'outline'}
              onClick={() => {
                if (swapMode) {
                  setSelectedPlayers([]);
                }
                setSwapMode(!swapMode);
              }}
              className={`flex items-center justify-center space-x-2 px-6 py-3 w-full sm:w-48 shadow-md ${
                swapMode
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-purple-500'
              }`}
            >
              <ArrowsRightLeftIcon className='h-5 w-5' />
              <span className='font-semibold'>
                {swapMode ? 'Cancelar Intercambio' : 'Intercambiar Jugadores'}
              </span>
            </Button>
          </div>

          {/* Confirmation Buttons */}
          {swapMode && selectedPlayers.length === 2 && (
            <Button
              variant='primary'
              onClick={handleSwapPlayers}
              disabled={saving}
              className='flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg px-8 py-3'
            >
              <CheckIcon className='h-5 w-5' />
              <span className='font-semibold'>
                {saving ? 'Intercambiando...' : 'Confirmar Intercambio'}
              </span>
            </Button>
          )}

          {editingMode && (
            <Button
              variant='primary'
              onClick={async () => {
                // Combinamos ambas actualizaciones
                try {
                  setSaving(true);
                  await handleUpdateScore();
                  await handleUpdateGoals();
                  setEditingMode(false);
                } catch (error) {
                  console.error('Error saving changes:', error);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className='flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg px-8 py-3'
            >
              <CheckIcon className='h-5 w-5' />
              <span className='font-semibold'>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </span>
            </Button>
          )}
        </div>

        {/* Teams Section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
          {/* Team A */}
          <div className='bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border border-green-200 p-6'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-2xl font-bold text-green-800 flex items-center space-x-2'>
                <span className='w-8 h-8 bg-green-500 rounded-full flex items-center justify-center'>
                  <span className='text-white text-sm font-bold'>A</span>
                </span>
                <span>Equipo A</span>
              </h3>
              <div className='bg-green-100 px-3 py-1 rounded-full'>
                <span className='text-green-800 font-semibold text-sm'>
                  {goalsA.length} ⚽
                </span>
              </div>
            </div>
            <div className='space-y-3'>
              {playersA.map((player) => {
                const playerGoals = goalsA.filter(
                  (g) => g.scorerId === player.id
                ).length;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 ${
                      swapMode &&
                      selectedPlayers.some((p) => p.id === player.id)
                        ? 'border-purple-500 bg-purple-50 shadow-md transform scale-105'
                        : swapMode
                        ? 'border-green-200 hover:border-green-300 cursor-pointer hover:shadow-md'
                        : 'border-green-200 bg-white shadow-sm'
                    }`}
                    onClick={() => swapMode && togglePlayerSelection(player)}
                  >
                    <div className='flex items-center space-x-3'>
                      <Avatar
                        src={player.image || ''}
                        alt={player.name || ''}
                        className='w-12 h-12 border-2 border-green-300'
                      />
                      <div className='flex flex-col'>
                        <span className='font-semibold text-gray-900'>
                          {player.name}
                        </span>
                        {!editingMode && playerGoals > 0 && (
                          <span className='text-sm text-green-600'>
                            {playerGoals} {playerGoals === 1 ? 'gol' : 'goles'}{' '}
                            ⚽
                          </span>
                        )}
                      </div>
                    </div>
                    {editingMode && (
                      <div className='flex items-center space-x-3'>
                        <span className='text-sm font-semibold text-green-700 bg-green-100 px-2 py-1 rounded'>
                          {playerGoals} ⚽
                        </span>
                        <div className='flex items-center space-x-1'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              const playerGoalsInTeamA = goals.filter(
                                (g) => g.scorerId === player.id && g.isTeamA
                              );
                              if (playerGoalsInTeamA.length > 0) {
                                removeGoal(
                                  playerGoalsInTeamA[
                                    playerGoalsInTeamA.length - 1
                                  ].id
                                );
                              }
                            }}
                            disabled={playerGoals === 0}
                            className='w-8 h-8 p-0 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 border-red-300'
                          >
                            −
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              addGoal(player.id, true);
                            }}
                            disabled={goalsA.length >= scoreA}
                            className='w-8 h-8 p-0 flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-600 border-green-300'
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B */}
          <div className='bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-lg border border-blue-200 p-6'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-2xl font-bold text-blue-800 flex items-center space-x-2'>
                <span className='w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center'>
                  <span className='text-white text-sm font-bold'>B</span>
                </span>
                <span>Equipo B</span>
              </h3>
              <div className='bg-blue-100 px-3 py-1 rounded-full'>
                <span className='text-blue-800 font-semibold text-sm'>
                  {goalsB.length} ⚽
                </span>
              </div>
            </div>
            <div className='space-y-3'>
              {playersB.map((player) => {
                const playerGoals = goalsB.filter(
                  (g) => g.scorerId === player.id
                ).length;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 ${
                      swapMode &&
                      selectedPlayers.some((p) => p.id === player.id)
                        ? 'border-purple-500 bg-purple-50 shadow-md transform scale-105'
                        : swapMode
                        ? 'border-blue-200 hover:border-blue-300 cursor-pointer hover:shadow-md'
                        : 'border-blue-200 bg-white shadow-sm'
                    }`}
                    onClick={() => swapMode && togglePlayerSelection(player)}
                  >
                    <div className='flex items-center space-x-3'>
                      <Avatar
                        src={player.image || ''}
                        alt={player.name || ''}
                        className='w-12 h-12 border-2 border-blue-300'
                      />
                      <div className='flex flex-col'>
                        <span className='font-semibold text-gray-900'>
                          {player.name}
                        </span>
                        {!editingMode && playerGoals > 0 && (
                          <span className='text-sm text-blue-600'>
                            {playerGoals} {playerGoals === 1 ? 'gol' : 'goles'}{' '}
                            ⚽
                          </span>
                        )}
                      </div>
                    </div>
                    {editingMode && (
                      <div className='flex items-center space-x-3'>
                        <span className='text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded'>
                          {playerGoals} ⚽
                        </span>
                        <div className='flex items-center space-x-1'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              const playerGoalsInTeamB = goals.filter(
                                (g) => g.scorerId === player.id && !g.isTeamA
                              );
                              if (playerGoalsInTeamB.length > 0) {
                                removeGoal(
                                  playerGoalsInTeamB[
                                    playerGoalsInTeamB.length - 1
                                  ].id
                                );
                              }
                            }}
                            disabled={playerGoals === 0}
                            className='w-8 h-8 p-0 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 border-red-300'
                          >
                            −
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              addGoal(player.id, false);
                            }}
                            disabled={goalsB.length >= scoreB}
                            className='w-8 h-8 p-0 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-300'
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Goals List (when editing) */}
        {editingMode && goals.length > 0 && (
          <div className='mt-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-lg border border-yellow-200 p-6'>
            <h3 className='text-2xl font-bold text-yellow-800 mb-6 flex items-center space-x-2'>
              <span className='w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center'>
                <span className='text-white text-sm font-bold'>⚽</span>
              </span>
              <span>Goles del Partido</span>
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Goals Team A */}
              <div className='bg-green-50 rounded-lg p-4 border border-green-200'>
                <h4 className='font-bold text-green-800 mb-4 flex items-center space-x-2'>
                  <span className='w-6 h-6 bg-green-500 rounded-full flex items-center justify-center'>
                    <span className='text-white text-xs font-bold'>A</span>
                  </span>
                  <span>Equipo A</span>
                </h4>
                <div className='space-y-2'>
                  {goalsA.map((goal, index) => (
                    <div
                      key={goal.id}
                      className='flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-green-100'
                    >
                      <span className='text-sm font-semibold text-gray-800'>
                        {goal.scorerName} {goal.minute && `(${goal.minute}')`}
                      </span>
                      <Button
                        variant='danger'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGoal(goal.id);
                        }}
                        className='bg-red-50 hover:bg-red-100 text-red-600 border-red-200 w-8 h-8 p-0 flex items-center justify-center'
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  {goalsA.length === 0 && (
                    <div className='text-center py-4 text-gray-500'>
                      Sin goles
                    </div>
                  )}
                </div>
              </div>

              {/* Goals Team B */}
              <div className='bg-blue-50 rounded-lg p-4 border border-blue-200'>
                <h4 className='font-bold text-blue-800 mb-4 flex items-center space-x-2'>
                  <span className='w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center'>
                    <span className='text-white text-xs font-bold'>B</span>
                  </span>
                  <span>Equipo B</span>
                </h4>
                <div className='space-y-2'>
                  {goalsB.map((goal, index) => (
                    <div
                      key={goal.id}
                      className='flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-blue-100'
                    >
                      <span className='text-sm font-semibold text-gray-800'>
                        {goal.scorerName} {goal.minute && `(${goal.minute}')`}
                      </span>
                      <Button
                        variant='danger'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGoal(goal.id);
                        }}
                        className='bg-red-50 hover:bg-red-100 text-red-600 border-red-200 w-8 h-8 p-0 flex items-center justify-center'
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  {goalsB.length === 0 && (
                    <div className='text-center py-4 text-gray-500'>
                      Sin goles
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        {swapMode && (
          <div className='mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 shadow-lg'>
            <div className='flex items-start space-x-3'>
              <div className='w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0'>
                <ArrowsRightLeftIcon className='h-5 w-5 text-white' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-purple-800 mb-2'>
                  Modo Intercambio de Jugadores
                </h3>
                <div className='text-sm text-purple-700 space-y-1'>
                  <p>
                    Selecciona 2 jugadores de equipos diferentes para
                    intercambiarlos.
                  </p>
                  <p className='font-semibold'>
                    Jugadores seleccionados: {selectedPlayers.length}/2
                  </p>
                  {selectedPlayers.length > 0 && (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {selectedPlayers.map((player, index) => (
                        <span
                          key={player.id}
                          className='bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold'
                        >
                          {player.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación para intercambio con goles */}
        {showSwapConfirmModal && swapImpact && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div className='bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl'>
              <div className='flex items-center space-x-3 mb-4'>
                <ExclamationTriangleIcon className='h-8 w-8 text-amber-500' />
                <h3 className='text-lg font-semibold text-gray-900'>
                  ¡Atención! Cambio de Resultado
                </h3>
              </div>

              <div className='space-y-4 mb-6'>
                <p className='text-gray-700'>
                  El intercambio de <strong>{swapImpact.player1.name}</strong> y{' '}
                  <strong>{swapImpact.player2.name}</strong> afectará el
                  resultado del partido porque uno o ambos jugadores tienen
                  goles.
                </p>

                <div className='bg-gray-50 rounded-lg p-4'>
                  <div className='text-sm text-gray-600 mb-2'>
                    Cambio de resultado:
                  </div>
                  <div className='flex items-center justify-center space-x-4'>
                    <div className='text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Actual</div>
                      <div className='text-xl font-bold text-gray-800'>
                        {swapImpact.currentScore.scoreA} -{' '}
                        {swapImpact.currentScore.scoreB}
                      </div>
                    </div>
                    <div className='text-gray-400'>→</div>
                    <div className='text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Nuevo</div>
                      <div className='text-xl font-bold text-blue-600'>
                        {swapImpact.newScore.scoreA} -{' '}
                        {swapImpact.newScore.scoreB}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='text-sm text-gray-600'>
                  <strong>Goles afectados:</strong>{' '}
                  {swapImpact.affectedGoals.length}
                  <ul className='mt-1 ml-4 list-disc'>
                    {swapImpact.affectedGoals.map((goal, index) => (
                      <li key={goal.id}>
                        {goal.scorerName} (
                        {goal.isTeamA ? 'Equipo A' : 'Equipo B'})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className='flex space-x-3'>
                <Button
                  variant='outline'
                  onClick={() => {
                    setShowSwapConfirmModal(false);
                    setSwapImpact(null);
                  }}
                  className='flex-1'
                >
                  Cancelar
                </Button>
                <Button
                  variant='primary'
                  onClick={() => {
                    setShowSwapConfirmModal(false);
                    setSwapImpact(null);
                    executeSwapPlayers();
                  }}
                  className='flex-1'
                >
                  Confirmar Intercambio
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
