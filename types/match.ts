import { PlayerRoleType } from '../lib/teambuilder/types';

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface PlayerRole {
  role: PlayerRoleType;
  priority: number;
}

export interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  playerRoles?: PlayerRole[];
  assignedRole?: PlayerRoleType;
  age?: number | null;
  isTeamA?: boolean;
  starRating?: number;
  birthdate?: string | Date | null;
  positionForced?: boolean;
}

export interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
  playerRoles?: PlayerRole[];
  assignedRole?: PlayerRoleType;
  positionForced?: boolean;
  starRating?: number;
}

export interface MatchInterface {
  id: string;
  date: string | Date;
  location: string;
  teamA: string | Player[];
  teamB: string | Player[];
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Player[];
  playersB?: Player[];
  confirmedPlayers?: Player[];
  tbdPlayers?: TbdPlayer[] | { teamA: TbdPlayer[]; teamB: TbdPlayer[] };
  pendingPlayers?: Player[];
  declinedPlayers?: Player[];
  sortCount?: number;
  teamAAvgAge?: number;
  teamBAvgAge?: number;
  unassignedCount?: number;
}

export interface Participant extends Player {
  status?: string;
  roles?: PlayerRole[];
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
