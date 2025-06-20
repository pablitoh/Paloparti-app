import React from 'react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import BirthdateModal from '../components/BirthdateModal';
import { useQueryClient } from '@tanstack/react-query';

// Define types for the Group interface
interface GroupMember {
  id: string;
  role: 'ADMIN' | 'MEMBER';
}

interface Group {
  id: string;
  name: string;
  description: string;
  sport: string;
  location: string;
  members: GroupMember[];
  userStatus?: string;
  nextMatchDate?: string;
  nextMatchLocation?: string;
}

export default function Groups() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBirthdateModal, setShowBirthdateModal] = useState(false);
  const queryClient = useQueryClient();

  // Verificar si el usuario necesita completar su fecha de nacimiento
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      console.log('Verificando fecha de nacimiento del usuario:', {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        birthdate: session.user.birthdate,
        birthdateType: typeof session.user.birthdate,
        hasBirthdate: !!session.user.birthdate,
      });

      // Si el usuario no tiene fecha de nacimiento, mostrar el modal
      if (!session.user.birthdate) {
        console.log('Usuario sin fecha de nacimiento - Mostrando modal');
        setShowBirthdateModal(true);
      } else {
        console.log('Usuario con fecha de nacimiento - No mostrar modal');
        setShowBirthdateModal(false);
      }
    }
  }, [status, session]);

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

  const handleBirthdateModalClose = () => {
    // No permitir cerrar el modal si no tiene fecha de nacimiento
    return;
  };

  const handleBirthdateModalSuccess = async () => {
    try {
      // Actualizar la sesión con NextAuth para obtener los datos más recientes
      await update();
      setShowBirthdateModal(false);
    } catch (error) {
      console.error('Error actualizando sesión:', error);
      // Como fallback, recargar la página
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <Layout>
        <div className='min-h-screen bg-gradient-green-soft flex justify-center items-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4'></div>
            <p className='text-primary-700 font-medium'>
              Cargando tus grupos...
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
              Error al cargar los grupos
            </h2>
            <p className='text-gray-600 mb-6'>{error}</p>
            <Button onClick={() => window.location.reload()} variant='primary'>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-green-soft'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          {/* Header */}
          <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 space-y-4 sm:space-y-0'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Mis Grupos
              </h1>
              <p className='text-gray-600'>
                Organiza y participa en tus deportes favoritos
              </p>
            </div>
            <Button
              onClick={() => router.push('/create-group')}
              variant='primary'
              className='shadow-green flex items-center justify-center'
            >
              <svg
                className='w-5 h-5 mr-2 flex-shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              <span>Crear Nuevo Grupo</span>
            </Button>
          </div>

          {userGroups.length === 0 ? (
            <div className='bg-white rounded-2xl shadow-green-lg p-12 text-center'>
              <div className='w-24 h-24 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
                <svg
                  className='w-12 h-12 text-primary-600'
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
              <h2 className='text-2xl font-bold text-gray-900 mb-4'>
                ¡Empieza tu primera aventura deportiva!
              </h2>
              <p className='text-gray-600 mb-8 max-w-md mx-auto'>
                Crea tu primer grupo o únete a uno existente para empezar a
                organizar partidos y conectar con otros deportistas.
              </p>
              <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                <Button
                  onClick={() => router.push('/create-group')}
                  variant='primary'
                  className='shadow-green flex items-center justify-center'
                >
                  <svg
                    className='w-5 h-5 mr-2 flex-shrink-0'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 4v16m8-8H4'
                    />
                  </svg>
                  <span>Crear mi primer grupo</span>
                </Button>
                <Button
                  onClick={() => {
                    /* Implementar lógica para buscar grupos */
                  }}
                  variant='outline'
                >
                  Buscar grupos
                </Button>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {userGroups.map((group) => (
                <div
                  key={group.id}
                  className={`bg-white rounded-2xl shadow-green-lg p-6 transition-all duration-200 transform hover:scale-105 ${
                    group.userStatus !== 'PENDING'
                      ? 'hover:shadow-green cursor-pointer'
                      : 'opacity-90 cursor-default'
                  }`}
                  onClick={() => {
                    if (group.userStatus !== 'PENDING') {
                      handleGroupClick(group.id);
                    }
                  }}
                >
                  {/* Estado pendiente (solo si aplica) */}
                  {group.userStatus === 'PENDING' && (
                    <div className='flex items-center justify-end mb-4'>
                      <span className='px-3 py-1 text-xs font-medium text-warning-700 bg-warning-100 rounded-full'>
                        Pendiente
                      </span>
                    </div>
                  )}

                  {/* Contenido principal */}
                  <div className='mb-4'>
                    <div className='flex items-center gap-2 mb-2'>
                      <h2 className='text-xl font-bold text-gray-900'>
                        {group.name}
                      </h2>
                      {group.members.some(
                        (member) =>
                          member.id === session?.user?.id &&
                          member.role === 'ADMIN'
                      ) && (
                        <span className='px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full'>
                          Admin
                        </span>
                      )}
                    </div>
                    <p className='text-gray-600 text-sm mb-3 line-clamp-2'>
                      {group.description}
                    </p>
                  </div>

                  {/* Información del grupo */}
                  <div className='space-y-2 mb-4'>
                    <div className='flex items-center text-sm text-gray-500'>
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
                      <span>{group.location}</span>
                    </div>
                    <div className='flex items-center text-sm text-gray-500'>
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
                          d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z'
                        />
                      </svg>
                      <span>{group.members.length} miembros</span>
                    </div>
                  </div>

                  {/* Próximo partido (si existe) */}
                  {group.nextMatchDate && (
                    <div className='mt-4 p-3 bg-primary-50 rounded-xl border-l-4 border-primary-400'>
                      <p className='text-xs font-medium text-primary-700 mb-1'>
                        Próximo partido
                      </p>
                      <p className='text-sm text-primary-600'>
                        {group.nextMatchDate}
                      </p>
                      {group.nextMatchLocation && (
                        <p className='text-xs text-primary-500'>
                          {group.nextMatchLocation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Indicador de hover solo para grupos activos */}
                  {group.userStatus !== 'PENDING' && (
                    <div className='mt-4 pt-4 border-t border-gray-200'>
                      <div className='flex items-center justify-center text-primary-600 text-sm font-medium group-hover:text-primary-700'>
                        <span>Ver detalles</span>
                        <svg
                          className='w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform'
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
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Elementos decorativos de fondo */}
        <div className='fixed top-20 right-10 w-32 h-32 bg-primary-200 rounded-full opacity-20 animate-pulse pointer-events-none'></div>
        <div
          className='fixed bottom-20 left-10 w-24 h-24 bg-accent-300 rounded-full opacity-25 animate-pulse pointer-events-none'
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      {/* Modal para completar fecha de nacimiento */}
      <BirthdateModal
        isOpen={showBirthdateModal}
        onClose={handleBirthdateModalClose}
        onSuccess={handleBirthdateModalSuccess}
      />
    </Layout>
  );
}
