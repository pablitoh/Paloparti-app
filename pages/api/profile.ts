import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/auth';
import { calculateAge } from '../../lib/utils';
import { isGoogleUser } from '../../lib/userProfileUtils';

interface UserWithBirthdate {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  birthdate: Date | null;
  emailVerified?: Date | null;
  password?: string | null;
}

interface GoalWithMatch {
  match: {
    group: {
      name: string;
    };
  };
}

interface MatchPlayerWithMatch {
  isTeamA: boolean;
  match: {
    id: string;
    date: Date;
    location: string;
    scoreA: number;
    scoreB: number;
    status: string;
    group: {
      id: string;
      name: string;
      sport: string | null;
    };
  };
}

interface GroupMemberWithGroup {
  role: string;
  group: {
    id: string;
    name: string;
    sport: string | null;
    location: string | null;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Enhanced logging for preview environment
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('Profile API called in preview:', {
        cookie: req.headers.cookie ? 'Present' : 'Missing',
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        sessionCookie: req.headers.cookie?.includes('next-auth.session-token')
          ? 'Present'
          : 'Missing',
        userAgent: req.headers['user-agent']?.substring(0, 50),
        host: req.headers.host,
      });
    }

    // Get the current user from the NextAuth session
    const user = await getCurrentUser(req, res);

    if (!user) {
      console.log('No authenticated user found in profile API');
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('Preview environment - detailed auth failure debug');
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('Processing profile request for user:', user.id);
    if (process.env.VERCEL_ENV === 'preview') {
      console.log(
        'Preview environment - user authenticated successfully:',
        user.email
      );
    }

    // Get user data including birthdate
    const userData = (await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    })) as UserWithBirthdate | null;

    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate age from birthdate
    const age = calculateAge(userData.birthdate);

    // Enhanced logging for preview environment
    if (process.env.VERCEL_ENV === 'preview' && userData.birthdate) {
      console.log('Preview environment - reading birthdate from DB:', {
        rawBirthdate: userData.birthdate,
        birthdateISO: userData.birthdate.toISOString(),
        birthdateUTC: userData.birthdate.toUTCString(),
        calculatedAge: age,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // Obtener grupos del usuario
    const userGroups = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            sport: true,
            location: true,
          },
        },
      },
    });

    // Obtener partidos del usuario
    const userMatches = await prisma.matchPlayer.findMany({
      where: {
        userId: user.id,
      },
      include: {
        match: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                sport: true,
              },
            },
          },
        },
      },
    });

    // Obtener goles del usuario
    const userGoals = await prisma.goal.findMany({
      where: {
        userId: user.id,
      },
      include: {
        match: {
          include: {
            group: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Calcular goles por grupo
    const goalsPerGroup = userGoals.reduce(
      (acc: Record<string, number>, goal: GoalWithMatch) => {
        const groupName = goal.match.group.name;
        if (!acc[groupName]) {
          acc[groupName] = 0;
        }
        acc[groupName]++;
        return acc;
      },
      {}
    );

    // Formatear la respuesta
    const response = {
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        image: userData.image,
        birthdate: userData.birthdate,
        age: age,
        isGoogleUser: userData.password === null,
      },
      groups: userGroups.map((member: GroupMemberWithGroup) => ({
        id: member.group.id,
        name: member.group.name,
        sport: member.group.sport || 'No especificado',
        location: member.group.location || 'No especificada',
        role: member.role,
      })),
      matches: userMatches.map((player: MatchPlayerWithMatch) => ({
        id: player.match.id,
        date: player.match.date.toString(),
        location: player.match.location,
        group: {
          id: player.match.group.id,
          name: player.match.group.name,
          sport: player.match.group.sport || 'No especificado',
        },
        team: player.isTeamA ? 'A' : 'B',
        scoreA: player.match.scoreA,
        scoreB: player.match.scoreB,
        status: player.match.status,
      })),
      goalsPerGroup: Object.entries(goalsPerGroup).map(
        ([groupName, count]) => ({
          groupName,
          count,
        })
      ),
      totalGoals: userGoals.length,
      totalMatches: userMatches.length,
      totalGroups: userGroups.length,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in profile API:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
