import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { mockStats, UserStats, MatchHistory } from '../../mock/history';
import { mockProfiles } from '../../mock/users';
import { calculateAge } from '../../lib/utils';

export default function History() {
  const router = useRouter();
  const { id } = router.query;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const stats = id ? mockStats[id as string] : mockStats['1'];
  const profile = id ? mockProfiles[id as string] : mockProfiles['1'];

  const getPlayerTeam = (match: MatchHistory, playerId: string) => {
    const isInTeamA = match.teamA.some((p) => p.id === playerId);
    return isInTeamA ? 'A' : 'B';
  };

  const getPlayerGoals = (match: MatchHistory, playerId: string) => {
    return match.goals.filter((g) => g.playerId === playerId).length;
  };

  if (!stats || !profile) {
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
            Historial de Partidos
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
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
          <div className='bg-white rounded-xl shadow-md p-6'>
            <h2 className='text-lg font-semibold text-gray-700 mb-4'>
              Estadísticas Generales
            </h2>
            <div className='grid grid-cols-2 gap-4'>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <p className='text-sm text-gray-500'>Partidos Jugados</p>
                <p className='text-2xl font-semibold text-gray-800'>
                  {stats.matchesPlayed}
                </p>
              </div>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <p className='text-sm text-gray-500'>Goles Totales</p>
                <p className='text-2xl font-semibold text-gray-800'>
                  {stats.totalGoals}
                </p>
              </div>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <p className='text-sm text-gray-500'>Asistencias Totales</p>
                <p className='text-2xl font-semibold text-gray-800'>
                  {stats.totalAssists}
                </p>
              </div>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <p className='text-sm text-gray-500'>Promedio de Goles</p>
                <p className='text-2xl font-semibold text-gray-800'>
                  {stats.averageGoals.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-xl shadow-md p-6'>
            <h2 className='text-lg font-semibold text-gray-700 mb-4'>
              Rendimiento
            </h2>
            <div className='grid grid-cols-3 gap-4'>
              <div className='bg-green-50 p-4 rounded-lg'>
                <p className='text-sm text-green-600'>Victorias</p>
                <p className='text-2xl font-semibold text-green-800'>
                  {stats.wins}
                </p>
              </div>
              <div className='bg-red-50 p-4 rounded-lg'>
                <p className='text-sm text-red-600'>Derrotas</p>
                <p className='text-2xl font-semibold text-red-800'>
                  {stats.losses}
                </p>
              </div>
              <div className='bg-yellow-50 p-4 rounded-lg'>
                <p className='text-sm text-yellow-600'>Empates</p>
                <p className='text-2xl font-semibold text-yellow-800'>
                  {stats.draws}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-xl shadow-md p-6'>
          <h2 className='text-lg font-semibold text-gray-700 mb-4'>
            Historial de Partidos
          </h2>
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Fecha
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Equipo
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Resultado
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Goles
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {stats.history.map((match) => (
                  <tr key={match.id}>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {formatDate(match.date)}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      Equipo {getPlayerTeam(match, stats.id)}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {match.result === 'win'
                        ? 'Victoria'
                        : match.result === 'loss'
                        ? 'Derrota'
                        : 'Empate'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {getPlayerGoals(match, stats.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
