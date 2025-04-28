import React from 'react';
import { MatchInterface } from '../types/group';

export const formatMatchDate = (date: string | Date) => {
  if (!date) return 'No programado';

  // Ensure we have a Date object
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formattedDate = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formattedDate;
};

export const getScoreForTeam = (
  match: MatchInterface,
  isTeamA: boolean
): number => {
  if (!match) return 0;
  return isTeamA ? match.scoreA : match.scoreB;
};

export const getPlayerGoals = (
  match: MatchInterface,
  playerId: string
): number => {
  return match.goals?.filter((goal) => goal.scorerId === playerId).length || 0;
};

export const renderGoalBalls = (count: number) => {
  if (count === 0) return null;

  // Soccer ball SVG icon with improved visibility
  const footballIcon = (
    <svg
      className='w-4 h-4 text-black'
      viewBox='0 0 512 512'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden='true'
    >
      <path d='M177.1 228.6L207.9 320l96.2 5.4L233 382.5l29.9 91.4L177.1 422l-85.8 51.9L121.1 382l-71-57.1 96.2-5.4L177.1 228.6zm44.4-53.8C239.7 75.5 349.7 18.6 448.8 36.3c23.7 98.2-33.1 209.2-132.9 227.4-99.8 18.1-200.9-46.2-224.6-144.4.1 0 .1.1 0 0-37.4 12.9-78.3-6.5-91.2-43.1-5.1-13.9-5.7-28.6-2.6-42.5 14.4-3.2 29.7-1.8 43.9 5.1 37.5 18.4 51.7 66.5 36.5 103.3-5.1 11.8-12.7 21.7-22 29.5z' />
    </svg>
  );

  return (
    <div className='flex items-center space-x-1 ml-2'>
      {count <= 3 ? (
        // Show one ball per goal for 1-3 goals
        Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className='bg-yellow-100 p-1 rounded-full inline-block transform hover:scale-110 transition-transform border border-yellow-300'
            title={`Gol ${i + 1}`}
          >
            {footballIcon}
          </div>
        ))
      ) : (
        // For 4+ goals, show the count + one ball
        <div className='flex items-center bg-yellow-100 rounded-full px-2 py-1 border border-yellow-300'>
          <span className='font-bold text-sm text-gray-800 mr-1'>{count}</span>
          {footballIcon}
        </div>
      )}
    </div>
  );
};

export const getRecurrenceText = (group: any) => {
  if (!group) return '';

  const dayNames = [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ];

  if (!group.recurrenceType || group.recurrenceType === 'NONE') {
    return '';
  }

  let frequencyText = '';
  if (group.recurrenceType === 'WEEKLY') {
    frequencyText = 'Semanal';
  } else if (group.recurrenceType === 'BIWEEKLY') {
    frequencyText = 'Quincenal';
  } else if (group.recurrenceType === 'MONTHLY') {
    frequencyText = 'Mensual';
  }

  let daysText = '';
  if (group.recurrenceDays && group.recurrenceDays.length > 0) {
    daysText = group.recurrenceDays
      .map((day: number) => dayNames[day])
      .map((day: string) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
  }

  let timeText = '';
  if (group.recurrenceTime) {
    timeText = `${group.recurrenceTime}hs`;
  }

  return `${frequencyText} - ${daysText} ${timeText}`;
};

export const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};
