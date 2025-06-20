import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { clearAuthState, getSafeCallbackUrl } from '../lib/authUtils';
import { GetServerSideProps } from 'next';
import { getSession, signIn } from 'next-auth/react';
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

  // Si está cargando la autenticación, mostrar spinner
  if (authLoading) {
    return (
      <div className='min-h-screen bg-gradient-green flex justify-center items-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white'></div>
      </div>
    );
  }

  // Si ya está autenticado, no mostrar el formulario
  if (user) {
    return null;
  }

  return (
    <div className='min-h-screen bg-gradient-green flex items-center justify-center px-4 py-8'>
      <div className='w-full max-w-sm'>
        {/* Logo/Shield */}
        <div className='text-center mb-6'>
          <div className='mx-auto w-28 h-28 mb-4'>
            <img
              src='/logo.png'
              alt='Paloparti Logo'
              className='w-full h-full object-contain drop-shadow-lg'
            />
          </div>
          <h1 className='text-3xl font-bold text-white mb-1 tracking-wide'>
            PALOPARTI
          </h1>
          <p className='text-white/80 text-sm'>¡Únete a nosotros!</p>
        </div>

        {/* Error message */}
        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm'>
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className='space-y-3'>
          <input
            type='text'
            name='name'
            placeholder='Nombre completo'
            className='w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200'
            value={formData.name}
            onChange={handleChange}
            required
          />

          <input
            type='email'
            name='email'
            placeholder='Correo electrónico'
            className='w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200'
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type='password'
            name='password'
            placeholder='Contraseña'
            className='w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200'
            value={formData.password}
            onChange={handleChange}
            required
          />

          <input
            type='password'
            name='confirmPassword'
            placeholder='Confirmar contraseña'
            className='w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200'
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />

          <input
            type='date'
            name='birthdate'
            placeholder='Fecha de nacimiento'
            className='w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-4 focus:ring-white/50 focus:bg-white transition-all duration-200'
            value={formData.birthdate}
            onChange={handleChange}
            max={maxDate}
            required
          />

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        {/* Separador */}
        <div className='flex items-center justify-center my-4'>
          <div className='w-6 h-6 bg-white/20 rounded-full flex items-center justify-center'>
            <div className='w-1.5 h-1.5 bg-white/60 rounded-full'></div>
          </div>
        </div>

        {/* Ya tienes cuenta */}
        <Link href='/auth/signin'>
          <button className='w-full bg-transparent border-2 border-white/30 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:bg-white/10 hover:border-white/50 mb-4'>
            Ya tengo cuenta
          </button>
        </Link>

        {/* Botón de Google habilitado */}
        <div className='space-y-2'>
          <button
            onClick={handleGoogleSignIn}
            className='w-full bg-white/90 backdrop-blur-sm text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:bg-white flex items-center justify-center space-x-3'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24'>
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
            <span>Registrarse con Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
