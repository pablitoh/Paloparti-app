import { useEffect, useState } from 'react';
import UnassignedPlayersNotification from './UnassignedPlayersNotification';

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  age?: number | null;
  isTeamA?: boolean;
}

interface UnassignedPlayersManagerProps {
  confirmedPlayers: Player[];
  playersA: Player[];
  playersB: Player[];
  teamsFormed: boolean;
  currentUserIsAdmin: boolean;
  onRandomizeTeams: () => Promise<void>;
  isLoading: boolean;
}

const UnassignedPlayersManager = ({
  confirmedPlayers,
  playersA,
  playersB,
  teamsFormed,
  currentUserIsAdmin,
  onRandomizeTeams,
  isLoading,
}: UnassignedPlayersManagerProps) => {
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);

  // Update unassigned players when confirmed players or team players change
  useEffect(() => {
    // Get all players in teams A and B
    const allTeamPlayerIds = [...playersA, ...playersB].map(
      (player) => player.id
    );

    // Calculate unassigned players (confirmed players not in any team)
    const unassignedPlayersArr = confirmedPlayers.filter(
      (player) => !allTeamPlayerIds.includes(player.id)
    );

    setUnassignedPlayers(unassignedPlayersArr);
    setUnassignedCount(unassignedPlayersArr.length);
  }, [confirmedPlayers, playersA, playersB]);

  // Only render notification if needed
  if (!teamsFormed || !currentUserIsAdmin || unassignedCount <= 0) {
    return null;
  }

  return (
    <UnassignedPlayersNotification
      unassignedCount={unassignedCount}
      onRandomizeTeams={onRandomizeTeams}
      isLoading={isLoading}
    />
  );
};

export default UnassignedPlayersManager;
