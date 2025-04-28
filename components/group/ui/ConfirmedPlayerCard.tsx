import React from 'react';
import { useRouter } from 'next/router';

interface Player {
  id: string;
  name: string;
  avatar?: string;
  position?: string;
  number?: number;
}

interface ConfirmedPlayerCardProps {
  player: Player;
  isCaptain?: boolean;
  goals?: number;
  onRemove?: () => void;
}

export default function ConfirmedPlayerCard({
  player,
  isCaptain = false,
  goals = 0,
  onRemove,
}: ConfirmedPlayerCardProps) {
  const router = useRouter();

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/profile/${player.id}`);
  };

  return (
    <div className='flex items-center justify-between p-3 bg-white rounded-lg shadow-sm'>
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden'>
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-gray-400'>👤</span>
          )}
        </div>
        <div className='flex flex-col'>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleProfileClick}
              className='text-sm font-medium text-gray-700 hover:text-gray-900'
            >
              {player.name}
            </button>
            {isCaptain && (
              <span className='text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full'>
                Capitán
              </span>
            )}
          </div>
          <div className='flex items-center gap-2 text-xs text-gray-500'>
            {player.position && <span>{player.position}</span>}
            {player.number && <span>#{player.number}</span>}
          </div>
        </div>
      </div>
      <div className='flex items-center gap-3'>
        {goals > 0 && (
          <div className='flex gap-1 items-center'>
            <span className='text-sm'>⚽</span>
            <span className='text-xs font-medium'>{goals}</span>
          </div>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className='text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
