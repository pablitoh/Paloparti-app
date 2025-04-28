import { useRouter } from 'next/router';
import Link from 'next/link';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Button from '../../components/Button';
import ParticipantCard from '../../components/ParticipantCard';
import Layout from '../../components/Layout';
import { RecurrenceType } from '../../types/match';
import { useSession } from 'next-auth/react';
import {
  CalendarIcon,
  MapPinIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
  PlusIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import { prisma } from '../../lib/prisma';
import type { PrismaClient } from '@prisma/client';
import { Box, Typography, Chip, Avatar } from '@mui/material';
import { toast } from 'react-hot-toast';
import { getSession } from 'next-auth/react';

type GroupWithRelations = NonNullable<
  Awaited<ReturnType<PrismaClient['group']['findUnique']>>
> & {
  matches: NonNullable<Awaited<ReturnType<PrismaClient['match']['findMany']>>>;
  members: Array<
    NonNullable<
      Awaited<ReturnType<PrismaClient['groupMember']['findUnique']>>
    > & {
      user: NonNullable<
        Awaited<ReturnType<PrismaClient['user']['findUnique']>>
      >;
    }
  >;
  creator: NonNullable<Awaited<ReturnType<PrismaClient['user']['findUnique']>>>;
  nextMatchRef?: NonNullable<
    Awaited<ReturnType<PrismaClient['match']['findUnique']>>
  >;
  nextMatchId?: string;
  nextMatchDetails?: MatchInterface;
  message?: string; // Mensaje sobre el estado de la membresía
  userStatus?: string; // Estado del usuario en el grupo
};

interface MatchInterface {
  id: string;
  date: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Array<{ id: string; name: string | null; avatar: string | null }>;
  playersB?: Array<{ id: string; name: string | null; avatar: string | null }>;
  confirmedPlayers?: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    age?: number | null;
  }>;
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

interface GroupInterface {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  members: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    role: string;
  }>;
  matches: Array<MatchInterface>;
  createdAt: string;
  createdBy: string;
  nextMatch: string | null;
  nextMatchId: string | null;
  nextMatchDetails: MatchInterface | null;
  totalMatches: number;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  status: ParticipantStatus;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    age?: number | null;
  };
  name?: string;
  email?: string;
  avatar?: string;
}

interface ExtendedMember extends Member {
  isCaptain: boolean;
  votedForResort: boolean;
}

interface Participant extends ExtendedMember {
  isCaptain: boolean;
  votedForResort: boolean;
}

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
}

const mockUser = {
  id: '1',
  name: 'Juan Pérez',
  isCaptain: true,
  isReferee: false,
};

type ParticipantStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'DECLINED'
  | 'confirmed'
  | 'pending'
  | 'declined';

export default function GroupDetails() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;
  const loading = status === 'loading';

  const [group, setGroup] = useState<GroupWithRelations | null>(null);
  const [showTeams, setShowTeams] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(true);
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);
  const [isTeamsCollapsed, setIsTeamsCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [participants, setParticipants] = useState<ExtendedMember[]>([]);
  const [userAttendanceStatus, setUserAttendanceStatus] =
    useState<ParticipantStatus | null>(null);
  const [hasResorted, setHasResorted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = router.query;
  const [balanceByAge, setBalanceByAge] = useState(false);
  const [playerGoalsMap, setPlayerGoalsMap] = useState<Record<string, number>>(
    {}
  );
  const [pendingMatch, setPendingMatch] = useState<MatchInterface | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchInterface | null>(null);
  const [sortTeamsLoading, setSortTeamsLoading] = useState(false);
  const [sortTeamsError, setSortTeamsError] = useState<string | null>(null);
  const [sortLocation, setSortLocation] = useState('');
  const [sortDate, setSortDate] = useState('');
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [teamA, setTeamA] = useState<Participant[]>([]);
  const [teamB, setTeamB] = useState<Participant[]>([]);
  const [hasVotedForResort, setHasVotedForResort] = useState(false);
  const [showConfirmResort, setShowConfirmResort] = useState(false);
  const [showNextMatchsConfirm, setShowNextMatchsConfirm] = useState(false);
  const [openGenerateTeamsDialog, setOpenGenerateTeamsDialog] = useState(false);
  const [isMatchHistoryCollapsed, setIsMatchHistoryCollapsed] = useState(false);
  const [completedMatches, setCompletedMatches] = useState<MatchInterface[]>(
    []
  );
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ExtendedMember[]>([]);
  const [shortInviteUrl, setShortInviteUrl] = useState<string | null>(null);
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Estado para las pestañas
  const [selectedTab, setSelectedTab] = useState(0);
  const [goleadores, setGoleadores] = useState<
    { id: string; name: string; goals: number; avatar: string | null }[]
  >([]);
  const [mvps, setMvps] = useState<
    {
      id: string;
      name: string;
      winRate: number;
      matchesPlayed: number;
      avatar: string | null;
    }[]
  >([]);
  const [inviteLink, setInviteLink] = useState('');
  const [sortingCriteria, setSortingCriteria] = useState('random');
  const [leaveGroupLoading, setLeaveGroupLoading] = useState(false);
  const [allowFillIn, setAllowFillIn] = useState(false);
  const [resetAttendanceLoading, setResetAttendanceLoading] = useState(false);
  const copyLinkRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Define all useMemo hooks at the top level
  const isUserInGroup = useMemo(() => {
    if (!user) return false;
    return group?.members?.some((member: any) => member.userId === user.id);
  }, [group?.members, user]);

  // Verificar si el usuario está pendiente de confirmación
  const isUserPendingInGroup = useMemo(() => {
    if (!user) return false;
    return group?.members?.some(
      (member: any) => member.userId === user.id && member.status === 'pending'
    );
  }, [group?.members, user]);

  // Obtener datos del grupo
  const fetchGroupDetails = async () => {
    if (!id) {
      return;
    }

    // Esperar a que la sesión se cargue
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Error al cargar los detalles del grupo');
        return;
      }

      // Agregar análisis de logs
      console.log('User data:', {
        id: user?.id,
        name: user?.name,
        members: data.members.length,
      });

      // Debug the response data to check for inviteToken
      console.log('Group API response:', data);
      console.log('Group data fields:', Object.keys(data));
      console.log(
        'Next match details:',
        data.nextMatchDetails || 'No details available'
      );
      console.log(
        'Confirmed players:',
        data.nextMatchDetails?.confirmedPlayers?.length || 0
      );

      // Verificar si el usuario actual es un administrador
      const isAdmin = data.members.some(
        (member: any) => member.userId === user?.id && member.role === 'ADMIN'
      );

      // Actualizar el estado global de isAdmin
      setCurrentUserIsAdmin(isAdmin);
      console.log('Usuario es admin:', isAdmin);

      // Verificar y actualizar el estado de asistencia del usuario actual
      const currentUserMember = data.members.find(
        (member: any) => String(member.userId) === String(user?.id)
      );

      if (currentUserMember) {
        // Normalizar el estado de asistencia (convertir a mayúsculas)
        const normalizedStatus =
          currentUserMember.status?.toUpperCase() || 'PENDING';
        console.log('Estado de membresía del usuario:', normalizedStatus);

        // Verificar también si el usuario tiene una confirmación específica para el próximo partido
        if (data.nextMatchDetails && data.nextMatchDetails.confirmedPlayers) {
          const isConfirmedForNextMatch =
            data.nextMatchDetails.confirmedPlayers.some(
              (player: any) => String(player.id) === String(user?.id)
            );

          if (isConfirmedForNextMatch) {
            console.log('Usuario confirmado para el próximo partido');
            setUserAttendanceStatus('CONFIRMED');
          } else {
            console.log('Usuario no confirmado para el próximo partido');
            setUserAttendanceStatus(normalizedStatus);
          }
        } else {
          console.log(
            'Estableciendo estado de asistencia del usuario desde miembro:',
            normalizedStatus
          );
          setUserAttendanceStatus(normalizedStatus as ParticipantStatus);
        }
      }

      setGroup(data);

      // Contar jugadores confirmados para el próximo partido
      if (data.nextMatchDetails && data.nextMatchDetails.confirmedPlayers) {
        const confirmedForNextMatch =
          data.nextMatchDetails.confirmedPlayers.length;
        setConfirmedCount(confirmedForNextMatch);
        console.log(
          'Jugadores confirmados para el próximo partido:',
          confirmedForNextMatch
        );
      } else {
        // Contar miembros con estado CONFIRMED si no hay próximo partido específico
        const confirmedMembers = data.members.filter(
          (member: any) => member.status.toUpperCase() === 'CONFIRMED'
        ).length;
        setConfirmedCount(confirmedMembers);
        console.log('Miembros confirmados en general:', confirmedMembers);
      }

      // Si hay próximo partido detallado, actualizarlo también
      if (data.nextMatchDetails) {
        console.log(
          'Estableciendo próximo partido con detalles:',
          data.nextMatchDetails
        );
      }

      // Buscar si hay un partido pendiente
      const pendingMatchData =
        data.matches.find(
          (m: any) =>
            m.status === 'PENDING' && m.playersA && m.playersA.length > 0
        ) ||
        (data.nextMatchDetails &&
        data.nextMatchDetails.playersA &&
        data.nextMatchDetails.playersA.length > 0
          ? data.nextMatchDetails
          : null);

      if (pendingMatchData) {
        // Si hay partido pendiente con equipos, usarlo
        console.log(
          'Estableciendo partido pendiente con equipos sorteados:',
          pendingMatchData.id
        );
        setPendingMatch(pendingMatchData);
        setShowTeams(false);
      } else {
        // Verificar si hay un partido pendiente sin equipos sorteados
        const nextMatchPending =
          data.matches.find((m: any) => m.status === 'PENDING') ||
          data.nextMatchDetails;

        if (nextMatchPending) {
          console.log(
            'Hay partido pendiente sin equipos sorteados:',
            nextMatchPending.id
          );
        }

        // No hay equipos sorteados, mostrar interfaz para sortear
        setPendingMatch(null);
        setShowTeams(true);
      }

      // Mensaje para debugging
      console.log('API Response - Current User:', {
        id: user?.id,
        name: user?.name,
        authHeader: Boolean(session),
        members: data.members.length,
      });

      // Convertir miembros del grupo a participantes para mantener compatibilidad
      console.log('Todos los miembros antes de mapeo:', data.members);

      const mappedParticipants = data.members.map((member: any) => {
        // Obtenemos el usuario asociado al miembro (si existe)
        const userObj = member.user || {
          id: member.userId || '',
          name: member.name || 'Sin nombre',
          image: member.avatar || null,
        };

        // Debug para ver los datos de cada miembro
        console.log('Original member data:', {
          memberId: member.id,
          userId: member.userId,
          name: member.user?.name || member.name,
          status: member.status,
          role: member.role,
        });

        // Asegurar que el status esté en minúsculas para la interfaz
        let normalizedStatus: ParticipantStatus = 'PENDING';

        if (member.status) {
          const status = member.status.toUpperCase();
          if (
            status === 'CONFIRMED' ||
            status === 'DECLINED' ||
            status === 'PENDING'
          ) {
            normalizedStatus = status as ParticipantStatus;
          }
        }

        // Asegurar que tengamos un userId válido
        const validUserId = member.userId || '';

        // Debug para normalización
        console.log('Normalized data:', {
          status: normalizedStatus,
          isCurrentUser: validUserId === user?.id,
          userId: validUserId,
        });

        return {
          id: member.id, // ID del GroupMember
          userId: validUserId, // ID del usuario, asegurando que sea un string válido
          name: userObj.name || 'Sin nombre',
          status: normalizedStatus,
          isCaptain: member.role === 'ADMIN',
          votedForResort: false,
          age: 30,
          avatar: userObj.image || member.avatar,
          role: member.role,
        };
      });

      console.log('Todos los miembros después de mapeo:', mappedParticipants);
      setParticipants(mappedParticipants);

      // Actualizar los contadores
      setConfirmedCount(
        mappedParticipants.filter(
          (p: { status: string }) => p.status === 'CONFIRMED'
        ).length
      );
      setPendingCount(
        mappedParticipants.filter(
          (p: { status: string }) => p.status === 'PENDING'
        ).length
      );

      // If user is admin, filter out pending membership requests
      if (isAdmin) {
        const pendingMemberships = data.members.filter((m: Member) => {
          const status = m.status?.toUpperCase() || '';
          return status === 'PENDING';
        });
        // Make sure we log the full details of each pending membership
        console.log(
          'Pending membership requests details:',
          pendingMemberships.map((m: Member) => ({
            id: m.id,
            userId: m.userId,
            name: m.name,
            email: m.email,
            status: m.status,
          }))
        );
        setPendingRequests(pendingMemberships);
      }

      // Generate invite URL using the group ID directly
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      // We'll pass the group ID directly in the URL since we now support this in the API
      setInviteUrl(`${baseUrl}/invite/${id}`);
    } catch (error) {
      console.error('Error fetching group details:', error);
      setError('Error al cargar los detalles del grupo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id && !loading) {
      fetchGroupDetails();
    }
  }, [id, loading]);

  // Generate short URL for invite link
  useEffect(() => {
    if (inviteUrl && !shortInviteUrl && !isGeneratingShortUrl) {
      generateShortUrl();
    }
  }, [inviteUrl, shortInviteUrl]);

  const generateShortUrl = async () => {
    if (!inviteUrl || isGeneratingShortUrl) return;

    setIsGeneratingShortUrl(true);

    try {
      const response = await fetch('/api/url-shortener', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inviteUrl }),
      });

      const data = await response.json();

      if (response.ok && data.shortUrl) {
        setShortInviteUrl(data.shortUrl);
      } else {
        console.error('Error generating short URL:', data.error);
      }
    } catch (error) {
      console.error('Error generating short URL:', error);
    } finally {
      setIsGeneratingShortUrl(false);
    }
  };

  // Add debug log to check participants status
  useEffect(() => {
    if (participants.length > 0 && user) {
      console.log('DEBUG - Participant status check:');
      console.log('Current user ID:', user.id, 'typeof:', typeof user.id);
      participants.forEach((p) => {
        console.log(`Participant ${p.name} (${p.id}):`, {
          userId: p.userId,
          userIdType: typeof p.userId,
          currentUserId: user.id,
          isCurrentUser: p.userId === user.id,
          equalityCheck: `'${p.userId}' === '${user.id}' = ${
            p.userId === user.id
          }`,
          status: p.status,
          statusType: typeof p.status,
          role: p.role,
          isAdmin: p.role === 'ADMIN',
          showSelfButtons: p.userId === user.id,
          showAdminButtons:
            currentUserIsAdmin && p.userId !== user.id && Boolean(p.userId),
        });
      });
      console.log('Current user is admin:', currentUserIsAdmin);
    }
  }, [participants, user, currentUserIsAdmin]);

  // Actualizar participantes cuando cambie el grupo
  useEffect(() => {
    if (group?.members) {
      const mappedParticipants: ExtendedMember[] = group.members.map(
        (member) => ({
          ...member,
          isCaptain: member.role === 'ADMIN',
          votedForResort: false,
          // Asegurar que el estado sea PENDING si no está definido
          status: (
            member.status || 'PENDING'
          ).toUpperCase() as ParticipantStatus,
        })
      );
      setParticipants(mappedParticipants);
    }
  }, [group]);

  // Determine admin status
  useEffect(() => {
    if (user && group) {
      // Verify if the current user is an admin by checking group members
      const isAdmin = group.members.some(
        (member: any) => member.userId === user.id && member.role === 'ADMIN'
      );
      setCurrentUserIsAdmin(isAdmin);
    }
  }, [user, group]);

  // Add a useEffect to set completed matches and expand details for the first one
  useEffect(() => {
    if (group && group.matches) {
      const completed = group.matches.filter(
        (match: any) => match.status === 'COMPLETED'
      );
      setCompletedMatches(completed);

      // Initialize player goals for all matches
      if (completed.length > 0) {
        const allGoals: { [matchId: string]: { [playerId: string]: number } } =
          {};
        completed.forEach((match) => {
          allGoals[match.id] = initializePlayerGoals(match);
        });
        setPlayerGoalsMap(
          Object.values(allGoals).reduce(
            (acc, curr) => ({ ...acc, ...curr }),
            {}
          )
        );
      }
    }
  }, [group]);

  // Mantener actualizado el estado de asistencia del usuario actual
  useEffect(() => {
    if (user && participants.length > 0) {
      const currentUserParticipant = participants.find(
        (p) => String(p.userId) === String(user.id)
      );

      if (currentUserParticipant) {
        console.log('Actualizando userAttendanceStatus:', {
          prevStatus: userAttendanceStatus,
          newStatus: currentUserParticipant.status,
          userId: user.id,
          participantId: currentUserParticipant.id,
        });

        setUserAttendanceStatus(currentUserParticipant.status);
      }
    }
  }, [participants, user]);

  // Función para calcular el puntaje de un equipo en un partido
  const getScoreForTeam = (match: MatchInterface, isTeamA: boolean): number => {
    // Si el partido ya tiene un resultado guardado, usar esos valores directamente
    if (isTeamA && typeof match.scoreA === 'number') {
      return match.scoreA;
    } else if (!isTeamA && typeof match.scoreB === 'number') {
      return match.scoreB;
    }

    // Si no hay resultado guardado, calcular por goles
    const teamGoals =
      match.goals?.filter((goal) => goal.isTeamA === isTeamA) || [];

    return teamGoals.length;
  };

  // Function to get tomorrow's date in YYYY-MM-DD format
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Set the default date to tomorrow when component loads
    setSortDate(getTomorrowDate());
  }, []);

  // Función para confirmar/rechazar asistencia como administrador
  const handleAdminAttendanceUpdate = async (
    participantId: string,
    userId: string,
    status: string
  ) => {
    try {
      if (!pendingMatch || !userId) {
        console.error('Missing required data for admin match attendance', {
          pendingMatch: Boolean(pendingMatch),
          userId,
        });
        return;
      }

      console.log('Admin actualizando asistencia al partido:', {
        matchId: pendingMatch.id,
        userId,
        status,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches/${pendingMatch.id}/attendance/${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: status,
          }),
        }
      );

      const data = await response.json();
      console.log('Response from admin match attendance update:', data);

      if (response.ok) {
        // Actualizar UI
        toast.success(
          `Asistencia ${
            status === 'CONFIRMED' ? 'confirmada' : 'rechazada'
          } por admin`
        );
        fetchGroupDetails(); // Recargar los datos del grupo para ver cambios
      } else {
        toast.error(`Error: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error updating attendance as admin:', error);
      toast.error('Error al actualizar asistencia');
    }
  };

  // Función para que un administrador actualice la asistencia de otro miembro
  const handleAdminGroupAttendance = async (
    memberId: string,
    memberIdAsTarget: string,
    status: string
  ) => {
    try {
      if (!user || !id || !group) {
        console.error('Missing required data', {
          user,
          id,
          group: Boolean(group),
        });
        return;
      }

      // Normalize status case for consistent use throughout the function
      const apiStatus = status.toUpperCase(); // API expects uppercase status
      const uiStatus = status.toLowerCase(); // UI uses lowercase status

      console.log('Admin actualizando asistencia:', {
        memberId,
        memberIdAsTarget: memberIdAsTarget,
        apiStatus,
        uiStatus,
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/groups/${id}/attendance/${memberId}`,
      });

      // Guardar el estado anterior para poder restaurarlo en caso de error
      const previousParticipants = [...participants];
      const participantToUpdate = participants.find((p) => p.id === memberId);
      const previousStatus = participantToUpdate?.status || 'pending';

      // Actualizar inmediatamente el estado de la UI para dar feedback instantáneo
      const updatedParticipants = participants.map((p) => {
        if (p.id === memberId) {
          console.log(
            `Admin actualizando estado local de ${p.status} a ${uiStatus}`
          );
          return {
            ...p,
            status: uiStatus as ParticipantStatus,
          };
        }
        return p;
      });

      // Actualizar los participantes inmediatamente
      setParticipants(updatedParticipants);

      // Actualizar el contador de confirmados
      const newConfirmedCount = updatedParticipants.filter(
        (p) => p.status === 'confirmed'
      ).length;
      setConfirmedCount(newConfirmedCount);

      // Realizar la llamada para actualizar el estado - Usando el ID del member directamente
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/groups/${id}/attendance/${memberId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: apiStatus, // Send uppercase status to API
            useDirectMemberId: true, // Indicar que estamos usando el ID del miembro directamente
          }),
        }
      );

      try {
        const data = await response.json();
        console.log('Response from admin attendance update:', data);

        if (response.ok) {
          // También actualizar el modelo del grupo para mantener sincronizados los estados
          const updatedGroupMembers = [...group.members];
          const memberIndex = updatedGroupMembers.findIndex(
            (m: any) => m.id === memberId
          );

          if (memberIndex !== -1) {
            updatedGroupMembers[memberIndex] = {
              ...updatedGroupMembers[memberIndex],
              status: apiStatus, // Make sure we're setting the correct case for the group members object
            };

            // Actualizar el grupo sin causar un refresco completo
            setGroup((prevGroup) => {
              if (!prevGroup) return null;
              return {
                ...prevGroup,
                members: updatedGroupMembers,
              };
            });

            console.log('Grupo actualizado localmente con éxito');
          } else {
            console.log(
              'No se encontró el miembro para actualizar en el grupo, pero la API actualizó correctamente'
            );
          }
        } else {
          console.error('Error en servidor:', data);
          alert(
            `Error al actualizar la asistencia: ${
              data.error || 'Error desconocido'
            }`
          );

          // Revertir cambios en UI al estado anterior en caso de error
          setParticipants(previousParticipants);
          setConfirmedCount(
            previousParticipants.filter((p) => p.status === 'confirmed').length
          );
        }
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        alert(
          `Error al procesar la respuesta: ${response.status} ${response.statusText}`
        );

        // Revertir cambios en UI al estado anterior en caso de error
        setParticipants(previousParticipants);
        setConfirmedCount(
          previousParticipants.filter((p) => p.status === 'confirmed').length
        );
      }
    } catch (error) {
      console.error('Error actualizando asistencia del miembro:', error);
      alert('Error al actualizar la asistencia. Inténtalo de nuevo.');

      // En caso de error general, actualizar los datos desde el servidor
      await fetchGroupDetails();
    }
  };

  // Función para actualizar la asistencia del usuario al grupo
  const handleGroupAttendance = async (status: ParticipantStatus) => {
    try {
      setIsLoading(true);

      // Ensure we have userId and groupId
      const userId = session?.user?.id;
      // Convert id to a safe string for groupId
      const groupId =
        typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;

      if (!userId || !groupId) {
        toast.error(
          'No se puede actualizar la asistencia. Falta información necesaria.'
        );
        setIsLoading(false);
        return;
      }

      let confirmedPlayers = [];

      const response = await fetch('/api/attendances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          groupId,
          status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error updating attendance:', error);
        toast.error(
          'Error al actualizar asistencia. Por favor, intenta de nuevo.'
        );
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Attendance updated successfully:', data);

      // Update local state
      const updatedGroup = { ...group } as GroupWithRelations;

      // Check if nextMatchDetails exists before updating
      if (updatedGroup.nextMatchDetails) {
        confirmedPlayers = updatedGroup.nextMatchDetails.confirmedPlayers || [];

        if (status === 'CONFIRMED') {
          // Add user to confirmed players if not already there
          const isUserConfirmed = confirmedPlayers.some(
            (player) => player.id === userId
          );
          if (!isUserConfirmed) {
            confirmedPlayers.push({
              id: userId,
              name: session?.user?.name || null,
              avatar: session?.user?.image || null,
            });
          }
        } else if (status === 'DECLINED') {
          // Remove user from confirmed players
          confirmedPlayers = confirmedPlayers.filter(
            (player) => player.id !== userId
          );
        }

        // Update nextMatchDetails with new confirmedPlayers
        updatedGroup.nextMatchDetails = {
          ...updatedGroup.nextMatchDetails,
          confirmedPlayers,
        };
      }

      // Update local state
      setGroup(updatedGroup);
      setUserAttendanceStatus(status);

      // Refresh group details after 1 second
      setTimeout(() => {
        fetchGroupDetails();
        setIsLoading(false);
      }, 1000);

      toast.success(
        status === 'CONFIRMED'
          ? 'Has confirmado tu asistencia al próximo partido!'
          : 'Has rechazado la asistencia al próximo partido!'
      );
    } catch (error) {
      console.error('Error in handleGroupAttendance:', error);
      toast.error(
        'Error al actualizar asistencia. Por favor, intenta de nuevo.'
      );
      setIsLoading(false);
    }
  };

  // Función para copiar enlace al portapapeles
  const copyInviteLink = () => {
    const urlToCopy = shortInviteUrl || inviteUrl || '';

    if (urlToCopy) {
      setIsCopying(true);
      navigator.clipboard
        .writeText(urlToCopy)
        .then(() => {
          toast.success('Enlace copiado al portapapeles');
          // Mantener el estado de copiado por 2 segundos
          setTimeout(() => {
            setIsCopying(false);
          }, 2000);
        })
        .catch((err) => {
          console.error('Error al copiar enlace:', err);
          toast.error('Error al copiar enlace');
          setIsCopying(false);
        });
    }
  };

  // Handle approve or reject membership request
  const handleMembershipRequest = async (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/groups/${id}/members/${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error al ${
            action === 'APPROVE' ? 'aprobar' : 'rechazar'
          } la solicitud`
        );
      }

      await fetchGroupDetails();
      toast.success(
        `Solicitud ${
          action === 'APPROVE' ? 'aprobada' : 'rechazada'
        } correctamente`
      );
    } catch (error) {
      console.error(
        `Error ${action === 'APPROVE' ? 'aprobando' : 'rechazando'} solicitud:`,
        error
      );
      toast.error(
        `Error al ${action === 'APPROVE' ? 'aprobar' : 'rechazar'} la solicitud`
      );
    }
  };

  // Función para abandonar el grupo
  const handleLeaveGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al abandonar el grupo');
      }

      toast.success('Has abandonado el grupo correctamente');
      router.push('/groups');
    } catch (error) {
      console.error('Error al abandonar el grupo:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error al abandonar el grupo'
      );
    }
  };

  // Función para calcular los goleadores y MVPs
  const calculateStats = () => {
    if (!group || !group.matches) return;

    // Calcular goleadores
    const goalsCount: Record<
      string,
      { goals: number; name: string; avatar: string | null }
    > = {};

    // Calcular victorias y partidos jugados para cada jugador
    const playerStats: Record<
      string,
      { wins: number; matches: number; name: string; avatar: string | null }
    > = {};

    // Para cada partido completado
    group.matches.forEach((match: any) => {
      if (match.status !== 'COMPLETED') return;

      // Registrar goles
      if (match.goals && match.goals.length > 0) {
        match.goals.forEach((goal: any) => {
          if (!goalsCount[goal.scorerId]) {
            goalsCount[goal.scorerId] = {
              goals: 0,
              name: goal.scorerName || 'Sin nombre',
              avatar: goal.scorerAvatar,
            };
          }
          goalsCount[goal.scorerId].goals += 1;
        });
      }

      // Determinar el equipo ganador
      const teamAWon = match.scoreA > match.scoreB;
      const isDraw = match.scoreA === match.scoreB;

      // Registrar victorias y partidos para jugadores del Equipo A
      if (match.playersA) {
        match.playersA.forEach((player: any) => {
          if (!playerStats[player.id]) {
            playerStats[player.id] = {
              wins: 0,
              matches: 0,
              name: player.name || 'Sin nombre',
              avatar: player.avatar,
            };
          }
          playerStats[player.id].matches += 1;
          if (teamAWon) playerStats[player.id].wins += 1;
          if (isDraw) playerStats[player.id].wins += 0.5; // Media victoria por empate
        });
      }

      // Registrar victorias y partidos para jugadores del Equipo B
      if (match.playersB) {
        match.playersB.forEach((player: any) => {
          if (!playerStats[player.id]) {
            playerStats[player.id] = {
              wins: 0,
              matches: 0,
              name: player.name || 'Sin nombre',
              avatar: player.avatar,
            };
          }
          playerStats[player.id].matches += 1;
          if (!teamAWon && !isDraw) playerStats[player.id].wins += 1;
          if (isDraw) playerStats[player.id].wins += 0.5; // Media victoria por empate
        });
      }
    });

    // Convertir los objetos a arrays y ordenarlos
    const sortedGoleadores = Object.entries(goalsCount)
      .map(([id, data]) => ({
        id,
        name: data.name,
        goals: data.goals,
        avatar: data.avatar,
      }))
      .sort((a, b) => b.goals - a.goals);

    const sortedMvps = Object.entries(playerStats)
      .map(([id, data]) => ({
        id,
        name: data.name,
        winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0,
        matchesPlayed: data.matches,
        avatar: data.avatar,
      }))
      .filter((player) => player.matchesPlayed >= 3) // Solo jugadores con al menos 3 partidos
      .sort((a, b) => b.winRate - a.winRate);

    setGoleadores(sortedGoleadores);
    setMvps(sortedMvps);
  };

  // Llamar a calculateStats cada vez que cambia el grupo
  useEffect(() => {
    if (group) {
      calculateStats();
    }
  }, [group]);

  // Actualizar el link de invitación cuando cambie el grupo
  useEffect(() => {
    if (group && group.inviteToken) {
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/invite/${group.inviteToken}`);
    }
  }, [group]);

  // Función para obtener el texto de recurrencia
  const getRecurrenceText = () => {
    if (!group) return '';

    const dayNames = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];

    if (!group.recurrenceType || group.recurrenceType === 'NONE') {
      if (!group.nextMatch) {
        return 'No hay próximo partido programado';
      }

      const nextDate = new Date(group.nextMatch);
      const nextDateStr = nextDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      return `Próximo partido: ${nextDateStr}`;
    }

    let frequencyText = '';
    if (group.recurrenceType === 'WEEKLY') {
      frequencyText = 'Semanal';
    } else if (group.recurrenceType === 'BIWEEKLY') {
      frequencyText = 'Quincenal';
    } else if (group.recurrenceType === 'MONTHLY') {
      frequencyText = 'Mensual';
    }

    let daysText = '';
    if (group.recurrenceDays && group.recurrenceDays.length > 0) {
      daysText = group.recurrenceDays
        .map((day: number) => dayNames[day])
        .map((day: string) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(', ');
    }

    let timeText = '';
    if (group.recurrenceTime) {
      timeText = `a las ${group.recurrenceTime} hrs`;
    }

    let recurrenceText = `Frecuencia: ${frequencyText}`;
    if (daysText) recurrenceText += ` - Días: ${daysText}`;
    if (timeText) recurrenceText += ` ${timeText}`;

    if (group.nextMatch) {
      const nextDate = new Date(group.nextMatch);
      const nextDateStr = nextDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      recurrenceText += `\nPróximo partido: ${nextDateStr}`;
    }

    return recurrenceText;
  };

  // Función para manejar el sorteo de equipos
  const handleSortTeams = async () => {
    if (!currentUserIsAdmin) {
      toast.error('No tienes permisos para realizar esta acción');
      return;
    }

    if (!group) {
      toast.error('No se encontró la información del grupo');
      return;
    }

    try {
      setSortTeamsLoading(true);

      // Obtener los miembros confirmados del próximo partido
      let confirmedMembers = [];

      // Si hay próximo partido con confirmedPlayers, usar esos jugadores
      if (
        group.nextMatchDetails &&
        group.nextMatchDetails.confirmedPlayers &&
        group.nextMatchDetails.confirmedPlayers.length > 0
      ) {
        confirmedMembers = group.nextMatchDetails.confirmedPlayers.map(
          (player) => ({
            userId: player.id,
            name: player.name,
            avatar: player.avatar,
          })
        );
        console.log(
          `Usando ${confirmedMembers.length} jugadores confirmados del próximo partido`
        );
      } else {
        // Si no hay confirmados para próximo partido, buscar en miembros generales
        confirmedMembers = participants
          .filter((p) => p.status.toUpperCase() === 'CONFIRMED')
          .map((p) => ({
            userId: p.userId,
            name: p.name,
            avatar: p.avatar,
          }));
        console.log(
          `Usando ${confirmedMembers.length} jugadores confirmados del grupo (método alternativo)`
        );
      }

      // Validar que haya suficientes jugadores o que esté permitido usar placeholders
      if (confirmedMembers.length < 2) {
        toast.error(
          'Se necesitan al menos 2 jugadores confirmados para sortear equipos'
        );
        setSortTeamsLoading(false);
        return;
      }

      if (
        !allowFillIn &&
        confirmedMembers.length < (group.requiredPlayers || 10)
      ) {
        toast.error(
          `Se necesitan ${
            group.requiredPlayers || 10
          } jugadores confirmados o activar la opción "A determinar"`
        );
        setSortTeamsLoading(false);
        return;
      }

      // Crear jugadores "A determinar" si es necesario
      let playersToSort = [...confirmedMembers];

      if (
        allowFillIn &&
        confirmedMembers.length < (group.requiredPlayers || 10)
      ) {
        const playersNeeded =
          (group.requiredPlayers || 10) - confirmedMembers.length;

        // Agregar jugadores temporales "A determinar"
        for (let i = 0; i < playersNeeded; i++) {
          playersToSort.push({
            userId: `temp-${Date.now()}-${i}`,
            name: 'A determinar',
            avatar: '',
          });
        }
      }

      // Dividir aleatoriamente los jugadores en dos equipos
      const shuffledPlayers = [...playersToSort].sort(
        () => Math.random() - 0.5
      );
      const midPoint = Math.floor(shuffledPlayers.length / 2);
      const teamAPlayers = shuffledPlayers.slice(0, midPoint);
      const teamBPlayers = shuffledPlayers.slice(midPoint);

      // Endpoint para crear o resortar partido
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/matches${
        pendingMatch ? `/${pendingMatch.id}/resort` : ''
      }`;

      const matchData = {
        groupId: group.id,
        date: new Date().toISOString(),
        location: group.location,
        teamA: group.teamAName || 'Equipo A',
        teamB: group.teamBName || 'Equipo B',
        status: 'PENDING',
        scoreA: 0,
        scoreB: 0,
        players: [
          ...teamAPlayers.map((p) => ({
            userId: p.userId,
            isTeamA: true,
            isPlaceholder: p.name === 'A determinar',
          })),
          ...teamBPlayers.map((p) => ({
            userId: p.userId,
            isTeamA: false,
            isPlaceholder: p.name === 'A determinar',
          })),
        ],
        sortingCriteria: sortingCriteria || 'random',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        let errorMessage = `Error al ${
          pendingMatch ? 'resortar' : 'crear'
        } partido: ${response.status} ${response.statusText}`;

        try {
          // Try to parse the error as JSON
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          // If parsing fails, use the error text directly
          if (errorText && errorText.length < 100) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      let jsonData;
      try {
        jsonData = await response.json();
      } catch (e) {
        console.error('Error parsing JSON response:', e);
        jsonData = { message: 'Error al procesar la respuesta' };
      }

      toast.success(
        pendingMatch
          ? 'Equipos resorteados exitosamente'
          : 'Partido creado exitosamente'
      );
      await fetchGroupDetails();
    } catch (error) {
      console.error('Error al sortear equipos:', error);
      setSortTeamsError(
        error instanceof Error
          ? error.message
          : 'Error desconocido al sortear equipos'
      );
      toast.error(
        error instanceof Error
          ? `Error: ${error.message}`
          : 'Error al sortear equipos'
      );
    } finally {
      setSortTeamsLoading(false);
    }
  };

  // Función para promover a admin
  const handlePromoteToAdmin = async (userId: string) => {
    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: userId,
          action: 'promote',
        }),
      });

      if (!response.ok) {
        throw new Error('Error al promover a administrador');
      }

      await fetchGroupDetails();
      toast.success('Usuario promovido a administrador');
    } catch (error) {
      console.error('Error promoting to admin:', error);
      toast.error('Error al promover a administrador');
    }
  };

  // Función para quitar rol de admin
  const handleDemoteFromAdmin = async (userId: string) => {
    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: userId,
          action: 'demote',
        }),
      });

      if (!response.ok) {
        throw new Error('Error al quitar rol de administrador');
      }

      await fetchGroupDetails();
      toast.success('Rol de administrador revocado');
    } catch (error) {
      console.error('Error demoting from admin:', error);
      toast.error('Error al quitar rol de administrador');
    }
  };

  // Función para inicializar los goles de los jugadores
  const initializePlayerGoals = (match: MatchInterface) => {
    const players = [...(match.playersA || []), ...(match.playersB || [])];
    return players.reduce((acc: { [key: string]: number }, player) => {
      acc[player.id] = 0;
      return acc;
    }, {});
  };

  const MembersTab = () => {
    const confirmedMembers = participants.filter(
      (p) => p.status.toUpperCase() === 'CONFIRMED'
    ).length;

    const handleConfirmAttendance = async (memberId: string) => {
      try {
        await handleAdminGroupAttendance(memberId, memberId, 'CONFIRMED');
      } catch (error) {
        console.error('Error confirming attendance:', error);
      }
    };

    const handleDeclineAttendance = async (memberId: string) => {
      try {
        await handleAdminGroupAttendance(memberId, memberId, 'DECLINED');
      } catch (error) {
        console.error('Error declining attendance:', error);
      }
    };

    return (
      <div className='space-y-4'>
        <div className='flex justify-between items-center'>
          <h3 className='text-lg font-semibold'>
            Miembros ({confirmedMembers} confirmados)
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Nombre
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Estado
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {participants.map((member) => (
                <tr key={member.id}>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center'>
                      <div className='flex-shrink-0 h-10 w-10'>
                        <Avatar
                          alt={member.name || ''}
                          src={member.avatar || ''}
                          className='h-10 w-10 rounded-full'
                        />
                      </div>
                      <div className='ml-4'>
                        <div className='text-sm font-medium text-gray-900'>
                          {member.name}
                          {member.role === 'ADMIN' && (
                            <span className='ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.status.toUpperCase() === 'CONFIRMED'
                          ? 'bg-green-100 text-green-800'
                          : member.status.toUpperCase() === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {member.status.toUpperCase() === 'CONFIRMED'
                        ? 'Confirmado'
                        : member.status.toUpperCase() === 'PENDING'
                        ? 'Pendiente'
                        : 'Rechazado'}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    <div className='flex space-x-2'>
                      {user && member.userId === user.id ? (
                        // Botones para el usuario actual
                        <>
                          {member.status.toUpperCase() !== 'CONFIRMED' && (
                            <button
                              onClick={() => handleGroupAttendance('CONFIRMED')}
                              className='text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-md'
                            >
                              Confirmar
                            </button>
                          )}
                          {member.status.toUpperCase() !== 'DECLINED' && (
                            <button
                              onClick={() => handleGroupAttendance('DECLINED')}
                              className='text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-md'
                            >
                              Rechazar
                            </button>
                          )}
                        </>
                      ) : (
                        // Botones para administradores
                        currentUserIsAdmin && (
                          <>
                            {member.status.toUpperCase() !== 'CONFIRMED' && (
                              <button
                                onClick={() =>
                                  handleConfirmAttendance(member.id)
                                }
                                className='text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-md'
                              >
                                Confirmar
                              </button>
                            )}
                            {member.status.toUpperCase() !== 'DECLINED' && (
                              <button
                                onClick={() =>
                                  handleDeclineAttendance(member.id)
                                }
                                className='text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-md'
                              >
                                Rechazar
                              </button>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botón de abandonar grupo al final de la pestaña de miembros */}
        {user && (
          <div className='mt-8 border-t pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-medium text-gray-900'>
                  Abandonar grupo
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {currentUserIsAdmin
                    ? 'Como administrador, asegúrate de que haya otro administrador antes de abandonar el grupo.'
                    : 'Esta acción no se puede deshacer.'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Estás seguro de que quieres abandonar el grupo? Esta acción no se puede deshacer.'
                    )
                  ) {
                    handleLeaveGroup();
                  }
                }}
                className='flex items-center space-x-2 px-4 py-2 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200'
              >
                <TrashIcon className='h-5 w-5' />
                <span>Abandonar grupo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Función para eliminar el partido pendiente
  const handleDeleteMatch = async () => {
    if (!pendingMatch || !currentUserIsAdmin) return;

    try {
      // No need to check for accessToken as the credentials will be sent with the cookie
      // Make the request without setting Authorization header explicitly
      const response = await fetch(`/api/matches/${pendingMatch.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar el partido');
      }

      toast.success('El partido ha sido eliminado con éxito');
      // Quitar el mensaje sobre reseteo de estados
      // toast.success('Los estados de confirmación han sido reseteados para todos los miembros');
      router.push(`/group/${id}`);
    } catch (error) {
      console.error('Error al eliminar el partido:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error al eliminar el partido'
      );
    }
  };

  // Función para redirigir a la página de resultados
  const handleAddResults = () => {
    if (!pendingMatch) return;
    router.push(`/matches/${pendingMatch.id}/results?edit=true`);
  };

  /**
   * Resetea los estados de asistencia de todos los usuarios para el próximo partido
   */
  const resetAttendanceStatus = async () => {
    if (!group || !group.nextMatchDetails || !group.id) return;

    try {
      setResetAttendanceLoading(true);

      const response = await fetch(`/api/groups/${group.id}/resetAttendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al resetear los estados de asistencia');
      }

      // Refresh group details
      fetchGroupDetails();
      toast.success('Estados de asistencia reseteados correctamente');
    } catch (error) {
      console.error('Error resetting attendance status:', error);
      toast.error('Error al resetear los estados de asistencia');
    } finally {
      setResetAttendanceLoading(false);
    }
  };

  /**
   * Formatea la fecha del partido
   */
  const formatMatchDate = (date: string | Date) => {
    if (!date) return 'No programado';

    // Ensure we have a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formattedDate;
  };

  return (
    <Layout>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {isLoading ? (
          <div className='flex justify-center items-center min-h-screen'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
          </div>
        ) : error ? (
          <div className='text-center text-red-600'>{error}</div>
        ) : group ? (
          <div>
            {/* Contenedor principal con pestañas */}
            <div className='mb-6'>
              {/* Header with title and actions */}
              <div className='flex items-center justify-between mb-5 flex-wrap gap-3'>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={() => router.push('/groups')}
                    className='flex items-center text-gray-600 hover:text-gray-800'
                  >
                    <ArrowLeftIcon className='h-5 w-5 mr-1' />
                    <span className='text-sm'>Volver</span>
                  </button>
                  <h1 className='text-2xl font-bold text-gray-800'>
                    {group.name}
                  </h1>
                </div>
                <div className='flex items-center space-x-2'>
                  {group.userStatus === 'PENDING' ? (
                    <span className='px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm'>
                      Solicitud pendiente
                    </span>
                  ) : (
                    isUserInGroup && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              '¿Estás seguro de que quieres salir de este grupo?'
                            )
                          ) {
                            handleLeaveGroup();
                          }
                        }}
                        className='px-3 py-1 text-sm text-red-600 hover:text-red-800'
                      >
                        Salir del grupo
                      </button>
                    )
                  )}
                  {currentUserIsAdmin && (
                    <>
                      <Link
                        href={`/edit-group/${id}`}
                        className='p-2 text-gray-600 hover:text-blue-600 transition-colors'
                        title='Editar grupo'
                      >
                        <PencilIcon className='h-5 w-5' />
                      </Link>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              '¿Estás seguro de que quieres eliminar este grupo? Esta acción no se puede deshacer.'
                            )
                          ) {
                            handleLeaveGroup();
                          }
                        }}
                        className='p-2 text-gray-600 hover:text-red-600 transition-colors'
                        title='Eliminar grupo'
                      >
                        <TrashIcon className='h-5 w-5' />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Información estática del grupo */}
              <div className='bg-gray-50 rounded-lg p-4 mb-4'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  {/* Columna 1: Información básica */}
                  <div>
                    <div className='mb-3'>
                      <p className='text-sm font-medium text-gray-500'>
                        Deporte
                      </p>
                      <p className='text-base text-gray-900'>{group.sport}</p>
                    </div>
                    <div className='mb-3'>
                      <p className='text-sm font-medium text-gray-500'>
                        Ubicación
                      </p>
                      <p className='text-base text-gray-900'>
                        {group.location}
                      </p>
                    </div>
                    <div>
                      <p className='text-sm font-medium text-gray-500'>
                        Total partidos
                      </p>
                      <p className='text-base text-gray-900'>
                        {group.totalMatches}
                      </p>
                    </div>
                  </div>

                  {/* Columna 2: Recurrencia y próximo partido */}
                  <div>
                    <div className='mb-3'>
                      <p className='text-sm font-medium text-gray-500'>
                        Próximo partido
                      </p>
                      <p className='text-base text-gray-900'>
                        {group.nextMatchDetails ? (
                          <span>
                            {formatMatchDate(group.nextMatchDetails.date)}
                          </span>
                        ) : group.nextMatch ? (
                          formatMatchDate(group.nextMatch)
                        ) : (
                          'No programado'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className='text-sm font-medium text-gray-500'>
                        Frecuencia
                      </p>
                      <p className='text-base text-gray-900'>
                        {group.recurrenceType === 'WEEKLY'
                          ? 'Semanal'
                          : group.recurrenceType === 'BIWEEKLY'
                          ? 'Quincenal'
                          : group.recurrenceType === 'MONTHLY'
                          ? 'Mensual'
                          : 'No recurrente'}
                        {group.recurrenceDays &&
                          group.recurrenceDays.length > 0 &&
                          ` - ${group.recurrenceDays
                            .map(
                              (day) =>
                                [
                                  'Dom',
                                  'Lun',
                                  'Mar',
                                  'Mié',
                                  'Jue',
                                  'Vie',
                                  'Sáb',
                                ][day]
                            )
                            .join(', ')}`}
                        {group.recurrenceTime &&
                          ` a las ${group.recurrenceTime} hrs`}
                      </p>
                    </div>
                  </div>

                  {/* Columna 3: Link de invitación */}
                  <div>
                    <p className='text-sm font-medium text-gray-500 mb-1'>
                      Link de invitación
                    </p>
                    <div className='flex items-center space-x-2'>
                      <a
                        href={inviteLink}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:text-blue-800 truncate max-w-[200px]'
                      >
                        {inviteLink}
                      </a>
                      <button
                        onClick={copyInviteLink}
                        className='text-gray-500 hover:text-gray-700 focus:outline-none'
                        title='Copiar enlace'
                      >
                        <ClipboardIcon className='h-5 w-5' />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='bg-white rounded-lg shadow-sm p-4'>
                {/* Tabs */}
                <div className='flex border-b mb-4 overflow-x-auto'>
                  <button
                    className={`py-2 px-4 ${
                      selectedTab === 0
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setSelectedTab(0)}
                  >
                    Próximo Partido
                  </button>
                  <button
                    className={`py-2 px-4 ${
                      selectedTab === 1
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setSelectedTab(1)}
                  >
                    Historial
                  </button>
                  <button
                    className={`py-2 px-4 ${
                      selectedTab === 2
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setSelectedTab(2)}
                  >
                    Goleadores
                  </button>
                  <button
                    className={`py-2 px-4 ${
                      selectedTab === 3
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setSelectedTab(3)}
                  >
                    MVPs
                  </button>
                  <button
                    className={`py-2 px-4 ${
                      selectedTab === 4
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setSelectedTab(4)}
                  >
                    Miembros
                  </button>
                  {currentUserIsAdmin && (
                    <button
                      className={`py-2 px-4 ${
                        selectedTab === 5
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setSelectedTab(5)}
                    >
                      Solicitudes{' '}
                      {pendingRequests.length > 0 && (
                        <span className='ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full'>
                          {pendingRequests.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Contenido de las pestañas */}
                <div className='mt-4'>
                  {selectedTab === 0 && (
                    <div className='space-y-6'>
                      {/* Botones de asistencia para el usuario actual */}
                      {user && (
                        <div className='bg-gray-50 p-4 rounded-lg'>
                          <div className='flex items-center justify-between'>
                            <h3 className='font-medium text-gray-900'>
                              Tu asistencia
                            </h3>
                            <button
                              onClick={() => {
                                const newStatus =
                                  userAttendanceStatus === 'CONFIRMED'
                                    ? 'DECLINED'
                                    : 'CONFIRMED';
                                handleGroupAttendance(newStatus);
                              }}
                              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                                userAttendanceStatus === 'CONFIRMED'
                                  ? 'bg-green-100 hover:bg-red-100 text-green-600 hover:text-red-600'
                                  : userAttendanceStatus === 'DECLINED'
                                  ? 'bg-red-100 hover:bg-green-100 text-red-600 hover:text-green-600'
                                  : 'bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600'
                              }`}
                            >
                              {userAttendanceStatus === 'CONFIRMED' ? (
                                <>
                                  <CheckCircleIconSolid className='h-6 w-6' />
                                  <span>Confirmado</span>
                                </>
                              ) : userAttendanceStatus === 'DECLINED' ? (
                                <>
                                  <XCircleIconSolid className='h-6 w-6' />
                                  <span>No asisto</span>
                                </>
                              ) : (
                                <>
                                  <QuestionMarkCircleIcon className='h-6 w-6' />
                                  <span>Pendiente</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reset Attendance Button (solo para administradores) */}
                      {currentUserIsAdmin && (
                        <div className='bg-gray-50 p-4 rounded-lg mb-4'>
                          <h3 className='font-medium text-gray-900 mb-4'>
                            Resetear asistencia
                          </h3>
                          <div className='flex justify-end'>
                            <button
                              onClick={resetAttendanceStatus}
                              disabled={resetAttendanceLoading}
                              className='px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors'
                            >
                              {resetAttendanceLoading
                                ? 'Reseteando...'
                                : 'Resetear estados de asistencia'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sorteo de equipos (solo para administradores) */}
                      {currentUserIsAdmin && !pendingMatch && (
                        <div className='bg-gray-50 p-4 rounded-lg mb-4'>
                          <h3 className='font-medium text-gray-900 mb-4'>
                            Sortear equipos
                          </h3>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSortTeams();
                            }}
                          >
                            <div className='space-y-4'>
                              <div>
                                <label className='block text-sm font-medium text-gray-700 mb-1'>
                                  Criterio de sorteo
                                </label>
                                <select
                                  value={sortingCriteria}
                                  onChange={(e) =>
                                    setSortingCriteria(e.target.value)
                                  }
                                  className='w-full p-2 border border-gray-300 rounded-md'
                                >
                                  <option value='random'>Aleatorio</option>
                                  <option value='balanced'>
                                    Equipos balanceados
                                  </option>
                                  <option value='age'>Por edad</option>
                                </select>
                              </div>
                              <div className='flex justify-end'>
                                <button
                                  type='submit'
                                  disabled={sortTeamsLoading}
                                  className='px-4 py-2 text-white bg-green-500 hover:bg-green-600 rounded-md transition-colors'
                                >
                                  {sortTeamsLoading
                                    ? 'Sorteando...'
                                    : `Sortear equipos (${
                                        group.nextMatchDetails?.confirmedPlayers
                                          ?.length || confirmedCount
                                      }/${group.requiredPlayers || 10})`}
                                </button>
                              </div>
                              <div className='mt-2'>
                                <div className='flex items-center'>
                                  <input
                                    type='checkbox'
                                    id='allowFillIn'
                                    className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                                    checked={allowFillIn}
                                    onChange={(e) =>
                                      setAllowFillIn(e.target.checked)
                                    }
                                  />
                                  <label
                                    htmlFor='allowFillIn'
                                    className='ml-2 block text-sm text-gray-700'
                                  >
                                    Permitir sortear con jugadores insuficientes
                                    (completar con "A determinar")
                                  </label>
                                </div>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Información del partido pendiente */}
                      {pendingMatch &&
                        pendingMatch.playersA &&
                        pendingMatch.playersA.length > 0 && (
                          <div className='bg-gray-50 p-4 rounded-lg mb-4'>
                            <div className='space-y-4'>
                              <div className='flex items-center justify-between'>
                                <div className='flex items-center space-x-2'>
                                  <h3 className='font-medium text-gray-900'>
                                    Equipos sorteados
                                  </h3>
                                  <span className='px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full'>
                                    Pendiente
                                  </span>
                                </div>
                                {currentUserIsAdmin && (
                                  <div className='flex items-center space-x-2'>
                                    <button
                                      onClick={handleAddResults}
                                      className='flex items-center space-x-2 px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200'
                                    >
                                      <PlusIcon className='h-5 w-5' />
                                      <span>Terminar Partido</span>
                                    </button>
                                    <button
                                      onClick={handleDeleteMatch}
                                      className='flex items-center space-x-2 px-3 py-1 text-sm font-medium text-red-600 bg-red-100 rounded-md hover:bg-red-200'
                                    >
                                      <TrashIcon className='h-5 w-5' />
                                      <span>Eliminar Partido</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className='grid grid-cols-2 gap-4 mt-4'>
                                <div>
                                  <h4 className='text-sm font-medium text-gray-500 mb-2'>
                                    {pendingMatch.teamA}
                                  </h4>
                                  <div className='space-y-1'>
                                    {pendingMatch.playersA?.map((player) => (
                                      <div
                                        key={player.id}
                                        className='flex items-center space-x-2'
                                      >
                                        {player.name === 'A determinar' ? (
                                          <div className='h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500'>
                                            ?
                                          </div>
                                        ) : (
                                          <Avatar
                                            alt={player.name || ''}
                                            src={player.avatar || ''}
                                            className='h-6 w-6 rounded-full'
                                          />
                                        )}
                                        <span
                                          className={`text-sm ${
                                            player.name === 'A determinar'
                                              ? 'text-gray-400 italic'
                                              : 'text-gray-600'
                                          }`}
                                        >
                                          {player.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <h4 className='text-sm font-medium text-gray-500 mb-2'>
                                    {pendingMatch.teamB}
                                  </h4>
                                  <div className='space-y-1'>
                                    {pendingMatch.playersB?.map((player) => (
                                      <div
                                        key={player.id}
                                        className='flex items-center space-x-2'
                                      >
                                        {player.name === 'A determinar' ? (
                                          <div className='h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500'>
                                            ?
                                          </div>
                                        ) : (
                                          <Avatar
                                            alt={player.name || ''}
                                            src={player.avatar || ''}
                                            className='h-6 w-6 rounded-full'
                                          />
                                        )}
                                        <span
                                          className={`text-sm ${
                                            player.name === 'A determinar'
                                              ? 'text-gray-400 italic'
                                              : 'text-gray-600'
                                          }`}
                                        >
                                          {player.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Lista de jugadores confirmados */}
                      <div className='bg-gray-50 p-4 rounded-lg'>
                        <h3 className='font-medium text-gray-900 mb-4'>
                          Jugadores confirmados (
                          {group?.nextMatchDetails?.confirmedPlayers?.length ||
                            0}
                          /{group?.requiredPlayers || 10})
                        </h3>
                        <div className='space-y-2'>
                          {group?.nextMatchDetails?.confirmedPlayers &&
                          group.nextMatchDetails.confirmedPlayers.length > 0 ? (
                            group.nextMatchDetails.confirmedPlayers.map(
                              (player) => (
                                <div
                                  key={player.id}
                                  className='flex items-center justify-between'
                                >
                                  <div className='flex items-center space-x-2'>
                                    {player.avatar ? (
                                      <img
                                        src={player.avatar}
                                        alt={player.name || 'Jugador'}
                                        className='w-6 h-6 rounded-full'
                                      />
                                    ) : (
                                      <div className='w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center'>
                                        <span className='text-xs'>
                                          {player.name?.[0] || '?'}
                                        </span>
                                      </div>
                                    )}
                                    <span className='text-sm font-medium text-gray-700'>
                                      {player.name || 'Jugador sin nombre'}
                                    </span>
                                  </div>
                                  {currentUserIsAdmin && (
                                    <button
                                      onClick={() =>
                                        handleAdminGroupAttendance(
                                          '',
                                          player.id,
                                          'DECLINED'
                                        )
                                      }
                                      className='text-red-500 hover:text-red-700'
                                      aria-label='Eliminar jugador'
                                      title='Eliminar jugador'
                                    >
                                      <XCircleIcon className='w-5 h-5' />
                                    </button>
                                  )}
                                </div>
                              )
                            )
                          ) : (
                            <p className='text-sm text-gray-500'>
                              Aún no hay jugadores confirmados
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTab === 1 && (
                    <div>
                      <h3 className='text-lg font-medium mb-3'>
                        Historial de Partidos
                      </h3>
                      {completedMatches.length === 0 ? (
                        <p className='text-gray-500'>
                          No hay partidos completados aún.
                        </p>
                      ) : (
                        <div className='space-y-4'>
                          {completedMatches.map((match) => (
                            <div
                              key={match.id}
                              className='bg-gray-50 p-4 rounded-lg'
                            >
                              <div className='flex justify-between items-center mb-2'>
                                <div className='text-sm text-gray-500'>
                                  {formatMatchDate(match.date)}
                                </div>
                                <div className='text-sm font-medium'>
                                  {match.scoreA} - {match.scoreB}
                                </div>
                              </div>
                              <div className='grid grid-cols-2 gap-4'>
                                <div>
                                  <h4 className='font-medium mb-2'>
                                    {match.teamA}
                                  </h4>
                                  <ul className='space-y-1'>
                                    {match.playersA?.map((player) => (
                                      <li key={player.id} className='text-sm'>
                                        {player.name}
                                        {match.goals &&
                                          match.goals.filter(
                                            (g) => g.scorerId === player.id
                                          ).length > 0 && (
                                            <span className='ml-2 text-yellow-500'>
                                              {'⚽'.repeat(
                                                match.goals.filter(
                                                  (g) =>
                                                    g.scorerId === player.id
                                                ).length
                                              )}
                                            </span>
                                          )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className='font-medium mb-2'>
                                    {match.teamB}
                                  </h4>
                                  <ul className='space-y-1'>
                                    {match.playersB?.map((player) => (
                                      <li key={player.id} className='text-sm'>
                                        {player.name}
                                        {match.goals &&
                                          match.goals.filter(
                                            (g) => g.scorerId === player.id
                                          ).length > 0 && (
                                            <span className='ml-2 text-yellow-500'>
                                              {'⚽'.repeat(
                                                match.goals.filter(
                                                  (g) =>
                                                    g.scorerId === player.id
                                                ).length
                                              )}
                                            </span>
                                          )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 2 && (
                    <div>
                      <h3 className='text-lg font-medium mb-3'>
                        Tabla de Goleadores
                      </h3>
                      {goleadores.length === 0 ? (
                        <p className='text-gray-500'>
                          No hay goleadores registrados aún.
                        </p>
                      ) : (
                        <div className='overflow-x-auto'>
                          <table className='min-w-full divide-y divide-gray-200'>
                            <thead className='bg-gray-50'>
                              <tr>
                                <th
                                  scope='col'
                                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                >
                                  Jugador
                                </th>
                                <th
                                  scope='col'
                                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                >
                                  Goles
                                </th>
                              </tr>
                            </thead>
                            <tbody className='bg-white divide-y divide-gray-200'>
                              {goleadores.map((player) => (
                                <tr key={player.id}>
                                  <td className='px-6 py-4 whitespace-nowrap'>
                                    <div className='flex items-center'>
                                      {player.avatar ? (
                                        <img
                                          src={player.avatar}
                                          alt={player.name}
                                          className='w-8 h-8 rounded-full mr-2'
                                        />
                                      ) : (
                                        <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2'>
                                          {player.name.substring(0, 1)}
                                        </div>
                                      )}
                                      <div className='text-sm font-medium text-gray-900'>
                                        {player.name}
                                      </div>
                                    </div>
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap'>
                                    <div className='flex items-center'>
                                      <span className='text-sm text-gray-900'>
                                        {player.goals}
                                      </span>
                                      <span className='ml-2 text-yellow-500'>
                                        {Array.from({
                                          length: Math.min(player.goals, 5),
                                        }).map((_, i) => (
                                          <span key={i} className='mx-0.5'>
                                            ⚽
                                          </span>
                                        ))}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 3 && (
                    <div>
                      <h3 className='text-lg font-medium mb-3'>
                        Tabla de MVPs
                      </h3>
                      <p className='text-xs text-gray-500 mb-3'>
                        Jugadores con al menos 3 partidos, ordenados por tasa de
                        victorias.
                      </p>
                      {mvps.length === 0 ? (
                        <p className='text-gray-500'>
                          No hay jugadores con suficientes partidos para
                          calcular MVPs.
                        </p>
                      ) : (
                        <div className='overflow-x-auto'>
                          <table className='min-w-full divide-y divide-gray-200'>
                            <thead className='bg-gray-50'>
                              <tr>
                                <th
                                  scope='col'
                                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                >
                                  Jugador
                                </th>
                                <th
                                  scope='col'
                                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                >
                                  Partidos
                                </th>
                                <th
                                  scope='col'
                                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                >
                                  % Victoria
                                </th>
                              </tr>
                            </thead>
                            <tbody className='bg-white divide-y divide-gray-200'>
                              {mvps.map((player) => (
                                <tr key={player.id}>
                                  <td className='px-6 py-4 whitespace-nowrap'>
                                    <div className='flex items-center'>
                                      {player.avatar ? (
                                        <img
                                          src={player.avatar}
                                          alt={player.name}
                                          className='w-8 h-8 rounded-full mr-2'
                                        />
                                      ) : (
                                        <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2'>
                                          {player.name.substring(0, 1)}
                                        </div>
                                      )}
                                      <div className='text-sm font-medium text-gray-900'>
                                        {player.name}
                                      </div>
                                    </div>
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                                    {player.matchesPlayed}
                                  </td>
                                  <td className='px-6 py-4 whitespace-nowrap'>
                                    <div className='flex items-center'>
                                      <span className='text-sm text-gray-900'>
                                        {player.winRate.toFixed(1)}%
                                      </span>
                                      {player.winRate >= 60 && (
                                        <span className='ml-2 text-yellow-500'>
                                          👑
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 4 && <MembersTab />}

                  {selectedTab === 5 && currentUserIsAdmin && (
                    <div>
                      <h3 className='text-lg font-medium mb-3'>
                        Solicitudes de Membresía
                      </h3>
                      {pendingRequests.length === 0 ? (
                        <p className='text-gray-500'>
                          No hay solicitudes pendientes.
                        </p>
                      ) : (
                        <div className='space-y-4'>
                          {pendingRequests.map((request) => (
                            <div
                              key={request.id}
                              className='flex items-center justify-between bg-gray-50 p-4 rounded-lg'
                            >
                              <div className='flex items-center'>
                                <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2'>
                                  {request.name
                                    ? request.name.substring(0, 1)
                                    : 'U'}
                                </div>
                                <div>
                                  <div className='text-sm font-medium text-gray-900'>
                                    {request.name || 'Sin nombre'}
                                  </div>
                                  <div className='text-sm text-gray-500'>
                                    {request.email || 'Sin email'}
                                  </div>
                                </div>
                              </div>
                              <div className='flex space-x-2'>
                                <button
                                  onClick={() =>
                                    handleMembershipRequest(
                                      request.userId,
                                      'APPROVE'
                                    )
                                  }
                                  className='px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600'
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() =>
                                    handleMembershipRequest(
                                      request.userId,
                                      'REJECT'
                                    )
                                  }
                                  className='px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600'
                                >
                                  Rechazar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
