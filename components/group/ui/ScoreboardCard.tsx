import React from 'react';

interface ScoringEvent {
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
  type: 'goal' | 'own_goal' | 'penalty';
  assistPlayerId?: string;
  assistPlayerName?: string;
}

interface Team {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  score: number;
}

interface ScoreboardCardProps {
  teamA: Team;
  teamB: Team;
  scoringEvents: ScoringEvent[];
  matchStatus: 'upcoming' | 'live' | 'halftime' | 'finished' | 'postponed';
  currentMinute?: number;
  onClose?: () => void;
}

export default function ScoreboardCard({
  teamA,
  teamB,
  scoringEvents,
  matchStatus,
  currentMinute,
  onClose,
}: ScoreboardCardProps) {
  const teamAEvents = scoringEvents.filter(
    (event) => event.teamId === teamA.id
  );
  const teamBEvents = scoringEvents.filter(
    (event) => event.teamId === teamB.id
  );

  const getEventIcon = (type: ScoringEvent['type']) => {
    switch (type) {
      case 'goal':
        return '⚽';
      case 'penalty':
        return '🎯';
      case 'own_goal':
        return '🤦‍♂️';
      default:
        return '⚽';
    }
  };

  const statusLabel = {
    upcoming: 'Próximamente',
    live: `En directo: ${currentMinute}'`,
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
    <div className='bg-white rounded-lg shadow-sm p-4'>
      {/* Header con botón de cerrar */}
      <div className='flex justify-between items-center mb-4'>
        <div>
          <span
            className={`text-xs px-2 py-1 rounded-full ${statusClass[matchStatus]}`}
          >
            {statusLabel[matchStatus]}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
          >
            <svg
              className='w-5 h-5'
              xmlns='http://www.w3.org/2000/svg'
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

      {/* Teams and score */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex flex-col items-center w-2/5'>
          <div
            className={`w-12 h-12 ${
              teamA.color || 'bg-blue-500'
            } rounded-full flex items-center justify-center mb-2`}
          >
            {teamA.logo ? (
              <img
                src={teamA.logo}
                alt={teamA.name}
                className='w-10 h-10 rounded-full bg-white p-0.5'
              />
            ) : (
              <span className='text-white font-bold'>
                {teamA.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className='text-sm font-medium text-center'>{teamA.name}</h3>
        </div>

        <div className='flex items-center justify-center w-1/5'>
          <span className='text-3xl font-bold'>{teamA.score}</span>
          <span className='text-gray-300 mx-1'>-</span>
          <span className='text-3xl font-bold'>{teamB.score}</span>
        </div>

        <div className='flex flex-col items-center w-2/5'>
          <div
            className={`w-12 h-12 ${
              teamB.color || 'bg-red-500'
            } rounded-full flex items-center justify-center mb-2`}
          >
            {teamB.logo ? (
              <img
                src={teamB.logo}
                alt={teamB.name}
                className='w-10 h-10 rounded-full bg-white p-0.5'
              />
            ) : (
              <span className='text-white font-bold'>
                {teamB.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className='text-sm font-medium text-center'>{teamB.name}</h3>
        </div>
      </div>

      {/* Goles */}
      {scoringEvents.length > 0 ? (
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <h4 className='text-xs font-medium text-gray-500 mb-2'>
              Goles {teamA.name}
            </h4>
            {teamAEvents.length > 0 ? (
              <ul className='space-y-2'>
                {teamAEvents.map((event, index) => (
                  <li key={index} className='flex items-center text-sm'>
                    <span className='mr-1'>{getEventIcon(event.type)}</span>
                    <span className='font-medium'>{event.playerName}</span>
                    <span className='text-gray-400 ml-1'>{event.minute}'</span>
                    {event.assistPlayerName && (
                      <span className='text-xs text-gray-500 ml-1'>
                        (Asist: {event.assistPlayerName})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-gray-400'>Sin goles</p>
            )}
          </div>

          <div>
            <h4 className='text-xs font-medium text-gray-500 mb-2'>
              Goles {teamB.name}
            </h4>
            {teamBEvents.length > 0 ? (
              <ul className='space-y-2'>
                {teamBEvents.map((event, index) => (
                  <li key={index} className='flex items-center text-sm'>
                    <span className='mr-1'>{getEventIcon(event.type)}</span>
                    <span className='font-medium'>{event.playerName}</span>
                    <span className='text-gray-400 ml-1'>{event.minute}'</span>
                    {event.assistPlayerName && (
                      <span className='text-xs text-gray-500 ml-1'>
                        (Asist: {event.assistPlayerName})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-gray-400'>Sin goles</p>
            )}
          </div>
        </div>
      ) : (
        <p className='text-center text-gray-400 my-4'>
          No se han registrado goles
        </p>
      )}
    </div>
  );
}
