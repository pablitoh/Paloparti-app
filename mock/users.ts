export interface UserProfile {
  id: string;
  name: string;
  birthdate: string;
  position: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
  favoritePosition: string;
  joinDate: string;
  lastMatch: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export const mockProfiles: Record<string, UserProfile> = {
  '1': {
    id: '1',
    name: 'Juan Pérez',
    birthdate: '1996-04-15',
    position: 'Delantero',
    matchesPlayed: 45,
    goals: 32,
    assists: 15,
    favoritePosition: 'Delantero Centro',
    joinDate: '2023-01-15',
    lastMatch: '2024-03-10',
    wins: 20,
    losses: 10,
    draws: 5,
    winRate: 66.67,
  },
  '2': {
    id: '2',
    name: 'Carlos López',
    birthdate: '1989-08-20',
    position: 'Mediocampista',
    matchesPlayed: 38,
    goals: 12,
    assists: 25,
    favoritePosition: 'Mediocampista Central',
    joinDate: '2023-02-20',
    lastMatch: '2024-03-10',
    wins: 15,
    losses: 10,
    draws: 3,
    winRate: 50,
  },
  '3': {
    id: '3',
    name: 'Pedro Sánchez',
    birthdate: '1982-02-10',
    position: 'Defensa',
    matchesPlayed: 52,
    goals: 5,
    assists: 8,
    favoritePosition: 'Defensa Central',
    joinDate: '2023-01-05',
    lastMatch: '2024-03-10',
    wins: 10,
    losses: 5,
    draws: 2,
    winRate: 33.33,
  },
};
