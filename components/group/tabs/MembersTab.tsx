import { useState, useEffect } from 'react';
import { Avatar } from '@mui/material';
import type { GroupWithRelations, Member } from '../../../types/group';
import type { AuthUser } from '../../../types/auth';
import {
  CheckIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import RoleSelectionModal from '../modals/RoleSelectionModal';
import { PlayerRole } from '../../../lib/teambuilder/types';
import LeaveGroupModal from '../modals/LeaveGroupModal';
import AddGhostPlayerModal from '../modals/AddGhostPlayerModal';
import StarRating from '../../StarRating';
import { updateMemberRating } from '../../../services/groupService';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';
import { useQueryClient } from '@tanstack/react-query';
import { createLogEntry } from '../../../services/logService';
import { LogAction } from '../../../utils/logTypes';
import { isGhostPlayer } from '../../../lib/ghostPlayerUtils';
import Button from '../../Button';

interface MembersTabProps {
  group: GroupWithRelations;
  user: AuthUser | null;
  currentUserIsAdmin: boolean;
  isLoading: boolean;
  handleConfirmAttendance: (
    memberId: string,
    userId: string,
    playerRoles?: PlayerRole[]
  ) => Promise<void>;
  handleDeclineAttendance: (memberId: string, userId: string) => Promise<void>;
  handleLeaveGroup?: () => Promise<void>;
}

interface ActionButtonsProps {
  member: Member;
  isConfirmedForNextMatch: boolean;
  isCurrentUser: boolean | null;
  onOpenRoleModal: (member: Member) => void;
}

// Define sort options
type SortField = 'name' | 'starRating';
type SortDirection = 'asc' | 'desc';

export default function MembersTab({
  group,
  user,
  currentUserIsAdmin,
  isLoading,
  handleConfirmAttendance,
  handleDeclineAttendance,
  handleLeaveGroup,
}: MembersTabProps) {
  // Estado local para mantener el estado de confirmación de cada miembro
  const [membersConfirmationStatus, setMembersConfirmationStatus] = useState<
    Record<string, boolean>
  >({});
  // Estado local para el contador de confirmados
  const [localConfirmedCount, setLocalConfirmedCount] = useState(0);
  // Estado para el botón que está siendo procesado
  const [processingButton, setProcessingButton] = useState<{
    id: string;
    action: 'confirm' | 'decline';
  } | null>(null);
  // Estado para el modal de selección de roles
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Estados para búsqueda y ordenamiento
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Estado para el modal de salir del grupo
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLocalLeaving, setIsLocalLeaving] = useState(false);

  // Estado para el modal de jugador fantasma
  const [showGhostPlayerModal, setShowGhostPlayerModal] = useState(false);
  const [isCreatingGhostPlayer, setIsCreatingGhostPlayer] = useState(false);

  // Get the queryClient instance at the component level
  const queryClient = useQueryClient();

  // Inicializar el estado local con los datos del grupo
  useEffect(() => {
    const initialStatus: Record<string, boolean> = {};
    const confirmedCount =
      group?.nextMatchDetails?.confirmedPlayers?.length || 0;
    setLocalConfirmedCount(confirmedCount);

    group?.members?.forEach((member) => {
      initialStatus[member.userId] = isMemberConfirmedForNextMatch(
        member.userId
      );
    });
    setMembersConfirmationStatus(initialStatus);
  }, [group?.members, group?.nextMatchDetails?.confirmedPlayers]);

  // Determinar si se alcanzó el límite de jugadores requeridos
  const requiredPlayers = group?.requiredPlayers || 10;
  const isMaxPlayersReached = localConfirmedCount >= requiredPlayers;

  // Verificar si un miembro está confirmado para el próximo partido
  const isMemberConfirmedForNextMatch = (userId: string) => {
    if (!group?.nextMatchDetails?.confirmedPlayers) {
      return false;
    }

    return group.nextMatchDetails.confirmedPlayers.some(
      (player) => player.id === userId
    );
  };

  // Función para abrir el modal de selección de roles
  const handleOpenRoleModal = (member: Member) => {
    if (isMaxPlayersReached && !isMemberConfirmedForNextMatch(member.userId))
      return;
    setSelectedMember(member);
    setIsRoleModalOpen(true);
  };

  // Función para manejar la confirmación de salir del grupo
  const handleLeaveConfirm = async () => {
    if (handleLeaveGroup) {
      try {
        setIsLocalLeaving(true);
        await handleLeaveGroup();
        setShowLeaveModal(false);
      } catch (error) {
        // Error handling is done in the parent component
        setShowLeaveModal(false);
      } finally {
        setIsLocalLeaving(false);
      }
    }
  };

  // Función para manejar la confirmación después de seleccionar roles
  const handleConfirmWithRoles = async (roles: PlayerRole[]) => {
    if (!selectedMember) return;

    setProcessingButton({ id: selectedMember.id, action: 'confirm' });
    try {
      // Pasar los roles seleccionados a la función de confirmación
      await handleConfirmAttendance(
        selectedMember.id,
        selectedMember.userId,
        roles
      );
      setMembersConfirmationStatus((prev) => ({
        ...prev,
        [selectedMember.userId]: true,
      }));
      setLocalConfirmedCount((prev) => prev + 1);

      // NO registrar el log aquí ya que la API /api/attendances ya lo hace automáticamente
      // Esto evita logs duplicados
    } finally {
      setProcessingButton(null);
      setSelectedMember(null);
    }
  };

  // Función para actualizar el star rating de un miembro
  const handleUpdateRating = async (userId: string, rating: number) => {
    if (!currentUserIsAdmin || !group.id || !user) return;

    try {
      // Encontrar el miembro para obtener su star rating actual y nombre
      const member = group.members.find((m) => m.userId === userId);
      if (!member) return;

      const previousRating = member.starRating || 0;
      const targetUserName = member.name || 'Miembro';

      // Añadir mensaje de carga
      showSuccessToast('Actualizando nivel de habilidad...');

      // Crear una copia del miembro con el rating actualizado
      const updatedMember = {
        ...member,
        starRating: rating,
      };

      // Crear una copia del grupo con los miembros actualizados
      const updatedMembers = group.members.map((m) =>
        m.userId === userId ? updatedMember : m
      );

      const updatedGroup = {
        ...group,
        members: updatedMembers,
      };

      // Actualizar el cache optimistamente (antes de la llamada a la API)
      queryClient.setQueryData(['group', group.id], updatedGroup);

      // Llamada a la API para persistir el cambio
      const result = await updateMemberRating(group.id, userId, rating);

      if (result.success) {
        showSuccessToast('Nivel de habilidad actualizado correctamente');

        // Registrar la acción en los logs
        await createLogEntry({
          groupId: group.id,
          action: LogAction.STAR_RATING_UPDATED,
          performedBy: user.id,
          performedByName: user.name || user.email || 'Admin',
          targetUserId: userId,
          targetUserName: targetUserName,
          details: {
            previousRating,
            newRating: rating,
            message: `cambió el nivel de habilidad de **${targetUserName}** de ${previousRating} a ${rating} estrellas`,
          },
          timestamp: new Date().toISOString(),
        });

        // Si la API devolvió el miembro actualizado, actualizar la caché con estos datos
        if (result.updatedMember) {
          // Asegurarse de preservar la estructura del miembro
          const serverUpdatedMember = {
            ...member,
            ...result.updatedMember,
            starRating: rating, // Forzar el rating por si acaso
          };

          const serverUpdatedMembers = group.members.map((m) =>
            m.userId === userId ? serverUpdatedMember : m
          );

          // Actualizar el cache con los datos del servidor
          queryClient.setQueryData(['group', group.id], {
            ...group,
            members: serverUpdatedMembers,
          });
        }

        // Forzar refresco de los datos para asegurar consistencia
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['group', group.id] });
        }, 100);
      } else {
        showErrorToast('Error al actualizar nivel de habilidad');
        // Revertir el cambio optimista
        queryClient.setQueryData(['group', group.id], group);
      }
    } catch (error) {
      console.error('Error al actualizar nivel de habilidad:', error);

      // Mostrar mensaje de error más detallado
      if (error instanceof Error) {
        showErrorToast(`Error: ${error.message}`);
      } else {
        showErrorToast('Error al actualizar nivel de habilidad');
      }

      // Revertir el cambio optimista
      queryClient.setQueryData(['group', group.id], group);
    }
  };

  // Función para ordenar miembros
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya estamos ordenando por este campo, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es un nuevo campo, establecer el campo y la dirección predeterminada
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Obtener y filtrar los miembros
  const getFilteredAndSortedMembers = () => {
    if (!group?.members) return [];

    // Primero filtrar por término de búsqueda
    let filteredMembers = searchTerm
      ? group.members.filter((member) =>
          member.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [...group.members];

    // Luego ordenar
    return filteredMembers.sort((a, b) => {
      if (sortField === 'name') {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return sortDirection === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      } else if (sortField === 'starRating') {
        const ratingA = a.starRating || 0;
        const ratingB = b.starRating || 0;
        return sortDirection === 'asc' ? ratingA - ratingB : ratingB - ratingA;
      }
      return 0;
    });
  };

  // Obtener miembros filtrados y ordenados
  const filteredAndSortedMembers = getFilteredAndSortedMembers();

  // Componente para los botones de acciones
  const ActionButtons: React.FC<ActionButtonsProps> = ({
    member,
    isConfirmedForNextMatch,
    isCurrentUser,
    onOpenRoleModal,
  }) => {
    const handleDecline = async () => {
      setProcessingButton({ id: member.id, action: 'decline' });
      try {
        await handleDeclineAttendance(member.id, member.userId);
        setMembersConfirmationStatus((prev) => ({
          ...prev,
          [member.userId]: false,
        }));
        setLocalConfirmedCount((prev) => prev - 1);
      } finally {
        setProcessingButton(null);
      }
    };

    if (isCurrentUser) {
      // No mostrar nada para el usuario actual (eliminar mensaje)
      return null;
    }

    if (!currentUserIsAdmin) {
      return null;
    }

    const isConfirmed =
      membersConfirmationStatus[member.userId] ?? isConfirmedForNextMatch;
    const isProcessing = processingButton?.id === member.id;

    // Verificar si es jugador fantasma
    const ghostPlayer = isGhostPlayer({
      email: member.email,
      image: member.avatar,
    });

    return (
      <div className='flex gap-2 mt-2 md:mt-0 flex-wrap justify-end'>
        {/* Botones normales para todos los usuarios (incluidos fantasma) */}
        {!isConfirmed && (
          <button
            onClick={() => onOpenRoleModal(member)}
            className='text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1.5 md:py-1 rounded-md text-xs md:text-sm flex items-center min-w-[90px] justify-center'
            disabled={
              isLoading ||
              (isMaxPlayersReached && !isConfirmed) ||
              !group?.nextMatchId ||
              processingButton !== null
            }
          >
            {isProcessing && processingButton?.action === 'confirm' ? (
              <span className='flex items-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-green-700'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                <span className='whitespace-nowrap'>Procesando...</span>
              </span>
            ) : !group?.nextMatchId ? (
              'Sin partido'
            ) : isMaxPlayersReached ? (
              'Cupo completo'
            ) : (
              <>
                <CheckIcon className='h-4 w-4 mr-1' />
                Confirmar
              </>
            )}
          </button>
        )}
        {isConfirmed && (
          <button
            onClick={handleDecline}
            className='text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1.5 md:py-1 rounded-md text-xs md:text-sm flex items-center min-w-[90px] justify-center'
            disabled={
              isLoading || !group?.nextMatchId || processingButton !== null
            }
          >
            {isProcessing && processingButton?.action === 'decline' ? (
              <span className='flex items-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-red-700'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                <span className='whitespace-nowrap'>Procesando...</span>
              </span>
            ) : (
              <>
                <XMarkIcon className='h-4 w-4 mr-1' />
                Cancelar
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  // Función para renderizar el ícono de ordenamiento
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUpDownIcon className='h-4 w-4' />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className='h-4 w-4' />
    ) : (
      <ChevronDownIcon className='h-4 w-4' />
    );
  };

  // Función para crear jugador fantasma
  const handleCreateGhostPlayer = async (name: string, age: number) => {
    if (!group?.id || !user?.id) return;

    setIsCreatingGhostPlayer(true);
    try {
      const response = await fetch(`/api/groups/${group.id}/ghost-players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, age }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear jugador fantasma');
      }

      const result = await response.json();

      showSuccessToast('Jugador fantasma creado exitosamente');

      // Invalidar y refrescar la consulta del grupo para actualizar la lista de miembros
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      queryClient.invalidateQueries({
        queryKey: ['group', 'members', group.id],
      });

      // Log de la acción
      if (user) {
        await createLogEntry({
          groupId: group.id,
          action: LogAction.GHOST_PLAYER_CREATED,
          performedBy: user.id,
          performedByName: user.name || 'Usuario',
          targetUserId: result.ghostPlayer.id,
          targetUserName: result.ghostPlayer.name,
          details: {
            ghostPlayerName: result.ghostPlayer.name,
            ghostPlayerId: result.ghostPlayer.id,
            age: age,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error creating ghost player:', error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : 'Error al crear jugador fantasma'
      );
      throw error; // Re-throw para que el modal maneje el error
    } finally {
      setIsCreatingGhostPlayer(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2'>
        <h3 className='text-lg font-semibold'>
          Miembros ({localConfirmedCount} confirmados para el próximo partido)
        </h3>
        {currentUserIsAdmin && (
          <Button
            onClick={() => setShowGhostPlayerModal(true)}
            variant='primary'
            size='sm'
            disabled={isCreatingGhostPlayer}
            className='flex items-center shadow-green'
          >
            <UserPlusIcon className='h-4 w-4 mr-2' />
            {isCreatingGhostPlayer ? 'Creando...' : 'Agregar Miembro Fantasma'}
          </Button>
        )}
      </div>

      {/* Buscador */}
      <div className='relative w-full md:w-64 mb-4'>
        <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
          <MagnifyingGlassIcon className='h-5 w-5 text-primary-400' />
        </div>
        <input
          type='text'
          className='block w-full pl-10 pr-3 py-2 border border-primary-200 rounded-lg leading-5 bg-white placeholder-primary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-200'
          placeholder='Buscar miembro...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isMaxPlayersReached && (
        <div className='bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-4 shadow-sm'>
          <div className='flex items-center'>
            <div className='w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3'>
              <span className='text-sm' role='img' aria-label='warning'>
                ⚠️
              </span>
            </div>
            <p className='text-sm text-yellow-800 font-medium'>
              Se ha alcanzado el cupo máximo de {requiredPlayers} jugadores para
              este partido.
            </p>
          </div>
        </div>
      )}

      {!group?.nextMatchId && (
        <div className='bg-gradient-green-light border border-primary-200 rounded-xl p-4 mb-4 shadow-green-sm'>
          <div className='flex items-center'>
            <div className='w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3'>
              <span className='text-sm' role='img' aria-label='info'>
                ℹ️
              </span>
            </div>
            <p className='text-sm text-primary-700 font-medium'>
              No hay un próximo partido programado para este grupo.
            </p>
          </div>
        </div>
      )}

      {/* Vista de tabla para pantallas medianas y grandes */}
      <div className='hidden md:block'>
        <div className='overflow-x-auto rounded-2xl shadow-green-lg border border-primary-200'>
          <table className='min-w-full divide-y divide-primary-200'>
            <thead className='bg-gradient-green-soft'>
              <tr>
                <th
                  className='px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider cursor-pointer hover:bg-primary-75 transition-colors duration-200'
                  onClick={() => handleSort('name')}
                >
                  <div className='flex items-center'>
                    Nombre
                    <span className='ml-1'>{renderSortIcon('name')}</span>
                  </div>
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider'>
                  Estado para el próximo partido
                </th>
                <th
                  className={`px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider ${
                    currentUserIsAdmin
                      ? 'cursor-pointer hover:bg-primary-75 transition-colors duration-200'
                      : ''
                  }`}
                  onClick={
                    currentUserIsAdmin
                      ? () => handleSort('starRating')
                      : undefined
                  }
                >
                  <div className='flex items-center'>
                    Nivel de habilidad
                    {currentUserIsAdmin && (
                      <span className='ml-1'>
                        {renderSortIcon('starRating')}
                      </span>
                    )}
                  </div>
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider'>
                  {currentUserIsAdmin ? 'Acciones' : ''}
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-primary-100'>
              {filteredAndSortedMembers.map((member: Member) => {
                // Determinar el estado para el próximo partido específicamente
                const isConfirmedForNextMatch =
                  membersConfirmationStatus[member.userId] ??
                  isMemberConfirmedForNextMatch(member.userId);

                // Verificar si el usuario actual es el dueño de esta fila
                const isCurrentUser = user && member.userId === user.id;

                return (
                  <tr
                    key={member.id}
                    className='hover:bg-primary-25 transition-colors duration-200'
                  >
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-10 w-10'>
                          <Avatar
                            alt={member.name || 'Usuario sin nombre'}
                            src={member.avatar || ''}
                            className='h-10 w-10 rounded-full border-2 border-primary-100'
                          />
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-semibold text-primary-900'>
                            {member.name || 'Usuario sin nombre'}
                            {member.role === 'ADMIN' && (
                              <span className='ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-green-soft text-primary-700 border border-primary-200'>
                                Admin
                              </span>
                            )}
                          </div>
                          {currentUserIsAdmin &&
                            member.email &&
                            !isGhostPlayer({
                              email: member.email,
                              image: member.avatar,
                            }) && (
                              <div className='text-sm text-primary-600'>
                                {member.email}
                              </div>
                            )}
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          isConfirmedForNextMatch
                            ? 'bg-gradient-green-light text-primary-800 border border-primary-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {isConfirmedForNextMatch ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <StarRating
                        key={`desktop-rating-${member.userId}-${
                          member.starRating
                        }-${Date.now()}`}
                        rating={member.starRating || 3}
                        readOnly={!currentUserIsAdmin}
                        onRatingChange={
                          currentUserIsAdmin
                            ? (rating) =>
                                handleUpdateRating(member.userId, rating)
                            : undefined
                        }
                        size='sm'
                      />
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                      <ActionButtons
                        member={member}
                        isConfirmedForNextMatch={isConfirmedForNextMatch}
                        isCurrentUser={isCurrentUser}
                        onOpenRoleModal={handleOpenRoleModal}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista móvil mejorada */}
      <div className='md:hidden space-y-3'>
        {/* Sección de estadísticas móvil */}
        <div className='sticky top-0 z-[1] bg-white pb-2'>
          <div className='flex justify-between items-center mb-2 bg-gradient-green-soft p-3 rounded-xl shadow-green-sm border border-primary-200'>
            <span className='text-sm font-semibold text-primary-700'>
              Total: {filteredAndSortedMembers.length || 0}
            </span>
            <span className='text-sm font-semibold text-primary-800'>
              {localConfirmedCount} confirmados
            </span>
          </div>

          {/* Opciones de orden en móvil */}
          <div className='flex gap-2 mb-2'>
            <button
              onClick={() => handleSort('name')}
              className={`flex items-center text-xs px-3 py-1.5 rounded-lg transition-colors duration-200 ${
                sortField === 'name'
                  ? 'bg-gradient-green-light text-primary-800 border border-primary-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-primary-50'
              }`}
            >
              Nombre{' '}
              {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('starRating')}
              className={`flex items-center text-xs px-3 py-1.5 rounded-lg transition-colors duration-200 ${
                sortField === 'starRating'
                  ? 'bg-gradient-green-light text-primary-800 border border-primary-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-primary-50'
              }`}
            >
              Habilidad{' '}
              {sortField === 'starRating' &&
                (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {filteredAndSortedMembers.map((member: Member) => {
          const isConfirmedForNextMatch =
            membersConfirmationStatus[member.userId] ??
            isMemberConfirmedForNextMatch(member.userId);
          const isCurrentUser = user && member.userId === user.id;

          return (
            <div
              key={member.id}
              className='bg-white shadow-green-sm rounded-xl p-4 flex flex-col border border-primary-200 hover:shadow-green-md transition-all duration-200'
            >
              <div className='flex items-center justify-between'>
                <div className='flex items-center flex-1'>
                  <Avatar
                    alt={member.name || 'Usuario sin nombre'}
                    src={member.avatar || ''}
                    className='h-10 w-10 rounded-full'
                  />
                  <div className='ml-3 min-w-0 flex-1'>
                    <div className='flex items-center flex-wrap gap-1'>
                      <span className='text-sm font-semibold text-primary-900 truncate'>
                        {member.name || 'Usuario sin nombre'}
                      </span>
                      {member.role === 'ADMIN' && (
                        <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-green-soft text-primary-700 border border-primary-200'>
                          Admin
                        </span>
                      )}
                    </div>
                    {currentUserIsAdmin &&
                      member.email &&
                      !isGhostPlayer({
                        email: member.email,
                        image: member.avatar,
                      }) && (
                        <div className='text-sm text-primary-600 mt-1'>
                          {member.email}
                        </div>
                      )}
                    <div className='mt-1'>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isConfirmedForNextMatch
                            ? 'bg-gradient-green-light text-primary-800 border border-primary-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {isConfirmedForNextMatch ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className='mt-2'>
                      <div className='text-xs text-gray-500 mb-1'>
                        Nivel de habilidad:
                      </div>
                      <StarRating
                        key={`mobile-rating-${member.userId}-${
                          member.starRating
                        }-${Date.now()}`}
                        rating={member.starRating || 3}
                        readOnly={!currentUserIsAdmin}
                        onRatingChange={
                          currentUserIsAdmin
                            ? (rating) =>
                                handleUpdateRating(member.userId, rating)
                            : undefined
                        }
                        size='sm'
                      />
                    </div>
                  </div>
                </div>
              </div>
              {(currentUserIsAdmin || isCurrentUser) && (
                <div className='mt-2 flex justify-end'>
                  <ActionButtons
                    member={member}
                    isConfirmedForNextMatch={isConfirmedForNextMatch}
                    isCurrentUser={isCurrentUser}
                    onOpenRoleModal={handleOpenRoleModal}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón de salir del grupo */}
      {handleLeaveGroup && user && (
        <div className='pt-4 border-t border-gray-200 mt-6'>
          <button
            onClick={() => setShowLeaveModal(true)}
            className='w-full flex items-center justify-center px-4 py-3 border border-red-600 rounded-md shadow-sm text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 transition-all duration-200 md:py-2 md:w-auto'
          >
            <ArrowRightOnRectangleIcon className='h-5 w-5 mr-2' />
            Salir del grupo
          </button>
        </div>
      )}

      {/* Modal de selección de roles */}
      {isRoleModalOpen && selectedMember && (
        <RoleSelectionModal
          isOpen={isRoleModalOpen}
          onClose={() => {
            setIsRoleModalOpen(false);
            setSelectedMember(null);
          }}
          onConfirm={handleConfirmWithRoles}
          playerName={selectedMember.name || 'Jugador'}
          initialRoles={[]}
        />
      )}

      {/* Modal de salir del grupo */}
      <LeaveGroupModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveConfirm}
        groupName={group.name}
        isLeaving={isLocalLeaving}
      />

      {/* Modal de jugador fantasma */}
      <AddGhostPlayerModal
        isOpen={showGhostPlayerModal}
        onClose={() => setShowGhostPlayerModal(false)}
        onConfirm={handleCreateGhostPlayer}
        isLoading={isCreatingGhostPlayer}
      />
    </div>
  );
}
