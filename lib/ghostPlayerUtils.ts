import { prisma } from './prisma';
import { PrismaClient } from '@prisma/client';

export const GHOST_EMAIL_DOMAIN = '@paloparti.ghost';

interface GhostPlayerMetadata {
  isGhost: true;
  createdBy: string; // ID del admin que lo creó
  groupId: string; // Grupo donde se creó
  realUserId?: string; // ID del usuario real para fusión futura
  createdAt: string;
}

export const generateGhostEmail = (
  groupId: string,
  playerName: string
): string => {
  const timestamp = Date.now();
  const cleanName = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  return `ghost-${groupId.substring(
    0,
    8
  )}-${cleanName}-${timestamp}${GHOST_EMAIL_DOMAIN}`;
};

export const isGhostPlayer = (user: {
  email: string | null;
  image: string | null;
}): boolean => {
  if (user.email?.endsWith(GHOST_EMAIL_DOMAIN)) return true;

  // Verificar también por metadata en campo image
  try {
    if (user.image) {
      const metadata = JSON.parse(user.image) as GhostPlayerMetadata;
      return metadata.isGhost === true;
    }
  } catch {
    // Si no es JSON válido, no es jugador fantasma
  }

  return false;
};

export const getGhostMetadata = (user: {
  image: string | null;
}): GhostPlayerMetadata | null => {
  try {
    if (user.image) {
      const metadata = JSON.parse(user.image) as GhostPlayerMetadata;
      return metadata.isGhost ? metadata : null;
    }
  } catch {
    return null;
  }
  return null;
};

// Calcular fecha de nacimiento basada en edad (1/1/AÑO)
export const calculateBirthdateFromAge = (age: number): Date => {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  return new Date(birthYear, 0, 1); // 1 de enero del año calculado
};

export const createGhostPlayer = async (
  groupId: string,
  adminId: string,
  playerData: { name: string; age: number; realUserId?: string }
) => {
  const ghostEmail = generateGhostEmail(groupId, playerData.name);
  const birthdate = calculateBirthdateFromAge(playerData.age);

  // Metadata del jugador fantasma
  const metadata: GhostPlayerMetadata = {
    isGhost: true,
    createdBy: adminId,
    groupId: groupId,
    realUserId: playerData.realUserId, // ID opcional del usuario real
    createdAt: new Date().toISOString(),
  };

  // 1. Crear usuario fantasma
  const ghostUser = await prisma.user.create({
    data: {
      name: `${playerData.name} (F)`,
      email: ghostEmail,
      birthdate: birthdate,
      password: null,
      emailVerified: null,
      image: JSON.stringify(metadata), // Metadata aquí
    },
  });

  // 2. Agregarlo automáticamente al grupo con rating por defecto
  await prisma.groupMember.create({
    data: {
      groupId: groupId,
      userId: ghostUser.id,
      role: 'MEMBER',
      status: 'CONFIRMED',
      starRating: 3, // Rating por defecto
    },
  });

  return { ghostUser, metadata };
};

// Eliminar jugador fantasma
export const deleteGhostPlayer = async (userId: string, groupId: string) => {
  console.log('Intentando eliminar jugador fantasma:', { userId, groupId });

  // Usar transacción para asegurar consistencia
  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    // 1. Verificar que es jugador fantasma
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true, image: true },
    });

    console.log('Usuario encontrado:', user);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!isGhostPlayer(user)) {
      throw new Error('No es un jugador fantasma');
    }

    // 2. Verificar que está en el grupo
    const membership = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    console.log('Membresía encontrada:', membership);

    if (!membership) {
      throw new Error('El jugador fantasma no está en este grupo');
    }

    // 3. Eliminar de grupo
    await tx.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    console.log('Membresía eliminada exitosamente');

    // 4. Verificar si está en otros grupos
    const otherMemberships = await tx.groupMember.count({
      where: { userId },
    });

    console.log('Otras membresías encontradas:', otherMemberships);

    // 5. Si no está en otros grupos, eliminar usuario
    if (otherMemberships === 0) {
      // Primero eliminar todas las relaciones del usuario
      await tx.matchAttendance.deleteMany({
        where: { userId },
      });

      await tx.matchPlayer.deleteMany({
        where: { userId },
      });

      await tx.goal.deleteMany({
        where: { userId },
      });

      await tx.groupLog.deleteMany({
        where: { userId },
      });

      // Eliminar cuentas y sesiones si existen
      await tx.account.deleteMany({
        where: { userId },
      });

      await tx.session.deleteMany({
        where: { userId },
      });

      // Finalmente eliminar el usuario
      await tx.user.delete({
        where: { id: userId },
      });

      console.log('Usuario fantasma eliminado completamente');
      return { userDeleted: true };
    } else {
      console.log('Usuario mantenido porque tiene otras membresías');
      return { userDeleted: false };
    }
  });

  console.log('Operación completada:', result);
  return result;
};

// Vincular jugador fantasma con usuario real
export const linkGhostToRealUser = async (
  ghostUserId: string,
  realUserId: string
) => {
  const ghostUser = await prisma.user.findUnique({
    where: { id: ghostUserId },
    select: { image: true, email: true },
  });

  if (!ghostUser || !isGhostPlayer(ghostUser)) {
    throw new Error('Usuario no es un jugador fantasma');
  }

  const metadata = getGhostMetadata(ghostUser);
  if (!metadata) {
    throw new Error('Metadata de jugador fantasma no encontrada');
  }

  // Actualizar metadata con ID del usuario real
  const updatedMetadata: GhostPlayerMetadata = {
    ...metadata,
    realUserId: realUserId,
  };

  await prisma.user.update({
    where: { id: ghostUserId },
    data: {
      image: JSON.stringify(updatedMetadata),
    },
  });
};

// Fusionar jugador fantasma con usuario real (para el futuro)
export const mergeGhostWithRealUser = async (
  ghostUserId: string,
  realUserId: string
) => {
  const transaction = await prisma.$transaction(async (tx: PrismaClient) => {
    // 1. Obtener datos del jugador fantasma
    const ghostUser = await tx.user.findUnique({
      where: { id: ghostUserId },
      include: {
        groupsMember: true,
        matchPlayers: true,
        goals: true,
        attendance: true,
        logs: true,
      },
    });

    if (!ghostUser || !isGhostPlayer(ghostUser)) {
      throw new Error('Usuario fantasma no encontrado');
    }

    // 2. Transferir todas las relaciones al usuario real
    // Membresías de grupo (evitar duplicados)
    for (const membership of ghostUser.groupsMember) {
      await tx.groupMember.upsert({
        where: {
          groupId_userId: { groupId: membership.groupId, userId: realUserId },
        },
        update: {
          starRating: Math.max(membership.starRating, 3), // Mantener el rating más alto
        },
        create: {
          groupId: membership.groupId,
          userId: realUserId,
          role: membership.role,
          status: membership.status,
          starRating: membership.starRating,
        },
      });
    }

    // Participaciones en partidos
    await tx.matchPlayer.updateMany({
      where: { userId: ghostUserId },
      data: { userId: realUserId },
    });

    // Goles
    await tx.goal.updateMany({
      where: { userId: ghostUserId },
      data: { userId: realUserId },
    });

    // Asistencias
    await tx.matchAttendance.updateMany({
      where: { userId: ghostUserId },
      data: { userId: realUserId },
    });

    // Logs
    await tx.groupLog.updateMany({
      where: { userId: ghostUserId },
      data: { userId: realUserId },
    });

    // 3. Eliminar membresías fantasma después de transferir
    await tx.groupMember.deleteMany({
      where: { userId: ghostUserId },
    });

    // 4. Eliminar usuario fantasma
    await tx.user.delete({
      where: { id: ghostUserId },
    });

    return { merged: true, ghostUser, realUserId };
  });

  return transaction;
};

// Buscar jugadores fantasma por usuario real ID
export const findGhostPlayersByRealUserId = async (realUserId: string) => {
  const allUsers = await prisma.user.findMany({
    where: {
      email: { endsWith: GHOST_EMAIL_DOMAIN },
    },
    include: {
      groupsMember: {
        include: {
          group: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return allUsers.filter(
    (user: { email: string | null; image: string | null }) => {
      const metadata = getGhostMetadata(user);
      return metadata?.realUserId === realUserId;
    }
  );
};
