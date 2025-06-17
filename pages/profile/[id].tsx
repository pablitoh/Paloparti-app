import { useRouter } from 'next/router';
import { useState } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { mockProfiles, UserProfile } from '../../mock/users';
import { calculateAge } from '../../lib/utils';

export default function Profile() {
  const router = useRouter();
  const { id } = router.query;
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const profile = id ? mockProfiles[id as string] : mockProfiles['1'];

  if (!profile) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-green-soft flex items-center justify-center py-12'>
          <div className='bg-white rounded-2xl shadow-green-lg p-8 max-w-md mx-auto text-center'>
            <div className='w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-error-500'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                />
              </svg>
            </div>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>
              Usuario no encontrado
            </h1>
            <p className='text-gray-600 mb-6'>
              El perfil que buscas no existe o ha sido eliminado
            </p>
            <Button
              variant='outline'
              onClick={() => router.back()}
              className='shadow-sm hover:shadow-green'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5 mr-2'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                  clipRule='evenodd'
                />
              </svg>
              Volver
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-green-soft'>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          {/* Header con breadcrumb */}
          <div className='flex items-center gap-4 mb-8'>
            <Button
              variant='outline'
              onClick={() => router.back()}
              className='flex items-center gap-2 shadow-sm hover:shadow-green'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                  clipRule='evenodd'
                />
              </svg>
              Volver
            </Button>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 mb-1'>
                Perfil de Usuario
              </h1>
              <p className='text-gray-600'>
                Información detallada y estadísticas
              </p>
            </div>
          </div>

          {/* Card principal del perfil */}
          <div className='bg-white rounded-2xl shadow-green-lg p-8 mb-6'>
            <div className='flex flex-col sm:flex-row items-start gap-6'>
              {/* Avatar */}
              <div className='relative'>
                <div className='w-32 h-32 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-green'>
                  <span className='text-5xl text-white'>👤</span>
                </div>
                <div className='absolute -bottom-2 -right-2 w-8 h-8 bg-success-500 rounded-full border-4 border-white flex items-center justify-center'>
                  <span className='text-white text-sm'>✓</span>
                </div>
              </div>

              {/* Información del usuario */}
              <div className='flex-1'>
                <div className='mb-4'>
                  <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                    {profile.name}
                  </h2>
                  <div className='flex flex-wrap gap-4 text-gray-600'>
                    <div className='flex items-center gap-2'>
                      <svg
                        className='w-5 h-5 text-primary-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8v8a2 2 0 002 2h4a2 2 0 002-2v-8m-6 0V9a2 2 0 012-2h4a2 2 0 012 2v6'
                        />
                      </svg>
                      <span>{calculateAge(profile.birthdate)} años</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <svg
                        className='w-5 h-5 text-primary-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                        />
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                        />
                      </svg>
                      <span>{profile.position}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant='primary'
                  onClick={() => router.push(`/history/${id}`)}
                  className='shadow-green flex items-center gap-2'
                >
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                    />
                  </svg>
                  Ver Historial de Partidos
                </Button>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Estadísticas */}
            <div className='bg-white rounded-2xl shadow-green-lg overflow-hidden'>
              <div className='bg-gradient-green-light p-6 border-b border-primary-100'>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center'>
                      <svg
                        className='w-6 h-6 text-white'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                        />
                      </svg>
                    </div>
                    <h2 className='text-lg font-semibold text-gray-900'>
                      Estadísticas
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                    className='text-gray-500 hover:text-primary-600 p-2 rounded-lg hover:bg-primary-50 transition-colors'
                  >
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        isStatsCollapsed ? 'rotate-180' : ''
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {!isStatsCollapsed && (
                <div className='p-6 space-y-6'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='bg-gradient-green-soft p-4 rounded-xl border border-primary-100'>
                      <p className='text-sm text-primary-700 font-medium mb-1'>
                        Partidos Jugados
                      </p>
                      <p className='text-3xl font-bold text-primary-900'>
                        {profile.matchesPlayed}
                      </p>
                    </div>
                    <div className='bg-gradient-green-soft p-4 rounded-xl border border-primary-100'>
                      <p className='text-sm text-primary-700 font-medium mb-1'>
                        Goles
                      </p>
                      <p className='text-3xl font-bold text-primary-900'>
                        {profile.goals}
                      </p>
                    </div>
                    <div className='bg-gradient-green-soft p-4 rounded-xl border border-primary-100'>
                      <p className='text-sm text-primary-700 font-medium mb-1'>
                        Asistencias
                      </p>
                      <p className='text-3xl font-bold text-primary-900'>
                        {profile.assists}
                      </p>
                    </div>
                    <div className='bg-gradient-green-soft p-4 rounded-xl border border-primary-100'>
                      <p className='text-sm text-primary-700 font-medium mb-1'>
                        Promedio de Goles
                      </p>
                      <p className='text-3xl font-bold text-primary-900'>
                        {(profile.goals / profile.matchesPlayed).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className='grid grid-cols-3 gap-3'>
                    <div className='bg-success-50 p-4 rounded-xl border border-success-200'>
                      <p className='text-sm text-success-700 font-medium mb-1'>
                        Victorias
                      </p>
                      <p className='text-2xl font-bold text-success-800'>
                        {profile.wins}
                      </p>
                    </div>
                    <div className='bg-error-50 p-4 rounded-xl border border-error-200'>
                      <p className='text-sm text-error-600 font-medium mb-1'>
                        Derrotas
                      </p>
                      <p className='text-2xl font-bold text-error-700'>
                        {profile.losses}
                      </p>
                    </div>
                    <div className='bg-warning-50 p-4 rounded-xl border border-warning-200'>
                      <p className='text-sm text-warning-600 font-medium mb-1'>
                        Empates
                      </p>
                      <p className='text-2xl font-bold text-warning-700'>
                        {profile.draws}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Información Adicional */}
            <div className='bg-white rounded-2xl shadow-green-lg overflow-hidden'>
              <div className='bg-gradient-green-light p-6 border-b border-primary-100'>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center'>
                      <svg
                        className='w-6 h-6 text-white'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                    </div>
                    <h2 className='text-lg font-semibold text-gray-900'>
                      Información
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                    className='text-gray-500 hover:text-primary-600 p-2 rounded-lg hover:bg-primary-50 transition-colors'
                  >
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        isHistoryCollapsed ? 'rotate-180' : ''
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {!isHistoryCollapsed && (
                <div className='p-6 space-y-4'>
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center'>
                          <svg
                            className='w-4 h-4 text-primary-600'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                            />
                          </svg>
                        </div>
                        <span className='font-medium text-gray-700'>
                          Posición Favorita
                        </span>
                      </div>
                      <span className='text-gray-900 font-semibold'>
                        {profile.favoritePosition}
                      </span>
                    </div>

                    <div className='flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center'>
                          <svg
                            className='w-4 h-4 text-primary-600'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8v8'
                            />
                          </svg>
                        </div>
                        <span className='font-medium text-gray-700'>
                          Miembro desde
                        </span>
                      </div>
                      <span className='text-gray-900 font-semibold'>
                        {formatDate(profile.joinDate)}
                      </span>
                    </div>

                    <div className='flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center'>
                          <svg
                            className='w-4 h-4 text-primary-600'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                          </svg>
                        </div>
                        <span className='font-medium text-gray-700'>
                          Último partido
                        </span>
                      </div>
                      <span className='text-gray-900 font-semibold'>
                        {formatDate(profile.lastMatch)}
                      </span>
                    </div>

                    <div className='flex items-center justify-between py-3 px-4 bg-success-50 rounded-xl border border-success-200'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-success-500 rounded-lg flex items-center justify-center'>
                          <svg
                            className='w-4 h-4 text-white'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                          </svg>
                        </div>
                        <span className='font-medium text-success-700'>
                          % Victorias
                        </span>
                      </div>
                      <span className='text-success-800 font-bold text-lg'>
                        {profile.winRate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
