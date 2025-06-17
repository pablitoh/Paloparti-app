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
        <div className='bg-white rounded-2xl border border-primary-200 shadow-green-lg overflow-hidden'>
          <div className='bg-gradient-green-soft px-6 py-4 border-b border-primary-200'>
            <div className='grid grid-cols-12 gap-4 items-center'>
              <div className='col-span-1 flex justify-center'>
                <span className='text-xs font-semibold text-primary-700 uppercase'>
                  Pos.
                </span>
              </div>
              <div className='col-span-6 flex items-center'>
                <span className='text-xs font-semibold text-primary-700 uppercase ml-13'>
                  Jugador
                </span>
              </div>
              <div className='col-span-3 text-center'>
                <span className='text-xs font-semibold text-primary-700 uppercase'>
                  % Victorias
                </span>
              </div>
              <div className='col-span-2 text-center'>
                <span className='text-xs font-semibold text-primary-700 uppercase'>
                  Partidos
                </span>
              </div>
            </div>
          </div>

          <div className='divide-y divide-primary-100'>
            {mvps.map((mvp, index) => (
              <div
                key={mvp.id}
                className={`px-6 py-5 hover:bg-primary-25 transition-colors duration-200 ${
                  index < 3 ? 'bg-gradient-to-r from-primary-25 to-white' : ''
                }`}
              >
                <div className='grid grid-cols-12 gap-4 items-center'>
                  <div className='col-span-1'>
                    <div
                      className={`
                      flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm
                      ${
                        index === 0
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-green-md'
                          : index === 1
                          ? 'bg-gradient-green-light text-primary-800 border-2 border-primary-300'
                          : index === 2
                          ? 'bg-primary-100 text-primary-700 border border-primary-200'
                          : 'bg-gray-100 text-gray-600'
                      }
                    `}
                    >
                      {index === 0 ? '🏆' : index + 1}
                    </div>
                  </div>
                  <div className='col-span-6'>
                    <div className='flex items-center'>
                      <div className='flex-shrink-0'>
                        <Avatar
                          alt={mvp.name || ''}
                          src={mvp.avatar || ''}
                          className='h-10 w-10 rounded-full border-2 border-primary-100'
                        />
                      </div>
                      <div className='ml-3'>
                        <p className='text-sm font-semibold text-primary-900'>
                          {mvp.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='col-span-3 text-center'>
                    <div className='inline-flex items-center justify-center px-4 py-2 rounded-full bg-gradient-green-light border border-primary-200'>
                      <span className='text-sm font-bold text-primary-800'>
                        {mvp.winRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className='col-span-2 text-center'>
                    <span className='text-sm font-semibold text-primary-700'>
                      {mvp.matchesPlayed}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className='bg-white rounded-2xl p-8 text-center border border-primary-200 shadow-green-lg'>
          <div className='w-16 h-16 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
            <span className='text-2xl' role='img' aria-label='trophy'>
              🏆
            </span>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            No hay suficientes datos
          </h3>
          <p className='text-primary-600 max-w-md mx-auto'>
            Se necesitan al menos 3 partidos jugados por usuario para calcular
            las estadísticas de MVPs.
          </p>
        </div>
      )}
    </div>
  );
}
