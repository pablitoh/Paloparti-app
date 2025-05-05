import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function EditMatch() {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchMatch = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/matches/${id}`);

        if (!response.ok) {
          throw new Error('Error al cargar datos del partido');
        }

        const data = await response.json();
        setMatch(data);
      } catch (err) {
        console.error('Error fetching match:', err);
        setError(err.message || 'Error al cargar el partido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatch();
  }, [id]);

  if (isLoading) {
    return <div className='p-4'>Cargando detalles del partido...</div>;
  }

  if (error) {
    return <div className='p-4 text-red-500'>Error: {error}</div>;
  }

  return (
    <div className='p-4'>
      <h1 className='text-xl font-bold mb-4'>Editar Partido</h1>

      {match ? (
        <div className='space-y-4'>
          <div>
            <p>
              <strong>Fecha:</strong>{' '}
              {new Date(match.date).toLocaleDateString()}
            </p>
            <p>
              <strong>Ubicación:</strong> {match.location}
            </p>
            <p>
              <strong>Estado:</strong> {match.status}
            </p>
          </div>

          <div className='flex space-x-4'>
            <Link
              href={`/matches/${id}/results`}
              className='px-4 py-2 bg-blue-500 text-white rounded'
            >
              Ver resultados
            </Link>

            <button
              onClick={() => router.back()}
              className='px-4 py-2 bg-gray-300 rounded'
            >
              Volver
            </button>
          </div>

          <div className='mt-4'>
            <p className='text-sm text-gray-500'>
              Nota: La edición completa del partido está disponible en la
              versión de escritorio.
            </p>
          </div>
        </div>
      ) : (
        <p>No se encontró información del partido</p>
      )}
    </div>
  );
}
