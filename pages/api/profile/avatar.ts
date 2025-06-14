import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { resizeImage, generateAvatarFilename } from '../../../utils/imageUtils';
import formidable from 'formidable';
import fs from 'fs';

// Config to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const AVATAR_SIZE = { width: 300, height: 300 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    return uploadAvatar(req, res);
  } else if (req.method === 'DELETE') {
    return deleteAvatar(req, res);
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function uploadAvatar(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Verificar que Supabase esté configurado
    if (!supabaseAdmin) {
      const availableSupabaseVars = Object.keys(process.env).filter((key) =>
        key.includes('SUPABASE')
      );
      return res.status(500).json({
        message:
          'Error de configuración: Supabase no está configurado correctamente. Verifica las variables de entorno con prefijos PALOPARTIPROD_, PALOPARTI_ o sin prefijo: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
        availableSupabaseVars,
      });
    }

    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filter: ({ mimetype }: { mimetype?: string | null }) => {
        return !!(mimetype && mimetype.includes('image'));
      },
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;

    if (!file) {
      return res.status(400).json({ message: 'No se encontró ningún archivo' });
    }

    const userId = session.user.id;
    const fileBuffer = fs.readFileSync(file.filepath);

    // Borrar avatar anterior si existe
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    if (currentUser?.image) {
      const oldFilename = currentUser.image.split('/').pop();
      if (oldFilename) {
        // Eliminar el avatar anterior
        const oldPath = `avatars/${oldFilename}`;
        await supabaseAdmin!.storage.from('user-content').remove([oldPath]);
      }
    }

    // Generar nombre de archivo único
    const filename = generateAvatarFilename(userId, 'jpg');
    const baseFilename = filename.split('/')[1]; // Solo el nombre sin la carpeta

    // Redimensionar imagen a tamaño medium
    const resizedBuffer = await resizeImage(fileBuffer, AVATAR_SIZE);
    const path = `avatars/${baseFilename}`;

    const { data, error } = await supabaseAdmin!.storage
      .from('user-content')
      .upload(path, resizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Error subiendo avatar:', error);
      throw new Error('Error al subir imagen');
    }

    // Generar URL pública
    const { data: publicData } = supabaseAdmin!.storage
      .from('user-content')
      .getPublicUrl(path);

    const avatarUrl = publicData.publicUrl;

    // Actualizar el perfil del usuario con la URL del avatar
    await prisma.user.update({
      where: { id: userId },
      data: { image: avatarUrl },
    });

    // Limpiar archivo temporal
    fs.unlinkSync(file.filepath);

    return res.status(200).json({
      message: 'Avatar subido correctamente',
      avatar: avatarUrl,
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return res.status(500).json({
      message: 'Error al subir el avatar',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

async function deleteAvatar(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Verificar que Supabase esté configurado
    if (!supabaseAdmin) {
      return res.status(500).json({
        message:
          'Error de configuración: Supabase no está configurado correctamente',
      });
    }

    const userId = session.user.id;

    // Obtener avatar actual
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    if (!currentUser?.image) {
      return res.status(404).json({ message: 'No hay avatar para eliminar' });
    }

    // Extraer nombre del archivo
    const filename = currentUser.image.split('/').pop();
    if (!filename) {
      return res.status(400).json({ message: 'Nombre de archivo inválido' });
    }

    // Eliminar el avatar
    const filesToDelete = [`avatars/${filename}`];

    const { error } = await supabaseAdmin!.storage
      .from('user-content')
      .remove(filesToDelete);

    if (error) {
      console.error('Error eliminando avatar:', error);
      throw new Error('Error al eliminar el avatar del storage');
    }

    // Actualizar perfil del usuario
    await prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });

    return res.status(200).json({
      message: 'Avatar eliminado correctamente',
    });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return res.status(500).json({
      message: 'Error al eliminar el avatar',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
