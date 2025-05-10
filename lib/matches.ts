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

    // Por defecto, añadir 7 días para el próximo partido
    nextMatchDate.setDate(nextMatchDate.getDate() + 7);

    // Si hay configuración de recurrencia, usarla
    if (
      group.recurrenceType === 'WEEKLY' &&
      group.recurrenceDays &&
      group.recurrenceDays.length > 0
    ) {
      // Encontrar el próximo día de la semana configurado
      const today = new Date().getDay(); // 0 = domingo, 1 = lunes, etc.
      const recurrenceDays = group.recurrenceDays.map(Number);

      // Ordenar los días de recurrencia y encontrar el próximo
      recurrenceDays.sort((a, b) => a - b);
      const nextDay = recurrenceDays.find((day) => day > today);

      if (nextDay !== undefined) {
        // Si hay un día configurado después del actual
        const daysToAdd = nextDay - today;
        nextMatchDate.setDate(nextMatchDate.getDate() - 7 + daysToAdd);
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

      // Limpiar explícitamente cualquier asistencia previa para este grupo
      // Esto garantiza que no haya jugadores confirmados heredados de partidos anteriores
      await tx.matchAttendance.updateMany({
        where: {
          groupId: groupId,
          status: 'CONFIRMED',
        },
        data: {
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });

      // Resetear *explícitamente* los estados de asistencia para este nuevo partido
      // Obtenemos los miembros del grupo
      const members = await tx.groupMember.findMany({
        where: {
          groupId: groupId,
          status: 'ACTIVE', // Solo miembros activos
        },
        select: { userId: true },
      });

      // Para cada miembro, creamos un registro de asistencia PENDING para el nuevo partido
      for (const member of members) {
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
        `Asistencias inicializadas a PENDING para ${members.length} miembros`
      );

      return newMatch;
    });
  } catch (error) {
    console.error('Error al crear nuevo partido automático:', error);
    return null;
  }
}
