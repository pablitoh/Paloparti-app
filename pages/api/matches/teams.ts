import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';

type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null; // Calculated from birthdate
  role: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  // Sólo permitir método POST para este endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const {
      groupId,
      balanceByAge = true, // Si se debe balancear por edad
      location,
      date,
    } = req.body;

    // Validar campos requeridos
    if (!groupId) {
      return res.status(400).json({ message: 'Se requiere el ID del grupo' });
    }

    // Verificar si el usuario es administrador del grupo
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: 'No tienes permisos de administrador para este grupo',
      });
    }

    // Verificar si ya existe un partido pendiente para este grupo
    // Solo se puede tener un sorteo activo a la vez
    try {
      // Obtener todos los partidos del grupo y filtrar por status en la aplicación
      const existingMatches = await prisma.match.findMany({
        where: {
          groupId,
        },
      });

      // Filtrar manualmente para encontrar partidos pendientes
      const pendingMatches = existingMatches.filter(
        (m) => m.status === 'PENDING'
      );

      if (pendingMatches.length > 0) {
        return res.status(400).json({
          message:
            'Ya existe un partido pendiente para este grupo. Finaliza el partido actual antes de crear uno nuevo.',
        });
      }
    } catch (error) {
      console.error('Error al verificar partidos existentes:', error);
      // Continuar con la ejecución si hay un error en la verificación
    }

    // Obtener solo los miembros confirmados del grupo
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'CONFIRMED', // Status is uppercase in the database
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            birthdate: true, // Changed from age to birthdate
          },
        },
      },
    });

    if (members.length < 2) {
      return res.status(400).json({
        message:
          'Se necesitan al menos 2 miembros confirmados para formar equipos',
      });
    }

    // Filtrar solo los miembros que han confirmado explícitamente su asistencia
    // Si no existe un registro de asistencia, considerar como no confirmado
    // Esto asume que en la interfaz de usuario, los usuarios confirman su asistencia
    const confirmedAttendees = await prisma.$queryRaw<
      Array<{ userId: string }>
    >`
      SELECT "userId" FROM "GroupMember"
      WHERE "groupId" = ${groupId}
      AND "status" = 'CONFIRMED'
    `;

    // Extraer solo los IDs de usuarios que han confirmado asistencia
    const confirmedUserIds = confirmedAttendees.map(
      (attendee) => attendee.userId
    );

    // Filtrar miembros que han confirmado asistencia
    const membersWithConfirmedAttendance = members.filter((member) =>
      confirmedUserIds.includes(member.user.id)
    );

    if (membersWithConfirmedAttendance.length < 2) {
      return res.status(400).json({
        message:
          'Se necesitan al menos 2 miembros con asistencia confirmada para formar equipos',
        confirmedCount: membersWithConfirmedAttendance.length,
        totalMembers: members.length,
      });
    }

    console.log(
      `Encontrados ${membersWithConfirmedAttendance.length} miembros con asistencia confirmada para el sorteo de entre ${members.length} miembros del grupo`
    );

    // Mapear miembros con sus datos
    const mappedMembers: Member[] = membersWithConfirmedAttendance.map(
      (member) => ({
        id: member.user.id,
        name: member.user.name,
        birthdate: member.user.birthdate,
        // Calculate age from birthdate, or use random age as fallback
        age:
          calculateAge(member.user.birthdate) ||
          Math.floor(Math.random() * 40) + 18,
        role: member.role,
      })
    );

    console.log(
      `Creando equipos con ${mappedMembers.length} miembros confirmados`
    );

    // Función para balancear equipos por edad
    const createBalancedTeams = (members: Member[]): [Member[], Member[]] => {
      // Ordenar miembros por edad, de mayor a menor
      const sortedMembers = [...members].sort((a, b) => {
        const ageA = a.age || 30; // Valor por defecto si no hay edad
        const ageB = b.age || 30;
        return ageB - ageA; // De mayor a menor
      });

      const teamA: Member[] = [];
      const teamB: Member[] = [];

      // Distribuir alternadamente los jugadores para balancear edades
      // Primero los más mayores, luego los más jóvenes
      sortedMembers.forEach((member, index) => {
        if (index % 2 === 0) {
          teamA.push(member);
        } else {
          teamB.push(member);
        }
      });

      return [teamA, teamB];
    };

    // Crear equipos aleatorios si no se requiere balanceo por edad
    const createRandomTeams = (members: Member[]): [Member[], Member[]] => {
      // Mezclar aleatoriamente
      const shuffledMembers = [...members].sort(() => Math.random() - 0.5);

      // Dividir en dos equipos
      const halfIndex = Math.ceil(shuffledMembers.length / 2);
      const teamA = shuffledMembers.slice(0, halfIndex);
      const teamB = shuffledMembers.slice(halfIndex);

      return [teamA, teamB];
    };

    // Determinar el método de creación de equipos según el parámetro
    const [teamA, teamB] = balanceByAge
      ? createBalancedTeams(mappedMembers)
      : createRandomTeams(mappedMembers);

    // Calcular edad promedio por equipo
    const calculateAverageAge = (team: Member[]): number => {
      const membersWithAge = team.filter((m) => m.age !== null);
      if (membersWithAge.length === 0) return 0;

      const sum = membersWithAge.reduce(
        (total, member) => total + (member.age || 0),
        0
      );
      return Math.round(sum / membersWithAge.length);
    };

    const teamAAvgAge = calculateAverageAge(teamA);
    const teamBAvgAge = calculateAverageAge(teamB);
    const matchLocation = location || 'Ubicación por definir';
    const matchDate = date
      ? new Date(date)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día en el futuro por defecto

    // Get the group to access custom team names
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        teamAName: true,
        teamBName: true,
        totalMatches: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Use custom team names or defaults without age info
    const teamAName = group.teamAName ? `${group.teamAName}` : `Equipo A`;
    const teamBName = group.teamBName ? `${group.teamBName}` : `Equipo B`;

    // Crear el partido en la base de datos
    const match = await prisma.match.create({
      data: {
        date: matchDate,
        location: matchLocation,
        groupId,
        teamA: teamAName,
        teamB: teamBName,
        scoreA: 0,
        scoreB: 0,
        status: 'PENDING',
      },
    });

    // Registrar los jugadores del equipo A
    for (const player of teamA) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: true,
        },
      });
    }

    // Registrar los jugadores del equipo B
    for (const player of teamB) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: false,
        },
      });
    }

    // Actualizar el grupo con la información del nuevo partido
    await prisma.group.update({
      where: { id: groupId },
      data: {
        totalMatches: { increment: 1 },
        nextMatch: matchDate,
      },
    });

    // Retornar los equipos formados y el partido creado
    return res.status(200).json({
      message: 'Equipos creados correctamente',
      teamA,
      teamB,
      teamAAvgAge,
      teamBAvgAge,
      match: match,
    });
  } catch (error) {
    console.error('Error al crear equipos:', error);
    return res.status(500).json({
      message: 'Error al crear los equipos',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
