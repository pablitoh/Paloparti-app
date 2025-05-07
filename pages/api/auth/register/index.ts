import { NextApiRequest, NextApiResponse } from 'next';

/**
 * ARCHIVO DEPRECADO - DEBE ELIMINARSE EN FUTURAS VERSIONES
 *
 * Este endpoint está deprecado y redirige a /api/register
 * IMPORTANTE: Se recomienda usar directamente /api/register
 *
 * TODO: Eliminar este archivo después de asegurar que todas las referencias
 * a /api/auth/register han sido actualizadas para usar /api/register
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(
    'Request received at deprecated /api/auth/register, redirecting to /api/register'
  );

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Redireccionar todas las solicitudes a /api/register
    const response = await fetch(`/api/register`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error in /api/auth/register redirect:', error);
    return res.status(500).json({
      message:
        'Error al redireccionar. Por favor, use /api/register directamente.',
    });
  }
}
