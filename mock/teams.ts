export interface Player {
  id: string;
  name: string;
  avatar?: string;
  isCaptain?: boolean;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

export const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Equipo A',
    players: [
      {
        id: '1',
        name: 'Juan Pérez',
        avatar: 'https://i.pravatar.cc/150?img=1',
        isCaptain: true,
      },
      {
        id: '2',
        name: 'Carlos López',
        avatar: 'https://i.pravatar.cc/150?img=2',
      },
      {
        id: '3',
        name: 'Pedro Sánchez',
        avatar: 'https://i.pravatar.cc/150?img=3',
      },
      {
        id: '4',
        name: 'Miguel Ángel',
        avatar: 'https://i.pravatar.cc/150?img=4',
      },
      {
        id: '5',
        name: 'Antonio Ruiz',
        avatar: 'https://i.pravatar.cc/150?img=5',
      },
    ],
  },
  {
    id: '2',
    name: 'Equipo B',
    players: [
      {
        id: '6',
        name: 'David García',
        avatar: 'https://i.pravatar.cc/150?img=6',
        isCaptain: true,
      },
      {
        id: '7',
        name: 'Luis Martínez',
        avatar: 'https://i.pravatar.cc/150?img=7',
      },
      {
        id: '8',
        name: 'Javier Rodríguez',
        avatar: 'https://i.pravatar.cc/150?img=8',
      },
      {
        id: '9',
        name: 'Manuel Torres',
        avatar: 'https://i.pravatar.cc/150?img=9',
      },
      {
        id: '10',
        name: 'Francisco Jiménez',
        avatar: 'https://i.pravatar.cc/150?img=10',
      },
    ],
  },
];
