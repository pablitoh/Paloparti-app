import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating = ({
  rating,
  maxRating = 5,
  onRatingChange,
  readOnly = false,
  size = 'md',
}: StarRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [internalRating, setInternalRating] = useState(rating);

  // Actualizar el estado interno cuando cambia la prop rating
  useEffect(() => {
    setInternalRating(rating);
  }, [rating]);

  // Determinar el tamaño de las estrellas
  const starSize = {
    sm: 'h-3 w-3',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[size];

  // Manejar el cambio de rating
  const handleRatingChange = (newRating: number) => {
    if (readOnly || !onRatingChange) return;

    setInternalRating(newRating);
    onRatingChange(newRating);
  };

  return (
    <div className='flex'>
      {[...Array(maxRating)].map((_, i) => {
        const ratingValue = i + 1;
        const filled = readOnly
          ? ratingValue <= internalRating
          : ratingValue <= (hoverRating || internalRating);

        return (
          <button
            key={i}
            type='button'
            onClick={() => handleRatingChange(ratingValue)}
            onMouseEnter={() => !readOnly && setHoverRating(ratingValue)}
            onMouseLeave={() => !readOnly && setHoverRating(0)}
            className={`${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
              size === 'sm' ? 'px-0.5' : 'px-1'
            }`}
            disabled={readOnly}
          >
            {filled ? (
              <StarIcon className={`${starSize} text-yellow-400`} />
            ) : (
              <StarOutline className={`${starSize} text-gray-300`} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
