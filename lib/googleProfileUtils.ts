interface GooglePersonProfile {
  birthdays?: Array<{
    metadata: {
      primary?: boolean;
      source: {
        type: string;
        id?: string;
      };
    };
    date: {
      year?: number;
      month?: number;
      day?: number;
    };
  }>;
  genders?: Array<{
    metadata: {
      primary?: boolean;
      source: {
        type: string;
      };
    };
    value: string;
  }>;
  names?: Array<{
    metadata: {
      primary?: boolean;
      source: {
        type: string;
      };
    };
    displayName: string;
    familyName?: string;
    givenName?: string;
  }>;
}

/**
 * Obtiene información extendida del perfil de Google usando People API
 */
export async function getGoogleExtendedProfile(accessToken: string): Promise<{
  birthdate: Date | null;
  fullName: string | null;
}> {
  try {
    // Llamar a Google People API para obtener información extendida
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=birthdays,genders,names',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(
        'Error obteniendo perfil extendido de Google:',
        response.status
      );
      return { birthdate: null, fullName: null };
    }

    const data: GooglePersonProfile = await response.json();
    console.log(
      'Perfil extendido de Google recibido:',
      JSON.stringify(data, null, 2)
    );

    // Extraer fecha de nacimiento
    let birthdate: Date | null = null;
    if (data.birthdays && data.birthdays.length > 0) {
      // Buscar cumpleaños primario o de tipo ACCOUNT
      const primaryBirthday =
        data.birthdays.find(
          (b) => b.metadata.primary || b.metadata.source.type === 'ACCOUNT'
        ) || data.birthdays[0];

      if (primaryBirthday?.date) {
        const { year, month, day } = primaryBirthday.date;
        if (year && month && day) {
          birthdate = new Date(year, month - 1, day); // month es 0-indexed en JS
          console.log(
            'Fecha de nacimiento extraída de Google:',
            birthdate.toISOString().split('T')[0]
          );
        }
      }
    }

    // Extraer nombre completo
    let fullName: string | null = null;
    if (data.names && data.names.length > 0) {
      const primaryName =
        data.names.find(
          (n) => n.metadata.primary || n.metadata.source.type === 'ACCOUNT'
        ) || data.names[0];

      fullName = primaryName?.displayName || null;
    }

    return { birthdate, fullName };
  } catch (error) {
    console.error('Error obteniendo perfil extendido de Google:', error);
    return { birthdate: null, fullName: null };
  }
}

/**
 * Calcula la edad mínima permitida (12 años)
 */
export function isAgeValid(birthdate: Date): boolean {
  const today = new Date();
  const age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();

  const actualAge =
    monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())
      ? age - 1
      : age;

  return actualAge >= 12;
}

/**
 * Formatea una fecha de nacimiento para logs
 */
export function formatBirthdateForLog(birthdate: Date | null): string {
  if (!birthdate) return 'No disponible';
  return birthdate.toISOString().split('T')[0];
}
