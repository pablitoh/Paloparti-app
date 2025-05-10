import { Participant } from '../types/participant';

export interface MatchHistory {
  id: string;
  date: string;
  teamA: Participant[];
  teamB: Participant[];
  result: 'win' | 'loss' | 'draw';
  goals: { playerId: string; team: 'A' | 'B' }[];
}

export interface UserStats {
  id: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalGoals: number;
  totalAssists: number;
  averageGoals: number;
  averageAssists: number;
  winRate: number;
  history: MatchHistory[];
}

export const mockStats: Record<string, UserStats> = {
  '1': {
    id: '1',
    name: 'Juan Pérez',
    matchesPlayed: 45,
    wins: 28,
    losses: 12,
    draws: 5,
    totalGoals: 32,
    totalAssists: 15,
    averageGoals: 0.71,
    averageAssists: 0.33,
    winRate: 62.2,
    history: [
      {
        id: '1',
        date: '2024-03-15',
        teamA: [
          {
            id: '1',
            name: 'Juan Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=1',
            isCaptain: true,
          },
          {
            id: '2',
            name: 'Carlos López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=2',
            isCaptain: false,
          },
          {
            id: '3',
            name: 'Pedro Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=3',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '4',
            name: 'Miguel Ángel',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=4',
            isCaptain: true,
          },
          {
            id: '5',
            name: 'Antonio Ruiz',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=5',
            isCaptain: false,
          },
          {
            id: '6',
            name: 'David García',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=6',
            isCaptain: false,
          },
        ],
        result: 'win',
        goals: [
          { playerId: '1', team: 'A' },
          { playerId: '1', team: 'A' },
          { playerId: '2', team: 'A' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
          { playerId: '4', team: 'B' },
        ],
      },
      {
        id: '2',
        date: '2024-03-10',
        teamA: [
          {
            id: '1',
            name: 'Juan Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=1',
            isCaptain: true,
          },
          {
            id: '7',
            name: 'Luis Martínez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=7',
            isCaptain: false,
          },
          {
            id: '8',
            name: 'Javier Rodríguez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=8',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '2',
            name: 'Carlos López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=2',
            isCaptain: true,
          },
          {
            id: '9',
            name: 'Manuel Torres',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=9',
            isCaptain: false,
          },
          {
            id: '10',
            name: 'Francisco Jiménez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=10',
            isCaptain: false,
          },
        ],
        result: 'draw',
        goals: [
          { playerId: '1', team: 'A' },
          { playerId: '2', team: 'B' },
        ],
      },
    ],
  },
  '2': {
    id: '2',
    name: 'Carlos López',
    matchesPlayed: 38,
    wins: 22,
    losses: 10,
    draws: 6,
    totalGoals: 12,
    totalAssists: 25,
    averageGoals: 0.32,
    averageAssists: 0.66,
    winRate: 57.9,
    history: [
      {
        id: '3',
        date: '2024-03-12',
        teamA: [
          {
            id: '2',
            name: 'Carlos López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=2',
            isCaptain: true,
          },
          {
            id: '11',
            name: 'José Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=11',
            isCaptain: false,
          },
          {
            id: '12',
            name: 'Ángel Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=12',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '1',
            name: 'Juan Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=1',
            isCaptain: true,
          },
          {
            id: '13',
            name: 'Diego Martín',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=13',
            isCaptain: false,
          },
          {
            id: '14',
            name: 'Sergio García',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=14',
            isCaptain: false,
          },
        ],
        result: 'loss',
        goals: [
          { playerId: '2', team: 'A' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
          { playerId: '1', team: 'B' },
        ],
      },
      {
        id: '4',
        date: '2024-03-08',
        teamA: [
          {
            id: '2',
            name: 'Carlos López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=2',
            isCaptain: true,
          },
          {
            id: '15',
            name: 'Pablo Ruiz',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=15',
            isCaptain: false,
          },
          {
            id: '16',
            name: 'Alberto Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=16',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '3',
            name: 'Pedro Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=3',
            isCaptain: true,
          },
          {
            id: '17',
            name: 'Raúl Martínez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=17',
            isCaptain: false,
          },
          {
            id: '18',
            name: 'Jorge Rodríguez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=18',
            isCaptain: false,
          },
        ],
        result: 'win',
        goals: [
          { playerId: '2', team: 'A' },
          { playerId: '15', team: 'A' },
          { playerId: '3', team: 'B' },
        ],
      },
    ],
  },
  '3': {
    id: '3',
    name: 'Pedro Sánchez',
    matchesPlayed: 42,
    wins: 25,
    losses: 11,
    draws: 6,
    totalGoals: 28,
    totalAssists: 18,
    averageGoals: 0.67,
    averageAssists: 0.43,
    winRate: 59.5,
    history: [
      {
        id: '5',
        date: '2024-03-14',
        teamA: [
          {
            id: '3',
            name: 'Pedro Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=3',
            isCaptain: true,
          },
          {
            id: '19',
            name: 'Fernando López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=19',
            isCaptain: false,
          },
          {
            id: '20',
            name: 'Ricardo García',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=20',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '2',
            name: 'Carlos López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=2',
            isCaptain: true,
          },
          {
            id: '21',
            name: 'Roberto Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=21',
            isCaptain: false,
          },
          {
            id: '22',
            name: 'Eduardo Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=22',
            isCaptain: false,
          },
        ],
        result: 'win',
        goals: [
          { playerId: '3', team: 'A' },
          { playerId: '3', team: 'A' },
          { playerId: '19', team: 'A' },
          { playerId: '2', team: 'B' },
        ],
      },
      {
        id: '6',
        date: '2024-03-09',
        teamA: [
          {
            id: '3',
            name: 'Pedro Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=3',
            isCaptain: true,
          },
          {
            id: '23',
            name: 'Miguel Sánchez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=23',
            isCaptain: false,
          },
          {
            id: '24',
            name: 'Javier Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=24',
            isCaptain: false,
          },
        ],
        teamB: [
          {
            id: '1',
            name: 'Juan Pérez',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=1',
            isCaptain: true,
          },
          {
            id: '25',
            name: 'Antonio García',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=25',
            isCaptain: false,
          },
          {
            id: '26',
            name: 'David López',
            status: 'confirmed',
            avatar: 'https://i.pravatar.cc/150?img=26',
            isCaptain: false,
          },
        ],
        result: 'draw',
        goals: [
          { playerId: '3', team: 'A' },
          { playerId: '1', team: 'B' },
        ],
      },
    ],
  },
};
