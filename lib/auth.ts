import { NextApiRequest } from 'next';
import { prisma } from './prisma';
import { getToken } from 'next-auth/jwt';
import { getSession } from 'next-auth/react';

// Especificamos los campos comunes que queremos seleccionar
const userSelectFields = {
  id: true,
  name: true,
  email: true,
  image: true,
  // Birthdate se añadirá dinámicamente si el esquema lo soporta
};

export async function getCurrentUser(req: NextApiRequest) {
  try {
    // Primero intentar obtener la sesión de NextAuth
    const session = await getSession({ req });

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

    // Si no se encontró por sesión, intentar con el token JWT
    const token = await getToken({ req });

    if (!token?.email) {
      console.log('No token or session found in getCurrentUser');
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
