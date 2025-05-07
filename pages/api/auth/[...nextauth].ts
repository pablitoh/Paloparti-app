import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

// Configuración simplificada de NextAuth
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña son requeridos');
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              password: true,
              birthdate: true,
            },
          });

          if (!user || !user.password) {
            throw new Error('Usuario no encontrado');
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) {
            throw new Error('Contraseña incorrecta');
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            birthdate: user.birthdate,
          };
        } catch (error) {
          console.error('Error en authorize:', error);
          throw error;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  // Configuración simplificada de cookies - sin seguridad forzada
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Deshabilitar secure para permitir HTTP en desarrollo y preview
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.birthdate = user.birthdate;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.birthdate = token.birthdate as Date | null;
      }
      return session;
    },
    // Redirección simplificada - solo redireccionar cuando sea necesario
    async redirect({ url, baseUrl }) {
      // Si es una URL relativa, adjuntar la URL base
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Si la URL coincide con la base, usar tal cual
      if (url.startsWith(baseUrl)) {
        return url;
      }

      // Para cualquier otro caso, usar la URL base
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  // Activar debug en desarrollo
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);
