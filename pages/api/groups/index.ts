import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import crypto from 'crypto';

type GroupMember = {
  id: string;
  userId: string;
  role: string;
  status?: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type GroupWithMembers = {
  id: string;
  name: string;
  description: string | null;
  sport: string | null;
  location: string | null;
  createdAt: Date;
  createdBy: string;
  nextMatch: Date | null;
  totalMatches: number;
  members: GroupMember[];
  matches: {
    date: Date;
  }[];
  inviteToken?: string;
};

interface FormattedMember {
  id: string;
  name: string | null;
  avatar: string | null;
  role: string;
}

interface FormattedGroup {
  id: string;
  name: string;
  description: string | null;
  sport: string | null;
  location: string | null;
  members: FormattedMember[];
  createdAt: Date;
  createdBy: string | null;
  nextMatch: string | Date | null;
  totalMatches: number | null;
  userStatus?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Received request to /api/groups');

  // Obtener la sesión del usuario usando NextAuth
  const session = await getServerSession(req, res, authOptions);

  // Verificar si el usuario está autenticado
  if (!session || !session.user?.id) {
    console.log('No authenticated user found');
    return res.status(401).json({ message: 'No autenticado' });
  }

  const userId = session.user.id;
  console.log('User ID from session:', userId);

  if (req.method === 'GET') {
    try {
      console.log('Fetching groups for user:', userId);

      if (!prisma) {
        console.error('Prisma client not available');
        return res.status(500).json({ message: 'Database connection error' });
      }

      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          location: true,
          createdAt: true,
          createdBy: true,
          nextMatch: true,
          totalMatches: true,
          members: {
            select: {
              userId: true,
              role: true,
              status: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
          matches: {
            orderBy: {
              date: 'desc',
            },
            take: 1,
            select: {
              date: true,
            },
          },
        },
      });

      console.log('Query executed successfully');
      console.log('Found groups count:', groups.length);
      console.log('First group (if any):', groups[0] ? groups[0].id : 'None');

      const formattedGroups = groups.map((group: (typeof groups)[0]) => {
        // Buscar el miembro actual para obtener su estado
        const currentUserMember = group.members.find(
          (member: (typeof group.members)[0]) => member.userId === userId
        );

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          sport: group.sport,
          location: group.location,
          members: group.members.map((member: (typeof group.members)[0]) => ({
            id: member.user.id,
            name: member.user.name,
            avatar: member.user.image,
            role: member.role,
          })),
          createdAt: group.createdAt,
          createdBy: group.createdBy,
          nextMatch: group.nextMatch || group.matches[0]?.date || null,
          totalMatches: group.totalMatches,
          userStatus: currentUserMember?.status || undefined,
        };
      });

      console.log('Formatted groups:', formattedGroups);
      return res.status(200).json(formattedGroups);
    } catch (error) {
      console.error('Error in GET /api/groups:', error);
      if (error instanceof Error) {
        return res.status(500).json({
          message: 'Error fetching groups',
          error: error.message,
          stack:
            process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
      return res.status(500).json({
        message: 'An unexpected error occurred while fetching groups',
      });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        name,
        sport,
        description,
        location,
        recurrenceType,
        recurrenceDays,
        recurrenceTime,
        nextMatch,
        requiredPlayers,
      } = req.body;

      // Validar campos obligatorios
      if (!name || !sport || !location) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
      }

      // Validar que recurrenceDays sea un array si se proporciona
      if (recurrenceDays && !Array.isArray(recurrenceDays)) {
        return res
          .status(400)
          .json({ message: 'recurrenceDays debe ser un array' });
      }

      // Validar que requiredPlayers sea un número par
      if (requiredPlayers && requiredPlayers % 2 !== 0) {
        return res
          .status(400)
          .json({ message: 'El número de jugadores requeridos debe ser par' });
      }

      // Generar token de invitación permanente
      const inviteToken = crypto.randomBytes(8).toString('hex');
      console.log('Token de invitación generado:', inviteToken);

      // Determinar la fecha del próximo partido
      const nextMatchDate = nextMatch ? new Date(nextMatch) : new Date();
      if (!nextMatch) {
        // Si no se proporciona, establecerlo a una semana en el futuro
        nextMatchDate.setDate(nextMatchDate.getDate() + 7);
      }

      // Crear el grupo con el token de invitación
      const newGroup = await prisma.group.create({
        data: {
          name,
          sport,
          description,
          location,
          createdBy: userId,
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
          nextMatch: nextMatchDate,
          inviteToken, // Guardar el token de invitación
          members: {
            create: {
              userId: userId,
              role: 'ADMIN', // El creador siempre es admin
              status: 'CONFIRMED', // El creador queda automáticamente aceptado
            },
          },
        },
      });

      // Primero crear un partido pendiente como 'nextMatch'
      const newMatch = await prisma.match.create({
        data: {
          date: nextMatchDate,
          location,
          teamA: 'Equipo A',
          teamB: 'Equipo B',
          scoreA: 0,
          scoreB: 0,
          status: 'PENDING',
          groupId: newGroup.id, // Agregar directamente la relación con el grupo
        },
      });

      console.log('Nuevo partido creado:', newMatch.id);

      // Actualizar el grupo con el ID del próximo partido
      await prisma.$executeRaw`
        UPDATE "Group" 
        SET "nextMatchId" = ${newMatch.id}
        WHERE "id" = ${newGroup.id}
      `;

      // Registrar la asistencia del creador al próximo partido
      await prisma.matchAttendance.create({
        data: {
          userId: userId,
          groupId: newGroup.id,
          matchId: newMatch.id,
          matchDate: nextMatchDate,
          status: 'CONFIRMED', // El creador está confirmado para el próximo partido
        },
      });

      // Construir URL de invitación
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

      // Obtener el grupo actualizado con todos sus datos
      const updatedGroup = await prisma.group.findUnique({
        where: { id: newGroup.id },
      });

      return res.status(201).json({
        ...updatedGroup,
        inviteUrl,
        nextMatchDetails: {
          id: newMatch.id,
          date: nextMatchDate,
          location: location,
          confirmedPlayers: [
            {
              id: userId,
              name: session?.user?.name || null,
              avatar: session?.user?.image || null,
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error creating group:', error);
      return res.status(500).json({ message: 'Error al crear el grupo' });
    }
  } else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}
