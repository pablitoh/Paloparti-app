import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

/**
 * Página principal - Solo redirige a la ruta adecuada
 * Maneja la redirección en el cliente para compatibilidad con export
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return; // Esperando a que cargue

    // Destinos por defecto según estado de autenticación
    const authenticatedDestination = '/groups';
    const unauthenticatedDestination = '/auth/signin';

    // Determinar la redirección según el estado de autenticación
    if (session) {
      console.log(
        'Usuario autenticado, redirigiendo a',
        authenticatedDestination
      );
      router.replace(authenticatedDestination);
    } else {
      console.log(
        'Usuario no autenticado, redirigiendo a',
        unauthenticatedDestination
      );
      router.replace(unauthenticatedDestination);
    }
  }, [session, status, router]);

  // Página de carga moderna con logo y colores de la app
  return (
    <div className='min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex flex-col items-center justify-center'>
      {/* Círculos decorativos de fondo */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse'></div>
        <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse delay-75'></div>
        <div className='absolute top-40 left-1/2 transform -translate-x-1/2 w-60 h-60 bg-lime-400 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse delay-150'></div>
      </div>

      {/* Contenido principal */}
      <div className='relative z-10 flex flex-col items-center justify-center space-y-8'>
        {/* Logo con animación */}
        <div className='relative'>
          <div className='absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-400 rounded-full blur-lg opacity-30 animate-pulse'></div>
          <div className='relative bg-white rounded-full p-6 shadow-green-lg'>
            <Image
              src='/logo.png'
              alt='Paloparti Logo'
              width={80}
              height={80}
              className='w-20 h-20 object-contain animate-bounce'
              priority
            />
          </div>
        </div>

        {/* Texto de carga */}
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-heading text-gray-800 animate-fade-in'>
            Cargando
          </h1>
          <p className='text-lg font-body text-gray-600 animate-fade-in delay-200'>
            Preparando tu experiencia deportiva
          </p>
        </div>

        {/* Spinner personalizado */}
        <div className='relative'>
          <div className='w-16 h-16 border-4 border-primary-200 rounded-full animate-spin'></div>
          <div className='absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-primary-500 rounded-full animate-spin'></div>
          <div className='absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-accent-400 rounded-full animate-spin animate-reverse'></div>
        </div>

        {/* Puntos de carga animados */}
        <div className='flex space-x-2'>
          <div className='w-3 h-3 bg-primary-400 rounded-full animate-bounce'></div>
          <div className='w-3 h-3 bg-primary-500 rounded-full animate-bounce delay-100'></div>
          <div className='w-3 h-3 bg-primary-600 rounded-full animate-bounce delay-200'></div>
        </div>
      </div>

      {/* Estilos personalizados */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .animate-reverse {
          animation: reverse 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
