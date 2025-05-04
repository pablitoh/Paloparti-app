#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  console.log('📊 Verificando conexión a la base de datos...');

  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos verificada correctamente.');
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    console.log(
      '⚠️ Verifica la configuración en .env y asegúrate que los datos de conexión sean correctos.'
    );
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkDatabase()
    .then((success) => {
      if (!success) {
        console.log(
          '⚠️ Verifica la configuración en .env y asegúrate que los datos de conexión sean correctos.'
        );
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Error inesperado:', error);
      process.exit(1);
    });
}

module.exports = { checkDatabase };
