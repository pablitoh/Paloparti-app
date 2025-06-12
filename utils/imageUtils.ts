import sharp from 'sharp';

interface ResizeOptions {
  width: number;
  height: number;
  quality?: number;
}

export const resizeImage = async (
  buffer: Buffer,
  options: ResizeOptions
): Promise<Buffer> => {
  const { width, height, quality = 80 } = options;

  try {
    const resizedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality })
      .toBuffer();

    return resizedBuffer;
  } catch (error) {
    console.error('Error redimensionando imagen:', error);
    throw new Error('Error al procesar la imagen');
  }
};

export const validateImageFile = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      'Tipo de archivo no permitido. Solo se permiten JPG, JPEG y PNG.'
    );
  }

  if (file.size > maxSize) {
    throw new Error('El archivo es demasiado grande. Máximo 5MB.');
  }

  return true;
};

export const generateAvatarFilename = (
  userId: string,
  extension: string
): string => {
  const timestamp = Date.now();
  return `avatars/${userId}_${timestamp}.${extension}`;
};
