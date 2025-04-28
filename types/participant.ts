export type ParticipantStatus =
  | 'confirmed'
  | 'pending'
  | 'declined'
  | 'waiting';

export interface Participant {
  id: string;
  userId?: string;
  name: string;
  status: ParticipantStatus;
  avatar?: string | null;
  isCaptain: boolean;
  isReferee?: boolean;
  age?: number;
  favoritePosition?: string;
  joinDate?: string;
  lastMatch?: string;
  matchesPlayed?: number;
  goals?: number;
  assists?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  winRate?: number;
  isPlaceholder?: boolean;
  votedForResort?: boolean;
  role?: string;
}
