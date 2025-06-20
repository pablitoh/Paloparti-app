import React, { useState, useRef, useEffect } from 'react';
import {
  ShareIcon,
  ChevronDownIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useScreenshotShare } from '../../../hooks/useScreenshotShare';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';
import Button from '../../Button';

interface Player {
  id: string;
  name: string | null;
  playerRoles?: any[];
  assignedRole?: string;
  age?: number | null;
  starRating?: number;
}

interface ShareTeamsButtonProps {
  elementId: string;
  groupName: string;
  teamAName: string;
  teamBName: string;
  className?: string;
  sortCount?: number;
  playersA?: Player[];
  playersB?: Player[];
}

const ShareTeamsButton: React.FC<ShareTeamsButtonProps> = ({
  elementId,
  groupName,
  teamAName,
  teamBName,
  className = '',
  sortCount = 0,
  playersA = [],
  playersB = [],
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { shareTeamsScreenshot } = useScreenshotShare();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleShareImage = async () => {
    if (isSharing) return;
    setShowDropdown(false);
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

  const formatPlayerText = (player: Player): string => {
    const name = player.name || 'Sin nombre';
    const roleEmojis: { [key: string]: string } = {
      goalkeeper: '🧤',
      defender: '🛡️',
      midfielder: '⚽',
      forward: '👟',
      wildcard: '🔄',
    };

    const role =
      player.assignedRole ||
      (player.playerRoles && player.playerRoles.length > 0
        ? player.playerRoles[0].role
        : null);
    const roleEmoji = role ? roleEmojis[role] || '' : '';

    return roleEmoji ? `${roleEmoji} ${name}` : name;
  };

  const handleShareText = async () => {
    if (isSharing) return;
    setShowDropdown(false);
    setIsSharing(true);

    try {
      // Format team lists
      const teamAText =
        playersA.length > 0
          ? playersA.map(formatPlayerText).join('\n')
          : 'Sin jugadores asignados';

      const teamBText =
        playersB.length > 0
          ? playersB.map(formatPlayerText).join('\n')
          : 'Sin jugadores asignados';

      // Create the message
      const message = `⚽ *Equipos sorteados en ${groupName}*

🟢 *${teamAName}* (${playersA.length} jugadores)
${teamAText}

🟡 *${teamBName}* (${playersB.length} jugadores)
${teamBText}

¡Que gane el mejor equipo! 💪

_Generado con Paloparti_ 🚀`;

      // Use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: 'Equipos Formados',
          text: message,
        });
        showSuccessToast('📱 Equipos compartidos exitosamente');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(message);
        showSuccessToast('📋 Texto copiado al portapapeles');
      }
    } catch (error) {
      console.error('Error sharing text:', error);
      showErrorToast('Error al compartir texto');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <Button
        variant='primary'
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isSharing}
        size='sm'
        className={`flex items-center text-xs ${className}`}
      >
        {isSharing ? (
          <>
            <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
            <span className='hidden sm:inline'>Compartiendo...</span>
          </>
        ) : (
          <>
            <ShareIcon className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Compartir</span>
            <ChevronDownIcon className='h-3 w-3 ml-1' />
          </>
        )}
      </Button>

      {showDropdown && !isSharing && (
        <div className='absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-green-lg border border-gray-200 py-2 z-[9999999]'>
          <button
            onClick={handleShareImage}
            className='w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center'
          >
            <PhotoIcon className='h-4 w-4 mr-3 text-gray-500' />
            Compartir como imagen
          </button>
          <button
            onClick={handleShareText}
            className='w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center'
          >
            <ChatBubbleLeftRightIcon className='h-4 w-4 mr-3 text-gray-500' />
            Compartir como texto
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareTeamsButton;
