import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Crea un nuevo partido automáticamente basado en la configuración del grupo
 * @param groupId ID del grupo para el cual crear un nuevo partido
 * @returns El nuevo partido creado o null si hay algún error
 */
export async function createNextMatch(groupId: string) {
  try {
    // Obtener información del grupo para crear un nuevo partido
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        location: true,
        teamAName: true,
        teamBName: true,
        recurrenceType: true,
        recurrenceDays: true,
        recurrenceTime: true,
      },
    });

    if (!group) {
      console.error(`Grupo con ID ${groupId} no encontrado`);
      return null;
    }

    // Calcular la fecha del próximo partido
    let nextMatchDate = new Date();
    nextMatchDate.setHours(0, 0, 0, 0); // Resetear a 00:00:00

    // Si hay configuración de recurrencia, usarla
    if (
      group.recurrenceType === 'WEEKLY' &&
      group.recurrenceDays &&
      group.recurrenceDays.length > 0
    ) {
      // Encontrar el próximo día de la semana configurado
      const now = new Date();
      const today = now.getDay(); // 0 = domingo, 1 = lunes, etc.
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const recurrenceDays = group.recurrenceDays.map(Number);

      // Obtener la hora configurada para comparar
      let configuredHour = 18; // Default 6 PM
      let configuredMinute = 0;
      if (group.recurrenceTime) {
        const [hours, minutes] = group.recurrenceTime.split(':').map(Number);
        configuredHour = hours;
        configuredMinute = minutes;
      }

      // Ordenar los días de recurrencia
      recurrenceDays.sort((a, b) => a - b);

      // Buscar el próximo día disponible considerando también la hora
      let nextDayThisWeek = recurrenceDays.find((day) => {
        if (day > today) {
          return true; // Cualquier día después de hoy está bien
        } else if (day === today) {
          // Si es el mismo día, verificar si la hora ya pasó
          const configuredTimeInMinutes =
            configuredHour * 60 + configuredMinute;
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          // Solo considera el mismo día si falta al menos 2 horas (120 minutos) para el partido
          return configuredTimeInMinutes > currentTimeInMinutes + 120;
        }
        return false;
      });

      if (nextDayThisWeek !== undefined) {
        // Si hay un día configurado después del actual en esta semana
        const daysToAdd = nextDayThisWeek - today;
        nextMatchDate.setDate(nextMatchDate.getDate() + daysToAdd);
      } else {
        // Si no hay un día después del actual, usar el primer día de la siguiente semana
        const daysToAdd = 7 - today + recurrenceDays[0];
        nextMatchDate.setDate(nextMatchDate.getDate() + daysToAdd);
      }

      // Configurar la hora si está disponible
      if (group.recurrenceTime) {
        const [hours, minutes] = group.recurrenceTime.split(':').map(Number);
        nextMatchDate.setHours(hours, minutes, 0, 0);
      }
    } else {
      // Si no hay configuración de recurrencia, añadir 7 días por defecto
      nextMatchDate.setDate(nextMatchDate.getDate() + 7);
    }

    // Usar una transacción para crear el partido y actualizar el grupo
    return await prisma.$transaction(async (tx) => {
      // Crear un nuevo partido pendiente
      const newMatch = await tx.match.create({
        data: {
          date: nextMatchDate,
          location: group.location || 'Ubicación por definir',
          groupId,
          teamA: group.teamAName || 'Equipo A',
          teamB: group.teamBName || 'Equipo B',
          scoreA: 0,
          scoreB: 0,
          status: 'PENDING',
        },
      });

      // Actualizar el grupo con la relación directa al próximo partido
      await tx.$executeRaw`
        UPDATE "Group" 
        SET "nextMatch" = ${nextMatchDate}, 
            "nextMatchId" = ${newMatch.id}
        WHERE "id" = ${groupId}
      `;

      // NO LIMPIAR las asistencias confirmadas - Las preservamos para el nuevo partido
      // await tx.matchAttendance.updateMany({
      //   where: {
      //     groupId: groupId,
      //     status: 'CONFIRMED',
      //   },
      //   data: {
      //     status: 'PENDING',
      //     updatedAt: new Date(),
      //   },
      // });

      // MANTENER las asistencias existentes del partido anterior
      // Buscar las últimas asistencias del grupo
      const previousAttendances = await tx.matchAttendance.findMany({
        where: {
          groupId: groupId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        distinct: ['userId'], // Obtener solo la asistencia más reciente por usuario
        select: {
          userId: true,
          status: true,
        },
      });

      // Para cada asistencia anterior, crear una nueva para el nuevo partido manteniendo el estado
      for (const attendance of previousAttendances) {
        await tx.matchAttendance.create({
          data: {
            userId: attendance.userId,
            matchId: newMatch.id,
            groupId: groupId,
            matchDate: nextMatchDate,
            status: attendance.status, // Mantener el estado anterior (CONFIRMED, PENDING, DECLINED)
          },
        });
      }

      // Para miembros que no tenían asistencia previa, crear con estado PENDING
      const membersWithAttendance = previousAttendances.map((a) => a.userId);
      const allActiveMembers = await tx.groupMember.findMany({
        where: {
          groupId: groupId,
          status: 'ACTIVE',
        },
        select: { userId: true },
      });

      const membersWithoutAttendance = allActiveMembers.filter(
        (member) => !membersWithAttendance.includes(member.userId)
      );

      for (const member of membersWithoutAttendance) {
        await tx.matchAttendance.create({
          data: {
            userId: member.userId,
            matchId: newMatch.id,
            groupId: groupId,
            matchDate: nextMatchDate,
            status: 'PENDING',
          },
        });
      }

      console.log(
        `Nuevo partido creado automáticamente con ID: ${newMatch.id}`
      );
      console.log(
        `Asistencias preservadas: ${previousAttendances.length} existentes, ${membersWithoutAttendance.length} nuevas como PENDING`
      );

      return newMatch;
    });
  } catch (error) {
    console.error('Error al crear nuevo partido automático:', error);
    return null;
  }
}
