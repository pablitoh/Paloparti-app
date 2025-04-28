# Migration from Age to Birthdate

This document outlines the changes made to replace the `age` field with `birthdate` across the application.

## Database Changes

1. Modified the Prisma schema to replace `age: Int?` with `birthdate: DateTime?` in the User model.
2. Created a migration that:
   - Adds the new `birthdate` column
   - Converts existing age values to approximate birthdate values (setting to current date minus age years)
   - Removes the old `age` column

## Utility Function

Added a utility function in `lib/utils.ts` to calculate age from birthdate:

```typescript
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
```

## API Updates

Updated API endpoints to:

1. Fetch `birthdate` instead of `age` from the database
2. Use the `calculateAge` function to compute age when needed
3. Return calculated age in the response objects

API endpoints updated:

- `/api/groups/[id].ts`
- `/api/matches/[id]/result.ts`
- `/api/matches/teams.ts`

## UI Updates

1. Modified UI components to display age calculated from birthdate
2. Updated mock data to use birthdate instead of age
3. Created a new `UserProfileCard` component that displays both birthdate and calculated age

## Best Practices for Working with Dates

When working with birthdates and ages:

1. Always store the birthdate, not the age, in the database
2. Calculate age dynamically when needed
3. Be mindful of timezone issues when displaying dates
4. Use the `calculateAge` utility function for consistent calculations
5. Format dates according to the user's locale (e.g., using `toLocaleDateString()`)

## Migration Testing

After applying these changes, ensure:

1. All existing users have their birthdates properly converted
2. Age calculations display correctly across the application
3. All forms that previously collected age now collect birthdate
4. Team balancing still works properly with the new age calculation
