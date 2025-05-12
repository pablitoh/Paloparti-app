import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ParticipantStatus } from '../../types/group';

// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

interface AttendanceConfirmationProps {
  userAttendanceStatus: ParticipantStatus | undefined;
  handleGroupAttendance: (
    status: ParticipantStatus,
    playerRoles?: string[]
  ) => Promise<void>;
  disabled?: boolean;
  confirmedCount?: number;
  requiredPlayers?: number;
  matchId?: string;
  initialPlayerRoles?: string[];
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
  const [selectedRoles, setSelectedRoles] =
    useState<string[]>(initialPlayerRoles);

  // Update local state when props change or match ID changes
  useEffect(() => {
    if (matchId) {
      setLocalAttendanceStatus(userAttendanceStatus);

      // Primero intentar usar los roles iniciales pasados como prop
      if (initialPlayerRoles && initialPlayerRoles.length > 0) {
        console.log('Cargando roles iniciales:', initialPlayerRoles);
        setSelectedRoles(initialPlayerRoles);
      } else {
        // Si no hay roles iniciales, intentar recuperar del localStorage
        const savedRoles = localStorage.getItem('paloparti_selected_roles');
        if (savedRoles) {
          try {
            const parsedRoles = JSON.parse(savedRoles);
            if (Array.isArray(parsedRoles) && parsedRoles.length > 0) {
              console.log('Cargando roles desde localStorage:', parsedRoles);
              setSelectedRoles(parsedRoles);
            }
          } catch (e) {
            console.error('Error parsing saved roles:', e);
          }
        }
      }
    }
  }, [userAttendanceStatus, matchId, initialPlayerRoles]);

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

  // Toggle a role selection
  const toggleRole = (role: string) => {
    const newSelectedRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];

    setSelectedRoles(newSelectedRoles);
  };

  // Manejar la confirmación de asistencia
  const handleConfirmAttendance = async () => {
    try {
      setIsLoading(true);

      // Asegurar que haya al menos un rol seleccionado, usando Comodín como predeterminado
      const rolesParaEnviar =
        selectedRoles.length > 0 ? [...selectedRoles] : [PLAYER_ROLES.WILDCARD];

      // Almacenar los roles en localStorage para que el hook los pueda recuperar
      localStorage.setItem(
        'paloparti_selected_roles',
        JSON.stringify(rolesParaEnviar)
      );

      // Llamar a handleGroupAttendance y asegurarse de que el estado se actualice
      await handleGroupAttendance('CONFIRMED', rolesParaEnviar);

      // Actualizar estado local para reflejar la confirmación
      setLocalAttendanceStatus('CONFIRMED');

      // Si la respuesta fue exitosa, asegurarnos de que se muestran los roles seleccionados
      setSelectedRoles(rolesParaEnviar);
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

      // No enviamos roles al declinar, pero guardamos los seleccionados en localStorage
      // para mantenerlos si el usuario cambia de opinión
      localStorage.setItem(
        'paloparti_selected_roles',
        JSON.stringify(selectedRoles)
      );

      await handleGroupAttendance('DECLINED', []);
      setLocalAttendanceStatus('DECLINED');
      // No resetear selectedRoles para mantener la selección del usuario
    } catch (error) {
      console.error('Error declinando asistencia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className=''>
      {allSpotsFilled && (
        <div className='mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start'>
          <ExclamationTriangleIcon className='h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5' />
          <p className='text-sm text-amber-800'>
            El partido ya tiene todos los jugadores confirmados. Puedes indicar
            que no asistirás o esperar a que se libere un lugar.
          </p>
        </div>
      )}

      {/* Selector de roles cuando no está confirmado aún o ya está confirmado */}
      <div className='mt-4 mb-4'>
        <p className='text-sm font-medium text-gray-700 mb-2'>
          Selecciona tus posiciones preferidas:
        </p>
        <div className='flex flex-wrap gap-2 mb-3'>
          {Object.values(PLAYER_ROLES).map((role) => (
            <button
              key={role}
              onClick={() => toggleRole(role)}
              className={`px-3 py-1 text-sm rounded-md transition ${
                selectedRoles.includes(role)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        <div className='text-xs text-gray-600 mb-4'>
          <strong>Roles seleccionados:</strong>{' '}
          {selectedRoles.length > 0 ? selectedRoles.join(', ') : 'Ninguno'}
        </div>
      </div>

      {/* Botones de asistencia */}
      <div className='flex gap-2'>
        <button
          onClick={handleConfirmAttendance}
          disabled={
            disabled ||
            isLoading ||
            (allSpotsFilled && !isConfirmed) ||
            selectedRoles.length === 0 // Deshabilitar si no hay roles seleccionados
          }
          className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center text-sm font-medium ${
            isConfirmed
              ? 'bg-green-500 text-white'
              : selectedRoles.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' // Estilo deshabilitado para sin roles
              : allSpotsFilled && !isConfirmed
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          <CheckCircleIcon className='h-4 w-4 mr-1' />
          <span>{isConfirmed ? 'Asistencia confirmada' : 'Asistiré'}</span>
        </button>

        <button
          onClick={handleDeclineAttendance}
          disabled={disabled || isLoading}
          className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center text-sm font-medium ${
            isDeclined
              ? 'bg-red-500 text-white'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          <XCircleIcon className='h-4 w-4 mr-1' />
          <span>{isDeclined ? 'No asistiré' : 'No puedo ir'}</span>
        </button>
      </div>

      {selectedRoles.length === 0 && !isDeclined && (
        <div className='mt-2 text-xs text-red-500'>
          Selecciona al menos una posición para confirmar asistencia
        </div>
      )}
    </div>
  );
};

export default AttendanceConfirmation;
