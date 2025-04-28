import React from 'react';
import { Participant } from '../types/participant';
import ParticipantCard from './ParticipantCard';

interface ParticipantListProps {
  participants: Participant[];
  title?: string;
}

export default function ParticipantList({
  participants,
  title,
}: ParticipantListProps) {
  if (
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    return (
      <div className='bg-white rounded-xl shadow-md p-6'>
        <h2 className='text-lg font-semibold text-gray-700 mb-4'>
          {title || 'Participantes'}
        </h2>
        <p className='text-gray-500 text-center py-4'>
          No hay participantes disponibles
        </p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-xl shadow-md p-6'>
      <h2 className='text-lg font-semibold text-gray-700 mb-4'>
        {title || 'Participantes'}
      </h2>
      <div className='space-y-3'>
        {participants.map((participant) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            isCaptain={participant.isCaptain}
          />
        ))}
      </div>
    </div>
  );
}
