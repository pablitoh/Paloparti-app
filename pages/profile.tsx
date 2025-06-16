import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Group {
  id: string;
  name: string;
  sport: string;
  location: string;
  role: string;
}

interface Match {
  id: string;
  date: string;
  location: string;
  group: {
    id: string;
    name: string;
    sport: string;
  };
  team: string;
  scoreA: number;
  scoreB: number;
  status: string;
}

interface GoalsPerGroup {
  groupName: string;
  count: number;
}

interface ProfileProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getServerSession(
      context.req,
      context.res,
      authOptions
    );

    // Si no hay sesión, redirigir a login
    if (!session || !session.user) {
      console.log(
        'No session found in profile getServerSideProps, redirecting to signin'
      );
      return {
        redirect: {
          destination: '/auth/signin?callbackUrl=/profile',
          permanent: false,
        },
      };
    }

    // Debug logging para preview
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('Profile getServerSideProps - Session found:', {
        userId: session.user.id,
        userEmail: session.user.email,
        environment: process.env.VERCEL_ENV,
      });
    }

    // Pasar información del usuario autenticado
    return {
      props: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        },
      },
    };
  } catch (error) {
    console.error('Error in profile getServerSideProps:', error);

    // En caso de error, redirigir a signin
    return {
      redirect: {
        destination: '/auth/signin?callbackUrl=/profile',
        permanent: false,
      },
    };
  }
};

export default function Profile({ user: serverUser }: ProfileProps) {
  const router = useRouter();
  const { user: clientUser, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState<{
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      birthdate?: Date | string | null;
      age?: number | null;
    };
    groups: Group[];
    matches: Match[];
    goalsPerGroup: GoalsPerGroup[];
    totalGoals: number;
    totalMatches: number;
    totalGroups: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para paginación del historial
  const [currentPage, setCurrentPage] = useState(1);
  const matchesPerPage = 5;

  useEffect(() => {
    // Ya tenemos verificación del servidor, solo necesitamos cargar los datos del perfil
    const fetchProfileData = async () => {
      try {
        console.log('Fetching profile data for server-verified user...');
        const response = await fetch('/api/profile', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(
            'Profile fetch error:',
            response.status,
            response.statusText
          );
          if (response.status === 401) {
            // Si aún así hay un 401, algo está mal con las cookies
            console.error(
              '401 error despite server-side verification - possible cookie issue'
            );
            router.push('/auth/signin');
            return;
          }
          throw new Error('Error fetching profile data');
        }

        const data = await response.json();
        console.log('Profile data received:', data);
        setProfileData(data);
      } catch (error) {
        console.error('Error fetching profile data:', error);
        setError('Error al cargar los datos del perfil');
      } finally {
        setIsLoading(false);
      }
    };

    // Cargar datos inmediatamente ya que tenemos verificación del servidor
    fetchProfileData();
  }, [router]);

  // Loading state mientras se cargan los datos del perfil
  if (isLoading) {
    return (
      <Layout>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold mb-4'>Perfil</h1>
            <div className='flex items-center justify-center'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
              <span className='ml-2'>Cargando datos del perfil...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold mb-4'>Perfil</h1>
            <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
              <p className='text-red-600'>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className='mt-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded'
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Format birthdate for display
  const formattedBirthdate = profileData?.user.birthdate
    ? format(new Date(profileData.user.birthdate), 'dd/MM/yyyy')
    : 'No especificada';

  // Function to determine if user won or lost the match
  const getMatchResult = (match: Match) => {
    const userTeamScore = match.team === 'A' ? match.scoreA : match.scoreB;
    const opponentTeamScore = match.team === 'A' ? match.scoreB : match.scoreA;

    if (userTeamScore > opponentTeamScore) {
      return 'victory';
    } else if (userTeamScore < opponentTeamScore) {
      return 'defeat';
    } else {
      return 'draw';
    }
  };

  // Calcular partidos para la página actual
  const totalMatches = profileData?.matches.length || 0;
  const totalPages = Math.ceil(totalMatches / matchesPerPage);
  const startIndex = (currentPage - 1) * matchesPerPage;
  const endIndex = startIndex + matchesPerPage;
  const currentMatches = profileData?.matches.slice(startIndex, endIndex) || [];

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <Layout>
      <div className='max-w-4xl mx-auto px-4 py-4 sm:py-8'>
        {/* Enlace para volver a grupos */}
        <div className='mb-4'>
          <Link
            href='/groups'
            className='inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors'
          >
            <ArrowLeftIcon className='h-4 w-4 mr-1' />
            Volver a grupos
          </Link>
        </div>

        <div className='bg-white rounded-xl shadow-md p-4 sm:p-6'>
          {/* User Info */}
          <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4'>
            <div className='flex flex-col sm:flex-row items-center sm:items-start gap-4'>
              <img
                src={
                  profileData?.user.image ||
                  serverUser.image ||
                  '/default-avatar.png'
                }
                alt={profileData?.user.name || serverUser.name || 'User'}
                className='w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto sm:mx-0'
              />
              <div className='text-center sm:text-left'>
                <h1 className='text-xl sm:text-2xl font-bold'>
                  {profileData?.user.name || serverUser.name || 'Usuario'}
                </h1>
                <p className='text-gray-600 text-sm sm:text-base'>
                  {serverUser.email}
                </p>
                <div className='mt-2 text-sm'>
                  <p className='text-gray-600'>
                    <span className='font-medium'>Fecha de nacimiento:</span>{' '}
                    {formattedBirthdate}
                  </p>
                  {profileData?.user.age && (
                    <p className='text-gray-600'>
                      <span className='font-medium'>Edad:</span>{' '}
                      {profileData.user.age} años
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className='flex justify-center sm:justify-end'>
              <Link
                href='/profile/edit'
                className='w-full sm:w-auto text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors text-sm sm:text-base'
              >
                Editar Perfil
              </Link>
            </div>
          </div>

          {/* Groups */}
          <div className='mb-6 sm:mb-8'>
            <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-4'>
              <h2 className='text-lg sm:text-xl font-bold'>Grupos</h2>
              <span className='bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs sm:text-sm font-semibold w-fit'>
                {profileData?.totalGroups || 0}
              </span>
            </div>
            <div className='space-y-3 sm:space-y-4'>
              {profileData?.groups.map((group) => (
                <div
                  key={group.id}
                  className='border rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer'
                  onClick={() => router.push(`/group/${group.id}`)}
                >
                  <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
                    <div className='flex-1'>
                      <h3 className='font-semibold text-sm sm:text-base'>
                        {group.name}
                      </h3>
                      <p className='text-xs sm:text-sm text-gray-600'>
                        {group.sport} - {group.location}
                      </p>
                    </div>
                    <span
                      className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm w-fit ${
                        group.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {group.role === 'ADMIN' ? 'Administrador' : 'Miembro'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match History */}
          <div>
            <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-4'>
              <h2 className='text-lg sm:text-xl font-bold'>
                Historial de Partidos
              </h2>
              <span className='bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs sm:text-sm font-semibold w-fit'>
                {profileData?.totalMatches || 0}
              </span>
            </div>

            {totalMatches > 0 ? (
              <>
                <div className='space-y-3 sm:space-y-4 mb-4 sm:mb-6'>
                  {currentMatches.map((match) => {
                    const result = getMatchResult(match);
                    return (
                      <div
                        key={match.id}
                        className='border rounded-lg p-3 sm:p-4'
                      >
                        <div className='flex flex-col gap-3'>
                          <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2'>
                            <div className='flex-1'>
                              <h3 className='font-semibold text-sm sm:text-base'>
                                {match.group.name}
                              </h3>
                              <p className='text-xs sm:text-sm text-gray-600'>
                                {format(new Date(match.date), 'PPP', {
                                  locale: es,
                                })}
                              </p>
                              <p className='text-xs sm:text-sm text-gray-600 mt-1'>
                                {match.location}
                              </p>
                            </div>
                            <div className='flex items-center justify-between sm:justify-end gap-3'>
                              <div className='text-left sm:text-right'>
                                <p className='text-xs sm:text-sm font-medium'>
                                  Equipo {match.team}:{' '}
                                  {match.team === 'A'
                                    ? match.scoreA
                                    : match.scoreB}{' '}
                                  -{' '}
                                  {match.team === 'A'
                                    ? match.scoreB
                                    : match.scoreA}
                                </p>
                              </div>
                              <span
                                className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  result === 'victory'
                                    ? 'bg-green-100 text-green-800'
                                    : result === 'defeat'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {result === 'victory'
                                  ? 'Victoria'
                                  : result === 'defeat'
                                  ? 'Derrota'
                                  : 'Empate'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Controles de paginación */}
                {totalPages > 1 && (
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3'>
                    <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                      Mostrando {startIndex + 1} -{' '}
                      {Math.min(endIndex, totalMatches)} de {totalMatches}{' '}
                      partidos
                    </div>
                    <div className='flex items-center justify-center gap-2'>
                      <button
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium ${
                          currentPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Anterior
                      </button>
                      <span className='px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap'>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium ${
                          currentPage === totalPages
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className='text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base'>
                No hay partidos en el historial
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
