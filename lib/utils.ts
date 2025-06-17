/**
 * Utility functions for the application
 */

/**
 * Calculate age based on birthdate
 * @param birthdate Date of birth
 * @returns Age in years
 */
export function calculateAge(birthdate: Date | string | null): number | null {
  if (!birthdate) return null;

  const birth = new Date(birthdate);
  // Use UTC date to avoid timezone issues
  const today = new Date();

  // Extract date components to avoid timezone issues
  const birthYear = birth.getUTCFullYear();
  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  let age = todayYear - birthYear;
  const monthDiff = todayMonth - birthMonth;

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && todayDay < birthDay)) {
    age--;
  }

  return age;
}

/**
 * Format a date as DD/MM/YYYY using UTC components to avoid timezone issues
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateUTC(date: Date | string | null): string {
  if (!date) return 'No especificada';

  try {
    const dateObj = new Date(date);
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = dateObj.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
}
