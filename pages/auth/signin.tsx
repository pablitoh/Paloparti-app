import { GetServerSideProps } from 'next';
import { signIn, getSession } from 'next-auth/react';
import Layout from '../../components/Layout';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import Link from 'next/link';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  // Si ya está autenticado, redirigir a la página principal
  if (session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      callbackUrl: context.query.callbackUrl || '/',
    },
  };
};

export default function SignIn({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        toast.error(result.error);
      } else if (result?.url) {
        router.push(result.url);
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
                  callbackUrl !== '/'
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
