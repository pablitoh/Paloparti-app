const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Verificando limpieza del schema...\n');

    // Verificar tabla Match
    const matchColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Match' 
      ORDER BY ordinal_position;
    `;

    console.log('📋 Columnas en tabla Match:');
    matchColumns.forEach((col) => {
      console.log(
        `- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`
      );
    });

    const playerRolesColumn = matchColumns.find(
      (col) => col.column_name === 'playerRoles'
    );
    if (!playerRolesColumn) {
      console.log('\n✅ Campo playerRoles eliminado correctamente de Match!');
    } else {
      console.log('\n❌ Campo playerRoles todavía existe en Match');
    }

    // Verificar tabla MatchAttendance
    const attendanceColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'MatchAttendance' 
      ORDER BY ordinal_position;
    `;

    console.log('\n📋 Columnas en tabla MatchAttendance:');
    attendanceColumns.forEach((col) => {
      console.log(
        `- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`
      );
    });

    const attendancePlayerRoles = attendanceColumns.find(
      (col) => col.column_name === 'playerRoles'
    );
    if (attendancePlayerRoles) {
      console.log(
        '\n✅ Campo playerRoles existe correctamente en MatchAttendance!'
      );
    } else {
      console.log('\n❌ Campo playerRoles NO existe en MatchAttendance');
    }

    console.log('\n🎯 RESUMEN:');
    console.log(
      `- Match.playerRoles: ${playerRolesColumn ? '❌ Existe' : '✅ Eliminado'}`
    );
    console.log(
      `- MatchAttendance.playerRoles: ${
        attendancePlayerRoles ? '✅ Existe' : '❌ No existe'
      }`
    );
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
