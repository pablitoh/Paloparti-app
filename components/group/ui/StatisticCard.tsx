import React from 'react';

interface StatItem {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number | string;
}

interface StatisticCardProps {
  title: string;
  stats: StatItem[];
  period?: string;
  avatarUrl?: string;
  name?: string;
  compact?: boolean;
  onClick?: () => void;
}

export default function StatisticCard({
  title,
  stats,
  period,
  avatarUrl,
  name,
  compact = false,
  onClick,
}: StatisticCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm p-4 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div className='flex justify-between items-start mb-3'>
        <div>
          <h3 className='font-medium text-gray-900'>{title}</h3>
          {period && <p className='text-xs text-gray-500'>{period}</p>}
        </div>

        {avatarUrl && (
          <div className='flex items-center'>
            <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden'>
              <img
                src={avatarUrl}
                alt={name || 'Avatar'}
                className='w-full h-full object-cover'
              />
            </div>
            {name && !compact && (
              <span className='ml-2 text-sm text-gray-700'>{name}</span>
            )}
          </div>
        )}
      </div>

      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${!compact && index > 0 ? 'border-t pt-3' : ''}`}
          >
            <div className='flex items-center mb-1'>
              {stat.icon && (
                <span className='mr-1 text-gray-500'>{stat.icon}</span>
              )}
              <span className='text-xs text-gray-500'>{stat.label}</span>
            </div>
            <div className='flex items-end'>
              <span
                className={`text-lg font-bold ${stat.color || 'text-gray-800'}`}
              >
                {stat.value}
                {stat.suffix && (
                  <span className='text-sm ml-1'>{stat.suffix}</span>
                )}
              </span>

              {stat.trend && (
                <div
                  className={`ml-2 flex items-center text-xs ${
                    stat.trend === 'up'
                      ? 'text-green-600'
                      : stat.trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }`}
                >
                  {stat.trend === 'up' && (
                    <svg
                      className='w-3 h-3 mr-0.5'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 10l7-7m0 0l7 7m-7-7v18'
                      />
                    </svg>
                  )}
                  {stat.trend === 'down' && (
                    <svg
                      className='w-3 h-3 mr-0.5'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M19 14l-7 7m0 0l-7-7m7 7V3'
                      />
                    </svg>
                  )}
                  {stat.trend === 'stable' && (
                    <svg
                      className='w-3 h-3 mr-0.5'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 12h14'
                      />
                    </svg>
                  )}
                  {stat.trendValue && <span>{stat.trendValue}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
