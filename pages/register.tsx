import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Button from '../components/Button';
import DatePickerField from '../components/DatePickerField';

export default function Register() {
  const router = useRouter();
  const { redirect } = router.query;
  const { register, user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    birthdate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si el usuario ya está autenticado, redirigir
    if (user && !authLoading) {
      if (typeof redirect === 'string' && redirect) {
        router.push(redirect);
      } else {
        router.push('/groups');
      }
    }
  }, [user, authLoading, router, redirect]);

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

    try {
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.birthdate
      );

      // Redireccionar según parámetro o a la página por defecto
      if (typeof redirect === 'string' && redirect) {
        router.push(redirect);
      } else {
        router.push('/groups');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Error al crear la cuenta. Por favor, intenta de nuevo.'
      );
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
                {error}
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
                Confirmar Contraseña
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
              disabled={loading}
              fullWidth
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-gray-600'>
              ¿Ya tienes una cuenta?{' '}
              <Link
                href={
                  redirect
                    ? `/auth/signin?callbackUrl=${encodeURIComponent(
                        redirect as string
                      )}`
                    : '/auth/signin'
                }
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
