import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

/**
 * Página principal - Solo redirige a la ruta adecuada
 * Se implementa únicamente en el servidor para evitar redirecciones en cliente
 * que podrían causar loops o flashes de contenido
 */
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Verificar si hay sesión activa
    const session = await getSession(context);

    // Verificar si estamos en ambiente de preview
    const isPreview = process.env.VERCEL_ENV === 'preview';

    // Destinos por defecto según ambiente y estado de autenticación
    const authenticatedDestination = '/groups';
    const unauthenticatedDestination = '/auth/signin';

    // Determinar la redirección según el estado de autenticación
    if (session) {
      console.log(
        'Usuario autenticado, redirigiendo a',
        authenticatedDestination
      );
      return {
        redirect: {
          destination: authenticatedDestination,
          permanent: false,
        },
      };
    } else {
      console.log(
        'Usuario no autenticado, redirigiendo a',
        unauthenticatedDestination
      );
      return {
        redirect: {
          destination: unauthenticatedDestination,
          permanent: false,
        },
      };
    }
  } catch (error) {
    console.error('Error en getServerSideProps de index:', error);

    // En caso de error, redirigir a signin para reiniciar el proceso
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }
};

/**
 * Este componente nunca debería renderizarse ya que siempre
 * redirigimos en el servidor con getServerSideProps
 */
export default function HomePage() {
  // Página de placeholder que no debería mostrarse nunca
  return (
    <div className='flex flex-col items-center justify-center min-h-screen py-2'>
      <main className='flex flex-col items-center justify-center flex-1 px-20 text-center'>
        <h1 className='text-6xl font-bold'>Redirigiendo...</h1>
      </main>
    </div>
  );
}
