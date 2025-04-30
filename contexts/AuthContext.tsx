import React, { createContext, useContext } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

  // Mutación para iniciar sesión
  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error: Error) => {
      console.error('Error signing in:', error);
      throw error;
    },
  });

  // Mutación para cerrar sesión
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Use redirect: true with a specific callbackUrl to ensure proper redirection
      return signOut({
        redirect: true,
        callbackUrl: '/auth/signin',
      });
    },
    // No onSuccess needed as we're using redirect: true above
  });

  // Mutación para registro
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
        // Usamos el endpoint simplificado en la raíz de la API
        const registerUrl = '/api/register';

        const response = await fetch(registerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ name, email, password, birthdate }),
          credentials: 'include',
        });

        // Leer el cuerpo de la respuesta como texto primero
        const responseText = await response.text();

        // Intentar parsearlo como JSON
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          console.error('Error parsing response:', responseText);
          return {
            success: false,
            message: 'Error al procesar la respuesta del servidor',
          };
        }

        if (!response.ok) {
          // En lugar de lanzar el error, lo retornamos como parte de la respuesta
          return {
            success: false,
            message: data.message || 'Error al crear la cuenta',
            status: response.status,
          };
        }

        return { success: true, data };
      } catch (error) {
        console.error('Network error during registration:', error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Error de conexión al servidor',
        };
      }
    },
    onSuccess: async (result, variables) => {
      // Solo intentamos auto-login si el registro fue exitoso
      if (result.success) {
        try {
          await loginMutation.mutateAsync({
            email: variables.email,
            password: variables.password,
          });
        } catch (error) {
          console.error('Error auto-login after registration:', error);
        }
      }
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    birthdate: string
  ) => {
    const result = await registerMutation.mutateAsync({
      name,
      email,
      password,
      birthdate,
    });

    // Si no fue exitoso, lanzamos el error para que el componente pueda manejarlo
    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;
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
