import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';

type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: string;
};

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType: 'TBD';
}

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
      date,
      location,
      balanceByAge = true,
      teamA = null,
      teamB = null,
      mode = 'auto', // 'auto' para sorteo automático, 'manual' para equipos manuales
      matchId = null, // ID del partido existente (para resort)
      isResort = false, // Indica si es un re-sorteo de un partido existente
      players = [], // Lista de jugadores proporcionada para el sorteo
      tbdPlayersInput = { teamA: [], teamB: [] }, // Jugadores TBD predefinidos
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

    // Si es un re-sorteo, verificar que el partido existe
    let existingMatch = null;
    if (isResort && matchId) {
      existingMatch = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!existingMatch) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      if (existingMatch.groupId !== groupId) {
        return res.status(403).json({
          message: 'El partido no pertenece al grupo especificado',
        });
      }

      if (existingMatch.status !== 'PENDING') {
        return res.status(400).json({
          message: 'Solo se pueden reorganizar partidos pendientes',
        });
      }

      // Verify match players separately
      const matchPlayers = await prisma.matchPlayer.findMany({
        where: { matchId },
      });
    } else if (!isResort) {
      // Si no es un re-sorteo, verificar que no existe un partido pendiente
      try {
        // Obtener todos los partidos del grupo y filtrar por status
        const existingMatches = await prisma.match.findMany({
          where: {
            groupId,
            status: 'PENDING',
          },
        });

        if (existingMatches.length > 0) {
          return res.status(400).json({
            message:
              'Ya existe un partido pendiente para este grupo. Finaliza el partido actual antes de crear uno nuevo.',
          });
        }
      } catch (error) {
        console.error('Error al verificar partidos existentes:', error);
        // Continuar con la ejecución si hay un error en la verificación
      }
    }

    // Obtener el grupo para acceder a nombres de equipos personalizados
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        teamAName: true,
        teamBName: true,
        totalMatches: true,
        requiredPlayers: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Comprobar si tenemos suficientes jugadores confirmados
    if (mode === 'auto' && players.length < 2) {
      // Obtenemos los miembros del grupo solo si no se proporcionaron jugadores
      const confirmedMembers = await prisma.matchPlayer.findMany({
        where: {
          matchId,
          match: {
            groupId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              birthdate: true,
            },
          },
        },
      });

      if (confirmedMembers.length < 2) {
        return res.status(400).json({
          message:
            'Se necesitan al menos 2 jugadores confirmados para formar equipos',
        });
      }
    }

    // Usar nombres de equipos personalizados o por defecto
    const teamAName = group.teamAName ? `${group.teamAName}` : `Equipo A`;
    const teamBName = group.teamBName ? `${group.teamBName}` : `Equipo B`;
    const requiredPlayersPerTeam = Math.ceil(group.requiredPlayers / 2) || 5;

    // Usar valores existentes si es un re-sorteo, o los proporcionados/default si es uno nuevo
    const matchDate =
      isResort && existingMatch
        ? existingMatch.date
        : date
        ? new Date(date)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día en el futuro por defecto

    const matchLocation =
      isResort && existingMatch
        ? existingMatch.location
        : location || 'Ubicación por definir';

    // Crear equipos según el modo (auto o manual)
    let finalTeamA: any[] = [];
    let finalTeamB: any[] = [];
    let teamAAvgAge = 0;
    let teamBAvgAge = 0;

    if (mode === 'manual' && teamA && teamB) {
      // Modo manual: usar los equipos proporcionados
      finalTeamA = teamA;
      finalTeamB = teamB;
    } else {
      // Modo automático: sortear equipos
      console.log(
        'Sorteando equipos para',
        players.length,
        'jugadores confirmados'
      );

      // Si se proporcionaron jugadores en la solicitud, usarlos para el sorteo
      let mappedMembers: Member[] = [];

      if (players && players.length > 0) {
        // Usar los jugadores proporcionados en la solicitud
        mappedMembers = players.map((player: any) => ({
          id: player.userId,
          name: player.name || 'Jugador',
          birthdate: null,
          age: 30, // Valor por defecto
          role: 'MEMBER',
        }));
      } else {
        // FALLBACK: Si no se proporcionaron jugadores, obtener los que confirmaron asistencia
        // Esto debería ejecutarse solo como respaldo
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

        // Obtener los datos básicos de esos usuarios
        const usersData = await prisma.user.findMany({
          where: {
            id: {
              in: confirmedUserIds,
            },
          },
          select: {
            id: true,
            name: true,
            birthdate: true,
          },
        });

        // Mapear los datos de usuarios
        mappedMembers = usersData.map((user) => ({
          id: user.id,
          name: user.name,
          birthdate: user.birthdate,
          age:
            calculateAge(user.birthdate) || Math.floor(Math.random() * 40) + 18,
          role: 'MEMBER',
        }));
      }

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
      const [autoTeamA, autoTeamB] = balanceByAge
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

      teamAAvgAge = calculateAverageAge(autoTeamA);
      teamBAvgAge = calculateAverageAge(autoTeamB);

      // Convertir a formato esperado
      finalTeamA = autoTeamA.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: null,
        playerType: 'TEAM',
      }));

      finalTeamB = autoTeamB.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: null,
        playerType: 'TEAM',
      }));
    }

    // Añadir jugadores TBD si es necesario
    const addTbdPlayers = (team: any[], isTeamA: boolean) => {
      // Si se proporcionaron jugadores TBD, usarlos
      if (tbdPlayersInput) {
        const tbdForTeam = isTeamA
          ? Array.isArray(tbdPlayersInput.teamA)
            ? tbdPlayersInput.teamA
            : []
          : Array.isArray(tbdPlayersInput.teamB)
          ? tbdPlayersInput.teamB
          : [];

        if (tbdForTeam.length > 0) {
          return tbdForTeam;
        }
      }

      // Fallback: crear jugadores TBD genéricos
      const generatedTbdPlayers: TbdPlayer[] = [];

      // Añadir jugadores TBD hasta completar el número requerido
      while (
        team.length + generatedTbdPlayers.length <
        requiredPlayersPerTeam
      ) {
        generatedTbdPlayers.push({
          id: `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: 'A determinar',
          isTeamA,
          avatar: null,
          playerType: 'TBD',
        });
      }

      return generatedTbdPlayers;
    };

    const tbdPlayersTeamA = addTbdPlayers(finalTeamA, true);
    const tbdPlayersTeamB = addTbdPlayers(finalTeamB, false);

    let match;

    // Si es un re-sorteo, actualizar el partido existente; si no, crear uno nuevo
    if (isResort && existingMatch) {
      // Primero eliminar los jugadores actuales
      await prisma.matchPlayer.deleteMany({
        where: { matchId: existingMatch.id },
      });

      // Actualizar el partido existente
      match = await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          // No actualizamos date ni location en un re-sorteo
          teamA: teamAName,
          teamB: teamBName,
        },
      });
    } else {
      // Crear un nuevo partido
      match = await prisma.match.create({
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

      // Actualizar el grupo con la información del nuevo partido
      await prisma.group.update({
        where: { id: groupId },
        data: {
          totalMatches: { increment: 1 },
          nextMatch: matchDate,
        },
      });
    }

    // Registrar jugadores del equipo A
    for (const player of finalTeamA) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: true,
        },
      });
    }

    // Registrar jugadores del equipo B
    for (const player of finalTeamB) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: false,
        },
      });
    }

    // Preparar los datos para la respuesta
    const tbdPlayers = {
      teamA: tbdPlayersTeamA,
      teamB: tbdPlayersTeamB,
    };

    // Retornar los equipos formados y el partido creado
    return res.status(200).json({
      message: isResort
        ? 'Equipos reorganizados correctamente'
        : 'Partido creado correctamente',
      teamA: finalTeamA,
      teamB: finalTeamB,
      teamAAvgAge,
      teamBAvgAge,
      match,
      tbdPlayers,
    });
  } catch (error) {
    console.error('Error al crear partido:', error);
    return res.status(500).json({
      message: 'Error al crear el partido',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
