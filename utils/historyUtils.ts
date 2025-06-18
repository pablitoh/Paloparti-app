// Utility functions for history tab functionality

export interface HistoryMatch {
  id: string;
  date: string | Date;
  createdAt?: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: HistoryPlayer[];
  playersB?: HistoryPlayer[];
  goals?: HistoryGoal[];
}

export interface HistoryPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
}

export interface HistoryGoal {
  id: string;
  isTeamA: boolean;
  scorerId: string;
  scorerName: string | null;
  scorerAvatar: string | null;
  minute?: number;
}

export const formatMatchDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getScoreForTeam = (
  match: HistoryMatch,
  isTeamA: boolean
): number => {
  return isTeamA ? match.scoreA : match.scoreB;
};

export const getPlayerGoals = (
  match: HistoryMatch,
  playerId: string
): number => {
  if (!match.goals) return 0;
  return match.goals.filter((goal) => goal.scorerId === playerId).length;
};

export const canEditMatch = (
  match: HistoryMatch,
  userIsAdmin: boolean
): boolean => {
  return userIsAdmin && match.status === 'COMPLETED';
};

export const validateScore = (scoreA: number, scoreB: number): boolean => {
  return scoreA >= 0 && scoreB >= 0 && scoreA <= 99 && scoreB <= 99;
};

export const formatEditMessage = (action: string, details: any): string => {
  switch (action) {
    case 'MATCH_RESULT_EDITED':
      if (details.action === 'goals_updated') {
        return `Goles actualizados - ${details.teamAName} vs ${details.teamBName}`;
      }
      if (details.previousScore && details.newScore) {
        const prevScore = `${details.previousScore.scoreA}-${details.previousScore.scoreB}`;
        const newScore = `${details.newScore.scoreA}-${details.newScore.scoreB}`;
        return `Resultado actualizado de ${prevScore} a ${newScore} - ${details.teamAName} vs ${details.teamBName}`;
      }
      return `Resultado del partido editado - ${details.teamAName} vs ${details.teamBName}`;

    case 'PLAYER_SWAPPED':
      return `Jugadores intercambiados: ${details.player1.name} (${details.player1.originalTeam} → ${details.player1.newTeam}) ↔ ${details.player2.name} (${details.player2.originalTeam} → ${details.player2.newTeam})`;

    default:
      return 'Acción realizada en el historial';
  }
};
