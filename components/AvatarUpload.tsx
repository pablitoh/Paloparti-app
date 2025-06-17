import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import Avatar from './Avatar';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  onAvatarChange?: (newAvatarUrl: string | null) => void;
  onFileSelect?: (file: File | null) => void;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  autoUpload?: boolean;
  fallbackText?: string;
  onDeleteRequested?: () => void;
}

interface AvatarUploadRef {
  uploadSelectedFile: () => Promise<string | null>;
  deleteAvatar: () => Promise<void>;
}

const AvatarUpload = forwardRef<AvatarUploadRef, AvatarUploadProps>(
  (
    {
      currentAvatar,
      onAvatarChange,
      onFileSelect,
      size = 'medium',
      className = '',
      autoUpload = true,
      fallbackText,
      onDeleteRequested,
    },
    ref
  ) => {
    const { data: session, update } = useSession();
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pendingDelete, setPendingDelete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarSizeMapping: Record<string, 'md' | 'lg' | 'xl'> = {
      small: 'md',
      medium: 'lg',
      large: 'xl',
    };

    const sizeClasses: Record<string, string> = {
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

      setSelectedFile(file);
      onFileSelect?.(file);

      // Solo subir automáticamente si autoUpload está habilitado
      if (autoUpload) {
        uploadAvatar(file);
      }
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

        // Agregar timestamp para evitar cache
        const avatarUrlWithTimestamp = `${result.avatar}?t=${Date.now()}`;

        // Primero notificar al componente padre
        onAvatarChange?.(avatarUrlWithTimestamp);
        setPreview(null);
        setSelectedFile(null);

        // Forzar refetch completo de la sesión desde el servidor
        setTimeout(async () => {
          try {
            console.log('Forzando refetch de sesión desde el servidor...');
            // Forzar refetch desde el servidor en lugar de solo actualizar el objeto local
            await update();
            console.log('Sesión refetcheada desde servidor');
          } catch (error) {
            console.error('Error refetcheando sesión:', error);
          }
        }, 500);
      } catch (error) {
        console.error('Error uploading avatar:', error);
        toast.error(
          error instanceof Error ? error.message : 'Error al subir el avatar'
        );
        setPreview(null);
        setSelectedFile(null);
      } finally {
        setIsUploading(false);
      }
    };

    const requestDeleteAvatar = () => {
      if (!currentAvatar && !pendingDelete) {
        return;
      }

      if (pendingDelete) {
        // Cancelar la eliminación pendiente
        setPendingDelete(false);
        onDeleteRequested?.();
      } else {
        // Marcar para eliminar
        setPendingDelete(true);
        onDeleteRequested?.();
      }
    };

    const actualDeleteAvatar = async () => {
      if (!session) {
        throw new Error('Debes estar autenticado');
      }

      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al eliminar el avatar');
      }

      // Limpiar el estado de eliminación pendiente
      setPendingDelete(false);

      return result;
    };

    const triggerFileInput = () => {
      fileInputRef.current?.click();
    };

    const cancelSelection = () => {
      setPreview(null);
      setSelectedFile(null);
      onFileSelect?.(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    const displayAvatar = preview || (pendingDelete ? null : currentAvatar);

    // Función pública para subir el archivo seleccionado
    const uploadSelectedFile = async (): Promise<string | null> => {
      if (!selectedFile) return null;

      await uploadAvatar(selectedFile);
      return null; // La función uploadAvatar maneja la notificación al padre
    };

    // Exponer las funciones al componente padre
    useImperativeHandle(ref, () => ({
      uploadSelectedFile,
      deleteAvatar: actualDeleteAvatar,
    }));

    return (
      <div className={`relative ${className}`}>
        <div className='relative'>
          <Avatar
            src={displayAvatar}
            alt='Avatar'
            size={avatarSizeMapping[size]}
            fallbackText={fallbackText}
            className={`${sizeClasses[size]} border-2 border-gray-300`}
          />
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

          {preview && !autoUpload && (
            <button
              onClick={cancelSelection}
              disabled={isUploading}
              className='bg-gray-600 hover:bg-gray-700 text-white p-1 rounded-full shadow-md transition-colors disabled:opacity-50'
              title='Cancelar selección'
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

          {(currentAvatar || pendingDelete) && !preview && (
            <button
              onClick={requestDeleteAvatar}
              disabled={isUploading}
              className={`p-1 rounded-full shadow-md transition-colors disabled:opacity-50 ${
                pendingDelete
                  ? 'bg-gray-600 hover:bg-gray-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={pendingDelete ? 'Cancelar eliminación' : 'Eliminar avatar'}
            >
              <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                {pendingDelete ? (
                  <path d='M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm6 2v6l1.5-1.5a.5.5 0 01.707.707L10 11.414l-2.207-2.207a.5.5 0 01.707-.707L10 10V4z' />
                ) : (
                  <path
                    fillRule='evenodd'
                    d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                    clipRule='evenodd'
                  />
                )}
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
  }
);

AvatarUpload.displayName = 'AvatarUpload';

export default AvatarUpload;
