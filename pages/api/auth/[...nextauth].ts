import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

// Find the appropriate secret from environment variables
const getAuthSecret = () => {
  const possibleSecrets = [
    'NEXTAUTH_SECRET',
    'paloparti_NEXTAUTH_SECRET',
    'palopartiprod_NEXTAUTH_SECRET',
  ];

  for (const secretName of possibleSecrets) {
    if (process.env[secretName]) {
      console.log(`Using auth secret from ${secretName}`);
      return process.env[secretName];
    }
  }

  console.warn(
    'No NEXTAUTH_SECRET found, using a fallback for development only'
  );
  // Fallback for development - NOT recommended for production
  return (
    process.env.JWT_SECRET || 'INSECURE_AUTH_SECRET_FALLBACK_NOT_FOR_PRODUCTION'
  );
};

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
  secret: getAuthSecret(),
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
        secure: process.env.NODE_ENV === 'production',
        domain:
          process.env.NODE_ENV === 'production'
            ? '.vercel.app' // This enables cookies across subdomains in production
            : undefined,
      },
    },
  },
  logger: {
    error(code, metadata) {
      console.error(`Auth error: ${code}`, metadata);
    },
    warn(code) {
      console.warn(`Auth warning: ${code}`);
    },
    debug(code, metadata) {
      console.log(`Auth debug: ${code}`, metadata);
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
  },
  pages: {
    signIn: '/auth/signin',
  },
  debug: process.env.NODE_ENV === 'development',
  // Permite que las cookies funcionen a través de subdominios en producción
  useSecureCookies: process.env.NODE_ENV === 'production',
};

export default NextAuth(authOptions);
