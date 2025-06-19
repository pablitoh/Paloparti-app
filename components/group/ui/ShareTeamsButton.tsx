import React, { useState } from 'react';
import { ShareIcon } from '@heroicons/react/24/outline';
import { useScreenshotShare } from '../../../hooks/useScreenshotShare';
import Button from '../../Button';

interface ShareTeamsButtonProps {
  elementId: string;
  groupName: string;
  teamAName: string;
  teamBName: string;
  className?: string;
  sortCount?: number;
}

const ShareTeamsButton: React.FC<ShareTeamsButtonProps> = ({
  elementId,
  groupName,
  teamAName,
  teamBName,
  className = '',
  sortCount = 0,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const { shareTeamsScreenshot } = useScreenshotShare();

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);

    try {
      const shareData = {
        text: `Equipos sorteados en ${groupName}`,
        groupName,
        teamAName,
        teamBName,
      };

      await shareTeamsScreenshot(sortCount, shareData);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      variant='primary'
      onClick={handleShare}
      disabled={isSharing}
      size='sm'
      className={`flex items-center text-xs ${className}`}
    >
      {isSharing ? (
        <>
          <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
          Generando...
        </>
      ) : (
        <>
          <ShareIcon className='h-4 w-4 mr-2' />
          Compartir
        </>
      )}
    </Button>
  );
};

export default ShareTeamsButton;
