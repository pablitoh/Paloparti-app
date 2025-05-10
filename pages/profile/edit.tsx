import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSession, getSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import DatePickerField, {
  formatDateForInput,
} from '../../components/DatePickerField';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin?callbackUrl=/profile/edit',
        permanent: false,
      },
    };
  }

  return {
    props: { session },
  };
};

export default function EditProfile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState<{
    name: string;
    birthdate: string;
  }>({
    name: '',
    birthdate: '',
  });
  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/profile/edit');
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Error fetching profile data');
        }

        const data = await response.json();

        setUserData({
          name: data.user.name || '',
          birthdate: data.user.birthdate
            ? formatDateForInput(data.user.birthdate)
            : '',
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Error al cargar los datos del usuario');
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchUserData();
    }
  }, [session, status, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPassword((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    if (!session) {
      setError('No hay sesión activa. Por favor inicia sesión de nuevo.');
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          birthdate: userData.birthdate || null,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al actualizar el perfil');
      }

      setSuccessMessage('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(
        error instanceof Error ? error.message : 'Error al actualizar el perfil'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!session) {
      setError('No hay sesión activa. Por favor inicia sesión de nuevo.');
      setIsSaving(false);
      return;
    }

    if (password.new !== password.confirm) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.new,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al actualizar la contraseña');
      }

      setSuccessMessage('Contraseña actualizada correctamente');
      setPassword({
        current: '',
        new: '',
        confirm: '',
      });
    } catch (error) {
      console.error('Error updating password:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Error al actualizar la contraseña'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <Layout>
        <div className='max-w-md mx-auto px-4 py-8'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold mb-4'>Editar Perfil</h1>
            <p>Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-md mx-auto px-4 py-8'>
        <div className='bg-white rounded-xl shadow-md p-6'>
          <h1 className='text-2xl font-bold mb-6 text-center'>Editar Perfil</h1>

          {successMessage && (
            <div className='bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4'>
              {successMessage}
            </div>
          )}
          {error && (
            <div className='bg-red-50 border border-red-200 text-red-600 p-3 rounded mb-4'>
              {error}
            </div>
          )}

          <div className='mb-6'>
            <h2 className='text-xl font-semibold mb-4'>Información Personal</h2>
            <form onSubmit={updateProfile} className='space-y-4'>
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Nombre
                </label>
                <input
                  id='name'
                  name='name'
                  type='text'
                  value={userData.name}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
              <DatePickerField
                id='birthdate'
                name='birthdate'
                label='Fecha de nacimiento'
                value={userData.birthdate}
                onChange={handleInputChange}
                className=''
              />
              <button
                type='submit'
                disabled={isSaving}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              >
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>

          <div className='border-t border-gray-200 pt-6'>
            <h2 className='text-xl font-semibold mb-4'>Cambiar Contraseña</h2>
            <form onSubmit={updatePassword} className='space-y-4'>
              <div>
                <label
                  htmlFor='current'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Contraseña Actual
                </label>
                <input
                  id='current'
                  name='current'
                  type='password'
                  value={password.current}
                  onChange={handlePasswordChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
              <div>
                <label
                  htmlFor='new'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Nueva Contraseña
                </label>
                <input
                  id='new'
                  name='new'
                  type='password'
                  value={password.new}
                  onChange={handlePasswordChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
              <div>
                <label
                  htmlFor='confirm'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Confirmar Contraseña
                </label>
                <input
                  id='confirm'
                  name='confirm'
                  type='password'
                  value={password.confirm}
                  onChange={handlePasswordChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
              <button
                type='submit'
                disabled={isSaving}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              >
                {isSaving ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </form>
          </div>

          <div className='mt-6'>
            <button
              onClick={() => router.push('/profile')}
              className='w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
            >
              Volver al Perfil
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
