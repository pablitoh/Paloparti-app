import React, { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  onAvatarChange?: (newAvatarUrl: string | null) => void;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onAvatarChange,
  size = 'medium',
  className = '',
}) => {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32',
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar el archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede ser mayor a 5MB');
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir el archivo
    uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    if (!session) {
      toast.error('Debes estar autenticado para subir un avatar');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al subir el avatar');
      }

      toast.success('Avatar actualizado correctamente');
      onAvatarChange?.(result.avatar);
      setPreview(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error al subir el avatar'
      );
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAvatar = async () => {
    if (!session) {
      toast.error('Debes estar autenticado');
      return;
    }

    if (!currentAvatar) {
      toast.error('No hay avatar para eliminar');
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al eliminar el avatar');
      }

      toast.success('Avatar eliminado correctamente');
      onAvatarChange?.(null);
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error al eliminar el avatar'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const displayAvatar = preview || currentAvatar;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-300 bg-gray-100 flex items-center justify-center`}
      >
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt='Avatar'
            className='w-full h-full object-cover'
          />
        ) : (
          <div className='text-gray-400'>
            <svg className='w-8 h-8' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z'
                clipRule='evenodd'
              />
            </svg>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className='absolute -bottom-2 -right-2 flex gap-1'>
        <button
          onClick={triggerFileInput}
          disabled={isUploading}
          className='bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full shadow-md transition-colors disabled:opacity-50'
          title='Cambiar avatar'
        >
          <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
            <path d='M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z' />
          </svg>
        </button>

        {currentAvatar && (
          <button
            onClick={deleteAvatar}
            disabled={isUploading}
            className='bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-colors disabled:opacity-50'
            title='Eliminar avatar'
          >
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        )}
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        onChange={handleFileSelect}
        className='hidden'
      />

      {/* Indicador de carga */}
      {isUploading && (
        <div className='absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-white'></div>
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
