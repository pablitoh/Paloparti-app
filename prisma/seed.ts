import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const sports = [
  'Fútbol',
  'Tenis',
  'Baloncesto',
  'Pádel',
  'Voleibol',
  'Natación',
];
const locations = [
  'Parque Central',
  'Club Deportivo',
  'Polideportivo Municipal',
  'Centro Deportivo',
  'Club Privado',
  'Parque Deportivo',
];

// Argentine players with birthdates
const argentinePlayers = [
  { name: 'Lionel Messi', birthdate: new Date('1987-06-24') },
  { name: 'Diego Maradona', birthdate: new Date('1960-10-30') },
  { name: 'Gabriel Batistuta', birthdate: new Date('1969-02-01') },
  { name: 'Sergio Agüero', birthdate: new Date('1988-06-02') },
  { name: 'Javier Zanetti', birthdate: new Date('1973-08-10') },
  { name: 'Juan Román Riquelme', birthdate: new Date('1978-06-24') },
  { name: 'Hernán Crespo', birthdate: new Date('1975-07-05') },
  { name: 'Ángel Di María', birthdate: new Date('1988-02-14') },
  { name: 'Mario Kempes', birthdate: new Date('1954-07-15') },
  { name: 'Jorge Valdano', birthdate: new Date('1955-10-04') },
  { name: 'Oscar Ruggeri', birthdate: new Date('1962-01-26') },
  { name: 'Pablo Aimar', birthdate: new Date('1979-11-03') },
  { name: 'Claudio Caniggia', birthdate: new Date('1967-01-22') },
  { name: 'Javier Mascherano', birthdate: new Date('1984-06-08') },
  { name: 'Diego Simeone', birthdate: new Date('1970-04-28') },
  { name: 'Gonzalo Higuaín', birthdate: new Date('1987-12-10') },
  { name: 'Daniel Passarella', birthdate: new Date('1953-05-25') },
  { name: 'Ariel Ortega', birthdate: new Date('1974-03-04') },
  { name: 'Juan Sebastián Verón', birthdate: new Date('1975-03-09') },
  { name: 'Ubaldo Fillol', birthdate: new Date('1950-07-21') },
  { name: 'Emiliano Martínez', birthdate: new Date('1992-09-02') },
  { name: 'Nicolás Otamendi', birthdate: new Date('1988-02-12') },
  { name: 'Paulo Dybala', birthdate: new Date('1993-11-15') },
  { name: 'Lautaro Martínez', birthdate: new Date('1997-08-22') },
  { name: 'Rodrigo De Paul', birthdate: new Date('1994-05-24') },
  { name: 'Julián Álvarez', birthdate: new Date('2000-01-31') },
  { name: 'Enzo Fernández', birthdate: new Date('2001-01-17') },
  { name: 'Alexis Mac Allister', birthdate: new Date('1998-12-24') },
  { name: 'Leandro Paredes', birthdate: new Date('1994-06-29') },
  { name: 'Cristian Romero', birthdate: new Date('1998-04-27') },
  // Add more Argentine players for a total of at least 40 to ensure we have enough for Fútbol Club
  { name: 'Roberto Ayala', birthdate: new Date('1973-04-14') },
  { name: 'Juan Pablo Sorín', birthdate: new Date('1976-05-05') },
  { name: 'Sergio Goycochea', birthdate: new Date('1963-10-17') },
  { name: 'Lisandro Martínez', birthdate: new Date('1998-01-18') },
  { name: 'Alejandro Garnacho', birthdate: new Date('2004-07-01') },
  { name: 'Nicolás Tagliafico', birthdate: new Date('1992-08-31') },
  { name: 'Valentín Carboni', birthdate: new Date('2005-03-05') },
  { name: 'Maxi Rodríguez', birthdate: new Date('1981-01-02') },
  { name: 'Ezequiel Lavezzi', birthdate: new Date('1985-05-03') },
  { name: 'Mateo Messi', birthdate: new Date('2015-09-11') }, // For fun
];

// Función para generar un resultado realista de goles (para deportes como fútbol)
const getRandomScore = () => Math.floor(Math.random() * 5); // 0-4 goles por equipo

function getRequiredPlayersForSport(sport: string): number {
  switch (sport) {
    case 'Fútbol':
      return 10; // 5v5
    case 'Baloncesto':
      return 6; // 3v3
    case 'Pádel':
      return 4; // 2v2
    case 'Tenis':
      return 2; // 1v1
    case 'Voleibol':
      return 6; // 3v3
    case 'Natación':
      return 4; // 2v2
    default:
      return 4; // Default value
  }
}

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
    console.error('Error during cleanup:', error);
  }

  // Create users with Argentine players' names but using test email format
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Messi as Test User 1 first (so we can reference it specifically)
  const messiPlayer = argentinePlayers[0]; // Lionel Messi
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

  // Create the rest of the players with test emails
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
    `Creados ${users.length} usuarios con nombres de jugadores argentinos y emails test#@example.com`
  );

  // Create groups for each sport
  const groups = [];
  for (let i = 0; i < sports.length; i++) {
    const sport = sports[i];
    const location = locations[i % locations.length];

    // Generate an invite token for each group
    const inviteToken = crypto.randomBytes(8).toString('hex');

    // Special handling for Fútbol Club - Messi always admin, many more members
    const isFutbolClub = sport === 'Fútbol';
    // For Fútbol club, always make Messi the creator
    const isMessiCreator = isFutbolClub ? true : i % 2 === 0;
    const creator = isMessiCreator
      ? testUser1
      : users[(i % (users.length - 1)) + 1];

    // Select users for this group (excluding the creator)
    const availableUsers = users.filter((u) => u.id !== creator.id);
    const selectedUsers = [];

    // Special handling for Fútbol Club - 30 users including Messi
    if (isFutbolClub) {
      // For Fútbol club, add as many members as possible (up to 29 more besides Messi)
      const usersToSelect = Math.min(29, availableUsers.length);
      for (let j = 0; j < usersToSelect; j++) {
        selectedUsers.push(availableUsers[j]);
      }
    } else {
      // For other clubs, standard logic
      // If Messi is not the creator, make sure to include him as a member
      if (!isMessiCreator) {
        selectedUsers.push(testUser1);

        // Get other random users
        const remainingUsers = availableUsers.filter(
          (u) => u.id !== testUser1.id
        );
        const usersToSelect = Math.min(4, remainingUsers.length); // Select 4 more (for total of 5)

        for (let j = 0; j < usersToSelect; j++) {
          const randomIndex = Math.floor(Math.random() * remainingUsers.length);
          selectedUsers.push(...remainingUsers.splice(randomIndex, 1));
        }
      } else {
        // Just select random users if Messi is already the creator
        const usersToSelect = Math.min(5, availableUsers.length);

        for (let j = 0; j < usersToSelect; j++) {
          const randomIndex = Math.floor(Math.random() * availableUsers.length);
          selectedUsers.push(...availableUsers.splice(randomIndex, 1));
        }
      }
    }

    try {
      // Create the group first
      const groupId = crypto.randomBytes(16).toString('hex');
      const nextMatchDate = new Date();
      nextMatchDate.setDate(nextMatchDate.getDate() + 7);

      // Create the group without the nextMatchId initially
      const group = await prisma.$queryRaw`
        INSERT INTO "Group" (
          "id", "name", "description", "sport", "location", "createdAt", 
          "createdBy", "requiredPlayers", "inviteToken", "totalMatches", "nextMatch"
        ) 
        VALUES (
          ${groupId}, 
          ${`${sport} Club`}, 
          ${`Grupo de ${sport.toLowerCase()} para todos los niveles`}, 
          ${sport}, 
          ${location}, 
          ${new Date()}, 
          ${creator.id}, 
          ${getRequiredPlayersForSport(sport)}, 
          ${inviteToken},
          0,
          ${nextMatchDate}
        )
        RETURNING *
      `;

      // Cast the result to any type to access properties
      const groupResult = group as any;
      const resultGroupId = groupResult[0].id;

      // Create group memberships
      await prisma.groupMember.create({
        data: {
          groupId: resultGroupId,
          userId: creator.id,
          role: 'ADMIN',
          status: 'CONFIRMED',
        },
      });

      for (const user of selectedUsers) {
        await prisma.groupMember.create({
          data: {
            groupId: resultGroupId,
            userId: user.id,
            role: 'MEMBER',
            status: 'CONFIRMED',
          },
        });
      }

      // Now create the next match after the group exists
      const nextMatch = await prisma.match.create({
        data: {
          id: crypto.randomBytes(16).toString('hex'),
          date: nextMatchDate,
          location: location,
          groupId: resultGroupId, // Now we can safely reference the group
          teamA: 'Equipo A',
          teamB: 'Equipo B',
          scoreA: 0,
          scoreB: 0,
          status: 'PENDING',
        },
      });

      console.log(
        `Created next match for group "${sport} Club": ${nextMatch.id}`
      );

      // Update the group to reference the next match
      await prisma.group.update({
        where: { id: resultGroupId },
        data: { nextMatchId: nextMatch.id },
      });

      // Create attendance records for all members (with the creator confirmed)
      await prisma.matchAttendance.create({
        data: {
          userId: creator.id,
          groupId: resultGroupId,
          matchId: nextMatch.id,
          matchDate: nextMatchDate,
          status: 'PENDING', // Creator con status PENDING para que no haya confirmados
        },
      });

      // Create other members with pending status
      for (const user of selectedUsers) {
        await prisma.matchAttendance.create({
          data: {
            userId: user.id,
            groupId: resultGroupId,
            matchId: nextMatch.id,
            matchDate: nextMatchDate,
            status: 'PENDING',
          },
        });
      }

      // Create short URL for the group's invite link
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/invite/${inviteToken}`;
      const shortCode = crypto.randomBytes(4).toString('hex');

      await prisma.$queryRaw`
        INSERT INTO "ShortUrl" ("id", "shortCode", "originalUrl", "createdAt", "accessCount") 
        VALUES (${crypto
          .randomBytes(16)
          .toString('hex')}, ${shortCode}, ${inviteUrl}, ${new Date()}, 0)
      `;

      const memberCount = selectedUsers.length + 1; // +1 for creator

      console.log(
        `Created group "${sport} Club" with ${memberCount} members and invite token: ${inviteToken}`
      );
      console.log(
        `Created short URL for "${sport} Club": ${baseUrl}/s/${shortCode}`
      );

      groups.push({ id: resultGroupId, location: location });
    } catch (error) {
      console.error(`Error creating ${sport} group:`, error);
    }
  }

  // Resto del código para crear partidos
  console.log(`Creados ${groups.length} grupos`);

  // Create matches for each group
  for (const group of groups) {
    try {
      const members = await prisma.groupMember.findMany({
        where: { groupId: group.id },
        include: { user: true },
      });

      if (members.length >= 4) {
        // Crear varios partidos completados (pasados) con resultados
        const numberOfCompletedMatches = Math.floor(Math.random() * 5) + 2; // 2-6 partidos completados

        for (let i = 0; i < numberOfCompletedMatches; i++) {
          const daysAgo = (i + 1) * 7; // Partidos cada 7 días en el pasado
          const scoreA = getRandomScore();
          const scoreB = getRandomScore();

          // Seleccionar jugadores aleatoriamente para cada equipo
          const allGroupMembers = [...members]; // Copia de todos los miembros disponibles
          const shuffledMembers = allGroupMembers.sort(
            () => Math.random() - 0.5
          );

          // Dividir los miembros en dos equipos
          const halfIndex = Math.ceil(shuffledMembers.length / 2);
          const teamAMembers = shuffledMembers.slice(0, halfIndex);
          const teamBMembers = shuffledMembers.slice(halfIndex);

          // Crear el partido
          const match = await prisma.match.create({
            data: {
              date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
              location: group.location,
              groupId: group.id,
              teamA: 'Equipo A',
              teamB: 'Equipo B',
              scoreA,
              scoreB,
              status: 'COMPLETED',
            },
          });

          // Registrar los jugadores de cada equipo
          for (const member of teamAMembers) {
            await prisma.matchPlayer.create({
              data: {
                matchId: match.id,
                userId: member.userId,
                isTeamA: true,
              },
            });
          }

          for (const member of teamBMembers) {
            await prisma.matchPlayer.create({
              data: {
                matchId: match.id,
                userId: member.userId,
                isTeamA: false,
              },
            });
          }

          // Registrar goles aleatoriamente
          for (let j = 0; j < scoreA; j++) {
            const randomScorerIndex = Math.floor(
              Math.random() * teamAMembers.length
            );
            const scorer = teamAMembers[randomScorerIndex];

            await prisma.goal.create({
              data: {
                matchId: match.id,
                userId: scorer.userId,
                isTeamA: true,
                minute: Math.floor(Math.random() * 90) + 1, // Minuto aleatorio entre 1-90
              },
            });
          }

          for (let j = 0; j < scoreB; j++) {
            const randomScorerIndex = Math.floor(
              Math.random() * teamBMembers.length
            );
            const scorer = teamBMembers[randomScorerIndex];

            await prisma.goal.create({
              data: {
                matchId: match.id,
                userId: scorer.userId,
                isTeamA: false,
                minute: Math.floor(Math.random() * 90) + 1,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error creating matches for group ${group.id}:`, error);
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
