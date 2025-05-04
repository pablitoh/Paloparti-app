import { useState, useEffect } from 'react';
import { Modal, Select, Button, Avatar, message } from 'antd';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';

// Interface for players
interface Player {
  id: string;
  name: string | null;
  avatar?: string | null;
  image?: string | null;
}

interface ReplaceTbdPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tbdPlayerId: string;
  matchId: string;
  groupId: string;
  isTeamA: boolean;
  allMembers: Player[];
  confirmedPlayers: Player[];
  onReplacementSuccess?: () => void;
}

export default function ReplaceTbdPlayerModal({
  isOpen,
  onClose,
  tbdPlayerId,
  matchId,
  groupId,
  isTeamA,
  allMembers,
  confirmedPlayers,
  onReplacementSuccess,
}: ReplaceTbdPlayerModalProps) {
  const [selectedMember, setSelectedMember] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSelectedMember(undefined);
    }
  }, [isOpen]);

  // Filter out members who are already confirmed players
  const availableMembers = allMembers.filter(
    (member) => !confirmedPlayers.some((player) => player.id === member.id)
  );

  const handleReplacement = async () => {
    if (!selectedMember) {
      message.error('Por favor selecciona un jugador');
      return;
    }

    setLoading(true);
    try {
      // Usar el nuevo endpoint edit-match con action=replace-tbd
      const response = await fetch(`/api/matches/${matchId}/edit-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tbdPlayerId,
          userId: selectedMember,
          isTeamA,
          groupId,
          action: 'replace-tbd',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al reemplazar jugador');
      }

      await response.json();
      showSuccessToast('Jugador reemplazado correctamente');

      // Call the success callback if provided
      if (onReplacementSuccess) {
        onReplacementSuccess();
      }

      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error replacing TBD player:', error);
      showErrorToast(
        error instanceof Error ? error.message : 'Error al reemplazar jugador'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title='Reemplazar jugador TBD'
      open={isOpen}
      onCancel={onClose}
      footer={null}
    >
      <div className='mb-4'>
        <p className='text-gray-700 mb-2'>
          Selecciona un jugador para agregar al{' '}
          {isTeamA ? 'Equipo A' : 'Equipo B'}:
        </p>
        <Select
          placeholder='Selecciona un jugador'
          style={{ width: '100%' }}
          value={selectedMember}
          onChange={setSelectedMember}
          optionFilterProp='label'
          showSearch
        >
          {availableMembers.map((member) => (
            <Select.Option
              key={member.id}
              value={member.id}
              label={member.name}
            >
              <div className='flex items-center'>
                <Avatar
                  size='small'
                  src={member.avatar || member.image}
                  className='mr-2'
                >
                  {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                </Avatar>
                {member.name}
              </div>
            </Select.Option>
          ))}
        </Select>
      </div>

      <div className='flex justify-end space-x-2'>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type='primary'
          onClick={handleReplacement}
          loading={loading}
          disabled={!selectedMember}
        >
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
