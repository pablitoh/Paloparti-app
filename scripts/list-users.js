const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
    });

    console.log('👥 Usuarios en la base de datos:');
    console.log('================================');

    if (users.length === 0) {
      console.log('No hay usuarios en la base de datos');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'Sin nombre'}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(
          `   🎂 Fecha de nacimiento: ${
            user.birthdate
              ? user.birthdate.toISOString().split('T')[0]
              : 'No definida'
          }`
        );
        console.log(`   🖼️  Imagen: ${user.image ? 'Sí' : 'No'}`);
      });
    }

    console.log(`\n📊 Total: ${users.length} usuarios`);
  } catch (error) {
    console.error('❌ Error al listar usuarios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
