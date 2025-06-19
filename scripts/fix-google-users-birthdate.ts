#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixGoogleUsersBirthdates() {
  console.log(
    '🔍 Buscando usuarios de Google con fechas de nacimiento incorrectas...'
  );

  try {
    // Buscar usuarios de Google (sin contraseña) con fecha de nacimiento en 1990-01-01
    const googleUsersWithWrongBirthdate = await prisma.user.findMany({
      where: {
        password: null, // Usuario de Google
        birthdate: new Date('1990-01-01'), // Fecha por defecto incorrecta
      },
      select: {
        id: true,
        name: true,
        email: true,
        birthdate: true,
      },
    });

    console.log(
      `📊 Encontrados ${googleUsersWithWrongBirthdate.length} usuarios de Google con fecha de nacimiento por defecto`
    );

    if (googleUsersWithWrongBirthdate.length === 0) {
      console.log('✅ No hay usuarios que necesiten corrección');
      return;
    }

    // Mostrar lista de usuarios que se van a actualizar
    console.log('\n📋 Usuarios que se actualizarán:');
    googleUsersWithWrongBirthdate.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.name} (${user.email}) - Fecha actual: ${
          user.birthdate?.toISOString().split('T')[0]
        }`
      );
    });

    // Actualizar fecha de nacimiento a null para forzar completar perfil
    const updateResult = await prisma.user.updateMany({
      where: {
        password: null,
        birthdate: new Date('1990-01-01'),
      },
      data: {
        birthdate: null,
      },
    });

    console.log(`\n✅ Actualizados ${updateResult.count} usuarios de Google`);
    console.log(
      '🎯 Ahora estos usuarios verán el banner para completar su perfil'
    );

    // Verificar resultados
    const updatedUsers = await prisma.user.findMany({
      where: {
        id: {
          in: googleUsersWithWrongBirthdate.map((u) => u.id),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        birthdate: true,
      },
    });

    console.log('\n📊 Estado después de la actualización:');
    updatedUsers.forEach((user, index) => {
      const status = user.birthdate === null ? '🔴 Pendiente' : '🟢 Completo';
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${status}`);
    });
  } catch (error) {
    console.error('❌ Error al actualizar usuarios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixGoogleUsersBirthdates()
    .then(() => {
      console.log('\n🚀 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}
