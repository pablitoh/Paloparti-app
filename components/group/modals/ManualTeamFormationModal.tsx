import { useState, useEffect } from 'react';
import { Modal, Button, List, Avatar, Space, message } from 'antd';
import { useManualTeamFormationMutation } from '../../../services/reactQueryHooks';

// Modal for manual team formation
interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
}

interface ManualTeamFormationModalProps {
  isOpen: boolean;
  onClose: () => void;
  confirmedPlayers: Player[];
  matchId: string;
  groupId: string;
  onSuccess?: () => void;
}

export default function ManualTeamFormationModal({
  isOpen,
  onClose,
  confirmedPlayers,
  matchId,
  groupId,
  onSuccess,
}: ManualTeamFormationModalProps) {
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);

  const manualTeamFormationMutation = useManualTeamFormationMutation();

  useEffect(() => {
    if (isOpen) {
      setAvailablePlayers(confirmedPlayers);
      setTeamA([]);
      setTeamB([]);
    }
  }, [isOpen, confirmedPlayers]);

  const handleAddToTeam = (player: Player, isTeamA: boolean) => {
    const targetTeam = isTeamA ? teamA : teamB;
    const otherTeam = isTeamA ? teamB : teamA;

    // Check if player is already in a team
    if (
      targetTeam.some((p) => p.id === player.id) ||
      otherTeam.some((p) => p.id === player.id)
    ) {
      return;
    }

    if (isTeamA) {
      setTeamA([...teamA, player]);
    } else {
      setTeamB([...teamB, player]);
    }

    setAvailablePlayers(availablePlayers.filter((p) => p.id !== player.id));
  };

  const handleRemoveFromTeam = (player: Player, isTeamA: boolean) => {
    if (isTeamA) {
      setTeamA(teamA.filter((p) => p.id !== player.id));
    } else {
      setTeamB(teamB.filter((p) => p.id !== player.id));
    }

    setAvailablePlayers([...availablePlayers, player]);
  };

  const handleSave = async () => {
    try {
      // Make sure teams are balanced
      if (teamA.length === 0 || teamB.length === 0) {
        message.error('Ambos equipos deben tener al menos un jugador');
        return;
      }

      console.log('Submitting teams:', {
        teamA,
        teamB,
        matchId,
        groupId,
      });

      // Call the mutation with the formatted teams
      const result = await manualTeamFormationMutation.mutateAsync({
        matchId,
        groupId,
        teamA,
        teamB,
      });

      console.log('Manual team formation result:', result);

      message.success('Equipos guardados correctamente');

      // Make sure to call onSuccess to refresh the parent component
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Error saving teams:', error);
      message.error('Error al guardar los equipos');
    }
  };

  const renderTeam = (team: Player[], isTeamA: boolean) => (
    <List
      dataSource={team}
      renderItem={(player: Player) => (
        <List.Item
          actions={[
            <Button
              key='remove'
              type='link'
              danger
              onClick={() => handleRemoveFromTeam(player, isTeamA)}
            >
              Quitar
            </Button>,
          ]}
        >
          <List.Item.Meta
            avatar={
              player.avatar ? (
                <Avatar src={player.avatar} />
              ) : (
                <Avatar>
                  {player.name ? player.name.charAt(0).toUpperCase() : 'U'}
                </Avatar>
              )
            }
            title={player.name || 'Jugador sin nombre'}
          />
        </List.Item>
      )}
    />
  );

  return (
    <Modal
      title='Formación Manual de Equipos'
      open={isOpen}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key='cancel' onClick={onClose}>
          Cancelar
        </Button>,
        <Button
          key='save'
          type='primary'
          onClick={handleSave}
          loading={manualTeamFormationMutation.isPending}
        >
          Guardar
        </Button>,
      ]}
    >
      <Space direction='vertical' style={{ width: '100%' }} size='large'>
        <div>
          <h3>Equipo A</h3>
          {renderTeam(teamA, true)}
        </div>

        <div>
          <h3>Equipo B</h3>
          {renderTeam(teamB, false)}
        </div>

        <div>
          <h3>Jugadores Disponibles</h3>
          <List
            dataSource={availablePlayers}
            renderItem={(player: Player) => (
              <List.Item
                actions={[
                  <Button
                    key='addA'
                    type='link'
                    onClick={() => handleAddToTeam(player, true)}
                  >
                    Añadir a A
                  </Button>,
                  <Button
                    key='addB'
                    type='link'
                    onClick={() => handleAddToTeam(player, false)}
                  >
                    Añadir a B
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    player.avatar ? (
                      <Avatar src={player.avatar} />
                    ) : (
                      <Avatar>
                        {player.name
                          ? player.name.charAt(0).toUpperCase()
                          : 'U'}
                      </Avatar>
                    )
                  }
                  title={player.name || 'Jugador sin nombre'}
                />
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Modal>
  );
}
