const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteUser() {
  // Cambia esto por el email o ID del usuario que quieres eliminar
  const userToDelete = process.argv[2]; // Email o ID del usuario

  if (!userToDelete) {
    console.log(
      '❌ Por favor proporciona el email o ID del usuario a eliminar'
    );
    console.log('Uso: node scripts/delete-user.js [email_o_id]');
    process.exit(1);
  }

  try {
    // Primero buscar el usuario
    let user;
    if (userToDelete.includes('@')) {
      // Es un email
      user = await prisma.user.findUnique({
        where: { email: userToDelete },
      });
    } else {
      // Es un ID
      user = await prisma.user.findUnique({
        where: { id: userToDelete },
      });
    }

    if (!user) {
      console.log('❌ Usuario no encontrado:', userToDelete);
      process.exit(1);
    }

    console.log('👤 Usuario encontrado:');
    console.log('- ID:', user.id);
    console.log('- Nombre:', user.name);
    console.log('- Email:', user.email);
    console.log('- Fecha de nacimiento:', user.birthdate);

    // Confirmar eliminación
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      '¿Estás seguro de que quieres eliminar este usuario? (sí/no): ',
      async (answer) => {
        if (
          answer.toLowerCase() === 'sí' ||
          answer.toLowerCase() === 'si' ||
          answer.toLowerCase() === 'yes'
        ) {
          // Eliminar registros relacionados primero
          console.log('🗑️ Eliminando registros relacionados...');

          // Eliminar miembros de grupos
          await prisma.groupMember.deleteMany({
            where: { userId: user.id },
          });

          // Eliminar jugadores de partidos
          await prisma.matchPlayer.deleteMany({
            where: { userId: user.id },
          });

          // Eliminar goles
          await prisma.goal.deleteMany({
            where: { userId: user.id },
          });

          // Eliminar el usuario
          await prisma.user.delete({
            where: { id: user.id },
          });

          console.log('✅ Usuario eliminado exitosamente');
        } else {
          console.log('❌ Eliminación cancelada');
        }

        rl.close();
        await prisma.$disconnect();
      }
    );
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteUser();
