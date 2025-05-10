import React, { useState } from 'react';

interface InviteLinkBoxProps {
  inviteLink: string;
  onGenerateNewLink?: () => Promise<string>;
  title?: string;
  description?: string;
}

export default function InviteLinkBox({
  inviteLink,
  onGenerateNewLink,
  title = 'Enlace de invitación',
  description = 'Comparte este enlace para invitar a más personas',
}: InviteLinkBoxProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [link, setLink] = useState(inviteLink);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Error al copiar el enlace', error);
    }
  };

  const handleGenerateNewLink = async () => {
    if (!onGenerateNewLink) return;

    try {
      setIsGenerating(true);
      const newLink = await onGenerateNewLink();
      setLink(newLink);
    } catch (error) {
      console.error('Error al generar nuevo enlace', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className='bg-white rounded-lg border border-gray-100 p-4'>
      <div className='mb-3'>
        <h3 className='text-sm font-medium text-gray-900'>{title}</h3>
        <p className='text-xs text-gray-500'>{description}</p>
      </div>

      <div className='flex items-stretch'>
        <div className='flex-1 p-2 bg-gray-50 border border-gray-200 rounded-l-md text-sm truncate'>
          {link}
        </div>
        <button
          onClick={handleCopyLink}
          className={`px-3 py-2 text-xs font-medium ${
            isCopied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } rounded-r-md flex items-center`}
          disabled={isCopied}
        >
          {isCopied ? (
            <>
              <svg
                className='w-3 h-3 mr-1'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 13l4 4L19 7'
                />
              </svg>
              Copiado
            </>
          ) : (
            <>
              <svg
                className='w-3 h-3 mr-1'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5'
                />
              </svg>
              Copiar
            </>
          )}
        </button>
      </div>

      {onGenerateNewLink && (
        <button
          onClick={handleGenerateNewLink}
          disabled={isGenerating}
          className='mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center'
        >
          {isGenerating ? (
            <>
              <svg
                className='animate-spin h-3 w-3 mr-1'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              Generando...
            </>
          ) : (
            <>
              <svg
                className='w-3 h-3 mr-1'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
              Generar nuevo enlace
            </>
          )}
        </button>
      )}
    </div>
  );
}
