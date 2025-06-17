import React from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackText?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  className = '',
  fallbackText,
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const getFallbackInitials = () => {
    if (fallbackText) {
      return fallbackText
        .split(' ')
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
    }
    return '';
  };

  const fallbackInitials = getFallbackInitials();

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className='w-full h-full object-cover'
          onError={(e) => {
            // Si falla la carga de la imagen, ocultar el elemento img y mostrar fallback
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            // Trigger re-render to show fallback
            if (target.parentElement) {
              target.parentElement.classList.add(
                'bg-gradient-to-br',
                'from-blue-400',
                'to-purple-500'
              );
            }
          }}
        />
      ) : null}

      {(!src || src === '') &&
        (fallbackInitials ? (
          <span className='font-bold text-white drop-shadow-sm'>
            {fallbackInitials}
          </span>
        ) : (
          <svg
            className={`${iconSizes[size]} text-white drop-shadow-sm`}
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z'
              clipRule='evenodd'
            />
          </svg>
        ))}
    </div>
  );
};

export default Avatar;
