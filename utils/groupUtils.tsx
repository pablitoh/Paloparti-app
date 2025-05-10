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

  return (
    <div className='flex items-center space-x-0.5 ml-1'>
      {count <= 3 ? (
        // Show one ball per goal for 1-3 goals
        Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className='inline-flex p-0.5 rounded-full transform hover:scale-110 transition-all duration-200'
            title={`Gol ${i + 1}`}
          >
            <span role='img' aria-label='balón de fútbol' className='text-lg'>
              ⚽
            </span>
          </div>
        ))
      ) : (
        // For 4+ goals, show the count + one ball
        <div className='flex items-center rounded-full px-1 py-0.5'>
          <span className='font-bold text-xs text-gray-800 mr-0.5'>
            {count}
          </span>
          <span role='img' aria-label='balón de fútbol' className='text-lg'>
            ⚽
          </span>
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
