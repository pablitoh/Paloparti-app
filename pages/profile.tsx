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

  return (
    <Layout>
      <div className='max-w-4xl mx-auto px-4 py-8'>
        {/* Debug info for preview */}
        {process.env.NODE_ENV === 'development' && (
          <div className='mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs'>
            <strong>Debug:</strong> Server user: {serverUser.email} | Client
            user: {clientUser?.email || 'loading...'}
          </div>
        )}

        <div className='bg-white rounded-xl shadow-md p-6'>
          {/* User Info */}
          <div className='flex items-center justify-between mb-8'>
            <div className='flex items-center gap-4'>
              <img
                src={
                  profileData?.user.image ||
                  serverUser.image ||
                  '/default-avatar.png'
                }
                alt={profileData?.user.name || serverUser.name || 'User'}
                className='w-24 h-24 rounded-full'
              />
              <div>
                <h1 className='text-2xl font-bold'>
                  {profileData?.user.name || serverUser.name || 'Usuario'}
                </h1>
                <p className='text-gray-600'>{serverUser.email}</p>
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
            <Link
              href='/profile/edit'
              className='bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors'
            >
              Editar Perfil
            </Link>
          </div>

          {/* Stats */}
          <div className='grid grid-cols-3 gap-4 mb-8'>
            <div className='bg-blue-50 p-4 rounded-lg text-center'>
              <p className='text-sm text-gray-600'>Partidos Jugados</p>
              <p className='text-2xl font-bold'>
                {profileData?.totalMatches || 0}
              </p>
            </div>
            <div className='bg-green-50 p-4 rounded-lg text-center'>
              <p className='text-sm text-gray-600'>Goles Totales</p>
              <p className='text-2xl font-bold'>
                {profileData?.totalGoals || 0}
              </p>
            </div>
            <div className='bg-purple-50 p-4 rounded-lg text-center'>
              <p className='text-sm text-gray-600'>Grupos</p>
              <p className='text-2xl font-bold'>
                {profileData?.totalGroups || 0}
              </p>
            </div>
          </div>

          {/* Groups */}
          <div className='mb-8'>
            <h2 className='text-xl font-bold mb-4'>Grupos</h2>
            <div className='space-y-4'>
              {profileData?.groups.map((group) => (
                <div
                  key={group.id}
                  className='border rounded-lg p-4 hover:bg-gray-50 cursor-pointer'
                  onClick={() => router.push(`/group/${group.id}`)}
                >
                  <div className='flex justify-between items-center'>
                    <div>
                      <h3 className='font-semibold'>{group.name}</h3>
                      <p className='text-sm text-gray-600'>
                        {group.sport} - {group.location}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
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

          {/* Goals per Group */}
          <div className='mb-8'>
            <h2 className='text-xl font-bold mb-4'>Goles por Grupo</h2>
            <div className='space-y-2'>
              {profileData?.goalsPerGroup.map((item) => (
                <div
                  key={item.groupName}
                  className='flex justify-between items-center p-2 bg-gray-50 rounded'
                >
                  <span>{item.groupName}</span>
                  <span className='font-semibold'>{item.count} goles</span>
                </div>
              ))}
            </div>
          </div>

          {/* Match History */}
          <div>
            <h2 className='text-xl font-bold mb-4'>Historial de Partidos</h2>
            <div className='space-y-4'>
              {profileData?.matches.map((match) => (
                <div
                  key={match.id}
                  className='border rounded-lg p-4 hover:bg-gray-50 cursor-pointer'
                  onClick={() => router.push(`/match/${match.id}/result`)}
                >
                  <div className='flex justify-between items-center mb-2'>
                    <div>
                      <h3 className='font-semibold'>{match.group.name}</h3>
                      <p className='text-sm text-gray-600'>
                        {format(new Date(match.date), 'PPP', { locale: es })}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm text-gray-600'>{match.location}</p>
                      <p className='text-sm'>
                        Equipo {match.team} -{' '}
                        {match.team === 'A' ? match.scoreA : match.scoreB} -{' '}
                        {match.team === 'A' ? match.scoreB : match.scoreA}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
