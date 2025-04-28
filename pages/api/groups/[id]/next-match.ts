import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    // Obtener el grupo para encontrar el nextMatchId
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        nextMatchId: true,
        requiredPlayers: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Si no hay próximo partido
    if (!group.nextMatchId) {
      return res.status(200).json({
        nextMatchDetails: null,
        userAttendance: null,
      });
    }

    // Obtener detalles del próximo partido
    const match = await prisma.match.findUnique({
      where: { id: group.nextMatchId },
      include: {
        playersA: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Procesar los datos del partido
    const confirmedPlayers = match.attendance
      .filter((attendance) => attendance.status === 'CONFIRMED')
      .map((attendance) => ({
        id: attendance.userId,
        name: attendance.user?.name || null,
        avatar: attendance.user?.image || null,
      }));

    // Obtener la asistencia del usuario actual
    const userAttendance = match.attendance.find(
      (attendance) => attendance.userId === session.user.id
    );

    // Formatear la respuesta
    // Separar playersA en equipos A y B basados en isTeamA
    const teamAPlayers = match.playersA
      .filter((player) => player.isTeamA)
      .map((player) => ({
        id: player.userId,
        name: player.user?.name || null,
        avatar: player.user?.image || null,
        isTeamA: true,
      }));

    const teamBPlayers = match.playersA
      .filter((player) => !player.isTeamA)
      .map((player) => ({
        id: player.userId,
        name: player.user?.name || null,
        avatar: player.user?.image || null,
        isTeamA: false,
      }));

    const nextMatchDetails = {
      id: match.id,
      date: match.date,
      location: match.location,
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      playersA: teamAPlayers,
      playersB: teamBPlayers,
      confirmedPlayers,
      tbdPlayers: match.tbdPlayers || [],
      requiredPlayers: group.requiredPlayers,
    };

    return res.status(200).json({
      nextMatchDetails,
      userAttendance: userAttendance ? userAttendance.status : null,
    });
  } catch (error) {
    console.error('Error al obtener próximo partido:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
