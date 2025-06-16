import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from './prisma';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';

// Especificamos los campos comunes que queremos seleccionar
const userSelectFields = {
  id: true,
  name: true,
  email: true,
  image: true,
  // Birthdate se añadirá dinámicamente si el esquema lo soporta
};

export async function getCurrentUser(
  req: NextApiRequest,
  res?: NextApiResponse
) {
  try {
    // Debug específico para preview - logs de inicio
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('getCurrentUser - Debug Info:', {
        method: req.method,
        url: req.url,
        headers: {
          cookie: req.headers.cookie ? 'Present' : 'Missing',
          authorization: req.headers.authorization ? 'Present' : 'Missing',
        },
        hasRes: !!res,
      });
    }

    // Primero intentar obtener la sesión de NextAuth usando getServerSession (para APIs)
    let session = null;

    try {
      if (res) {
        session = await getServerSession(req, res, authOptions);
      } else {
        // Para llamadas sin res, solo usar JWT token
        console.log('No res provided, skipping getServerSession');
      }
    } catch (sessionError) {
      console.log('getServerSession failed, will try JWT token:', sessionError);
    }

    // Debug específico para preview
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('getCurrentUser - server session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionError: session ? null : 'No session found',
      });
    }

    if (session?.user?.email) {
      console.log('Session found in getCurrentUser:', session.user.id);

      // Si la sesión tiene el ID del usuario, usarlo directamente
      if (session.user.id) {
        const sessionUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: userSelectFields,
        });

        if (sessionUser) {
          console.log('User found by session ID:', sessionUser.id);
          return sessionUser;
        }
      }

      // Si no hay ID o no se encontró el usuario, buscar por email
      const emailUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: userSelectFields,
      });

      if (emailUser) {
        console.log('User found by session email:', emailUser.id);
        return emailUser;
      }
    }

    // Si no se encontró por sesión, intentar con el token JWT como fallback
    let token = null;
    try {
      token = await getToken({ req });
    } catch (tokenError) {
      console.log('getToken failed:', tokenError);
    }

    if (process.env.VERCEL_ENV === 'preview') {
      console.log('getCurrentUser - JWT token check:', {
        hasToken: !!token,
        tokenEmail: token?.email,
        tokenSub: token?.sub,
        tokenError: token ? null : 'No token found',
        cookieHeader: req.headers.cookie
          ? req.headers.cookie.substring(0, 100) + '...'
          : 'No cookies',
      });
    }

    if (!token?.email) {
      console.log('No token or session found in getCurrentUser');

      // Debug adicional en preview para entender por qué falla
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('getCurrentUser - Failed Authentication Details:', {
          hasSessionUser: !!session?.user,
          hasTokenEmail: !!token?.email,
          requestUrl: req.url,
          userAgent: req.headers['user-agent']?.substring(0, 50),
        });
      }

      return null;
    }

    // Buscar el usuario en la base de datos por email
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: userSelectFields,
    });

    if (!user) {
      console.log('User not found in database');
      return null;
    }

    console.log('User found by token:', user.id);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
