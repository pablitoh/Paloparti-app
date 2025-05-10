import React, { createContext, useContext } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clearAuthState } from '../lib/authUtils';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  birthdate?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    birthdate: string
  ) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Use React Query para manejar el estado del usuario
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (status === 'loading') {
        return null;
      }

      if (session?.user) {
        // Make sure we have the user ID
        const userId = session.user.id || '';
        if (userId) {
          const userData = {
            id: userId,
            name: session.user.name || null,
            email: session.user.email || null,
            image: session.user.image || null,
            birthdate: (session.user as any).birthdate || null,
          };
          return userData;
        } else {
          console.error('No user ID in session:', session);
          return null;
        }
      }
      return null;
    },
    enabled: status !== 'loading',
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutación para iniciar sesión - simplificada
  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      // Limpiar estado de autenticación previo
      clearAuthState();

      // Usar signIn sin callbackUrl para evitar redirecciones no deseadas
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Esperar un momento para que la sesión esté disponible
      await new Promise((resolve) => setTimeout(resolve, 300));

      return result;
    },
    onSuccess: (result) => {
      // Después de login exitoso, invalidar consultas y navegar
      queryClient.invalidateQueries({ queryKey: ['user'] });

      // Navegar a /groups explícitamente después del login exitoso
      router.replace('/groups');
    },
    onError: (error: Error) => {
      console.error('Error signing in:', error);
      throw error;
    },
  });

  // Mutación para cerrar sesión - simplificada
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Limpiar estado de autenticación
      clearAuthState();

      // Cerrar sesión con redirección explícita para evitar problemas de callbackUrl
      return signOut({
        redirect: false,
      });
    },
    onSuccess: () => {
      // Navegar a la página de inicio de sesión después de cerrar sesión
      router.replace('/auth/signin');
    },
  });

  // Mutación para registro - simplificada
  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      birthdate,
    }: {
      name: string;
      email: string;
      password: string;
      birthdate: string;
    }) => {
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, birthdate }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: `Error de servidor: ${response.status} ${response.statusText}`,
          }));
          throw new Error(
            errorData.message ||
              `Error ${response.status}: ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.error('Error en el proceso de registro:', error);
        throw error;
      }
    },
    onSuccess: async (_, variables) => {
      // Auto-login después del registro
      await loginMutation.mutateAsync({
        email: variables.email,
        password: variables.password,
      });
    },
    onError: (error: Error) => {
      console.error('Error registering:', error);
      throw error;
    },
  });

  // Función simplificada de login
  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  // Función simplificada de logout
  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Función simplificada de registro
  const register = async (
    name: string,
    email: string,
    password: string,
    birthdate: string
  ) => {
    await registerMutation.mutateAsync({ name, email, password, birthdate });
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        loading: isLoading,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
