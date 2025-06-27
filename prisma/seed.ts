import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Roles constantes para mantener consistencia
const ROLES = {
  GOALKEEPER: 'GOALKEEPER',
  DEFENDER: 'DEFENDER',
  MIDFIELDER: 'MIDFIELDER',
  FORWARD: 'FORWARD',
} as const;

const futbolGroups = [
  {
    name: 'Fútbol 11 - La Scaloneta',
    description: 'Fútbol 11 competitivo. Se juega los sábados por la mañana.',
    sport: 'Fútbol 11',
    location: 'Complejo Deportivo Norte',
    requiredPlayers: 22,
  },
  {
    name: 'Fútbol 7 - Los Pibes',
    description: 'Fútbol 7 recreativo. Partidos entre semana por la noche.',
    sport: 'Fútbol 7',
    location: 'Club Atlético Sur',
    requiredPlayers: 14,
  },
  {
    name: 'Fútbol 5 - Los Cracks',
    description: 'Fútbol 5 indoor. Partidos todos los martes y jueves.',
    sport: 'Fútbol 5',
    location: 'Complejo Indoor Central',
    requiredPlayers: 10,
  },
  {
    name: 'Fútbol Mixto - Unidos FC',
    description: 'Fútbol mixto recreativo. Todos son bienvenidos!',
    sport: 'Fútbol Mixto',
    location: 'Polideportivo Municipal',
    requiredPlayers: 14,
  },
];

// Argentine players with birthdates and roles (primary and secondary)
const argentinePlayers = [
  {
    name: 'Lionel Messi',
    birthdate: new Date('1987-06-24'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Emiliano Martínez',
    birthdate: new Date('1992-09-02'),
    roles: [
      { role: ROLES.GOALKEEPER, priority: 1 },
      { role: ROLES.GOALKEEPER, priority: 2 }, // Dibu es solo arquero
    ],
  },
  {
    name: 'Nicolás Otamendi',
    birthdate: new Date('1988-02-12'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Cristian Romero',
    birthdate: new Date('1998-04-27'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 }, // Cuti es solo defensor
    ],
  },
  {
    name: 'Marcos Acuña',
    birthdate: new Date('1991-10-28'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Nahuel Molina',
    birthdate: new Date('1998-04-06'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Rodrigo De Paul',
    birthdate: new Date('1994-05-24'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Enzo Fernández',
    birthdate: new Date('2001-01-17'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 },
    ],
  },
  {
    name: 'Alexis Mac Allister',
    birthdate: new Date('1998-12-24'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Julián Álvarez',
    birthdate: new Date('2000-01-31'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Lautaro Martínez',
    birthdate: new Date('1997-08-22'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 }, // Lautaro es solo delantero
    ],
  },
  {
    name: 'Ángel Di María',
    birthdate: new Date('1988-02-14'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  // Suplentes con roles específicos
  {
    name: 'Franco Armani',
    birthdate: new Date('1986-10-16'),
    roles: [
      { role: ROLES.GOALKEEPER, priority: 1 },
      { role: ROLES.GOALKEEPER, priority: 2 },
    ],
  },
  {
    name: 'Gerónimo Rulli',
    birthdate: new Date('1992-05-20'),
    roles: [
      { role: ROLES.GOALKEEPER, priority: 1 },
      { role: ROLES.GOALKEEPER, priority: 2 },
    ],
  },
  {
    name: 'Lisandro Martínez',
    birthdate: new Date('1998-01-18'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Juan Foyth',
    birthdate: new Date('1998-01-12'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Germán Pezzella',
    birthdate: new Date('1991-06-27'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 },
    ],
  },
  {
    name: 'Leandro Paredes',
    birthdate: new Date('1994-06-29'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 },
    ],
  },
  {
    name: 'Guido Rodríguez',
    birthdate: new Date('1994-04-12'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 },
    ],
  },
  {
    name: 'Alejandro Gómez',
    birthdate: new Date('1988-02-15'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Paulo Dybala',
    birthdate: new Date('1993-11-15'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Nicolás González',
    birthdate: new Date('1998-04-06'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  // Jugadores adicionales para otros grupos
  {
    name: 'Giovani Lo Celso',
    birthdate: new Date('1996-04-09'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Lucas Ocampos',
    birthdate: new Date('1994-07-11'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Exequiel Palacios',
    birthdate: new Date('1998-10-05'),
    roles: [
      { role: ROLES.MIDFIELDER, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Nicolás Tagliafico',
    birthdate: new Date('1992-08-31'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
  {
    name: 'Marcos Senesi',
    birthdate: new Date('1997-05-10'),
    roles: [
      { role: ROLES.DEFENDER, priority: 1 },
      { role: ROLES.DEFENDER, priority: 2 },
    ],
  },
  {
    name: 'Lucas Alario',
    birthdate: new Date('1992-10-08'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Giovanni Simeone',
    birthdate: new Date('1995-07-05'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.FORWARD, priority: 2 },
    ],
  },
  {
    name: 'Alejandro Garnacho',
    birthdate: new Date('2004-07-01'),
    roles: [
      { role: ROLES.FORWARD, priority: 1 },
      { role: ROLES.MIDFIELDER, priority: 2 },
    ],
  },
];

async function main() {
  // First, clean up the database
  try {
    await prisma.goal.deleteMany();
    await prisma.matchPlayer.deleteMany();
    await prisma.$queryRaw`TRUNCATE TABLE "MatchAttendance" CASCADE;`;
    await prisma.match.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.$queryRaw`TRUNCATE TABLE "GroupInvitation" CASCADE;`;
    await prisma.group.deleteMany();
    await prisma.account.deleteMany();
    await prisma.session.deleteMany();
    await prisma.$queryRaw`TRUNCATE TABLE "ShortUrl" CASCADE;`;
    await prisma.user.deleteMany();
  } catch (error) {
    console.error('Error durante la limpieza:', error);
  }

  // Create users with Argentine players' names
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Messi as Test User 1 first (admin)
  const messiPlayer = argentinePlayers[0];
  const testUser1 = await prisma.user.create({
    data: {
      email: 'test1@example.com',
      name: messiPlayer.name,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        messiPlayer.name
      )}`,
      password: hashedPassword,
      birthdate: messiPlayer.birthdate,
    },
  });
  users.push(testUser1);

  // Create the rest of the players
  for (let i = 1; i < argentinePlayers.length; i++) {
    const player = argentinePlayers[i];
    const emailIndex = i + 1;

    const user = await prisma.user.create({
      data: {
        email: `test${emailIndex}@example.com`,
        name: player.name,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          player.name
        )}`,
        password: hashedPassword,
        birthdate: player.birthdate,
      },
    });
    users.push(user);
  }

  console.log(
    `Creados ${users.length} usuarios con nombres de jugadores argentinos`
  );

  // Create football groups
  const groups = [];
  for (const groupInfo of futbolGroups) {
    const inviteToken = crypto.randomBytes(8).toString('hex');

    const group = await prisma.group.create({
      data: {
        name: groupInfo.name,
        description: groupInfo.description,
        sport: groupInfo.sport,
        location: groupInfo.location,
        inviteToken,
        requiredPlayers: groupInfo.requiredPlayers,
        createdBy: testUser1.id, // Messi creates all groups
      },
    });
    groups.push(group);

    // Add members to the group with their roles
    const membersToAdd =
      groupInfo.sport === 'Fútbol 11'
        ? 22
        : groupInfo.sport === 'Fútbol 7'
        ? 14
        : groupInfo.sport === 'Fútbol 5'
        ? 10
        : 14;

    // Always add Messi first as admin
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: testUser1.id,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    // Add other players with their specific roles
    for (let i = 1; i < Math.min(membersToAdd, users.length); i++) {
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: users[i].id,
          role: argentinePlayers[i].roles[0].role, // Usamos el rol primario para el grupo
          status: 'ACTIVE',
        },
      });
    }

    // Create a match for each group
    const matchDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const match = await prisma.match.create({
      data: {
        groupId: group.id,
        date: matchDate,
        location: groupInfo.location,
        status: 'PENDING',
        teamA: 'Equipo A',
        teamB: 'Equipo B',
      },
    });

    // Update group with nextMatchId
    await prisma.group.update({
      where: { id: group.id },
      data: {
        nextMatchId: match.id,
        nextMatch: matchDate,
      },
    });

    // Add attendance records for all members (PENDING)
    for (let i = 0; i < Math.min(membersToAdd, users.length); i++) {
      await prisma.matchAttendance.create({
        data: {
          matchId: match.id,
          userId: users[i].id,
          groupId: group.id,
          matchDate: matchDate,
          status: 'PENDING',
          playerRoles: { roles: argentinePlayers[i].roles },
        },
      });
    }
  }

  console.log(
    `Creados ${groups.length} grupos de fútbol con sus miembros, roles y partidos programados`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
