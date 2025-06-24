import { useEffect, useState } from 'react';
import UnassignedPlayersNotification from './UnassignedPlayersNotification';

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
  isTeamA?: boolean;
  isAssigned?: boolean;
}

interface UnassignedPlayersManagerProps {
  confirmedPlayers: Player[];
  playersA: Player[];
  playersB: Player[];
  teamsFormed: boolean;
  currentUserIsAdmin: boolean;
  onRandomizeTeams: () => Promise<void>;
  isLoading: boolean;
  unassignedCount?: number;
}

const UnassignedPlayersManager = ({
  confirmedPlayers,
  playersA,
  playersB,
  teamsFormed,
  currentUserIsAdmin,
  onRandomizeTeams,
  isLoading,
  unassignedCount: propUnassignedCount,
}: UnassignedPlayersManagerProps) => {
  const [calculatedUnassignedCount, setCalculatedUnassignedCount] =
    useState<number>(0);

  useEffect(() => {
    if (propUnassignedCount === undefined) {
      const allTeamPlayerIds = [...playersA, ...playersB].map(
        (player) => player.id
      );

      const unassignedPlayersCount = confirmedPlayers.filter(
        (player) => !allTeamPlayerIds.includes(player.id)
      ).length;

      setCalculatedUnassignedCount(unassignedPlayersCount);
    }
  }, [confirmedPlayers, playersA, playersB, propUnassignedCount]);

  const finalUnassignedCount = propUnassignedCount ?? calculatedUnassignedCount;

  if (!currentUserIsAdmin || finalUnassignedCount <= 0) {
    return null;
  }

  return (
    <UnassignedPlayersNotification
      unassignedCount={finalUnassignedCount}
      onRandomizeTeams={onRandomizeTeams}
      isLoading={isLoading}
      teamsFormed={teamsFormed}
    />
  );
};

export default UnassignedPlayersManager;
