import { GetServerSideProps } from 'next';
import { signIn, getSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { clearAuthState, getSafeCallbackUrl } from '../../lib/authUtils';

/**
 * Simplificación de la página de inicio de sesión
 * Sin gestión compleja de callbackUrl para evitar loops
 */
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Verificar si hay sesión activa
    const session = await getSession(context);

    // Si el usuario ya está autenticado, redirigirlo a /groups
    if (session) {
      // Check for callbackUrl
      const callbackUrl = context.query.callbackUrl as string | undefined;
      const redirectUrl = getSafeCallbackUrl(callbackUrl, '/groups');

      return {
        redirect: {
          destination: redirectUrl,
          permanent: false,
        },
      };
    }

    // Si no hay sesión, mostrar página de login
    return {
      props: {
        error: context.query.error || null,
        callbackUrl: context.query.callbackUrl || null,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps de signin:', error);
    return {
      props: {
        error: 'Error al procesar la solicitud',
        callbackUrl: null,
      },
    };
  }
};

interface SignInProps {
  error?: string | null;
  callbackUrl?: string | null;
}

export default function SignIn({ error, callbackUrl }: SignInProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Mostrar error si viene de SSR o query params
  useEffect(() => {
    if (error) {
      toast.error(typeof error === 'string' ? error : 'Error de autenticación');
    }
  }, [error]);

  // Limpiar estado de autenticación al cargar la página para evitar problemas
  useEffect(() => {
    clearAuthState();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use callbackUrl if available
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error);
      } else {
        // Si el login fue exitoso, redireccionar según callbackUrl
        const redirectUrl = getSafeCallbackUrl(
          callbackUrl as string,
          '/groups'
        );
        router.replace(redirectUrl);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      toast.error('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-md w-full space-y-8'>
          <div>
            <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
              Iniciar Sesión
            </h2>
          </div>
          <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
            <div className='rounded-md shadow-sm -space-y-px'>
              <div>
                <label htmlFor='email' className='sr-only'>
                  Email
                </label>
                <input
                  id='email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor='password' className='sr-only'>
                  Contraseña
                </label>
                <input
                  id='password'
                  name='password'
                  type='password'
                  autoComplete='current-password'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Contraseña'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type='submit'
                className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-gray-600'>
              ¿No tienes una cuenta?{' '}
              <Link
                href='/register'
                legacyBehavior={false}
                className='text-blue-600 hover:underline'
              >
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
