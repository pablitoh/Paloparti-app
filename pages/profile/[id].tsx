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
        <div className='max-w-4xl mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-800'>
              Usuario no encontrado
            </h1>
            <Button
              variant='outline'
              onClick={() => router.back()}
              className='mt-4'
            >
              Volver
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-4xl mx-auto px-4 py-8'>
        <div className='flex items-center gap-4 mb-6'>
          <Button
            variant='outline'
            onClick={() => router.back()}
            className='flex items-center gap-2'
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
          <h1 className='text-2xl font-bold text-gray-800'>
            Perfil de Usuario
          </h1>
        </div>

        <div className='bg-white rounded-xl shadow-md p-6 mb-6'>
          <div className='flex items-start gap-6'>
            <div className='w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center'>
              <span className='text-3xl text-gray-400'>👤</span>
            </div>
            <div className='flex-1'>
              <h2 className='text-xl font-semibold text-gray-800'>
                {profile.name}
              </h2>
              <p className='text-gray-600'>
                {calculateAge(profile.birthdate)} años
              </p>
              <p className='text-gray-600'>{profile.position}</p>
              <Button
                variant='outline'
                onClick={() => router.push(`/history/${id}`)}
                className='mt-4'
              >
                Ver Historial de Partidos
              </Button>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Estadísticas */}
          <div className='bg-white rounded-xl shadow-md p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-semibold text-gray-700'>
                Estadísticas
              </h2>
              <button
                onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                className='text-gray-500 hover:text-gray-700'
              >
                {isStatsCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {!isStatsCollapsed && (
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='bg-gray-50 p-4 rounded-lg'>
                    <p className='text-sm text-gray-500'>Partidos Jugados</p>
                    <p className='text-2xl font-semibold text-gray-800'>
                      {profile.matchesPlayed}
                    </p>
                  </div>
                  <div className='bg-gray-50 p-4 rounded-lg'>
                    <p className='text-sm text-gray-500'>Goles</p>
                    <p className='text-2xl font-semibold text-gray-800'>
                      {profile.goals}
                    </p>
                  </div>
                  <div className='bg-gray-50 p-4 rounded-lg'>
                    <p className='text-sm text-gray-500'>Asistencias</p>
                    <p className='text-2xl font-semibold text-gray-800'>
                      {profile.assists}
                    </p>
                  </div>
                  <div className='bg-gray-50 p-4 rounded-lg'>
                    <p className='text-sm text-gray-500'>Promedio de Goles</p>
                    <p className='text-2xl font-semibold text-gray-800'>
                      {(profile.goals / profile.matchesPlayed).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className='grid grid-cols-3 gap-4'>
                  <div className='bg-green-50 p-4 rounded-lg'>
                    <p className='text-sm text-green-600'>Victorias</p>
                    <p className='text-2xl font-semibold text-green-800'>
                      {profile.wins}
                    </p>
                  </div>
                  <div className='bg-red-50 p-4 rounded-lg'>
                    <p className='text-sm text-red-600'>Derrotas</p>
                    <p className='text-2xl font-semibold text-red-800'>
                      {profile.losses}
                    </p>
                  </div>
                  <div className='bg-yellow-50 p-4 rounded-lg'>
                    <p className='text-sm text-yellow-600'>Empates</p>
                    <p className='text-2xl font-semibold text-yellow-800'>
                      {profile.draws}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Información Adicional */}
          <div className='bg-white rounded-xl shadow-md p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-lg font-semibold text-gray-700'>
                Información
              </h2>
              <button
                onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                className='text-gray-500 hover:text-gray-700'
              >
                {isHistoryCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {!isHistoryCollapsed && (
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <p className='text-gray-600'>
                    <span className='font-medium'>Posición Favorita:</span>{' '}
                    {profile.favoritePosition}
                  </p>
                  <p className='text-gray-600'>
                    <span className='font-medium'>Miembro desde:</span>{' '}
                    {formatDate(profile.joinDate)}
                  </p>
                  <p className='text-gray-600'>
                    <span className='font-medium'>Último partido:</span>{' '}
                    {formatDate(profile.lastMatch)}
                  </p>
                  <p className='text-gray-600'>
                    <span className='font-medium'>% Victorias:</span>{' '}
                    {profile.winRate}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
