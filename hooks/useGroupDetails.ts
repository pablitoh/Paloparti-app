import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useGroupDetailsQuery } from '../services/reactQueryHooks';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Types
interface MatchInterface {
  id: string;
  date: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Player[];
  playersB?: Player[];
  confirmedPlayers?: Player[];
  tbdPlayers?: Player[];
  goals?: Array<{
    id: string;
    isTeamA: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  groupId?: string;
  goalsA?: Array<{
    id: string;
    isTeamA: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
  goalsB?: Array<{
    id: string;
    isTeamA?: boolean;
    isTeamB?: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
}

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
  isTeamA?: boolean;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  teamAName: string;
  teamBName: string;
  recurrenceType: string | null;
  recurrenceDays: number[];
  recurrenceTime: string | null;
  requiredPlayers: number;
  inviteToken: string | null;
  members: Member[];
  matches: MatchInterface[];
  createdAt: Date;
  createdBy: string;
  nextMatch: Date | null;
  nextMatchId: string | null;
  nextMatchDetails: MatchInterface | null;
  totalMatches: number;
  userStatus?: string;
  creator?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function useGroupDetails(groupId: string | string[] | undefined) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user;
  const queryClient = useQueryClient();

  // Usar el hook de React Query para obtener datos del grupo
  const {
    data: group,
    isLoading,
    error,
    refetch,
  } = useGroupDetailsQuery(groupId);

  // Refetch mejorado con invalidación de caché
  const refetchGroupData = useCallback(async () => {
    // Obtener el ID del grupo en formato apropiado
    const id =
      typeof groupId === 'string'
        ? groupId
        : Array.isArray(groupId)
        ? groupId[0]
        : undefined;

    if (id) {
      // Invalidar la consulta actual
      queryClient.invalidateQueries({ queryKey: ['group', id] });

      // Realizar un refetch inmediato
      return await refetch();
    }
  }, [groupId, queryClient, refetch]);

  // Parse tbdPlayers to ensure proper format
  const parseTbdPlayers = (match: any): MatchInterface => {
    if (!match) return match;

    let parsedTbdPlayers: any[] = [];

    // Try to parse tbdPlayers if it exists
    if (match.tbdPlayers) {
      try {
        // If it's a string, try to parse as JSON
        if (typeof match.tbdPlayers === 'string') {
          parsedTbdPlayers = JSON.parse(match.tbdPlayers);
        }
        // If it's an object with teamA/teamB, extract and flatten the players
        else if (
          typeof match.tbdPlayers === 'object' &&
          (match.tbdPlayers.teamA || match.tbdPlayers.teamB)
        ) {
          const teamA = Array.isArray(match.tbdPlayers.teamA)
            ? match.tbdPlayers.teamA
            : [];
          const teamB = Array.isArray(match.tbdPlayers.teamB)
            ? match.tbdPlayers.teamB
            : [];

          // Mark players with their team and return as a flat array
          parsedTbdPlayers = [
            ...teamA.map((p: any) => ({
              ...p,
              isTeamA: true,
              playerType: 'TBD',
            })),
            ...teamB.map((p: any) => ({
              ...p,
              isTeamA: false,
              playerType: 'TBD',
            })),
          ];
        }
        // If it's already an array, use it directly
        else if (Array.isArray(match.tbdPlayers)) {
          parsedTbdPlayers = match.tbdPlayers;
        }

        // Ensure each player has the necessary properties
        parsedTbdPlayers = parsedTbdPlayers.map((player: any) => ({
          id:
            player.id ||
            `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: player.name || `TBD Player`,
          avatar: player.avatar || null,
          age: player.age || null,
          playerType: 'TBD',
          isTeamA: typeof player.isTeamA === 'boolean' ? player.isTeamA : true,
        }));
      } catch (error) {
        console.error('Error parsing tbdPlayers:', error);
        parsedTbdPlayers = [];
      }
    }

    // Return a copy of the match with tbdPlayers in the original database format
    // Keep the original format to maintain consistency with backend expectations
    return {
      ...match,
      tbdPlayers: match.tbdPlayers, // Keep original format from database
    } as MatchInterface;
  };

  // Redirect if not authenticated
  if (status === 'unauthenticated' && !isLoading) {
    router.push('/login?redirect=' + encodeURIComponent(`/group/${groupId}`));
  }

  // Devolver los datos y funciones necesarias
  return {
    group,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: refetchGroupData,
    parseTbdPlayers,
  };
}

export default useGroupDetails;
