import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import useSWR from 'swr';

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  memberCount: number;
}

interface InvitationInfo {
  token: string;
  expiresAt: string;
}

export default function Invitation() {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);

  // Define fetcher function for useSWR
  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  // Use SWR for data fetching
  const {
    data,
    isLoading: swrLoading,
    error: swrError,
  } = useSWR(
    token
      ? `/api/invitations/${
          typeof token === 'string' ? token.split(':')[0] : token
        }`
      : null,
    fetcher
  );

  // Fetch invitation details
  useEffect(() => {
    if (!token || typeof token !== 'string') return;

    const fetchInvitationDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Fetching invitation details for token:', token);
        const response = await fetch(`/api/invitations/${token.split(':')[0]}`);

        // Log response status for debugging
        console.log('API Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', response.status, errorData);
          throw new Error(errorData.message || 'Error al cargar la invitación');
        }

        const data = await response.json();
        console.log('Invitation data received:', data);

        setGroupInfo(data.group);
        setInvitationInfo(data.invitation);
      } catch (error) {
        console.error('Error al cargar la invitación:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'Error al cargar la invitación'
        );
        setGroupInfo(null);
        setInvitationInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitationDetails();
  }, [token]);

  // Handle join group action for authenticated users
  const handleJoinGroup = async () => {
    if (!user || !token || isJoining) return;

    try {
      setIsJoining(true);
      setError(null);

      console.log('Starting join process with token:', token);

      const response = await fetch('/api/invitations/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      console.log('Join API response status:', response.status);
      const data = await response.json();
      console.log('Join API response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Error al unirse al grupo');
      }

      // Si ya es miembro confirmado, redirigir al grupo
      if (data.status === 'CONFIRMED') {
        setJoinSuccess(true);
        setTimeout(() => {
          router.push(`/group/${data.groupId}`);
        }, 1500);
      } else {
        // Si está pendiente, mostrar mensaje de pendiente
        setPendingApproval(true);
        setGroupId(data.groupId);
      }
    } catch (error) {
      console.error('Error al unirse al grupo:', error);
      setError(
        error instanceof Error ? error.message : 'Error al unirse al grupo'
      );
    } finally {
      setIsJoining(false);
    }
  };

  // Loading state
  if (isLoading || authLoading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className='max-w-md mx-auto px-4 py-16 text-center'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>
              Invitación no válida
            </h1>
            <p className='text-gray-700 mb-6'>{error}</p>
            <Button onClick={() => router.push('/')} variant='primary'>
              Volver al inicio
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // No group info state
  if (!groupInfo || !invitationInfo) {
    return (
      <Layout>
        <div className='max-w-md mx-auto px-4 py-16 text-center'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-gray-800 mb-4'>
              Invitación no encontrada
            </h1>
            <p className='text-gray-700 mb-6'>
              No se ha encontrado la invitación solicitada o ha expirado.
            </p>
            <Button onClick={() => router.push('/')} variant='primary'>
              Volver al inicio
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Pending approval state
  if (pendingApproval) {
    return (
      <Layout>
        <div className='max-w-md mx-auto px-4 py-16 text-center'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-yellow-600 mb-4'>
              Solicitud enviada
            </h1>
            <p className='text-gray-700 mb-6'>
              Tu solicitud para unirte al grupo ha sido enviada. Deberás esperar
              a que un administrador la apruebe para poder acceder.
            </p>
            <Button onClick={() => router.push('/')} variant='primary'>
              Volver al inicio
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Success state - after joining
  if (joinSuccess) {
    return (
      <Layout>
        <div className='max-w-md mx-auto px-4 py-16 text-center'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-green-600 mb-4'>
              ¡Te has unido al grupo exitosamente!
            </h1>
            <p className='text-gray-700 mb-6'>
              Serás redirigido a la página del grupo en unos momentos...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-md mx-auto px-4 py-8'>
        <div className='bg-white rounded-lg shadow-md overflow-hidden'>
          <div className='bg-blue-600 text-white p-6'>
            <h1 className='text-2xl font-bold mb-2'>
              Invitación para unirse a {groupInfo.name}
            </h1>
            <p className='text-sm text-blue-100'>
              Deporte: {groupInfo.sport} • Ubicación: {groupInfo.location}
            </p>
          </div>

          <div className='p-6'>
            {groupInfo.description && (
              <div className='mb-6'>
                <h2 className='text-lg font-medium text-gray-800 mb-2'>
                  Descripción del grupo:
                </h2>
                <p className='text-gray-600'>{groupInfo.description}</p>
              </div>
            )}

            <div className='mb-6'>
              <div className='flex items-center gap-2 text-gray-700'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-5 w-5 text-blue-600'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z'
                    clipRule='evenodd'
                  />
                </svg>
                <span>{groupInfo.memberCount} miembros</span>
              </div>
            </div>

            {user ? (
              // Usuario ya autenticado
              <div className='text-center'>
                <p className='mb-4'>
                  Estás conectado como <strong>{user?.name}</strong>
                </p>
                <Button
                  onClick={handleJoinGroup}
                  variant='primary'
                  disabled={isJoining}
                  fullWidth
                >
                  {isJoining ? 'Uniéndose...' : 'Unirse al grupo'}
                </Button>
              </div>
            ) : (
              // Usuario no autenticado
              <div className='space-y-4'>
                <div className='text-center mb-4'>
                  <p className='text-gray-700'>
                    Para unirte a este grupo, debes iniciar sesión o registrarte
                  </p>
                </div>

                <Link href='/auth/signin' className='block w-full'>
                  <Button variant='primary' fullWidth>
                    Iniciar sesión
                  </Button>
                </Link>

                <div className='text-center text-gray-600 text-sm'>o</div>

                <Link href='/register' className='block w-full'>
                  <Button variant='outline' fullWidth>
                    Registrarme
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
