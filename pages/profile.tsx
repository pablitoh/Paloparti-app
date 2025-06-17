import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import Layout from '../components/Layout';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateUTC } from '../lib/utils';
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
        <div className='min-h-screen bg-gradient-green-soft flex justify-center items-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4'></div>
            <p className='text-primary-700 font-medium'>
              Cargando datos del perfil...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
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
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h2 className='text-xl font-bold text-gray-900 mb-4'>
              Error al cargar el perfil
            </h2>
            <p className='text-gray-600 mb-6'>{error}</p>
            <Button onClick={() => window.location.reload()} variant='primary'>
              Reintentar
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Format birthdate for display using UTC to avoid timezone issues
  const formattedBirthdate = formatDateUTC(profileData?.user.birthdate || null);

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
      <div className='min-h-screen bg-gradient-green-soft'>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          {/* Header con breadcrumb */}
          <div className='mb-8'>
            <Link
              href='/groups'
              className='inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-green mb-4'
            >
              <ArrowLeftIcon className='h-5 w-5 mr-2' />
              Volver a grupos
            </Link>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 mb-1'>
                Mi Perfil
              </h1>
              <p className='text-gray-600'>
                Información personal y estadísticas deportivas
              </p>
            </div>
          </div>

          {/* Card principal del perfil */}
          <div className='bg-white rounded-2xl shadow-green-lg p-6 sm:p-8 mb-6'>
            {/* User Info */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-6'>
              <div className='flex flex-col sm:flex-row items-center sm:items-start gap-6'>
                <div className='relative'>
                  <Avatar
                    src={profileData?.user.image || serverUser.image}
                    alt={profileData?.user.name || serverUser.name || 'User'}
                    size='xl'
                    fallbackText={
                      profileData?.user.name || serverUser.name || 'U'
                    }
                    className='w-24 h-24 sm:w-28 sm:h-28 border-4 border-primary-100'
                  />
                  <div className='absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-green rounded-full flex items-center justify-center shadow-green'>
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
                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                      />
                    </svg>
                  </div>
                </div>
                <div className='text-center sm:text-left'>
                  <h2 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>
                    {profileData?.user.name || serverUser.name || 'Usuario'}
                  </h2>
                  <p className='text-gray-600 text-lg mb-4'>
                    {serverUser.email}
                  </p>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-center sm:justify-start text-gray-600'>
                      <svg
                        className='w-5 h-5 mr-2 text-primary-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2'
                        />
                      </svg>
                      <span className='font-medium'>Fecha de nacimiento:</span>
                      <span className='ml-2'>{formattedBirthdate}</span>
                    </div>
                    {profileData?.user.age && (
                      <div className='flex items-center justify-center sm:justify-start text-gray-600'>
                        <svg
                          className='w-5 h-5 mr-2 text-primary-500'
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
                        <span className='font-medium'>Edad:</span>
                        <span className='ml-2'>
                          {profileData.user.age} años
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className='flex justify-center sm:justify-end'>
                <Button
                  onClick={() => router.push('/profile/edit')}
                  variant='primary'
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
                      d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                    />
                  </svg>
                  Editar Perfil
                </Button>
              </div>
            </div>
          </div>

          {/* Groups */}
          <div className='bg-white rounded-2xl shadow-green-lg p-6 sm:p-8 mb-6'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-10 h-10 bg-gradient-green rounded-xl flex items-center justify-center'>
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
                    d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                  />
                </svg>
              </div>
              <div>
                <h2 className='text-xl font-bold text-gray-900'>Mis Grupos</h2>
                <p className='text-gray-600 text-sm'>
                  Grupos en los que participas
                </p>
              </div>
              <span className='ml-auto bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-semibold'>
                {profileData?.totalGroups || 0}
              </span>
            </div>

            {profileData?.groups && profileData.groups.length > 0 ? (
              <div className='space-y-4'>
                {profileData.groups.map((group) => (
                  <div
                    key={group.id}
                    className='border border-gray-200 rounded-xl p-4 hover:bg-primary-50 hover:border-primary-200 cursor-pointer transition-all duration-200 hover:shadow-green'
                    onClick={() => router.push(`/group/${group.id}`)}
                  >
                    <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3'>
                      <div className='flex-1'>
                        <h3 className='font-semibold text-lg text-gray-900 mb-1'>
                          {group.name}
                        </h3>
                        <div className='flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600'>
                          <span className='flex items-center'>
                            <svg
                              className='w-4 h-4 mr-1 text-primary-500'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                              />
                            </svg>
                            {group.sport}
                          </span>
                          <span className='hidden sm:inline text-gray-400'>
                            •
                          </span>
                          <span className='flex items-center'>
                            <svg
                              className='w-4 h-4 mr-1 text-primary-500'
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
                            {group.location}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            group.role === 'ADMIN'
                              ? 'bg-primary-100 text-primary-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {group.role === 'ADMIN' ? 'Administrador' : 'Miembro'}
                        </span>
                        <svg
                          className='w-5 h-5 text-gray-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M9 5l7 7-7 7'
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-8 h-8 text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                    />
                  </svg>
                </div>
                <p className='text-gray-500'>
                  No formas parte de ningún grupo aún
                </p>
              </div>
            )}
          </div>

          {/* Match History */}
          <div className='bg-white rounded-2xl shadow-green-lg p-6 sm:p-8'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-10 h-10 bg-gradient-green rounded-xl flex items-center justify-center'>
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
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
              </div>
              <div>
                <h2 className='text-xl font-bold text-gray-900'>
                  Historial de Partidos
                </h2>
                <p className='text-gray-600 text-sm'>
                  Todos tus partidos jugados
                </p>
              </div>
              <span className='ml-auto bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-semibold'>
                {profileData?.totalMatches || 0}
              </span>
            </div>

            {totalMatches > 0 ? (
              <>
                <div className='space-y-4 mb-6'>
                  {currentMatches.map((match) => {
                    const result = getMatchResult(match);
                    return (
                      <div
                        key={match.id}
                        className='border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-all duration-200'
                      >
                        <div className='flex flex-col gap-3'>
                          <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3'>
                            <div className='flex-1'>
                              <h3 className='font-semibold text-lg text-gray-900 mb-1'>
                                {match.group.name}
                              </h3>
                              <div className='space-y-1 text-sm text-gray-600'>
                                <div className='flex items-center'>
                                  <svg
                                    className='w-4 h-4 mr-2 text-primary-500'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                  >
                                    <path
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      strokeWidth='2'
                                      d='M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2'
                                    />
                                  </svg>
                                  {format(new Date(match.date), 'PPP', {
                                    locale: es,
                                  })}
                                </div>
                                <div className='flex items-center'>
                                  <svg
                                    className='w-4 h-4 mr-2 text-primary-500'
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
                                  {match.location}
                                </div>
                              </div>
                            </div>
                            <div className='flex items-center justify-between sm:justify-end gap-4'>
                              <div className='text-center'>
                                <div className='text-lg font-bold text-gray-900 mb-1'>
                                  {match.team === 'A'
                                    ? match.scoreA
                                    : match.scoreB}{' '}
                                  -{' '}
                                  {match.team === 'A'
                                    ? match.scoreB
                                    : match.scoreA}
                                </div>
                                <div className='text-xs text-gray-500'>
                                  Equipo {match.team}
                                </div>
                              </div>
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
                                  result === 'victory'
                                    ? 'bg-success-100 text-success-700'
                                    : result === 'defeat'
                                    ? 'bg-error-100 text-error-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {result === 'victory'
                                  ? '🏆 Victoria'
                                  : result === 'defeat'
                                  ? '😞 Derrota'
                                  : '🤝 Empate'}
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
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between pt-6 border-t border-gray-200 gap-4'>
                    <div className='text-sm text-gray-600 text-center sm:text-left'>
                      Mostrando {startIndex + 1} -{' '}
                      {Math.min(endIndex, totalMatches)} de {totalMatches}{' '}
                      partidos
                    </div>
                    <div className='flex items-center justify-center gap-2'>
                      <Button
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        variant='outline'
                        size='sm'
                        className={
                          currentPage === 1
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:shadow-green'
                        }
                      >
                        Anterior
                      </Button>
                      <span className='px-4 py-2 text-sm text-gray-600 whitespace-nowrap'>
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        variant='outline'
                        size='sm'
                        className={
                          currentPage === totalPages
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:shadow-green'
                        }
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className='text-center py-12'>
                <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-8 h-8 text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                </div>
                <h3 className='text-lg font-medium text-gray-900 mb-2'>
                  No hay partidos en el historial
                </h3>
                <p className='text-gray-500 mb-6'>
                  Únete a un grupo y empieza a jugar para ver tu historial aquí
                </p>
                <Button
                  onClick={() => router.push('/groups')}
                  variant='primary'
                  className='shadow-green'
                >
                  Ver Grupos
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Elementos decorativos de fondo */}
        <div className='fixed top-20 right-10 w-32 h-32 bg-primary-200 rounded-full opacity-20 animate-pulse pointer-events-none'></div>
        <div
          className='fixed bottom-20 left-10 w-24 h-24 bg-accent-300 rounded-full opacity-25 animate-pulse pointer-events-none'
          style={{ animationDelay: '2s' }}
        ></div>
      </div>
    </Layout>
  );
}
