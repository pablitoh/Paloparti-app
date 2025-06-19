import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Layout from '../../components/Layout';
import { format, subYears } from 'date-fns';
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

  // Calculate maximum date (12 years ago from today) to ensure minimum age of 12
  const maxDate = format(subYears(new Date(), 12), 'yyyy-MM-dd');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
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
        setIsGoogleUser(data.user.isGoogleUser || false);
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
        <div className='min-h-screen bg-gradient-green-soft flex items-center justify-center py-12'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4'></div>
            <h1 className='text-2xl font-bold text-gray-900 mb-2'>
              Editar Perfil
            </h1>
            <p className='text-primary-700 font-medium'>
              Cargando tu información...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-green-soft'>
        <div className='max-w-2xl mx-auto px-4 py-8'>
          {/* Header con breadcrumb */}
          <div className='mb-8'>
            <Link
              href='/profile'
              className='inline-flex items-center text-primary-600 hover:text-primary-700 transition-colors mb-4 bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-green'
            >
              <ArrowLeftIcon className='h-5 w-5 mr-2' />
              Volver al Perfil
            </Link>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Editar Perfil
              </h1>
              <p className='text-gray-600'>
                Actualiza tu información personal y configuración
              </p>
            </div>
          </div>

          {/* Banner informativo para usuarios de Google */}
          {isGoogleUser && (
            <div className='bg-blue-50 border-l-4 border-blue-400 p-4 mb-6'>
              <div className='flex'>
                <div className='flex-shrink-0'>
                  <svg className='h-5 w-5 text-blue-400' viewBox='0 0 24 24'>
                    <path
                      fill='#4285F4'
                      d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                    />
                    <path
                      fill='#34A853'
                      d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                    />
                    <path
                      fill='#FBBC05'
                      d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                    />
                    <path
                      fill='#EA4335'
                      d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <p className='text-sm text-blue-700'>
                    <strong>Cuenta de Google:</strong> Has iniciado sesión con
                    Google. Puedes actualizar tu información personal aquí, pero
                    la autenticación se maneja a través de Google.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card principal de información personal */}
          <div className='bg-white rounded-2xl shadow-green-lg overflow-hidden mb-6'>
            {/* Header de la sección */}
            <div className='bg-gradient-green-light p-6 border-b border-primary-100'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center'>
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
                      d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                    />
                  </svg>
                </div>
                <h2 className='text-xl font-semibold text-gray-900'>
                  Información Personal
                </h2>
              </div>
            </div>

            <div className='p-6'>
              {/* Avatar Upload Section */}
              <div className='mb-8'>
                <label className='block text-sm font-medium text-gray-700 mb-4'>
                  Foto de Perfil
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

              <form onSubmit={updateProfile} className='space-y-6'>
                <div>
                  <label
                    htmlFor='name'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Nombre completo
                  </label>
                  <input
                    id='name'
                    name='name'
                    type='text'
                    value={userData.name}
                    onChange={handleInputChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors'
                    placeholder='Ingresa tu nombre completo'
                  />
                </div>

                <DatePickerField
                  id='birthdate'
                  name='birthdate'
                  label='Fecha de nacimiento'
                  value={userData.birthdate}
                  onChange={handleInputChange}
                  maxDate={maxDate}
                  className='[&>input]:rounded-xl [&>input]:border-gray-300 [&>input]:px-4 [&>input]:py-3 [&>input]:focus:ring-2 [&>input]:focus:ring-primary-500 [&>input]:focus:border-primary-500'
                />

                <button
                  type='submit'
                  disabled={isSaving || !hasChanges()}
                  className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 transform ${
                    isSaving || !hasChanges()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-green text-white hover:shadow-green focus:outline-none focus:ring-4 focus:ring-primary-200 active:scale-95'
                  }`}
                >
                  {isSaving ? (
                    <div className='flex items-center justify-center'>
                      <div className='animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2'></div>
                      Guardando...
                    </div>
                  ) : hasChanges() ? (
                    <div className='flex items-center justify-center'>
                      <svg
                        className='w-5 h-5 mr-2'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      Guardar Cambios
                    </div>
                  ) : (
                    <div className='flex items-center justify-center'>
                      <svg
                        className='w-5 h-5 mr-2'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      Sin Cambios
                    </div>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Card de cambio de contraseña - Solo para usuarios no Google */}
          {!isGoogleUser && (
            <div className='bg-white rounded-2xl shadow-green-lg overflow-hidden'>
              {/* Header de la sección */}
              <div className='bg-gradient-green-light p-6 border-b border-primary-100'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center'>
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
                        d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                      />
                    </svg>
                  </div>
                  <h2 className='text-xl font-semibold text-gray-900'>
                    Cambiar Contraseña
                  </h2>
                </div>
              </div>

              <div className='p-6'>
                <form onSubmit={updatePassword} className='space-y-6'>
                  <div>
                    <label
                      htmlFor='current'
                      className='block text-sm font-medium text-gray-700 mb-2'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors'
                      placeholder='Ingresa tu contraseña actual'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='new'
                      className='block text-sm font-medium text-gray-700 mb-2'
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
                      className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors'
                      placeholder='Ingresa tu nueva contraseña'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='confirm'
                      className='block text-sm font-medium text-gray-700 mb-2'
                    >
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      id='confirm'
                      name='confirm'
                      type='password'
                      value={password.confirm}
                      onChange={handlePasswordChange}
                      required
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none transition-colors ${
                        password.confirm &&
                        password.new &&
                        password.new !== password.confirm
                          ? 'border-error-300 bg-error-50 focus:ring-2 focus:ring-error-500 focus:border-error-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                      placeholder='Confirma tu nueva contraseña'
                    />
                    {password.confirm &&
                      password.new &&
                      password.new !== password.confirm && (
                        <div className='mt-2 flex items-center text-error-600'>
                          <svg
                            className='w-4 h-4 mr-2'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                          </svg>
                          <p className='text-sm'>
                            Las contraseñas no coinciden
                          </p>
                        </div>
                      )}
                  </div>

                  <button
                    type='submit'
                    disabled={isSaving || !isPasswordFormValid()}
                    className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 transform ${
                      isSaving || !isPasswordFormValid()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-green text-white hover:shadow-green focus:outline-none focus:ring-4 focus:ring-primary-200 active:scale-95'
                    }`}
                  >
                    {isSaving ? (
                      <div className='flex items-center justify-center'>
                        <div className='animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2'></div>
                        Actualizando...
                      </div>
                    ) : isPasswordFormValid() ? (
                      <div className='flex items-center justify-center'>
                        <svg
                          className='w-5 h-5 mr-2'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                          />
                        </svg>
                        Actualizar Contraseña
                      </div>
                    ) : hasPasswordData() ? (
                      <div className='flex items-center justify-center'>
                        <svg
                          className='w-5 h-5 mr-2'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        Complete todos los campos
                      </div>
                    ) : (
                      <div className='flex items-center justify-center'>
                        <svg
                          className='w-5 h-5 mr-2'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                          />
                        </svg>
                        Actualizar Contraseña
                      </div>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
