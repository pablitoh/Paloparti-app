import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

interface UserResponse {
  id: string;
  name: string | null;
  birthdate: Date | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Configurar encabezados CORS para permitir credenciales
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { name, birthdate } = req.body;
    const userId = session.user?.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in session' });
    }

    // Convert birthdate string to Date object if it exists
    let birthdateObj = null;
    if (birthdate) {
      // Enhanced logging for preview environment
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('Preview environment - processing birthdate:', {
          originalBirthdate: birthdate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          serverTime: new Date().toISOString(),
        });
      }

      // Para evitar problemas de zona horaria, crear la fecha como UTC medianoche
      const [year, month, day] = birthdate.split('-').map(Number);

      if (
        !year ||
        !month ||
        !day ||
        year < 1900 ||
        year > 2100 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        return res.status(400).json({ message: 'Invalid birthdate format' });
      }

      // Crear fecha UTC explícitamente para evitar problemas de zona horaria
      birthdateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

      if (process.env.VERCEL_ENV === 'preview') {
        console.log('Preview environment - created birthdate object:', {
          year,
          month,
          day,
          birthdateObj: birthdateObj.toISOString(),
          birthdateUTC: birthdateObj.toUTCString(),
        });
      }

      if (isNaN(birthdateObj.getTime())) {
        return res.status(400).json({ message: 'Invalid birthdate format' });
      }
    }

    // Verify that the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || null,
        birthdate: birthdateObj,
      },
      select: {
        id: true,
        name: true,
        birthdate: true,
      },
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      message: 'Error updating profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
