import React from 'react';

interface Team {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  score?: number;
}

interface MatchTime {
  date: Date | string;
  status?: 'upcoming' | 'live' | 'halftime' | 'finished' | 'postponed';
  minute?: number;
  period?: string;
}

interface TeamVsCardProps {
  teamA: Team;
  teamB: Team;
  matchTime: MatchTime;
  location?: string;
  onClick?: () => void;
  compact?: boolean;
}

export default function TeamVsCard({
  teamA,
  teamB,
  matchTime,
  location,
  onClick,
  compact = false,
}: TeamVsCardProps) {
  const matchDate =
    typeof matchTime.date === 'string'
      ? new Date(matchTime.date)
      : matchTime.date;

  const isUpcoming = matchTime.status === 'upcoming';
  const isLive = matchTime.status === 'live' || matchTime.status === 'halftime';
  const isFinished = matchTime.status === 'finished';

  const formattedDate = matchDate.toLocaleDateString('es-ES', {
    weekday: compact ? undefined : 'long',
    day: 'numeric',
    month: compact ? 'numeric' : 'long',
  });

  const formattedTime = matchDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusLabel = {
    upcoming: 'Próximamente',
    live: `En directo: ${matchTime.minute}'`,
    halftime: 'Descanso',
    finished: 'Finalizado',
    postponed: 'Aplazado',
  };

  const statusClass = {
    upcoming: 'bg-blue-100 text-blue-800',
    live: 'bg-red-100 text-red-800',
    halftime: 'bg-yellow-100 text-yellow-800',
    finished: 'bg-gray-100 text-gray-800',
    postponed: 'bg-purple-100 text-purple-800',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm p-3 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      {!compact && (
        <div className='flex justify-between items-center mb-3'>
          <div className='text-sm text-gray-500'>
            {formattedDate} • {formattedTime}
          </div>
          {matchTime.status && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                statusClass[matchTime.status]
              }`}
            >
              {statusLabel[matchTime.status]}
            </span>
          )}
        </div>
      )}

      <div className='flex items-center justify-between'>
        {/* Team A */}
        <div className='flex flex-col items-center w-2/5'>
          <div
            className={`w-10 h-10 ${
              teamA.color || 'bg-blue-500'
            } rounded-full flex items-center justify-center mb-2`}
          >
            {teamA.logo ? (
              <img
                src={teamA.logo}
                alt={teamA.name}
                className='w-8 h-8 rounded-full bg-white p-0.5'
              />
            ) : (
              <span className='text-white font-bold'>
                {teamA.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className='text-sm font-medium text-gray-800 text-center'>
            {teamA.name}
          </h3>
        </div>

        {/* Score / VS */}
        <div className='flex flex-col items-center justify-center w-1/5'>
          {compact && matchTime.status && (
            <span
              className={`text-xs mb-1 px-2 py-0.5 rounded-full ${
                statusClass[matchTime.status]
              }`}
            >
              {matchTime.status === 'live' ? `${matchTime.minute}'` : ''}
            </span>
          )}

          {(isLive || isFinished) &&
          typeof teamA.score === 'number' &&
          typeof teamB.score === 'number' ? (
            <div className='flex items-center'>
              <span className='text-lg font-bold text-gray-800'>
                {teamA.score}
              </span>
              <span className='text-xs text-gray-400 mx-1'>-</span>
              <span className='text-lg font-bold text-gray-800'>
                {teamB.score}
              </span>
            </div>
          ) : (
            <>
              {compact ? (
                <span className='text-sm text-gray-500'>vs</span>
              ) : (
                <div className='flex flex-col items-center'>
                  <span className='text-sm text-gray-500 mb-1'>vs</span>
                  <span className='text-xs text-gray-400'>{formattedTime}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Team B */}
        <div className='flex flex-col items-center w-2/5'>
          <div
            className={`w-10 h-10 ${
              teamB.color || 'bg-red-500'
            } rounded-full flex items-center justify-center mb-2`}
          >
            {teamB.logo ? (
              <img
                src={teamB.logo}
                alt={teamB.name}
                className='w-8 h-8 rounded-full bg-white p-0.5'
              />
            ) : (
              <span className='text-white font-bold'>
                {teamB.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className='text-sm font-medium text-gray-800 text-center'>
            {teamB.name}
          </h3>
        </div>
      </div>

      {location && !compact && (
        <div className='mt-3 text-xs text-gray-500 text-center'>
          <svg
            className='w-3 h-3 inline-block mr-1'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
            />
          </svg>
          {location}
        </div>
      )}
    </div>
  );
}
