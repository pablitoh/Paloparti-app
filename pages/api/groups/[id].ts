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
}

interface FormattedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
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

  try {
    // En lugar de usar include con nextMatchRef que puede causar errores,
    // obtenemos el grupo primero
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
                birthdate: true,
              },
            },
          },
        },
        matches: {
          orderBy: {
            date: 'desc',
          },
          include: {
            playersA: {
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
            goals: {
              include: {
                scorer: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Ahora obtenemos el partido relacionado como nextMatch si existe
    let nextMatchDetails = null;
    // Use consistent type assertion for nextMatchId
    const nextMatchId = (group as any).nextMatchId;
    if (nextMatchId) {
      nextMatchDetails = await prisma.match.findUnique({
        where: { id: nextMatchId },
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
          goals: {
            include: {
              scorer: {
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

      // Obtener las asistencias confirmadas para este partido específico
      const confirmedAttendances = await prisma.matchAttendance.findMany({
        where: {
          matchId: nextMatchId,
          status: 'CONFIRMED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      console.log(
        'Found confirmed attendances for next match:',
        confirmedAttendances.length
      );

      // Si hay nextMatchDetails, añadir la lista de jugadores confirmados específica para este partido
      if (nextMatchDetails) {
        nextMatchDetails = {
          ...nextMatchDetails,
          confirmedPlayers:
            confirmedAttendances.length > 0
              ? confirmedAttendances.map((attendance) => ({
                  id: attendance.user.id,
                  name: attendance.user.name,
                  avatar: attendance.user.image,
                }))
              : [], // Asegurar que siempre haya un array vacío si no hay confirmados
        };

        console.log(
          'Attached confirmedPlayers to nextMatchDetails:',
          nextMatchDetails.confirmedPlayers?.length || 0
        );
      }
    }

    // Debug the available fields on the group object
    console.log('All group properties:', {
      id: group?.id,
      name: group?.name,
      inviteToken: group?.inviteToken,
      description: group?.description,
      nextMatchId: group?.nextMatchId,
      // List all properties to check what's available
      propertiesAvailable: Object.keys(group || {}),
    });

    // Verificar si el usuario pertenece al grupo
    const userMembership = group.members.find(
      (member) => member.userId === user.id
    );
    const isMember = userMembership !== undefined;

    // Verificar si el usuario está confirmado en el grupo o es admin
    const isConfirmedMember =
      userMembership &&
      (userMembership.status === 'CONFIRMED' ||
        userMembership.role === 'ADMIN');

    if (!isMember) {
      return res
        .status(403)
        .json({ message: 'No tienes permiso para ver este grupo' });
    }

    // Si el usuario es miembro pero su estado es PENDING, devolver info básica del grupo
    // Excepción: Si es ADMIN aunque tenga estado PENDING, dejar que acceda al grupo completo
    if (
      userMembership &&
      userMembership.status === 'PENDING' &&
      userMembership.role !== 'ADMIN'
    ) {
      // Devolver información limitada del grupo
      const limitedGroupInfo = {
        id: group.id,
        name: group.name,
        description: group.description,
        sport: group.sport,
        location: group.location,
        members: [
          {
            id: userMembership.id,
            userId: userMembership.userId,
            status: 'PENDING',
            role: userMembership.role,
            name: user.name,
            avatar: user.image,
            email: user.email,
          },
        ],
        userStatus: 'PENDING',
        message: 'Tu solicitud de membresía está pendiente de aprobación',
      };

      return res.status(200).json(limitedGroupInfo);
    }

    // Para DELETE, verificar que el usuario sea administrador
    if (req.method === 'DELETE') {
      // Verificar si el usuario es administrador del grupo
      const isAdmin = group.members.some(
        (member: { userId: string; role: string }) =>
          member.userId === user.id && member.role === 'ADMIN'
      );

      if (!isAdmin) {
        return res.status(403).json({
          message:
            'No tienes permisos de administrador para eliminar este grupo',
        });
      }

      try {
        // Eliminar primero las relaciones - miembros y partidos
        await prisma.groupMember.deleteMany({
          where: { groupId: id },
        });

        await prisma.match.deleteMany({
          where: { groupId: id },
        });

        // Finalmente eliminar el grupo
        await prisma.group.delete({
          where: { id },
        });

        return res
          .status(200)
          .json({ message: 'Grupo eliminado correctamente' });
      } catch (error) {
        console.error('Error eliminando grupo:', error);
        return res.status(500).json({ message: 'Error al eliminar el grupo' });
      }
    } else if (req.method === 'PUT') {
      try {
        console.log('PUT request received for group ID:', id);

        // Verificar que el usuario sea administrador
        const isAdmin = group.members.some(
          (member: { userId: string; role: string }) =>
            member.userId === user.id && member.role === 'ADMIN'
        );
        console.log('User ID:', user.id);
        console.log('Group members:', JSON.stringify(group.members, null, 2));
        console.log('Admin status check:', isAdmin);

        if (!isAdmin) {
          return res.status(403).json({
            message: 'No tienes permisos para editar este grupo',
          });
        }

        const {
          name,
          description,
          sport,
          location,
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
          nextMatch,
          requiredPlayers,
          teamAName,
          teamBName,
        } = req.body;

        console.log(
          'Received update data:',
          JSON.stringify(
            {
              name,
              description,
              sport,
              location,
              recurrenceType,
              recurrenceDays: Array.isArray(recurrenceDays)
                ? recurrenceDays
                : 'NOT_ARRAY',
              recurrenceTime,
              nextMatch,
              requiredPlayers,
              teamAName,
              teamBName,
            },
            null,
            2
          )
        );

        // Validar campos obligatorios
        if (!name || !sport || !location) {
          console.log('Missing required fields');
          return res
            .status(400)
            .json({ message: 'Faltan campos obligatorios' });
        }

        // Validar que recurrenceDays sea un array si se proporciona
        if (recurrenceDays && !Array.isArray(recurrenceDays)) {
          console.log('recurrenceDays is not an array');
          return res
            .status(400)
            .json({ message: 'recurrenceDays debe ser un array' });
        }

        // Crear objeto con los datos para actualizar
        const updateData = {
          name,
          description,
          sport,
          location,
          recurrenceType,
          recurrenceDays,
          recurrenceTime,
          nextMatch: nextMatch ? new Date(nextMatch) : null,
          requiredPlayers: requiredPlayers
            ? parseInt(requiredPlayers.toString(), 10)
            : 10,
          teamAName:
            teamAName === undefined || teamAName === null
              ? 'Equipo A'
              : String(teamAName),
          teamBName:
            teamBName === undefined || teamBName === null
              ? 'Equipo B'
              : String(teamBName),
        };

        console.log(
          'Update data prepared:',
          JSON.stringify(updateData, null, 2)
        );
        console.log('Team names specifically:', {
          teamAName: updateData.teamAName,
          teamBName: updateData.teamBName,
        });

        // Actualizar grupo
        const updatedGroup = await prisma.group.update({
          where: { id },
          data: updateData,
        });

        console.log('Group updated successfully');
        return res.status(200).json({
          message: 'Grupo actualizado correctamente',
          group: updatedGroup,
        });
      } catch (error) {
        console.error('Error updating group:', error);
        return res
          .status(500)
          .json({ message: 'Error al actualizar el grupo' });
      }
    } else if (req.method === 'PATCH') {
      // Este endpoint manejará cambios en roles de miembros
      // Verificar si el usuario es administrador del grupo
      const isAdmin = group.members.some(
        (member: { userId: string; role: string }) =>
          member.userId === user.id && member.role === 'ADMIN'
      );

      if (!isAdmin) {
        return res.status(403).json({
          message: 'No tienes permisos de administrador para modificar roles',
        });
      }

      try {
        const { memberId, action } = req.body;

        if (!memberId || !action) {
          return res.status(400).json({
            message: 'Se requiere ID del miembro y acción a realizar',
          });
        }

        // Verificar que el miembro exista en el grupo
        const memberExists = await prisma.groupMember.findFirst({
          where: {
            groupId: id,
            userId: memberId,
          },
        });

        if (!memberExists) {
          return res
            .status(404)
            .json({ message: 'El miembro no pertenece a este grupo' });
        }

        // Acción para cambiar rol a administrador
        if (action === 'promote') {
          await prisma.groupMember.update({
            where: {
              id: memberExists.id,
            },
            data: {
              role: 'ADMIN',
            },
          });
          return res.status(200).json({
            message: 'Usuario promovido a administrador correctamente',
          });
        }
        // Acción para quitar rol de administrador
        else if (action === 'demote') {
          // Verificar que no sea el último administrador
          const adminCount = await prisma.groupMember.count({
            where: {
              groupId: id,
              role: 'ADMIN',
            },
          });

          if (adminCount <= 1) {
            return res.status(400).json({
              message: 'No se puede quitar el último administrador del grupo',
            });
          }

          await prisma.groupMember.update({
            where: {
              id: memberExists.id,
            },
            data: {
              role: 'MEMBER',
            },
          });
          return res.status(200).json({
            message: 'Rol de administrador revocado correctamente',
          });
        }
        // Acción para eliminar un miembro
        else if (action === 'remove') {
          // Verificar que no se esté intentando eliminar a un administrador
          if (memberExists.role === 'ADMIN') {
            const adminCount = await prisma.groupMember.count({
              where: {
                groupId: id,
                role: 'ADMIN',
              },
            });

            if (adminCount <= 1) {
              return res.status(400).json({
                message:
                  'No se puede eliminar al último administrador del grupo',
              });
            }
          }

          await prisma.groupMember.delete({
            where: {
              id: memberExists.id,
            },
          });
          return res.status(200).json({
            message: 'Miembro eliminado del grupo correctamente',
          });
        } else {
          return res.status(400).json({ message: 'Acción no válida' });
        }
      } catch (error) {
        console.error('Error actualizando rol de miembro:', error);
        return res
          .status(500)
          .json({ message: 'Error al actualizar el rol del miembro' });
      }
    } else if (req.method === 'GET') {
      try {
        // Format the group members with user details
        const members: FormattedMember[] = await Promise.all(
          group.members.map(async (member) => {
            const user = await prisma.user.findUnique({
              where: { id: member.userId },
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            });

            return {
              id: member.id,
              userId: member.userId,
              name: user?.name || 'Sin nombre',
              email: user?.email || null,
              avatar: user?.image || null,
              role: member.role,
              status: (member.status || 'CONFIRMED').toLowerCase(),
            };
          })
        );

        // Función para formatear un partido
        const formatMatch = (match: DbMatch): FormattedMatch => {
          // Get confirmed players if they exist in the match object
          const confirmedPlayers = (match as any).confirmedPlayers || [];

          return {
            id: match.id,
            date: match.date,
            location: match.location,
            teamA: match.teamA,
            teamB: match.teamB,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            status: match.status,
            playersA: match.playersA
              .filter((player) => player.isTeamA)
              .map((player) => ({
                id: player.user.id,
                name: player.user.name,
                avatar: player.user.image,
                age: calculateAge(player.user.birthdate),
              })),
            playersB: match.playersA
              .filter((player) => !player.isTeamA)
              .map((player) => ({
                id: player.user.id,
                name: player.user.name,
                avatar: player.user.image,
                age: calculateAge(player.user.birthdate),
              })),
            goals: match.goals.map((goal) => ({
              id: goal.id,
              scorerId: goal.scorer.id,
              isTeamA: goal.isTeamA,
              minute: goal.minute,
              scorerName: goal.scorer.name,
              scorerAvatar: goal.scorer.image,
            })),
            // Include the confirmed players
            confirmedPlayers: confirmedPlayers,
          };
        };

        // Formatear la respuesta
        const formattedGroup: FormattedGroup = {
          id: group.id,
          name: group.name,
          description: group.description || null,
          sport: group.sport || '',
          location: group.location || '',
          teamAName: group.teamAName || 'Equipo A',
          teamBName: group.teamBName || 'Equipo B',
          recurrenceType: group.recurrenceType,
          recurrenceDays: group.recurrenceDays || [],
          recurrenceTime: group.recurrenceTime,
          requiredPlayers: group.requiredPlayers || 10,
          inviteToken: group.inviteToken,
          members,
          matches: group.matches.map((match: DbMatch) => formatMatch(match)),
          createdAt: group.createdAt,
          createdBy: group.createdBy,
          nextMatch: group.nextMatch,
          nextMatchId: group.nextMatchId,
          nextMatchDetails: nextMatchDetails
            ? formatMatch(nextMatchDetails as unknown as DbMatch)
            : null,
          totalMatches: group.totalMatches,
        };

        console.log(
          'GET response members:',
          JSON.stringify(formattedGroup.members, null, 2)
        );
        console.log(
          'Original group.members:',
          JSON.stringify(
            group.members.map((m) => ({
              id: m.id,
              userId: m.userId,
              role: m.role,
            })),
            null,
            2
          )
        );

        // Agregar información sobre el status diferente entre miembros del grupo y asistentes al partido
        console.log(
          `IMPORTANTE: El status de los miembros (${members.length}) se refiere a su pertenencia al grupo, NO a su asistencia al próximo partido.`
        );
        if (nextMatchDetails && nextMatchDetails.confirmedPlayers) {
          console.log(
            `Los jugadores confirmados para el próximo partido son ${nextMatchDetails.confirmedPlayers.length}, independientemente de su estado en el grupo.`
          );
        }

        console.log('Devolviendo datos de grupo. Miembros:', {
          count: group.members.length,
          firstFew: group.members.slice(0, 3).map((m) => ({
            id: m.id,
            userId: m.userId,
            status: m.status,
            role: m.role,
          })),
        });

        return res.status(200).json(formattedGroup);
      } catch (error) {
        console.error('Error fetching group details:', error);
        return res
          .status(500)
          .json({ message: 'Error al obtener detalles del grupo' });
      }
    } else {
      return res.status(405).json({ message: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error fetching group details:', error);
    return res
      .status(500)
      .json({ message: 'Error al obtener detalles del grupo' });
  }
}
