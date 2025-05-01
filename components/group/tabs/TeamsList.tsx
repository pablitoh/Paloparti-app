import React from 'react';
import { Avatar } from '@mui/material';
import { UserIcon } from '@heroicons/react/24/outline';
import { UserPlusIcon } from '@heroicons/react/24/outline';

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
}

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType?: string;
}

interface TeamsListProps {
  playersA: Player[];
  playersB: Player[];
  tbdPlayers?: TbdPlayer[];
  teamAName: string;
  teamBName: string;
  currentUserIsAdmin: boolean;
  onReplaceTbd?: (playerId: string) => void;
}

interface PlayerItemProps {
  player: Player | TbdPlayer;
  isTbd?: boolean;
  showReplaceButton?: boolean;
}

interface TeamSectionProps {
  players: Player[];
  tbdPlayers: TbdPlayer[];
  teamName: string;
  colorClass: string;
}

const TeamsList: React.FC<TeamsListProps> = ({
  playersA,
  playersB,
  tbdPlayers = [],
  teamAName,
  teamBName,
  currentUserIsAdmin,
  onReplaceTbd,
}) => {
  // Filter TBD players by team
  const teamATbdPlayers = tbdPlayers.filter((player) => player.isTeamA);
  const teamBTbdPlayers = tbdPlayers.filter((player) => !player.isTeamA);

  // Componente reutilizable para un jugador
  const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    isTbd = false,
    showReplaceButton = false,
  }) => (
    <li className='py-2 flex items-center justify-between'>
      <div className='flex items-center gap-2 sm:gap-3'>
        {isTbd ? (
          <div className='h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-200 flex items-center justify-center'>
            <UserIcon className='h-5 w-5 sm:h-6 sm:w-6 text-gray-500' />
          </div>
        ) : (
          <Avatar
            src={player.avatar || ''}
            alt={player.name || 'Jugador'}
            className='h-8 w-8 sm:h-10 sm:w-10 rounded-full'
          />
        )}
        <div className='min-w-0'>
          <p className='font-medium text-gray-800 text-sm sm:text-base truncate max-w-[120px] sm:max-w-full'>
            {player.name || (isTbd ? 'TBD' : 'Jugador sin nombre')}
          </p>
          {(player.playerType === 'TBD' || isTbd) && (
            <span className='text-xs text-gray-500 italic'>
              Jugador pendiente
            </span>
          )}
        </div>
      </div>

      {showReplaceButton && currentUserIsAdmin && onReplaceTbd && (
        <button
          onClick={() => onReplaceTbd(player.id)}
          className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
          title='Reemplazar jugador'
        >
          <UserPlusIcon className='h-4 w-4 sm:h-5 sm:w-5' />
        </button>
      )}
    </li>
  );

  // Componente para un equipo
  const TeamSection: React.FC<TeamSectionProps> = ({
    players,
    tbdPlayers,
    teamName,
    colorClass,
  }) => (
    <div className='p-4 w-full'>
      <div className='text-center mb-4'>
        <h3 className={`text-lg sm:text-xl font-bold ${colorClass}`}>
          {teamName}
        </h3>
      </div>

      <ul className='divide-y divide-gray-100'>
        {/* Regular players */}
        {players.map((player) => (
          <PlayerItem
            key={player.id}
            player={player}
            showReplaceButton={player.playerType === 'TBD'}
          />
        ))}

        {/* TBD players */}
        {tbdPlayers.map((player) => (
          <PlayerItem
            key={player.id}
            player={player}
            isTbd={true}
            showReplaceButton={true}
          />
        ))}
      </ul>
    </div>
  );

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
      {/* En móvil: equipos apilados verticalmente */}
      {/* En tablet/desktop: equipos lado a lado */}
      <div className='flex flex-col md:flex-row md:justify-center'>
        {/* Team A */}
        <div className='w-full md:w-1/2 md:border-r md:border-gray-200'>
          <TeamSection
            players={playersA}
            tbdPlayers={teamATbdPlayers}
            teamName={teamAName || 'Equipo A'}
            colorClass='text-blue-600'
          />
        </div>

        {/* Separador visual en móvil */}
        <div className='border-t border-gray-200 md:hidden'></div>

        {/* Team B */}
        <div className='w-full md:w-1/2'>
          <TeamSection
            players={playersB}
            tbdPlayers={teamBTbdPlayers}
            teamName={teamBName || 'Equipo B'}
            colorClass='text-red-600'
          />
        </div>
      </div>
    </div>
  );
};

export default TeamsList;
