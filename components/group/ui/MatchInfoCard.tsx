import React from 'react';

interface Match {
  id: string;
  title?: string;
  date: Date | string;
  location: string;
  confirmedPlayers: number;
  maxPlayers: number;
  status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  price?: number;
}

interface MatchInfoCardProps {
  match: Match;
  onViewDetails?: () => void;
  onJoin?: () => void;
  isUserJoined?: boolean;
}

export default function MatchInfoCard({
  match,
  onViewDetails,
  onJoin,
  isUserJoined = false,
}: MatchInfoCardProps) {
  const matchDate =
    typeof match.date === 'string' ? new Date(match.date) : match.date;

  const formattedDate = matchDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedTime = matchDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusStyles = {
    upcoming: 'bg-blue-100 text-blue-800',
    ongoing: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const statusText = {
    upcoming: 'Próximo',
    ongoing: 'En curso',
    completed: 'Finalizado',
    cancelled: 'Cancelado',
  };

  return (
    <div className='bg-white rounded-lg shadow-sm p-4'>
      <div className='flex justify-between items-start mb-3'>
        <h3 className='font-medium text-gray-900'>
          {match.title || 'Partido'}
        </h3>
        {match.status && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              statusStyles[match.status]
            }`}
          >
            {statusText[match.status]}
          </span>
        )}
      </div>

      <div className='space-y-2 mb-4'>
        <div className='flex items-center text-sm text-gray-600'>
          <svg
            className='w-4 h-4 mr-2 text-gray-500'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
          <span className='capitalize'>{formattedDate}</span>
        </div>

        <div className='flex items-center text-sm text-gray-600'>
          <svg
            className='w-4 h-4 mr-2 text-gray-500'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <span>{formattedTime}</span>
        </div>

        <div className='flex items-center text-sm text-gray-600'>
          <svg
            className='w-4 h-4 mr-2 text-gray-500'
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
          <span>{match.location}</span>
        </div>

        {match.price && (
          <div className='flex items-center text-sm text-gray-600'>
            <svg
              className='w-4 h-4 mr-2 text-gray-500'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span>{match.price} €</span>
          </div>
        )}
      </div>

      <div className='flex items-center mb-4'>
        <div className='w-full bg-gray-200 rounded-full h-2.5'>
          <div
            className='bg-blue-600 h-2.5 rounded-full'
            style={{
              width: `${(match.confirmedPlayers / match.maxPlayers) * 100}%`,
            }}
          ></div>
        </div>
        <span className='ml-2 text-sm text-gray-500'>
          {match.confirmedPlayers}/{match.maxPlayers}
        </span>
      </div>

      <div className='flex gap-2'>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className='text-sm text-blue-600 hover:text-blue-800 font-medium'
          >
            Ver detalles
          </button>
        )}

        {onJoin && !isUserJoined && (
          <button
            onClick={onJoin}
            className='ml-auto text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded'
          >
            Unirme
          </button>
        )}

        {isUserJoined && (
          <span className='ml-auto text-sm text-green-600 font-medium flex items-center'>
            <svg
              className='w-4 h-4 mr-1'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 13l4 4L19 7'
              />
            </svg>
            Confirmado
          </span>
        )}
      </div>
    </div>
  );
}
