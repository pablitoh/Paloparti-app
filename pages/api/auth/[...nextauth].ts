import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

// Detectar si estamos en un ambiente de preview de Vercel
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

// Función para limpiar URLs de Vercel toolbar
function cleanVercelParams(url: string) {
  try {
    if (url.includes('__vercel_')) {
      const urlObj = new URL(
        url.startsWith('http') ? url : `https://example.com${url}`
      );
      [...urlObj.searchParams.keys()].forEach((key) => {
        if (key.startsWith('__vercel_')) {
          urlObj.searchParams.delete(key);
        }
      });

      return url.startsWith('http')
        ? urlObj.toString()
        : urlObj.pathname + (urlObj.search !== '?' ? urlObj.search : '');
    }
    return url;
  } catch (e) {
    return url;
  }
}

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
        secure: false, // Usar false en todos los ambientes para pruebas
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
    // Limpiar URLs de parámetros del Vercel toolbar
    async redirect({ url, baseUrl }) {
      // Limpiar parámetros del Vercel toolbar
      const cleanedUrl = cleanVercelParams(url);

      // En preview, siempre ir a /groups
      if (isVercelPreview) {
        console.log('Preview environment - redirecting to /groups');
        return `${baseUrl}/groups`;
      }

      // Para otros ambientes, usar la URL limpia
      if (cleanedUrl.startsWith(baseUrl)) return cleanedUrl;
      if (cleanedUrl.startsWith('/')) return `${baseUrl}${cleanedUrl}`;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);
