import React from 'react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useQueryClient } from '@tanstack/react-query';

interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  sport: string;
  location: string;
  members: GroupMember[];
  createdAt: string;
  createdBy: string;
  nextMatch?: string;
  totalMatches: number;
  userStatus?: string;
}

export default function Groups() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('No user found, redirecting to home');
      router.push('/');
      return;
    }

    if (status === 'loading') {
      return;
    }

    const fetchGroups = async () => {
      try {
        // Añadir timestamp para evitar caché
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/groups?_t=${timestamp}`, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });

        const data = await response.json();
        console.log('API Response:', data);

        if (!response.ok) {
          console.error('Error response:', data);
          throw new Error(
            data.message ||
              `Error fetching groups: ${response.status} ${response.statusText}`
          );
        }

        if (!Array.isArray(data)) {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format from server');
        }

        console.log('Groups data:', data);
        setUserGroups(data);
      } catch (error) {
        console.error('Error in fetchGroups:', error);
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unexpected error occurred while fetching groups');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [status, router]);

  // Forzar recarga al hacer clic en un grupo
  const handleGroupClick = (groupId: string) => {
    console.log(
      `Navegando a grupo ${groupId} - Invalidando consultas relevantes`
    );
    queryClient.invalidateQueries({
      queryKey: ['group', groupId],
      refetchType: 'active',
    });
    router.push(`/group/${groupId}`);
  };

  if (status === 'loading' || isLoading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-gray-900 mb-4'>
            Error al cargar los grupos
          </h2>
          <p className='text-gray-500 mb-6'>{error}</p>
          <Button onClick={() => window.location.reload()} variant='primary'>
            Intentar de nuevo
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>Mis Grupos</h1>
          <Button
            onClick={() => router.push('/create-group')}
            variant='primary'
          >
            Crear Nuevo Grupo
          </Button>
        </div>

        {userGroups.length === 0 ? (
          <div className='text-center py-12'>
            <h2 className='text-xl font-medium text-gray-900 mb-4'>
              No tienes grupos aún
            </h2>
            <p className='text-gray-500 mb-6'>
              Crea tu primer grupo o únete a uno existente para empezar a
              organizar partidos.
            </p>
            <Button
              onClick={() => router.push('/create-group')}
              variant='primary'
            >
              Crear mi primer grupo
            </Button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {userGroups.map((group) => (
              <div
                key={group.id}
                className={`bg-white rounded-lg shadow-md p-6 transition-shadow duration-200 ${
                  group.userStatus !== 'PENDING'
                    ? 'hover:shadow-lg cursor-pointer'
                    : 'opacity-90 cursor-default'
                }`}
                onClick={() => {
                  if (group.userStatus !== 'PENDING') {
                    handleGroupClick(group.id);
                  }
                }}
              >
                <div className='flex items-center gap-2'>
                  <h2 className='text-lg font-semibold text-gray-800'>
                    {group.name}
                  </h2>
                  {group.members.some(
                    (member) =>
                      member.id === session?.user?.id && member.role === 'ADMIN'
                  ) && (
                    <span className='px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full'>
                      Admin
                    </span>
                  )}
                  {group.userStatus === 'PENDING' && (
                    <span className='px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full ml-auto'>
                      Solicitud enviada
                    </span>
                  )}
                </div>
                <p className='text-sm text-gray-500 mb-4'>
                  {group.description}
                </p>
                <div className='flex items-center space-x-2 text-sm text-gray-500 mb-2'>
                  <span>{group.sport}</span>
                  <span>•</span>
                  <span>{group.location}</span>
                </div>
                <div className='flex items-center space-x-2 text-sm text-gray-500'>
                  <span>{group.members.length} miembros</span>
                  {group.nextMatch && (
                    <>
                      <span>•</span>
                      <span>
                        Próximo partido:{' '}
                        {new Date(group.nextMatch).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
