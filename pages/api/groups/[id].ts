import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';

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
  // Verificar autenticación
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
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

      // Validar que requiredPlayers sea un número par
      if (requiredPlayers % 2 !== 0) {
        return res
          .status(400)
          .json({ message: 'El número de jugadores requeridos debe ser par' });
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
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
          requiredPlayers,
          // Actualizar nextMatch si se proporciona
          ...(nextMatch && { nextMatch: new Date(nextMatch) }),
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
  } else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}
