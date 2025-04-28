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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      return signOut({ callbackUrl: '/' });
    },
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, birthdate }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error creating account');
      }

      return response.json();
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
