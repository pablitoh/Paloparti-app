import { User } from '@prisma/client';

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  requiredFields: string[];
}

/**
 * Verifica si un usuario tiene un perfil completo
 */
export function checkProfileCompletion(user: User): ProfileCompletionStatus {
  const requiredFields = ['name', 'birthdate'];
  const missingFields: string[] = [];

  // Verificar nombre
  if (!user.name || user.name.trim() === '' || user.name === 'Usuario Google') {
    missingFields.push('name');
  }

  // Verificar fecha de nacimiento
  if (!user.birthdate) {
    missingFields.push('birthdate');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    requiredFields,
  };
}

/**
 * Detecta si un usuario es de Google (no tiene contraseña)
 */
export function isGoogleUser(user: User): boolean {
  return user.password === null;
}

/**
 * Detecta si un usuario tiene nombre temporal de Google
 */
export function hasTemporaryGoogleName(user: User): boolean {
  if (!user.name) return false;
  return user.name === 'Usuario Google' || user.name.startsWith('Usuario ');
}

/**
 * Genera un nombre temporal para usuarios de Google sin nombre
 */
export function generateTemporaryName(email: string): string {
  const emailPrefix = email.split('@')[0];
  const cleanPrefix = emailPrefix.replace(/[^a-zA-Z0-9]/g, '');
  return `Usuario ${
    cleanPrefix.charAt(0).toUpperCase() + cleanPrefix.slice(1)
  }`;
}

/**
 * Determina si un usuario necesita completar su perfil
 */
export function needsProfileCompletion(user: User): boolean {
  const status = checkProfileCompletion(user);
  return !status.isComplete;
}

/**
 * Calcula la edad a partir de una fecha de nacimiento
 */
export function calculateAge(birthdate: Date): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Genera una fecha de nacimiento por defecto para una edad específica
 */
export function generateBirthdateFromAge(age: number): Date {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  return new Date(birthYear, 0, 1); // 1 de enero del año calculado
}
