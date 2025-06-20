import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { birthdate } = req.body;

    if (!birthdate) {
      return res
        .status(400)
        .json({ message: 'Fecha de nacimiento es requerida' });
    }

    // Validar formato de fecha
    const birthdateDate = new Date(birthdate);
    if (isNaN(birthdateDate.getTime())) {
      return res.status(400).json({ message: 'Formato de fecha inválido' });
    }

    // Validar edad (12-100 años)
    const today = new Date();
    let age = today.getFullYear() - birthdateDate.getFullYear();
    const monthDiff = today.getMonth() - birthdateDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthdateDate.getDate())
    ) {
      age--;
    }

    if (age < 12 || age > 100) {
      return res.status(400).json({
        message: 'La edad debe estar entre 12 y 100 años',
      });
    }

    // Actualizar fecha de nacimiento del usuario
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { birthdate: birthdateDate },
      select: {
        id: true,
        name: true,
        email: true,
        birthdate: true,
      },
    });

    res.status(200).json({
      message: 'Fecha de nacimiento actualizada correctamente',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating birthdate:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
