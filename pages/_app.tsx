import '../styles/globals.css';
import 'tailwindcss/tailwind.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { clearAllToasts } from '../services/toastService';

function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();

  // Crear un nuevo QueryClient en cada cambio de ruta
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Siempre considerar datos como obsoletos
            gcTime: 0, // No guardar en caché (reemplaza a cacheTime)
            retry: 1,
            refetchOnMount: 'always', // Siempre refetch al montar
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  );

  // Forzar invalidación de todas las consultas en cambios de ruta
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Skip invalidation for auth-related redirects to prevent loop
      if (url.includes('/auth/signin') || url.includes('/register')) {
        console.log('Skipping invalidation for auth route:', url);
        return;
      }

      console.log('Invalidando consultas relevantes en cambio de ruta a:', url);
      // Solo invalidar las consultas activas en lugar de limpiar toda la caché
      queryClient.invalidateQueries({
        refetchType: 'active',
      });
      // Limpiar los toasts activos
      clearAllToasts();
    };

    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider
        session={session}
        // Set a very short refetchInterval to handle auth state changes quickly
        refetchInterval={30} // 30 seconds - more aggressive session polling
        refetchOnWindowFocus={true}
        refetchWhenOffline={false} // Don't attempt to refetch when offline
      >
        <AuthProvider>
          <Component {...pageProps} key={router.asPath} />
          <Toaster
            position='bottom-right'
            toastOptions={{
              duration: 3000,
              // Limitar el número de toasts visibles a la vez
              success: {
                duration: 3000,
              },
              error: {
                duration: 4000,
              },
            }}
          />
        </AuthProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;
