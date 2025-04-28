import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  try {
    // Buscar el usuario test1
    const testUser1 = await prisma.user.findUnique({
      where: { email: 'test1@example.com' },
    });

    if (!testUser1) {
      console.log('No se encontró el Test User 1, creándolo...');
      // Crear test user 1 si no existe
      const hashedPassword = await bcrypt.hash('password123', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'test1@example.com',
          name: 'Test User 1',
          image: 'https://ui-avatars.com/api/?name=Test+User+1',
          password: hashedPassword,
        },
      });
      console.log('Usuario Test User 1 creado:', newUser.id);
    } else {
      console.log('Usuario Test User 1 encontrado:', testUser1.id);
    }

    // Crear un nuevo grupo con todos confirmados y test user 1 como admin
    const groupName = 'Equipo de Prueba Completo';

    // Verificar si el grupo ya existe
    const existingGroup = await prisma.group.findFirst({
      where: { name: groupName },
    });

    if (existingGroup) {
      console.log('El grupo ya existe, no se creará uno nuevo');

      // Verificar si tiene un token de invitación, si no, agregar uno
      if (!existingGroup.inviteToken) {
        const inviteToken = crypto.randomBytes(8).toString('hex');
        await prisma.group.update({
          where: { id: existingGroup.id },
          data: { inviteToken },
        });
        console.log(
          'Token de invitación agregado al grupo existente:',
          inviteToken
        );
      } else {
        console.log(
          'El grupo ya tiene un token de invitación:',
          existingGroup.inviteToken
        );
      }

      return;
    }

    // Generar token de invitación para el nuevo grupo
    const inviteToken = crypto.randomBytes(8).toString('hex');
    console.log('Token de invitación generado:', inviteToken);

    // Crear el grupo con token de invitación
    const newGroup = await prisma.group.create({
      data: {
        name: groupName,
        description: 'Grupo de prueba con todos los miembros confirmados',
        sport: 'Fútbol',
        location: 'Campo de Pruebas',
        createdBy: testUser1?.id || '',
        inviteToken, // Agregar token de invitación
      },
    });

    console.log('Grupo creado:', newGroup.id);
    console.log('Token de invitación del grupo:', inviteToken);

    // Añadir al test user 1 como ADMIN
    await prisma.groupMember.create({
      data: {
        groupId: newGroup.id,
        userId: testUser1?.id || '',
        role: 'ADMIN',
        status: 'CONFIRMED', // Estado confirmado
      },
    });

    // Buscar otros 9 usuarios para el grupo
    const otherUsers = await prisma.user.findMany({
      where: {
        email: { not: 'test1@example.com' },
      },
      take: 9,
    });

    // Añadir los otros usuarios como miembros
    for (const user of otherUsers) {
      await prisma.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId: user.id,
          role: 'MEMBER',
          status: 'CONFIRMED', // Estado confirmado
        },
      });
    }

    console.log('Se han añadido', otherUsers.length + 1, 'miembros al grupo.');

    // Crear un partido para el grupo
    await prisma.match.create({
      data: {
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 días a futuro
        location: 'Campo Principal',
        groupId: newGroup.id,
        teamA: 'Equipo Rojo',
        teamB: 'Equipo Azul',
        scoreA: 0,
        scoreB: 0,
      },
    });

    console.log('Se ha creado un partido para el grupo.');

    // Actualizar todos los grupos existentes para agregar tokens de invitación
    const allGroups = await prisma.group.findMany({
      where: {
        inviteToken: null,
      },
    });

    console.log(
      `Encontrados ${allGroups.length} grupos sin token de invitación.`
    );

    for (const group of allGroups) {
      const token = crypto.randomBytes(8).toString('hex');
      await prisma.group.update({
        where: { id: group.id },
        data: { inviteToken: token },
      });
      console.log(
        `Token de invitación agregado al grupo ${group.name}: ${token}`
      );
    }

    console.log('¡Proceso completado exitosamente!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
