import React from 'react';
import { useRouter } from 'next/router';
import { Participant, ParticipantStatus } from '../types/participant';

interface ParticipantCardProps {
  participant: Participant;
  isCaptain?: boolean;
  goals?: number;
  showStatus?: boolean;
}

export default function ParticipantCard({
  participant,
  isCaptain = false,
  goals = 0,
  showStatus = true,
}: ParticipantCardProps) {
  const router = useRouter();
  const statusColors: Record<ParticipantStatus, string> = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    declined: 'bg-red-100 text-red-800',
    waiting: 'bg-blue-100 text-blue-800',
  };

  if (!participant) {
    return null;
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/profile/${participant.id}`);
  };

  console.log('ParticipantCard renderizado con:', {
    participantId: participant.id,
    participantName: participant.name,
    participantStatus: participant.status,
    showStatus,
  });

  return (
    <div className='flex items-center justify-between p-3 bg-white rounded-lg shadow-sm'>
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden'>
          {participant.avatar ? (
            <img
              src={participant.avatar}
              alt={participant.name}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-gray-400'>👤</span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={handleProfileClick}
            className='text-sm font-medium text-gray-700 hover:text-gray-900'
          >
            {participant.name}
          </button>
          {isCaptain && (
            <span className='text-xs text-gray-500'>(Capitán)</span>
          )}
          {goals > 0 && (
            <span className='flex gap-1'>
              {Array(goals)
                .fill('⚽')
                .map((ball, index) => (
                  <span key={index} className='text-yellow-500'>
                    {ball}
                  </span>
                ))}
            </span>
          )}
        </div>
      </div>
      {showStatus && (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            statusColors[participant.status]
          }`}
        >
          {participant.status === 'confirmed'
            ? 'Confirmado'
            : participant.status === 'pending'
            ? 'Pendiente'
            : participant.status === 'waiting'
            ? 'En espera'
            : 'Rechazado'}
        </span>
      )}
    </div>
  );
}
