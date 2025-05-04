import { Participant, ParticipantStatus } from './participant';

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface MatchInterface {
  id: string;
  date: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
  }>;
  playersB?: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
  }>;
  confirmedPlayers?: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
  }>;
  tbdPlayers?: Array<{
    id: string;
    name: string;
    isTeamA: boolean;
    avatar: string | null;
  }>;
}

export interface Match {
  id: string;
  name: string;
  date: string;
  time: string;
  location: {
    address: string;
    lat: string;
    lng: string;
  };
  requiredPlayers: number;
  maxPlayers: number;
  recurrence: {
    type: RecurrenceType;
    endDate?: string;
  };
  participants: Participant[];
  history: {
    date: string;
    teamA: Participant[];
    teamB: Participant[];
    result: 'win' | 'loss' | 'draw';
    goals: {
      playerId: string;
      team: 'A' | 'B';
    }[];
  }[];
}
