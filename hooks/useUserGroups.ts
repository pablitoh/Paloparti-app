import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface GroupMember {
  id: string;
  role: 'ADMIN' | 'MEMBER';
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  sport: string;
  location: string;
  members: GroupMember[];
  userStatus?: string;
  nextMatchDate?: string;
  nextMatchLocation?: string;
}

export const useUserGroups = () => {
  const { data: session, status } = useSession();
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setUserGroups([]);
      setIsLoading(false);
      return;
    }

    if (status === 'loading') {
      return;
    }

    const fetchGroups = async () => {
      try {
        const response = await fetch(`/api/groups`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Error fetching groups: ${response.status} ${response.statusText}`
          );
        }

        if (!Array.isArray(data)) {
          throw new Error('Invalid response format from server');
        }

        setUserGroups(data);
        setError(null);
      } catch (error) {
        console.error('Error in fetchGroups:', error);
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unexpected error occurred while fetching groups');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [status]);

  return { userGroups, isLoading, error };
};
