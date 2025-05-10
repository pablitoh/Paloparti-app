import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Obtener token de la URL
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Token de invitación inválido' });
    }

    console.log('Buscando grupo con token de invitación:', token);

    // Extraer el token limpio en caso de que venga con caracteres adicionales
    const cleanToken = token.split(':')[0];

    // Buscar el grupo por inviteToken en lugar de por ID
    const group = await prisma.group.findFirst({
      where: {
        inviteToken: cleanToken,
      },
      include: {
        members: true,
      },
    });

    // Verificar si encontramos el grupo
    if (!group) {
      console.log(
        'No se encontró ningún grupo con el token de invitación proporcionado'
      );
      return res.status(404).json({ message: 'Invitación no encontrada' });
    }

    console.log('Grupo encontrado:', group.id, group.name);

    // Devolver información del grupo
    return res.status(200).json({
      invitation: {
        token: cleanToken,
        permanent: true,
      },
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        sport: group.sport,
        location: group.location,
        memberCount: group.members.length,
      },
    });
  } catch (error) {
    console.error('Error al validar invitación:', error);
    return res.status(500).json({ message: 'Error al validar invitación' });
  }
}
