import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';
import { logGroupEvent } from '../../../utils/serverLogEvents';
import { LogAction } from '../../../utils/logTypes';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Tipos para formatear los datos
interface FormattedMember {
  id: string; // ID del GroupMember
  userId: string; // ID del usuario
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string; // Estado del miembro (CONFIRMED, PENDING, etc.)
}

// Interfaces adicionales para facilitar el tipado
interface MatchPlayer {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    birthdate: Date | null;
  };
  isTeamA: boolean;
}

interface Goal {
  id: string;
  isTeamA: boolean;
  minute: number | null;
  scorer: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface DbMatch {
  id: string;
  date: Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA: MatchPlayer[];
  goals: Goal[];
  tbdPlayers?: any; // Add tbdPlayers field to DbMatch interface
}

interface FormattedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
  playerType?: string;
  isTeamA?: boolean;
}

interface FormattedGoal {
  id: string;
  scorerId: string;
  isTeamA: boolean;
  minute: number | null;
  scorerName: string | null;
  scorerAvatar: string | null;
}

interface FormattedMatch {
  id: string;
  date: Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA: FormattedPlayer[];
  playersB: FormattedPlayer[];
  goals: FormattedGoal[];
  confirmedPlayers?: FormattedPlayer[];
  tbdPlayers?: FormattedPlayer[]; // Add tbdPlayers field to store TBD players
}

interface FormattedGroup {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  teamAName: string;
  teamBName: string;
  recurrenceType: string | null;
  recurrenceDays: number[];
  recurrenceTime: string | null;
  requiredPlayers: number;
  inviteToken: string | null;
  members: FormattedMember[];
  matches: FormattedMatch[];
  createdAt: Date;
  createdBy: string;
  nextMatch: Date | null;
  nextMatchId: string | null;
  nextMatchDetails: FormattedMatch | null;
  totalMatches: number;
}

interface TbdPlayer {
  id: string;
  name: string;
  avatar: string | null;
  age: number | null;
  isTeamA: boolean;
}

// Update the Prisma types
interface PrismaGroup {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  teamAName: string | null;
  teamBName: string | null;
  recurrenceType: string | null;
  recurrenceDays: number[];
  recurrenceTime: string | null;
  requiredPlayers: number;
  inviteToken: string | null;
  createdAt: Date;
  createdBy: string;
  nextMatch: Date | null;
  nextMatchId: string | null;
  totalMatches: number;
  members: {
    id: string;
    userId: string;
    role: string;
    status: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }[];
  matches: DbMatch[];
  creator: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación usando la misma lógica que funciona en /api/groups
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    console.log('No authenticated session found in /api/groups/[id]');
    return res.status(401).json({ message: 'No autenticado' });
  }

  const userId = session.user.id;
  console.log('User ID from session in /api/groups/[id]:', userId);

  // Buscar el usuario en la base de datos para confirmar que existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    console.log('User not found in database for /api/groups/[id]');
    return res.status(401).json({ message: 'Usuario no encontrado' });
  }

  // Obtener ID del grupo
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID de grupo inválido' });
  }

  // GET: Obtener información del grupo
  if (req.method === 'GET') {
    try {
      // Obtener solo la información básica del grupo
      const group = await prisma.group.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          location: true,
          teamAName: true,
          teamBName: true,
          teamAColor: true,
          teamBColor: true,
          lastSortingCriteria: true,
          recurrenceType: true,
          recurrenceDays: true,
          recurrenceTime: true,
          requiredPlayers: true,
          inviteToken: true,
          createdAt: true,
          createdBy: true,
          nextMatchId: true,
          totalMatches: true,
        },
      });

      if (!group) {
        return res.status(404).json({ message: 'Grupo no encontrado' });
      }

      // Verificar si el usuario es miembro y su rol
      const userMembership = await prisma.groupMember.findFirst({
        where: {
          groupId: id,
          userId: user.id,
        },
      });

      // Determinar si el usuario es administrador
      const isAdmin =
        userMembership?.role === 'ADMIN' || group.createdBy === user.id;

      // Formatear la respuesta
      const formattedGroup = {
        ...group,
        isAdmin,
        userStatus: userMembership?.status || null,
      };

      return res.status(200).json(formattedGroup);
    } catch (error) {
      console.error('Error al obtener detalles del grupo:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
  // PUT: Actualizar información del grupo
  else if (req.method === 'PUT') {
    try {
      // Verificar que el usuario es administrador
      const userMembership = await prisma.groupMember.findFirst({
        where: {
          groupId: id,
          userId: user.id,
        },
      });

      const group = await prisma.group.findUnique({
        where: { id },
        select: {
          createdBy: true,
        },
      });

      if (!group) {
        return res.status(404).json({ message: 'Grupo no encontrado' });
      }

      // Determinar si el usuario es administrador
      const isAdmin =
        userMembership?.role === 'ADMIN' || group.createdBy === user.id;

      if (!isAdmin) {
        return res
          .status(403)
          .json({ message: 'No tienes permisos para editar este grupo' });
      }

      // Extraer datos del cuerpo de la solicitud
      const {
        name,
        sport,
        description,
        location,
        teamAName,
        teamBName,
        teamAColor,
        teamBColor,
        recurrenceType,
        recurrenceDays,
        recurrenceTime,
        requiredPlayers,
        nextMatch,
      } = req.body;

      // Validar campos obligatorios
      if (!name || !sport || !location) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
      }

      // Actualizar el grupo
      const updatedGroup = await prisma.group.update({
        where: { id },
        data: {
          name,
          sport,
          description,
          location,
          teamAName,
          teamBName,
          teamAColor,
          teamBColor,
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
          requiredPlayers,
          // Actualizar nextMatch si se proporciona
          ...(nextMatch && { nextMatch: new Date(nextMatch) }),
        },
      });

      // Registrar en el log
      await logGroupEvent(id, user.id, LogAction.GROUP_EDITED, {
        previousData: {
          name: group.name,
          sport: group.sport,
          description: group.description,
          location: group.location,
          teamAName: group.teamAName,
          teamBName: group.teamBName,
          teamAColor: group.teamAColor,
          teamBColor: group.teamBColor,
          requiredPlayers: group.requiredPlayers,
          recurrenceType: group.recurrenceType,
          recurrenceDays: group.recurrenceDays,
          recurrenceTime: group.recurrenceTime,
        },
        newData: {
          name,
          sport,
          description,
          location,
          teamAName,
          teamBName,
          teamAColor,
          teamBColor,
          requiredPlayers,
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
        },
      });

      return res.status(200).json({
        message: 'Grupo actualizado correctamente',
        group: updatedGroup,
      });
    } catch (error) {
      console.error('Error al actualizar el grupo:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
  // DELETE: Eliminar grupo
  else if (req.method === 'DELETE') {
    try {
      // Verificar que el usuario es administrador o creador del grupo
      const group = await prisma.group.findUnique({
        where: { id },
        select: {
          createdBy: true,
          name: true,
        },
      });

      if (!group) {
        return res.status(404).json({ message: 'Grupo no encontrado' });
      }

      const userMembership = await prisma.groupMember.findFirst({
        where: {
          groupId: id,
          userId: user.id,
        },
      });

      // Determinar si el usuario es administrador o creador
      const isAdmin =
        userMembership?.role === 'ADMIN' || group.createdBy === user.id;

      if (!isAdmin) {
        return res
          .status(403)
          .json({ message: 'No tienes permisos para eliminar este grupo' });
      }

      // Eliminar en orden para evitar problemas de foreign key constraints
      // 1. Eliminar goals de todos los matches del grupo
      await prisma.goal.deleteMany({
        where: {
          match: {
            groupId: id,
          },
        },
      });

      // 2. Eliminar match players de todos los matches del grupo
      await prisma.matchPlayer.deleteMany({
        where: {
          match: {
            groupId: id,
          },
        },
      });

      // 3. Eliminar match attendance de todos los matches del grupo
      await prisma.matchAttendance.deleteMany({
        where: {
          groupId: id,
        },
      });

      // 4. Eliminar todos los matches del grupo
      await prisma.match.deleteMany({
        where: {
          groupId: id,
        },
      });

      // 5. Eliminar todos los logs del grupo
      await prisma.groupLog.deleteMany({
        where: {
          groupId: id,
        },
      });

      // 6. Eliminar todos los miembros del grupo
      await prisma.groupMember.deleteMany({
        where: {
          groupId: id,
        },
      });

      // 7. Finalmente, eliminar el grupo
      await prisma.group.delete({
        where: { id },
      });

      // Registrar en el log antes de eliminar (si queremos mantener un registro)
      // Note: Como estamos eliminando el grupo, este log también se eliminará
      // pero podríamos crear un log global si fuera necesario

      return res.status(200).json({
        message: 'Grupo eliminado correctamente',
      });
    } catch (error) {
      console.error('Error al eliminar el grupo:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  } else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}
