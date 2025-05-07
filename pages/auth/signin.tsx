import { GetServerSideProps } from 'next';
import { signIn, getSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import Link from 'next/link';

// Detectar si estamos en ambiente de Vercel Preview
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

// Función para limpiar URLs de parámetros de toolbar de Vercel
function cleanCallbackUrl(url: string): string {
  try {
    // Si la URL contiene parámetros de Vercel toolbar, eliminarlos
    if (url.includes('__vercel_')) {
      const urlObj = new URL(url, 'https://example.com');
      // Remover todos los parámetros que empiezan con __vercel_
      [...urlObj.searchParams.keys()].forEach((key) => {
        if (key.startsWith('__vercel_')) {
          urlObj.searchParams.delete(key);
        }
      });

      // Retornar solo el pathname y search limpio
      return urlObj.pathname + (urlObj.search !== '?' ? urlObj.search : '');
    }
    return url;
  } catch (e) {
    // Si hay algún error, devolver /groups por seguridad
    return '/groups';
  }
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  // En ambientes de preview, siempre redirigir a /groups después de login
  const defaultCallbackUrl = isVercelPreview ? '/groups' : '/groups';

  // Obtener y limpiar callbackUrl
  let rawCallbackUrl = context.query.callbackUrl
    ? String(context.query.callbackUrl)
    : defaultCallbackUrl;

  // Limpiar parámetros Vercel toolbar del callbackUrl
  const callbackUrl = cleanCallbackUrl(rawCallbackUrl);

  // Si es la página de signin, redireccionar a /groups para evitar loops
  if (callbackUrl.includes('/auth/signin')) {
    return {
      props: {
        callbackUrl: defaultCallbackUrl,
      },
    };
  }

  // Si ya está autenticado, redirigir
  if (session) {
    console.log('Session found, redirecting to:', callbackUrl);
    return {
      redirect: {
        destination: callbackUrl || defaultCallbackUrl,
        permanent: false,
      },
    };
  }

  return {
    props: {
      callbackUrl: callbackUrl || defaultCallbackUrl,
      isPreview:
        !!process.env.VERCEL_ENV && process.env.VERCEL_ENV === 'preview',
    },
  };
};

export default function SignIn({
  callbackUrl,
  isPreview,
}: {
  callbackUrl: string;
  isPreview?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Al cargar, limpiar cualquier dato de sesión local corrupto
  useEffect(() => {
    if (isPreview) {
      // En ambientes de preview, limpiar localStorage y cookies
      try {
        // Limpiar localStorage
        localStorage.removeItem('next-auth.session-token');
        localStorage.removeItem('next-auth.callback-url');
        localStorage.removeItem('next-auth.csrf-token');
        sessionStorage.clear();

        // Limpiar cookies (estableciéndolas con fecha expirada)
        document.cookie =
          'next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie =
          'next-auth.csrf-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie =
          'next-auth.callback-url=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) {
        // Si hay errores al limpiar, ignoramos
      }
    }
  }, [isPreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // En preview, siempre usar /groups como callbackUrl
      const safeCallbackUrl = isPreview
        ? '/groups'
        : callbackUrl && callbackUrl !== '/auth/signin'
        ? callbackUrl
        : '/groups';

      console.log('Iniciando sesión con callbackUrl:', safeCallbackUrl);

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: safeCallbackUrl,
      });

      if (result?.error) {
        toast.error(result.error);
      } else if (result?.url) {
        console.log(
          'Redirección después de login a:',
          isPreview ? '/groups' : result.url
        );

        // En preview, siempre ir a /groups
        if (isPreview) {
          router.replace('/groups');
        } else {
          // Limpiar la URL antes de redireccionar
          const cleanUrl = cleanCallbackUrl(result.url);
          router.replace(cleanUrl);
        }
      }
    } catch (error) {
      toast.error('Error al iniciar sesión');
      console.error('Error signing in:', error);
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
            {isPreview && (
              <p className='mt-2 text-center text-sm text-orange-600'>
                Ambiente de Preview - Autenticación simplificada
              </p>
            )}
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
                href={
                  callbackUrl !== '/groups'
                    ? `/register?redirect=${encodeURIComponent(callbackUrl)}`
                    : '/register'
                }
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
