import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { Match, MatchPlayer, User } from '@prisma/client';
import { calculateAge } from '../../../../lib/utils';

// Interfaces for type safety
interface MatchWithRelations extends Match {
  matchPlayers: (MatchPlayer & {
    user: Pick<User, 'id' | 'name' | 'image' | 'birthdate'> | null;
  })[];
  attendance: Array<{
    userId: string;
    status: string;
    user: Pick<User, 'id' | 'name' | 'image' | 'birthdate'> | null;
  }>;
}

interface PlayerData {
  id: string;
  name: string | null;
  avatar: string | null;
  isTeamA?: boolean;
}

interface TbdPlayer {
  id: string;
  name: string;
  avatar: string | null;
  isTeamA: boolean;
  playerType: 'TBD';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación usando getServerSession en lugar de getSession
  const session = await getServerSession(req, res, authOptions);
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
      select: {
        id: true,
        date: true,
        location: true,
        groupId: true,
        teamA: true,
        teamB: true,
        scoreA: true,
        scoreB: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tbdPlayers: true, // Intentar obtener los tbdPlayers si existen
        sortCount: true,
        matchPlayers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                birthdate: true,
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
                birthdate: true,
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
      .filter(
        (attendance: (typeof match.attendance)[0]) =>
          attendance.status === 'CONFIRMED'
      )
      .map((attendance: (typeof match.attendance)[0]) => ({
        id: attendance.userId,
        name: attendance.user?.name || null,
        avatar: attendance.user?.image || null,
        age: calculateAge(attendance.user?.birthdate || null),
      }));

    // Obtener la asistencia del usuario actual
    const userAttendance = match.attendance.find(
      (attendance: (typeof match.attendance)[0]) =>
        attendance.userId === session.user.id
    );

    // Formatear la respuesta
    // Usar matchPlayers para obtener los jugadores de cada equipo
    const teamAPlayers = (match.matchPlayers as any[])
      .filter((player: any) => player.isTeamA)
      .map((player: any) => ({
        id: player.userId,
        name: player.user?.name || null,
        avatar: player.user?.image || null,
        isTeamA: true,
        age: calculateAge(player.user?.birthdate || null),
      }));

    const teamBPlayers = (match.matchPlayers as any[])
      .filter((player: any) => !player.isTeamA)
      .map((player: any) => ({
        id: player.userId,
        name: player.user?.name || null,
        avatar: player.user?.image || null,
        isTeamA: false,
        age: calculateAge(player.user?.birthdate || null),
      }));

    // Procesar los TBD players
    let tbdPlayers: TbdPlayer[] = [];

    // Intentar extraer y parsear tbdPlayers almacenados
    if (match.tbdPlayers) {
      try {
        // Si es un string, intentar parsearlo como JSON
        if (typeof match.tbdPlayers === 'string' && match.tbdPlayers !== '') {
          const parsed = JSON.parse(match.tbdPlayers);

          // Si es un array, usarlo directamente
          if (Array.isArray(parsed)) {
            tbdPlayers = parsed;
          }
          // Si es un objeto con teamA/teamB, procesarlo
          else if (parsed.teamA || parsed.teamB) {
            const teamATbd = Array.isArray(parsed.teamA) ? parsed.teamA : [];
            const teamBTbd = Array.isArray(parsed.teamB) ? parsed.teamB : [];

            tbdPlayers = [
              ...teamATbd.map((p: any) => ({
                ...p,
                isTeamA: true,
                playerType: 'TBD',
              })),
              ...teamBTbd.map((p: any) => ({
                ...p,
                isTeamA: false,
                playerType: 'TBD',
              })),
            ];
          }
        }
        // Si ya es un array, usarlo directamente
        else if (Array.isArray(match.tbdPlayers)) {
          tbdPlayers = match.tbdPlayers.map((p: any) => ({
            id:
              p.id ||
              `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: p.name || 'TBD Player',
            avatar: p.avatar || null,
            isTeamA: typeof p.isTeamA === 'boolean' ? p.isTeamA : true,
            playerType: 'TBD',
          }));
        }
      } catch (error) {
        console.error('Error parsing tbdPlayers:', error);
        // En caso de error, continuar con tbdPlayers como array vacío
        tbdPlayers = [];
      }
    }

    // Si no hay TBD players o no pudimos parsearlos, generar nuevos si son necesarios
    if (tbdPlayers.length === 0) {
      const requiredPlayersPerTeam = Math.ceil(group.requiredPlayers / 2) || 5;

      // Generar TBD players para el equipo A si es necesario
      if (teamAPlayers.length < requiredPlayersPerTeam) {
        const missingA = requiredPlayersPerTeam - teamAPlayers.length;
        for (let i = 0; i < missingA; i++) {
          tbdPlayers.push({
            id: `tbd-${Date.now()}-a-${i}`,
            name: `TBD A${i + 1}`,
            avatar: null,
            isTeamA: true,
            playerType: 'TBD',
          });
        }
      }

      // Generar TBD players para el equipo B si es necesario
      if (teamBPlayers.length < requiredPlayersPerTeam) {
        const missingB = requiredPlayersPerTeam - teamBPlayers.length;
        for (let i = 0; i < missingB; i++) {
          tbdPlayers.push({
            id: `tbd-${Date.now()}-b-${i}`,
            name: `TBD B${i + 1}`,
            avatar: null,
            isTeamA: false,
            playerType: 'TBD',
          });
        }
      }
    }

    // Calcular promedios de edad para cada equipo
    const calculateAverageAge = (players: any[]): number | undefined => {
      const playersWithAge = players.filter(
        (p) => p.age !== null && p.age !== undefined
      );
      if (playersWithAge.length === 0) return undefined;

      const sum = playersWithAge.reduce((acc, player) => acc + player.age, 0);
      return Math.round(sum / playersWithAge.length);
    };

    const teamAAvgAge = calculateAverageAge(teamAPlayers);
    const teamBAvgAge = calculateAverageAge(teamBPlayers);

    // Opcional: Añadir log para depuración
    console.log('Calculado promedios de edad:', {
      teamAAvgAge,
      teamBAvgAge,
      teamAPlayers: teamAPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
      })),
      teamBPlayers: teamBPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
      })),
    });

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
      tbdPlayers,
      requiredPlayers: group.requiredPlayers,
      sortCount: match.sortCount,
      teamAAvgAge,
      teamBAvgAge,
    };

    return res.status(200).json({
      nextMatchDetails,
      userAttendance: userAttendance ? userAttendance.status : null,
    });
  } catch (error) {
    console.error('Error al obtener próximo partido:', error);
    return res.status(500).json({
      message: 'Error interno del servidor',
      error: String(error),
      // Add stack trace for better debugging
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
