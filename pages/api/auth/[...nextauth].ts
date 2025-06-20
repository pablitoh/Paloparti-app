import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
// import {
//   getGoogleExtendedProfile,
//   isAgeValid,
//   formatBirthdateForLog,
// } from '../../../lib/googleProfileUtils';

// Función para obtener la URL base correcta
function getBaseUrl() {
  // En desarrollo local
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXTAUTH_URL || 'http://localhost:3000';
  }

  // En producción, SIEMPRE usar NEXTAUTH_URL si está definida
  // Esto previene redirecciones a URLs de preview no autorizadas
  if (process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Solo en preview/desarrollo usar VERCEL_URL como fallback
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback final a NEXTAUTH_URL
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
    }),
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
    async signIn({ user, account, profile, email, credentials }) {
      // Para Google Sign-In, crear o actualizar el usuario en nuestra base de datos
      if (account?.provider === 'google' && user.email) {
        try {
          console.log('=== Google Sign-In iniciado ===');
          console.log('Usuario de Google:', {
            email: user.email,
            name: user.name,
            image: user.image,
          });

          // Buscar si el usuario ya existe
          let existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Crear nuevo usuario con información básica de Google
            const finalName =
              user.name ||
              `Usuario ${
                user.email.split('@')[0].charAt(0).toUpperCase() +
                user.email.split('@')[0].slice(1)
              }`;

            existingUser = await prisma.user.create({
              data: {
                email: user.email,
                name: finalName,
                image: user.image,
                birthdate: null, // Se pedirá después en el modal
                password: null, // Usuario de Google
              },
            });

            console.log('✅ Nuevo usuario Google creado:', existingUser.id, {
              name: existingUser.name,
              hasImage: !!existingUser.image,
              birthdate: 'Se pedirá en modal',
            });
          } else {
            // Actualizar datos básicos si es necesario
            const updateData: any = {};

            if (!existingUser.name && user.name) {
              updateData.name = user.name;
            }

            if (!existingUser.image && user.image) {
              updateData.image = user.image;
            }

            // Solo actualizar si hay cambios
            if (Object.keys(updateData).length > 0) {
              existingUser = await prisma.user.update({
                where: { email: user.email },
                data: updateData,
              });
              console.log('✅ Usuario Google actualizado:', existingUser.id, {
                updatedFields: Object.keys(updateData),
              });
            } else {
              console.log('ℹ️ Usuario Google sin cambios:', existingUser.id, {
                name: existingUser.name,
                hasImage: !!existingUser.image,
                birthdate: existingUser.birthdate
                  ? existingUser.birthdate.toISOString().split('T')[0]
                  : 'null',
              });
            }
          }

          // Asignar el ID de nuestra base de datos al usuario
          user.id = existingUser.id;
          user.birthdate = existingUser.birthdate;

          console.log('=== Google Sign-In completado exitosamente ===');
          return true;
        } catch (error) {
          console.error('❌ Error en signIn callback:', error);
          return false;
        }
      }

      // Para otros proveedores (credentials), continuar normalmente
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.birthdate = user.birthdate;
      }

      // Siempre refrescar datos del usuario desde la base de datos si tenemos un ID
      if (token.id) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              birthdate: true,
            },
          });

          if (updatedUser) {
            // Actualizar el token con los datos más recientes
            token.name = updatedUser.name;
            token.email = updatedUser.email;
            token.picture = updatedUser.image; // NextAuth usa 'picture' para la imagen
            token.birthdate = updatedUser.birthdate;

            console.log('JWT actualizado con datos del usuario:', {
              name: updatedUser.name,
              email: updatedUser.email,
              image: updatedUser.image,
              birthdate: updatedUser.birthdate ? 'Presente' : 'Ausente',
            });
          }
        } catch (error) {
          console.error(
            'Error refrescando datos del usuario en JWT callback:',
            error
          );
        }
      }

      // Debug logging para preview
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('NextAuth JWT callback:', {
          trigger,
          hasUser: !!user,
          hasToken: !!token,
          tokenId: token?.id,
          hasBirthdate: !!token.birthdate,
          environment: process.env.VERCEL_ENV,
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture as string | null; // NextAuth usa 'picture' internamente
        session.user.birthdate = token.birthdate as Date | null;
      }

      // Debug logging para preview y desarrollo
      if (
        process.env.VERCEL_ENV === 'preview' ||
        process.env.NODE_ENV === 'development'
      ) {
        console.log('NextAuth session callback:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userImage: session?.user?.image,
          userBirthdate: session?.user?.birthdate ? 'Presente' : 'Ausente',
          tokenId: token?.id,
          tokenBirthdate: token?.birthdate ? 'Presente' : 'Ausente',
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
