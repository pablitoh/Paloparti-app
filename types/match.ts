import { Participant, ParticipantStatus } from './participant';

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

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
