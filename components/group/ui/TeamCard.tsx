import React from 'react';

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  position?: string;
}

interface Team {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  captainId?: string;
  members: TeamMember[];
  wins?: number;
  losses?: number;
  draws?: number;
}

interface TeamCardProps {
  team: Team;
  compact?: boolean;
  onClick?: () => void;
  showStats?: boolean;
}

export default function TeamCard({
  team,
  compact = false,
  onClick,
  showStats = true,
}: TeamCardProps) {
  const teamColor = team.color || 'bg-blue-500';
  const textColorClass = 'text-white';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg shadow-sm overflow-hidden ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div
        className={`${teamColor} ${textColorClass} p-3 flex items-center justify-between`}
      >
        <div className='flex items-center gap-2'>
          {team.logo ? (
            <img
              src={team.logo}
              alt={team.name}
              className='w-8 h-8 rounded-full bg-white p-0.5'
            />
          ) : (
            <div className='w-8 h-8 rounded-full bg-white flex items-center justify-center'>
              <span className='text-sm font-bold text-gray-800'>
                {team.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <h3 className='font-medium'>{team.name}</h3>
        </div>

        {showStats && (
          <div className='flex gap-2 text-xs'>
            <span className='bg-white bg-opacity-20 px-2 py-1 rounded'>
              {team.wins || 0}V
            </span>
            <span className='bg-white bg-opacity-20 px-2 py-1 rounded'>
              {team.draws || 0}E
            </span>
            <span className='bg-white bg-opacity-20 px-2 py-1 rounded'>
              {team.losses || 0}D
            </span>
          </div>
        )}
      </div>

      {!compact && (
        <div className='bg-white p-3'>
          <h4 className='text-xs text-gray-500 mb-2'>
            Jugadores ({team.members.length})
          </h4>
          <div className='flex flex-wrap gap-1'>
            {team.members.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className='flex items-center bg-gray-50 rounded-full pl-1 pr-2 py-1'
              >
                <div className='w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-1'>
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <span className='text-gray-400 text-xs'>👤</span>
                  )}
                </div>
                <span className='text-xs text-gray-700'>
                  {member.name}
                  {team.captainId === member.id && (
                    <span className='text-yellow-500 ml-1'>©</span>
                  )}
                </span>
              </div>
            ))}
            {team.members.length > 5 && (
              <div className='flex items-center bg-gray-50 rounded-full px-2 py-1'>
                <span className='text-xs text-gray-700'>
                  +{team.members.length - 5} más
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
