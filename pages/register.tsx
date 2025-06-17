import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Button from '../components/Button';
import DatePickerField from '../components/DatePickerField';
import { clearAuthState, getSafeCallbackUrl } from '../lib/authUtils';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { subYears, format, differenceInYears } from 'date-fns';

/**
 * Página de registro simplificada
 * Sin gestión compleja de redirects para evitar loops
 */

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Verificar si hay sesión activa
    const session = await getSession(context);

    // Si el usuario ya está autenticado, redirigir según callbackUrl
    if (session) {
      const callbackUrl = context.query.callbackUrl as string | undefined;
      const redirectUrl = getSafeCallbackUrl(callbackUrl, '/groups');

      return {
        redirect: {
          destination: redirectUrl,
          permanent: false,
        },
      };
    }

    // Si no hay sesión, mostrar página de registro
    return {
      props: {
        callbackUrl: context.query.callbackUrl || null,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps de register:', error);
    return {
      props: {
        callbackUrl: null,
      },
    };
  }
};

interface RegisterProps {
  callbackUrl?: string | null;
}

export default function Register({ callbackUrl }: RegisterProps) {
  const router = useRouter();
  const { register, user, loading: authLoading } = useAuth();

  // Calculate maximum date (12 years ago from today) to ensure minimum age of 12
  const maxDate = format(subYears(new Date(), 12), 'yyyy-MM-dd');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    birthdate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Limpia estado de autenticación al cargar
  useEffect(() => {
    clearAuthState();
  }, []);

  useEffect(() => {
    // Si el usuario ya está autenticado, redirigir según callbackUrl
    if (user && !authLoading) {
      const redirectUrl = getSafeCallbackUrl(callbackUrl as string, '/groups');
      router.push(redirectUrl);
    }
  }, [user, authLoading, router, callbackUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (!formData.birthdate) {
      setError('La fecha de nacimiento es obligatoria');
      setLoading(false);
      return;
    }

    // Validar edad mínima de 12 años
    const birthDate = new Date(formData.birthdate);
    const today = new Date();
    const age = differenceInYears(today, birthDate);

    if (age < 12) {
      setError('Debes tener al menos 12 años para registrarte');
      setLoading(false);
      return;
    }

    try {
      // Registrarse y luego redirigir a la página principal
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.birthdate
      );

      // Redirigir según callbackUrl
      const redirectUrl = getSafeCallbackUrl(callbackUrl as string, '/groups');
      router.push(redirectUrl);
    } catch (err) {
      // Extraer mensaje de error
      let errorMessage =
        'Error al crear la cuenta. Por favor, intenta de nuevo.';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Si está cargando la autenticación, mostrar spinner
  if (authLoading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  // Si ya está autenticado, no mostrar el formulario
  if (user) {
    return null;
  }

  return (
    <Layout>
      <div className='max-w-md mx-auto px-4 py-12'>
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h1 className='text-2xl font-bold text-center text-gray-900 mb-6'>
            Crear una cuenta
          </h1>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {error && (
              <div className='p-3 bg-red-50 border border-red-200 text-red-600 rounded'>
                <p className='font-medium'>{error}</p>
                {error.includes('El correo electrónico ya está registrado') && (
                  <p className='mt-1 text-sm'>
                    <Link
                      href='/auth/signin'
                      className='text-blue-600 hover:underline'
                    >
                      Inicia sesión aquí
                    </Link>
                  </p>
                )}
              </div>
            )}

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
                required
                value={formData.name}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Email
              </label>
              <input
                id='email'
                name='email'
                type='email'
                autoComplete='email'
                required
                value={formData.email}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <DatePickerField
              id='birthdate'
              name='birthdate'
              label='Fecha de nacimiento'
              value={formData.birthdate}
              onChange={handleChange}
              required={true}
              maxDate={maxDate}
            />

            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Contraseña
              </label>
              <input
                id='password'
                name='password'
                type='password'
                autoComplete='new-password'
                required
                value={formData.password}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='confirmPassword'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Confirmar contraseña
              </label>
              <input
                id='confirmPassword'
                name='confirmPassword'
                type='password'
                autoComplete='new-password'
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <Button
              type='submit'
              variant='primary'
              fullWidth
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-gray-600'>
              ¿Ya tienes una cuenta?{' '}
              <Link
                href='/auth/signin'
                legacyBehavior={false}
                className='text-blue-600 hover:underline'
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
