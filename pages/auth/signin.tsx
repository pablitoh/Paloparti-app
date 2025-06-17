import { GetServerSideProps } from 'next';
import { signIn, getSession } from 'next-auth/react';
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

  const handleGoogleSignIn = () => {
    signIn('google', {
      callbackUrl: getSafeCallbackUrl(callbackUrl as string, '/groups'),
    });
  };

  const handleAppleSignIn = () => {
    signIn('apple', {
      callbackUrl: getSafeCallbackUrl(callbackUrl as string, '/groups'),
    });
  };

  return (
    <div className='min-h-screen bg-gradient-green flex items-center justify-center px-4'>
      <div className='w-full max-w-sm'>
        {/* Logo/Shield */}
        <div className='text-center mb-8'>
          <div className='mx-auto w-32 h-32 mb-6'>
            <img
              src='/logo.png'
              alt='Paloparti Logo'
              className='w-full h-full object-contain drop-shadow-lg'
            />
          </div>
          <h1 className='text-4xl font-bold text-white mb-2 tracking-wide'>
            PALOPARTI
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <input
              type='email'
              placeholder='Correo electrónico'
              className='w-full px-6 py-4 bg-white/90 backdrop-blur-sm rounded-2xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200 text-lg'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <input
              type='password'
              placeholder='Contraseña'
              className='w-full px-6 py-4 bg-white/90 backdrop-blur-sm rounded-2xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200 text-lg'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Separador */}
        <div className='flex items-center justify-center my-6'>
          <div className='w-8 h-8 bg-white/20 rounded-full flex items-center justify-center'>
            <div className='w-2 h-2 bg-white/60 rounded-full'></div>
          </div>
        </div>

        {/* Crear cuenta */}
        <Link href='/register'>
          <button className='w-full bg-transparent border-2 border-white/30 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 hover:bg-white/10 hover:border-white/50 mb-6 text-lg'>
            Crear cuenta
          </button>
        </Link>

        {/* Botones sociales - Ocultos por ahora */}
        {/* 
        <div className='space-y-3'>
          <button
            onClick={handleGoogleSignIn}
            className='w-full bg-white/90 backdrop-blur-sm text-gray-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-200 hover:bg-white flex items-center justify-center space-x-3 text-lg'
          >
            <svg className='w-6 h-6' viewBox='0 0 24 24'>
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
            <span>Iniciar con Google</span>
          </button>

          <button
            onClick={handleAppleSignIn}
            className='w-full bg-black/20 backdrop-blur-sm text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 hover:bg-black/30 flex items-center justify-center space-x-3 text-lg'
          >
            <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
              <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
            </svg>
            <span>Iniciar con Apple</span>
          </button>
        </div>
        */}
      </div>
    </div>
  );
}
