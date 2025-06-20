import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ParticipantStatus } from '../../types/group';
import { POSITION_CONFIG } from '../../lib/teambuilder/constants';

// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

// Nueva estructura para posiciones con prioridad
export interface PlayerRole {
  role: string;
  priority: number;
}

interface AttendanceConfirmationProps {
  userAttendanceStatus: ParticipantStatus | undefined;
  handleGroupAttendance: (
    status: ParticipantStatus,
    playerRoles?: PlayerRole[]
  ) => Promise<void>;
  disabled?: boolean;
  confirmedCount?: number;
  requiredPlayers?: number;
  matchId?: string;
  initialPlayerRoles?: string[] | PlayerRole[];
}

const AttendanceConfirmation: React.FC<AttendanceConfirmationProps> = ({
  userAttendanceStatus,
  handleGroupAttendance,
  disabled = false,
  confirmedCount = 0,
  requiredPlayers = 0,
  matchId,
  initialPlayerRoles = [],
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localAttendanceStatus, setLocalAttendanceStatus] = useState<
    ParticipantStatus | undefined
  >(userAttendanceStatus);
  const [selectedRoles, setSelectedRoles] = useState<PlayerRole[]>([]);

  // Función para convertir formato antiguo a nuevo
  const convertLegacyRoles = useCallback(
    (roles: string[] | PlayerRole[]): PlayerRole[] => {
      if (!roles || roles.length === 0) return [];

      // Si ya está en formato nuevo
      if (
        Array.isArray(roles) &&
        roles.length > 0 &&
        typeof roles[0] === 'object' &&
        'priority' in roles[0]
      ) {
        return roles as PlayerRole[];
      }

      // Convertir formato antiguo - mantener orden original como prioridad
      const stringRoles = roles as string[];
      return stringRoles.map((role, index) => ({
        role,
        priority: index + 1,
      }));
    },
    []
  );

  // Update local state when props change or match ID changes
  useEffect(() => {
    if (matchId) {
      setLocalAttendanceStatus(userAttendanceStatus);

      // Primero intentar usar los roles iniciales pasados como prop
      if (initialPlayerRoles && initialPlayerRoles.length > 0) {
        console.log('Cargando roles iniciales:', initialPlayerRoles);
        const convertedRoles = convertLegacyRoles(initialPlayerRoles);
        setSelectedRoles(convertedRoles);
      } else {
        // Si no hay roles iniciales, intentar recuperar del localStorage
        const savedRoles = localStorage.getItem('paloparti_selected_roles');
        if (savedRoles) {
          try {
            const parsedRoles = JSON.parse(savedRoles);
            const convertedRoles = convertLegacyRoles(parsedRoles);
            if (convertedRoles.length > 0) {
              console.log('Cargando roles desde localStorage:', convertedRoles);
              setSelectedRoles(convertedRoles);
            }
          } catch (e) {
            console.error('Error parsing saved roles:', e);
          }
        }
      }
    }
  }, [userAttendanceStatus, matchId, initialPlayerRoles, convertLegacyRoles]);

  // Cleanup localStorage when component unmounts
  useEffect(() => {
    return () => {
      // Limpiar localStorage al desmontar el componente para evitar datos obsoletos
      localStorage.removeItem('paloparti_selected_roles');
    };
  }, []);

  // Normalized status check function to handle both uppercase and lowercase variants
  const isStatus = (
    status: string,
    checkStatus: ParticipantStatus
  ): boolean => {
    return status?.toUpperCase() === checkStatus.toUpperCase();
  };

  const isConfirmed =
    localAttendanceStatus && isStatus(localAttendanceStatus, 'CONFIRMED');
  const isDeclined =
    localAttendanceStatus && isStatus(localAttendanceStatus, 'DECLINED');

  // Check if all spots are filled (excluding the current user if they're already confirmed)
  const allSpotsFilled =
    requiredPlayers > 0 && confirmedCount >= requiredPlayers && !isConfirmed;

  // Nueva lógica para manejar clicks en roles
  const handleRoleClick = (role: string) => {
    if (isConfirmed) return;

    const currentRoleIndex = selectedRoles.findIndex((r) => r.role === role);

    if (currentRoleIndex === -1) {
      // Rol no seleccionado - agregarlo con la siguiente prioridad disponible
      if (selectedRoles.length < POSITION_CONFIG.MAX_POSITIONS) {
        const nextPriority = selectedRoles.length + 1;
        setSelectedRoles((prev) => [...prev, { role, priority: nextPriority }]);
      }
    } else {
      // Rol ya seleccionado - removerlo y reajustar prioridades
      const newRoles = selectedRoles.filter((r) => r.role !== role);
      // Reajustar prioridades para que sean consecutivas
      const adjustedRoles = newRoles.map((r, index) => ({
        ...r,
        priority: index + 1,
      }));
      setSelectedRoles(adjustedRoles);
    }
  };

  // Obtener la prioridad de un rol
  const getRolePriority = (role: string): number | undefined => {
    const roleData = selectedRoles.find((r) => r.role === role);
    return roleData?.priority;
  };

  // Verificar si un rol está seleccionado
  const isRoleSelected = (role: string): boolean => {
    return selectedRoles.some((r) => r.role === role);
  };

  // Manejar la confirmación de asistencia
  const handleConfirmAttendance = async () => {
    if (selectedRoles.length < POSITION_CONFIG.MIN_POSITIONS) {
      return;
    }
    try {
      setIsLoading(true);

      // Almacenar los roles en localStorage para que el hook los pueda recuperar
      localStorage.setItem(
        'paloparti_selected_roles',
        JSON.stringify(selectedRoles)
      );

      // Llamar a handleGroupAttendance con el nuevo formato
      await handleGroupAttendance('CONFIRMED', selectedRoles);

      // Actualizar estado local para reflejar la confirmación
      setLocalAttendanceStatus('CONFIRMED');
    } catch (error) {
      console.error('Error confirmando asistencia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar el rechazo de asistencia
  const handleDeclineAttendance = async () => {
    try {
      setIsLoading(true);

      // Guardar los roles seleccionados para mantenerlos si cambia de opinión
      localStorage.setItem(
        'paloparti_selected_roles',
        JSON.stringify(selectedRoles)
      );

      await handleGroupAttendance('DECLINED', []);
      setLocalAttendanceStatus('DECLINED');
    } catch (error) {
      console.error('Error declinando asistencia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='w-full'>
      {allSpotsFilled && (
        <div className='mb-2 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start'>
          <ExclamationTriangleIcon className='h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5' />
          <p className='text-sm text-amber-800'>
            El partido ya tiene todos los jugadores confirmados. Puedes indicar
            que no asistirás o esperar a que se libere un lugar.
          </p>
        </div>
      )}

      {/* Selector de roles con prioridades */}
      <div className='mt-2 mb-4'>
        <p className='text-xs text-gray-600 mb-1.5'>
          Selecciona {POSITION_CONFIG.MIN_POSITIONS} posiciones por orden de
          prioridad
        </p>
        <div className='grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5'>
          {Object.entries(PLAYER_ROLES).map(
            ([key, role]) =>
              key !== 'WILDCARD' && (
                <button
                  key={role}
                  onClick={() => !isConfirmed && handleRoleClick(role)}
                  disabled={isConfirmed}
                  className={`px-2 py-1.5 text-sm rounded-md transition flex items-center justify-center relative ${
                    isConfirmed
                      ? isRoleSelected(role)
                        ? 'bg-blue-300 text-white border-2 border-blue-400 cursor-not-allowed opacity-75'
                        : 'bg-gray-200 text-gray-500 border-2 border-transparent cursor-not-allowed opacity-75'
                      : isRoleSelected(role)
                      ? 'bg-blue-500 text-white border-2 border-blue-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {/* Mostrar número de prioridad */}
                  {isRoleSelected(role) && (
                    <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center'>
                      {getRolePriority(role)}
                    </span>
                  )}
                  {key === 'GOALKEEPER' && '🧤'}
                  {key === 'DEFENDER' && '🛡️'}
                  {key === 'MIDFIELDER' && '⚽'}
                  {key === 'FORWARD' && '👟'}
                  <span className='ml-1.5'>{role}</span>
                </button>
              )
          )}
        </div>
      </div>

      {/* Botón de asistencia */}
      <div className='mt-4'>
        <button
          onClick={
            isConfirmed ? handleDeclineAttendance : handleConfirmAttendance
          }
          disabled={
            disabled ||
            isLoading ||
            (allSpotsFilled && !isConfirmed) ||
            (!isConfirmed &&
              selectedRoles.length < POSITION_CONFIG.MIN_POSITIONS)
          }
          className={`w-full py-2 px-3 rounded-lg flex items-center justify-center text-base font-medium transition-all ${
            isConfirmed
              ? 'bg-red-500 text-white hover:bg-red-600'
              : selectedRoles.length < POSITION_CONFIG.MIN_POSITIONS
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : allSpotsFilled && !isConfirmed
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isConfirmed ? (
            <>
              <XCircleIcon className='h-5 w-5 mr-2' />
              <span>Cancelar asistencia</span>
            </>
          ) : (
            <>
              <CheckCircleIcon className='h-5 w-5 mr-2' />
              <span>Asistiré</span>
            </>
          )}
        </button>

        {selectedRoles.length < POSITION_CONFIG.MIN_POSITIONS &&
          !isConfirmed && (
            <div className='mt-1 text-xs text-red-500'>
              Selecciona al menos <b>{POSITION_CONFIG.MIN_POSITIONS}</b>{' '}
              posiciones para confirmar asistencia
            </div>
          )}
      </div>
    </div>
  );
};

export default AttendanceConfirmation;
