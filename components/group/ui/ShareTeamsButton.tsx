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
}

const ShareTeamsButton: React.FC<ShareTeamsButtonProps> = ({
  elementId,
  groupName,
  teamAName,
  teamBName,
  className = '',
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const { shareToWhatsApp } = useScreenshotShare();

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);

    try {
      await shareToWhatsApp(elementId, {
        text: `Equipos sorteados en ${groupName}`,
        groupName,
        teamAName,
        teamBName,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`inline-flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${className}`}
      title='Compartir equipos'
    >
      {isSharing ? (
        <div className='animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent'></div>
      ) : (
        <ShareIcon className='h-5 w-5' />
      )}
    </button>
  );
};

export default ShareTeamsButton;
