import { PrismaClient } from '@prisma/client';

export interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  playerRoles?: string[];
  age?: number | null;
  isTeamA?: boolean;
}

export interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  playerRoles?: string[];
  avatar?: string | null;
  age?: number | null;
}

export interface Goal {
  id: string;
  isTeamA: boolean;
  scorerId: string;
  scorerName: string | null;
  scorerAvatar: string | null;
  minute?: number;
}

export interface MatchInterface {
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
  tbdPlayers?: Player[];
  goals?: Goal[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  groupId?: string;
  goalsA?: Goal[];
  goalsB?: Goal[];
}

export interface GroupMember {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  teamAName?: string;
  teamBName?: string;
  requiredPlayers?: number;
  recurrenceType?: 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  recurrenceDays?: number[];
  recurrenceTime?: string;
  inviteToken?: string;
  createdBy: string;
  isAdmin?: boolean;
  userStatus?: string;
  nextMatchId?: string;
  nextMatchDetails?: MatchInterface;
  members?: GroupMember[];
  pendingRequests?: Array<{
    id: string;
    userId: string;
    name: string;
    email?: string;
    avatar?: string;
  }>;
}

export interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface ExtendedMember extends Member {
  isCaptain: boolean;
  votedForResort: boolean;
}

export interface GroupWithRelations {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  teamAName: string;
  teamBName: string;
  recurrenceType: string | null;
  recurrenceDays: number[];
  recurrenceTime: string | null;
  requiredPlayers: number;
  inviteToken: string | null;
  members: Member[];
  matches: MatchInterface[];
  createdAt: Date;
  createdBy: string;
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  nextMatch: Date | null;
  nextMatchId: string | null;
  nextMatchDetails: MatchInterface | null;
  totalMatches: number;
  userStatus?: string;
  message?: string;
}

export interface Participant extends ExtendedMember {
  isCaptain: boolean;
  votedForResort: boolean;
}

export type ParticipantStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'DECLINED'
  | 'confirmed'
  | 'pending'
  | 'declined';

export interface TbdPlayersData {
  teamA: TbdPlayer[];
  teamB: TbdPlayer[];
}

export interface MatchDetails {
  id: string;
  date: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA: Player[];
  playersB: Player[];
  confirmedPlayers: Player[];
  tbdPlayers: Player[];
}
