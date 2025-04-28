import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../lib/prisma';

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
    const session = await getSession({ req });

    console.log('Session in update API:', session);

    if (!session) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { name, birthdate } = req.body;
    const userId = session.user?.id as string;

    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in session' });
    }

    console.log('Updating user profile:', { userId, name, birthdate });

    // Convert birthdate string to Date object if it exists
    let birthdateObj = null;
    if (birthdate) {
      birthdateObj = new Date(birthdate);
      // Validate that the birthdate is a valid date
      if (isNaN(birthdateObj.getTime())) {
        return res.status(400).json({ message: 'Invalid birthdate format' });
      }
    }

    // Verificar que el usuario existe primero
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Crear un objeto de datos dinámico para la actualización
    const updateData: any = {
      name: name || null,
    };

    // Solo incluir birthdate si el esquema lo soporta
    if (birthdateObj !== null) {
      try {
        // Intentamos verificar si el campo existe en el modelo User
        const userWithBirthdate = await prisma.$queryRaw`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'User' AND column_name = 'birthdate'
        `;

        // Si llegamos aquí, el campo existe
        updateData.birthdate = birthdateObj;
        console.log('Birthdate field exists in schema, including in update');
      } catch (error) {
        console.warn('Birthdate field may not exist in schema:', error);
        // No añadimos el campo si no existe en el esquema
      }
    }

    // Update user in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        // Solo seleccionamos birthdate si existe en el modelo
        ...(updateData.birthdate !== undefined ? { birthdate: true } : {}),
      },
    });

    console.log('User updated successfully:', updatedUser);

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
