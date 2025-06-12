import '../styles/globals.css';
import 'tailwindcss/tailwind.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { clearAllToasts } from '../services/toastService';
import { clearAuthState } from '../lib/authUtils';

// Interfaz para el objeto de opciones en eventos de cambio de ruta
interface RouteChangeOptions {
  shallow: boolean;
  [key: string]: any;
}

// Rutas que no deberían causar invalidación de consultas
// para prevenir loops y problemas de rendimiento
const AUTH_ROUTES = ['/auth', '/login', '/register', '/api/auth'];

// Configuración de tiempo para detectar posibles loops
const LOOP_DETECTION_WINDOW = 5000; // 5 segundos
const MAX_NAVIGATION_COUNT = 5; // Máximo número de navegaciones en la ventana de tiempo

function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const routerEventsEnabled = useRef(true);

  // Historial reciente de navegación para detección de loops
  const recentNavigations = useRef<{ path: string; time: number }[]>([]);

  // Crear un nuevo QueryClient
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Siempre considerar datos como obsoletos
            gcTime: 0, // No guardar en caché (reemplaza a cacheTime)
            retry: 1,
            refetchOnMount: 'always',
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  );

  // Función mejorada para detectar y prevenir loops de redirección
  const detectRouteChangeLoop = (url: string): boolean => {
    const now = Date.now();
    const recentPaths = recentNavigations.current;

    // Limpiar navegaciones antiguas fuera de la ventana de tiempo
    recentNavigations.current = recentPaths.filter(
      (item) => now - item.time < LOOP_DETECTION_WINDOW
    );

    // Añadir la navegación actual
    recentNavigations.current.push({
      path: url,
      time: now,
    });

    // Contar ocurrencias de esta URL en la ventana de tiempo
    const occurrences = recentNavigations.current.filter(
      (item) => item.path === url
    ).length;

    // Si detectamos demasiadas navegaciones a la misma URL en poco tiempo
    if (occurrences >= MAX_NAVIGATION_COUNT) {
      console.warn(
        `⚠️ Posible loop de redirección detectado: ${url} (${occurrences} veces en ${LOOP_DETECTION_WINDOW}ms)`
      );

      // Intentar romper el loop limpiando el estado de autenticación
      try {
        console.log('Limpiando estado de autenticación para romper loop');
        clearAuthState();
      } catch (e) {
        console.error('Error al limpiar estado para romper loop:', e);
      }

      // Desactivar eventos del router temporalmente
      routerEventsEnabled.current = false;
      setTimeout(() => {
        routerEventsEnabled.current = true;
        recentNavigations.current = [];
      }, 1000);

      return true; // Loop detectado
    }

    return false; // No hay loop
  };

  // Manejo de cambios de ruta para invalidación de consultas
  useEffect(() => {
    const handleRouteChange = (url: string, options: RouteChangeOptions) => {
      // Si los eventos del router están desactivados, ignorar
      if (!routerEventsEnabled.current) return;

      // Detectar posible loop de redirección
      if (detectRouteChangeLoop(url)) {
        console.log('Omitiendo invalidación por detección de loop');
        return;
      }

      // No invalidar en navegaciones shallow (cambios de estado de URL sin recarga)
      if (options.shallow) {
        console.log('Omitiendo invalidación en navegación shallow:', url);
        return;
      }

      // Omitir invalidación para rutas de autenticación
      if (AUTH_ROUTES.some((route) => url.includes(route))) {
        console.log('Omitiendo invalidación para ruta de auth:', url);
        return;
      }

      // Para otras rutas, proceder con la invalidación normal
      console.log('Invalidando consultas para cambio de ruta a:', url);
      queryClient.invalidateQueries({
        refetchType: 'active',
      });

      // Limpiar toasts
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
        // Configuración más conservadora para prevenir loops
        refetchInterval={process.env.NODE_ENV === 'development' ? 60 : 300} // 5 minutos en producción
        refetchOnWindowFocus={true}
        refetchWhenOffline={false}
        // Configuración específica para Vercel preview
        basePath='/api/auth'
      >
        <AuthProvider>
          <Component {...pageProps} key={router.asPath} />
          <Toaster
            position='bottom-right'
            toastOptions={{
              duration: 3000,
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
