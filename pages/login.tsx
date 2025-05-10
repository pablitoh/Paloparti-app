import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { clearAuthState } from '../lib/authUtils';

/**
 * Página de redirección simple a la página de inicio de sesión
 * Sin gestión compleja de redirecciones para evitar loops
 */
export default function RedirectToSignIn() {
  const router = useRouter();

  useEffect(() => {
    if (router.isReady) {
      // Limpiar estado de autenticación
      clearAuthState();

      // Redirección simple a la página de inicio de sesión
      router.replace('/auth/signin');
    }
  }, [router]);

  return (
    <div className='flex justify-center items-center min-h-screen'>
      <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
    </div>
  );
}
