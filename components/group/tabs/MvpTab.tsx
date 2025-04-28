import { Avatar } from '@mui/material';
import type { Player } from '../../../types/group';

interface MvpData extends Player {
  winRate: number;
  matchesPlayed: number;
}

interface MvpTabProps {
  mvps: MvpData[];
}

export default function MvpTab({ mvps }: MvpTabProps) {
  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <div>
          <h3 className='text-xl font-semibold text-gray-900'>
            Ranking de MVPs
          </h3>
          <p className='text-sm text-gray-500'>
            Jugadores con mejor porcentaje de victorias (mínimo 3 partidos
            jugados)
          </p>
        </div>
        <span className='text-sm text-gray-500'>{mvps.length} jugadores</span>
      </div>

      {mvps && mvps.length > 0 ? (
        <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
          <div className='bg-gray-50 px-6 py-3 border-b border-gray-200'>
            <div className='grid grid-cols-12 gap-4'>
              <div className='col-span-1'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Pos.
                </span>
              </div>
              <div className='col-span-6'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Jugador
                </span>
              </div>
              <div className='col-span-3 text-center'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  % Victorias
                </span>
              </div>
              <div className='col-span-2 text-center'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Partidos
                </span>
              </div>
            </div>
          </div>

          <div className='divide-y divide-gray-200'>
            {mvps.map((mvp, index) => (
              <div
                key={mvp.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  index < 3 ? 'bg-gradient-to-r from-blue-50 to-white' : ''
                }`}
              >
                <div className='grid grid-cols-12 gap-4 items-center'>
                  <div className='col-span-1'>
                    <div
                      className={`
                      flex items-center justify-center w-8 h-8 rounded-full
                      ${
                        index === 0
                          ? 'bg-blue-100 text-blue-700'
                          : index === 1
                          ? 'bg-blue-50 text-blue-600'
                          : index === 2
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }
                    `}
                    >
                      <span className='text-sm font-semibold'>{index + 1}</span>
                    </div>
                  </div>
                  <div className='col-span-6'>
                    <div className='flex items-center'>
                      <div className='flex-shrink-0'>
                        <Avatar
                          alt={mvp.name || ''}
                          src={mvp.avatar || ''}
                          className='h-9 w-9 rounded-full'
                        />
                      </div>
                      <div className='ml-3'>
                        <p className='text-sm font-medium text-gray-900'>
                          {mvp.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='col-span-3 text-center'>
                    <div className='inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-100'>
                      <span className='text-sm font-semibold text-indigo-800'>
                        {mvp.winRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className='col-span-2 text-center'>
                    <span className='text-sm font-medium text-gray-700'>
                      {mvp.matchesPlayed}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className='bg-white rounded-lg p-6 text-center border border-gray-200 shadow-sm'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-12 w-12 mx-auto text-gray-400 mb-4'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1}
              d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
            />
          </svg>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            No hay suficientes datos
          </h3>
          <p className='text-gray-500 max-w-md mx-auto'>
            Se necesitan al menos 3 partidos jugados por usuario para calcular
            las estadísticas de MVPs.
          </p>
        </div>
      )}
    </div>
  );
}
