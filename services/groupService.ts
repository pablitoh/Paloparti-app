import { toast } from 'react-hot-toast';

/**
 * Tipos para el servicio de grupos
 */
export type ParticipantStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'DECLINED'
  | 'confirmed'
  | 'pending'
  | 'declined';

export interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

/**
 * Actualiza la asistencia de un usuario a un partido como administrador
 */
export const updateAttendanceAsAdmin = async (
  userId: string,
  matchId: string,
  status: ParticipantStatus,
  groupId?: string
): Promise<{ success: boolean; groupId?: string }> => {
  console.log(
    `Updating attendance for user ${userId} to ${status} for match ${matchId}`
  );

  // Add additional debug information
  console.log(
    'Admin attendance request URL:',
    `/api/matches/${matchId}/attendance/${userId}`
  );
  console.log('Admin attendance request body:', JSON.stringify({ status }));

  const response = await fetch(`/api/matches/${matchId}/attendance/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  // Log response status
  console.log(
    `Admin attendance response status: ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    // Try to parse the error as JSON, but handle non-JSON responses safely
    try {
      const errorData = await response.json();
      console.error('API error response:', errorData);

      // Manejar casos de error específicos
      if (response.status === 404) {
        if (errorData.error === 'Match not found') {
          console.error(`Match not found with ID: ${matchId}`);
          throw new Error(
            'Partido no encontrado. Puede que haya sido eliminado o no esté correctamente configurado.'
          );
        } else if (
          errorData.error === 'Target user is not a member of this group'
        ) {
          throw new Error('El usuario no es miembro de este grupo.');
        } else {
          throw new Error(
            `Error 404: ${errorData.error || 'Recurso no encontrado'}`
          );
        }
      } else if (response.status === 403) {
        throw new Error('No tienes permisos para realizar esta acción.');
      } else {
        throw new Error(
          errorData.message ||
            errorData.error ||
            'Error al actualizar asistencia'
        );
      }
    } catch (parseError) {
      // If we can't parse the response as JSON, return a generic error
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error de servidor'
        }`
      );
    }
  }

  const data = await response.json();
  // Use provided groupId or get it from the response
  return { success: true, groupId: groupId || data.groupId };
};

/**
 * Actualiza la asistencia del usuario actual a un partido
 */
export const updateUserAttendance = async (
  matchId: string,
  status: ParticipantStatus
): Promise<{ success: boolean; groupId?: string }> => {
  const response = await fetch(`/api/matches/${matchId}/attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
    }),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar asistencia');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error de servidor'
        }`
      );
    }
  }

  const data = await response.json();
  return { success: true, groupId: data.groupId };
};

/**
 * Gestiona una solicitud de membresía (aprobar o rechazar)
 */
export const manageMembershipRequest = async (
  groupId: string,
  userId: string,
  action: 'APPROVE' | 'REJECT'
): Promise<Response> => {
  const response = await fetch(`/api/groups/${groupId}/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, action }),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(
        error.message ||
          `Error al ${
            action === 'APPROVE' ? 'aprobar' : 'rechazar'
          } la solicitud`
      );
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText ||
          `Error al ${
            action === 'APPROVE' ? 'aprobar' : 'rechazar'
          } la solicitud`
        }`
      );
    }
  }

  return response;
};

/**
 * Abandonar un grupo
 */
export const leaveGroup = async (groupId: string): Promise<Response> => {
  const response = await fetch(`/api/groups/${groupId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || 'Error al abandonar el grupo');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error al abandonar el grupo'
        }`
      );
    }
  }

  return response;
};

/**
 * Sortear equipos para un partido
 */
export const randomizeTeams = async (
  groupId: string,
  matchId: string,
  balanceByAge: boolean = false,
  balanceByRole: boolean = true,
  balanceByRating: boolean = false
): Promise<{ success: boolean; groupId: string }> => {
  const response = await fetch(`/api/matches/create-match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId,
      matchId,
      mode: 'auto',
      // Using the matchId indicates this is a re-sort of an existing match
      isResort: true,
      balanceByAge,
      balanceByRole,
      balanceByRating,
    }),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      console.error('API error response:', errorData);
      throw new Error(
        errorData.message || errorData.error || 'Error al sortear equipos'
      );
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      // If we can't parse JSON, try to use the response text
      try {
        const errorText = await response.text();
        if (errorText && errorText.length < 200) {
          throw new Error(errorText);
        } else {
          throw new Error(
            `Error ${response.status}: ${
              response.statusText || 'Error de servidor'
            }`
          );
        }
      } catch (textError) {
        // If all else fails, return a generic error
        throw new Error(
          `Error ${response.status}: ${
            response.statusText || 'Error de servidor'
          }`
        );
      }
    }
  }

  const data = await response.json();
  return { success: true, groupId };
};

/**
 * Eliminar un partido
 */
export const deleteMatch = async (
  matchId: string,
  groupId: string
): Promise<{ success: boolean; groupId: string }> => {
  const response = await fetch(`/api/matches/${matchId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar el partido');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error al eliminar el partido'
        }`
      );
    }
  }

  return { success: true, groupId };
};

/**
 * Reemplazar un jugador TBD con un jugador real
 */
export const replaceTbdPlayer = async (
  tbdPlayerId: string,
  userId: string,
  matchId: string,
  isTeamA: boolean,
  groupId: string
): Promise<{ success: boolean; groupId: string }> => {
  const response = await fetch(`/api/matches/${matchId}/replace-tbd`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tbdPlayerId,
      userId,
      isTeamA,
    }),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || 'Error al reemplazar jugador TBD');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error de servidor'
        }`
      );
    }
  }

  return { success: true, groupId };
};

/**
 * Reiniciar las asistencias de un partido
 */
export const resetAttendance = async (
  matchId: string,
  groupId: string
): Promise<{ success: boolean; groupId: string }> => {
  const response = await fetch(`/api/matches/${matchId}/reset-attendance`, {
    method: 'POST',
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || 'Error al reiniciar asistencias');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error(
        `Error ${response.status}: ${
          response.statusText || 'Error de servidor'
        }`
      );
    }
  }

  return { success: true, groupId };
};

/**
 * Actualiza el star rating de un miembro del grupo
 */
export const updateMemberRating = async (
  groupId: string,
  userId: string,
  rating: number
): Promise<{
  success: boolean;
  message?: string;
  updatedMember?: any;
}> => {
  try {
    console.log(
      `Actualizando rating para usuario ${userId} en grupo ${groupId}: ${rating}`
    );

    const ratingInt = parseInt(rating.toString(), 10);

    const response = await fetch(`/api/groups/${groupId}/member/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        rating: ratingInt,
      }),
    });

    // Registrar información de la respuesta para depuración
    console.log(`Response status: ${response.status}`);

    const data = await response.json();

    // Registrar el cuerpo de la respuesta
    console.log('Response data:', data);

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Error ${response.status}: ${
            response.statusText || 'Error desconocido'
          }`
      );
    }

    return {
      success: true,
      message: data.message || 'Rating actualizado correctamente',
      updatedMember: data.updatedMember,
    };
  } catch (error) {
    console.error('Error detallado al actualizar rating:', error);

    if (error instanceof Error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }

    return {
      success: false,
      message: 'Error desconocido al actualizar el nivel de habilidad',
    };
  }
};
