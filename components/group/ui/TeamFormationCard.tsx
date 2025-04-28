import React from 'react';

interface Position {
  id: string;
  x: number;
  y: number;
  player?: Player;
}

interface Player {
  id: string;
  name: string;
  avatar?: string;
  number?: number;
  position?: string;
}

interface TeamFormationCardProps {
  formationName: string;
  positions: Position[];
  teamColor?: string;
  teamName?: string;
  editable?: boolean;
  onPlayerClick?: (player: Player | undefined, positionId: string) => void;
}

export default function TeamFormationCard({
  formationName,
  positions,
  teamColor = 'bg-blue-500',
  teamName,
  editable = false,
  onPlayerClick,
}: TeamFormationCardProps) {
  // Definir dimensiones del campo
  const fieldWidth = 280;
  const fieldHeight = 400;

  // Convertir coordenadas relativas (0-100) a píxeles
  const getPositionStyle = (position: Position) => {
    return {
      left: `${position.x}%`,
      top: `${position.y}%`,
      transform: 'translate(-50%, -50%)',
    };
  };

  return (
    <div className='bg-white rounded-lg shadow-sm p-4'>
      <div className='flex justify-between items-center mb-3'>
        <div>
          <h3 className='font-medium text-gray-900'>{formationName}</h3>
          {teamName && <p className='text-xs text-gray-500'>{teamName}</p>}
        </div>
      </div>

      <div
        className='relative bg-green-100 rounded-lg mx-auto mb-3'
        style={{
          width: `${fieldWidth}px`,
          height: `${fieldHeight}px`,
          backgroundImage: `
            linear-gradient(to right, transparent 49.9%, white 50%, transparent 50.1%),
            linear-gradient(to bottom, transparent 32.9%, white 33%, transparent 33.1%),
            linear-gradient(to bottom, transparent 66.9%, white 67%, transparent 67.1%),
            radial-gradient(circle at center, white 2%, transparent 2.5%)
          `,
          backgroundSize: `100% 100%, 100% 100%, 100% 100%, 100% 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Campo de fútbol */}
        <div
          className='absolute bg-white rounded-full'
          style={{
            width: '60px',
            height: '60px',
            left: '50%',
            top: '33%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid white',
            opacity: 0.2,
          }}
        ></div>
        <div
          className='absolute bg-white rounded-md'
          style={{
            width: '100px',
            height: '40px',
            left: '50%',
            bottom: '0',
            transform: 'translate(-50%, 0)',
            border: '2px solid white',
            opacity: 0.2,
          }}
        ></div>
        <div
          className='absolute bg-white rounded-md'
          style={{
            width: '100px',
            height: '40px',
            left: '50%',
            top: '0',
            transform: 'translate(-50%, 0)',
            border: '2px solid white',
            opacity: 0.2,
          }}
        ></div>

        {/* Posiciones de jugadores */}
        {positions.map((position) => (
          <div
            key={position.id}
            style={getPositionStyle(position)}
            className={`absolute ${editable ? 'cursor-pointer' : ''}`}
            onClick={() =>
              onPlayerClick && onPlayerClick(position.player, position.id)
            }
          >
            <div
              className={`
              ${teamColor} text-white w-12 h-12 
              rounded-full flex flex-col items-center justify-center
              border-2 border-white
            `}
            >
              {position.player ? (
                <>
                  {position.player.avatar ? (
                    <div className='w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden'>
                      <img
                        src={position.player.avatar}
                        alt={position.player.name}
                        className='w-full h-full object-cover'
                      />
                    </div>
                  ) : (
                    <span className='text-xs'>
                      {position.player.number || '?'}
                    </span>
                  )}
                </>
              ) : (
                <span className='text-xs font-medium'>+</span>
              )}
            </div>
            {position.player && (
              <div className='absolute top-full mt-1 left-1/2 transform -translate-x-1/2 text-center'>
                <span className='bg-white text-xs font-medium px-1 py-0.5 rounded shadow-sm text-gray-800 whitespace-nowrap'>
                  {position.player.name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <p className='text-xs text-gray-500 text-center'>
          Toca en una posición para asignar un jugador
        </p>
      )}
    </div>
  );
}
