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

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
      <div className='flex items-stretch'>
        {/* Team A */}
        <div className='flex-1 p-4 border-r border-gray-200'>
          <div className='text-center mb-4'>
            <h3 className='text-xl font-bold text-blue-600'>
              {teamAName || 'Equipo A'}
            </h3>
          </div>

          <ul className='divide-y divide-gray-100'>
            {/* Regular players */}
            {playersA.map((player) => (
              <li
                key={player.id}
                className='py-2 flex items-center justify-between'
              >
                <div className='flex items-center gap-3'>
                  <Avatar
                    src={player.avatar || ''}
                    alt={player.name || 'Jugador'}
                    className='h-10 w-10 rounded-full'
                  />
                  <div>
                    <p className='font-medium text-gray-800'>
                      {player.name || 'Jugador sin nombre'}
                    </p>
                    {player.playerType === 'TBD' && (
                      <span className='text-xs text-gray-500 italic'>
                        Jugador pendiente
                      </span>
                    )}
                  </div>
                </div>

                {player.playerType === 'TBD' &&
                  currentUserIsAdmin &&
                  onReplaceTbd && (
                    <button
                      onClick={() => onReplaceTbd(player.id)}
                      className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
                      title='Reemplazar jugador'
                    >
                      <UserPlusIcon className='h-5 w-5' />
                    </button>
                  )}
              </li>
            ))}

            {/* TBD players for Team A */}
            {teamATbdPlayers.map((player) => (
              <li
                key={player.id}
                className='py-2 flex items-center justify-between'
              >
                <div className='flex items-center gap-3'>
                  <div className='h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center'>
                    <UserIcon className='h-6 w-6 text-gray-500' />
                  </div>
                  <div>
                    <p className='font-medium text-gray-800'>
                      {player.name || 'TBD'}
                    </p>
                    <span className='text-xs text-gray-500 italic'>
                      Jugador pendiente
                    </span>
                  </div>
                </div>

                {currentUserIsAdmin && onReplaceTbd && (
                  <button
                    onClick={() => onReplaceTbd(player.id)}
                    className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
                    title='Reemplazar jugador'
                  >
                    <UserPlusIcon className='h-5 w-5' />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Team B */}
        <div className='flex-1 p-4'>
          <div className='text-center mb-4'>
            <h3 className='text-xl font-bold text-red-600'>
              {teamBName || 'Equipo B'}
            </h3>
          </div>

          <ul className='divide-y divide-gray-100'>
            {/* Regular players */}
            {playersB.map((player) => (
              <li
                key={player.id}
                className='py-2 flex items-center justify-between'
              >
                <div className='flex items-center gap-3'>
                  <Avatar
                    src={player.avatar || ''}
                    alt={player.name || 'Jugador'}
                    className='h-10 w-10 rounded-full'
                  />
                  <div>
                    <p className='font-medium text-gray-800'>
                      {player.name || 'Jugador sin nombre'}
                    </p>
                    {player.playerType === 'TBD' && (
                      <span className='text-xs text-gray-500 italic'>
                        Jugador pendiente
                      </span>
                    )}
                  </div>
                </div>

                {player.playerType === 'TBD' &&
                  currentUserIsAdmin &&
                  onReplaceTbd && (
                    <button
                      onClick={() => onReplaceTbd(player.id)}
                      className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
                      title='Reemplazar jugador'
                    >
                      <UserPlusIcon className='h-5 w-5' />
                    </button>
                  )}
              </li>
            ))}

            {/* TBD players for Team B */}
            {teamBTbdPlayers.map((player) => (
              <li
                key={player.id}
                className='py-2 flex items-center justify-between'
              >
                <div className='flex items-center gap-3'>
                  <div className='h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center'>
                    <UserIcon className='h-6 w-6 text-gray-500' />
                  </div>
                  <div>
                    <p className='font-medium text-gray-800'>
                      {player.name || 'TBD'}
                    </p>
                    <span className='text-xs text-gray-500 italic'>
                      Jugador pendiente
                    </span>
                  </div>
                </div>

                {currentUserIsAdmin && onReplaceTbd && (
                  <button
                    onClick={() => onReplaceTbd(player.id)}
                    className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
                    title='Reemplazar jugador'
                  >
                    <UserPlusIcon className='h-5 w-5' />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamsList;
