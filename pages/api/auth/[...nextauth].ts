import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

// Función para obtener la URL base correcta
function getBaseUrl() {
  // En desarrollo local
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXTAUTH_URL || 'http://localhost:3000';
  }

  // En Vercel preview o production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback a NEXTAUTH_URL si está definida
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  return 'http://localhost:3000';
}

// Configuración simplificada de NextAuth
export const authOptions: NextAuthOptions = {
  // Configuración específica para Vercel
  useSecureCookies:
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview',
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure:
          process.env.NODE_ENV === 'production' ||
          process.env.VERCEL_ENV === 'preview',
        // Configuración específica para preview
        domain: process.env.VERCEL_ENV === 'preview' ? undefined : undefined,
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure:
          process.env.NODE_ENV === 'production' ||
          process.env.VERCEL_ENV === 'preview',
        domain: process.env.VERCEL_ENV === 'preview' ? undefined : undefined,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure:
          process.env.NODE_ENV === 'production' ||
          process.env.VERCEL_ENV === 'preview',
        domain: process.env.VERCEL_ENV === 'preview' ? undefined : undefined,
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.birthdate = user.birthdate;
      }

      // Debug logging para preview
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('NextAuth JWT callback:', {
          trigger,
          hasUser: !!user,
          hasToken: !!token,
          tokenId: token?.id,
          environment: process.env.VERCEL_ENV,
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.birthdate = token.birthdate as Date | null;
      }

      // Debug logging para preview
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('NextAuth session callback:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          tokenId: token?.id,
          environment: process.env.VERCEL_ENV,
          vercelUrl: process.env.VERCEL_URL,
        });
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Usar la función getBaseUrl para obtener la base correcta
      const correctBaseUrl = getBaseUrl();

      if (url.startsWith('/')) {
        return `${correctBaseUrl}${url}`;
      }
      if (url.startsWith(correctBaseUrl)) {
        return url;
      }

      // Debug logging
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('NextAuth redirect:', {
          url,
          baseUrl,
          correctBaseUrl,
          result: correctBaseUrl,
          vercelUrl: process.env.VERCEL_URL,
        });
      }

      return correctBaseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  debug:
    process.env.NODE_ENV === 'development' ||
    process.env.VERCEL_ENV === 'preview',
  logger: {
    error(code, metadata) {
      if (process.env.VERCEL_ENV === 'preview') {
        console.error('NextAuth Error:', code, metadata);
      }
    },
    warn(code) {
      if (process.env.VERCEL_ENV === 'preview') {
        console.warn('NextAuth Warning:', code);
      }
    },
    debug(code, metadata) {
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('NextAuth Debug:', code, metadata);
      }
    },
  },
};

export default NextAuth(authOptions);
