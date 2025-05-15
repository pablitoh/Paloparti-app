import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Obtener todos los miembros de grupos
  const groupMembers = await prisma.groupMember.findMany();

  console.log(`Encontrados ${groupMembers.length} miembros para actualizar`);

  // Actualizar cada miembro con un star rating aleatorio
  for (const member of groupMembers) {
    try {
      // Asignar un valor aleatorio entre 1 y 5
      const starRating = Math.floor(Math.random() * 5) + 1;

      // Actualizar el miembro
      await prisma.groupMember.update({
        where: { id: member.id },
        data: { starRating },
      });

      console.log(`Actualizado miembro ${member.id} con rating ${starRating}`);
    } catch (error) {
      console.error(`Error al actualizar miembro ${member.id}:`, error);
    }
  }

  console.log('Star ratings actualizados exitosamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
