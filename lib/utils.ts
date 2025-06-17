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
