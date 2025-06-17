import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import DatePickerField, {
  formatDateForInput,
} from '../../components/DatePickerField';
import AvatarUpload from '../../components/AvatarUpload';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { showSuccessToast, showErrorToast } from '../../services/toastService';

interface EditProfileProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

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
        'No session found in profile/edit getServerSideProps, redirecting to signin'
      );
      return {
        redirect: {
          destination: '/auth/signin?callbackUrl=/profile/edit',
          permanent: false,
        },
      };
    }

    // Debug logging para preview
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('Profile edit getServerSideProps - Session found:', {
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
    console.error('Error in profile/edit getServerSideProps:', error);

    // En caso de error, redirigir a signin
    return {
      redirect: {
        destination: '/auth/signin?callbackUrl=/profile/edit',
        permanent: false,
      },
    };
  }
};

export default function EditProfile({ user: serverUser }: EditProfileProps) {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { user: clientUser, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState<{
    name: string;
    birthdate: string;
    image: string | null;
  }>({
    name: '',
    birthdate: '',
    image: null,
  });
  const [originalUserData, setOriginalUserData] = useState<{
    name: string;
    birthdate: string;
    image: string | null;
  }>({
    name: '',
    birthdate: '',
    image: null,
  });
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [pendingAvatarDelete, setPendingAvatarDelete] = useState(false);
  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const avatarUploadRef = useRef<{
    uploadSelectedFile: () => Promise<string | null>;
    deleteAvatar: () => Promise<void>;
  }>(null);

  // Función para detectar si hay cambios
  const hasChanges = () => {
    return (
      userData.name !== originalUserData.name ||
      userData.birthdate !== originalUserData.birthdate ||
      userData.image !== originalUserData.image ||
      selectedAvatarFile !== null ||
      pendingAvatarDelete
    );
  };

  // Función para detectar si hay información en el formulario de contraseña
  const hasPasswordData = () => {
    return (
      password.current.trim() !== '' ||
      password.new.trim() !== '' ||
      password.confirm.trim() !== ''
    );
  };

  // Función para validar el formulario de contraseña
  const isPasswordFormValid = () => {
    return (
      password.current.trim() !== '' &&
      password.new.trim() !== '' &&
      password.confirm.trim() !== '' &&
      password.new === password.confirm
    );
  };

  useEffect(() => {
    // Ya tenemos verificación del servidor, solo necesitamos cargar los datos del perfil
    const fetchUserData = async () => {
      try {
        console.log('Fetching user data for server-verified user...');
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
        console.log('Profile data received for edit:', data);

        const initialData = {
          name: data.user.name || serverUser.name || '',
          birthdate: data.user.birthdate
            ? formatDateForInput(data.user.birthdate)
            : '',
          image: data.user.image || serverUser.image || null,
        };

        setUserData(initialData);
        setOriginalUserData(initialData);
      } catch (error) {
        console.error('Error fetching user data:', error);
        showErrorToast('Error al cargar los datos del usuario');
      } finally {
        setIsLoading(false);
      }
    };

    // Cargar datos inmediatamente ya que tenemos verificación del servidor
    fetchUserData();
  }, [router, serverUser]);

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

  const handleAvatarChange = (newAvatarUrl: string | null) => {
    setUserData((prevData) => ({
      ...prevData,
      image: newAvatarUrl,
    }));
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedAvatarFile(file);
  };

  const handleDeleteRequest = () => {
    setPendingAvatarDelete(!pendingAvatarDelete);
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (!session) {
      showErrorToast('No hay sesión activa. Por favor inicia sesión de nuevo.');
      setIsSaving(false);
      return;
    }

    try {
      // Primero subir la imagen si hay una seleccionada
      if (selectedAvatarFile && avatarUploadRef.current) {
        await avatarUploadRef.current.uploadSelectedFile();
        // La imagen se actualiza automáticamente a través del callback handleAvatarChange
      }

      // Eliminar avatar si está marcado para eliminación
      if (pendingAvatarDelete && avatarUploadRef.current) {
        await avatarUploadRef.current.deleteAvatar();
        setPendingAvatarDelete(false);
        // Actualizar la imagen a null
        setUserData((prev) => ({ ...prev, image: null }));
      }

      // Luego actualizar el resto del perfil
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

      // Update the session to reflect the new user data
      await update({
        ...session,
        user: {
          ...session.user,
          name: userData.name,
          image: userData.image,
        },
      });

      showSuccessToast('Perfil actualizado correctamente');
      setSelectedAvatarFile(null); // Limpiar el archivo seleccionado
      setPendingAvatarDelete(false); // Limpiar eliminación pendiente

      // Actualizar los datos originales para que el botón se deshabilite
      setOriginalUserData({
        name: userData.name,
        birthdate: userData.birthdate,
        image: userData.image,
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      showErrorToast(
        error instanceof Error ? error.message : 'Error al actualizar el perfil'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) {
      showErrorToast('No hay sesión activa. Por favor inicia sesión de nuevo.');
      return;
    }

    if (password.new !== password.confirm) {
      showErrorToast('Las contraseñas nuevas no coinciden');
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

      showSuccessToast('Contraseña actualizada correctamente');
      setPassword({
        current: '',
        new: '',
        confirm: '',
      });
    } catch (error) {
      console.error('Error updating password:', error);
      showErrorToast(
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
        {/* Enlace para volver al perfil */}
        <div className='mb-4'>
          <Link
            href='/profile'
            className='inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors'
          >
            <ArrowLeftIcon className='h-4 w-4 mr-1' />
            Volver al Perfil
          </Link>
        </div>

        <div className='bg-white rounded-xl shadow-md p-6'>
          <h1 className='text-2xl font-bold mb-6 text-center'>Editar Perfil</h1>

          <div className='mb-6'>
            <h2 className='text-xl font-semibold mb-4'>Información Personal</h2>

            {/* Avatar Upload Section */}
            <div className='mb-6'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Avatar
              </label>
              <div className='flex justify-center'>
                <AvatarUpload
                  ref={avatarUploadRef}
                  currentAvatar={userData.image}
                  onAvatarChange={handleAvatarChange}
                  onFileSelect={handleFileSelect}
                  onDeleteRequested={handleDeleteRequest}
                  size='large'
                  autoUpload={false}
                  fallbackText={userData.name || serverUser.name || 'U'}
                />
              </div>
            </div>

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
                disabled={isSaving || !hasChanges()}
                className={`w-full py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isSaving || !hasChanges()
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSaving
                  ? 'Guardando...'
                  : hasChanges()
                  ? 'Guardar Cambios'
                  : 'Sin Cambios'}
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    password.confirm &&
                    password.new &&
                    password.new !== password.confirm
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {password.confirm &&
                  password.new &&
                  password.new !== password.confirm && (
                    <p className='text-red-500 text-xs mt-1'>
                      Las contraseñas no coinciden
                    </p>
                  )}
              </div>
              <button
                type='submit'
                disabled={isSaving || !isPasswordFormValid()}
                className={`w-full py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isSaving || !isPasswordFormValid()
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSaving
                  ? 'Actualizando...'
                  : isPasswordFormValid()
                  ? 'Actualizar Contraseña'
                  : hasPasswordData()
                  ? 'Complete todos los campos'
                  : 'Actualizar Contraseña'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
