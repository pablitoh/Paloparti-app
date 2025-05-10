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
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
