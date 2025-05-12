import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Button from '../components/Button';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { RecurrenceType } from '../types/match';

export default function CreateGroup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sport: 'Fútbol',
    description: '',
    location: '',
    teamAName: 'Equipo A',
    teamBName: 'Equipo B',
    recurrenceType: 'NONE',
    recurrenceDays: [] as number[],
    recurrenceTime: '18:00',
    requiredPlayers: 10,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      // Validar que los campos requeridos estén completos
      if (!formData.name || !formData.sport || !formData.location) {
        setError('Todos los campos obligatorios deben estar completos');
        setIsSubmitting(false);
        return;
      }

      // Validar que requiredPlayers sea un número par
      if (formData.requiredPlayers % 2 !== 0) {
        setError('El número de jugadores requeridos debe ser par');
        setIsSubmitting(false);
        return;
      }

      // Calcular próxima fecha de partido si corresponde
      const nextMatch = calculateNextMatch();

      const dataToSend = {
        ...formData,
        nextMatch: nextMatch ? nextMatch.toISOString() : null,
      };

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear el grupo');
      }

      // Redireccionar a la página del grupo recién creado
      router.push(`/group/${data.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      setError(
        error instanceof Error ? error.message : 'Error al crear el grupo'
      );
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: value,
      };

      // If sport changes, update requiredPlayers
      if (name === 'sport') {
        newData.requiredPlayers = getDefaultRequiredPlayers(value);
      }

      return newData;
    });
  };

  const handleDayChange = (day: number) => {
    setFormData((prev) => {
      const days = [...prev.recurrenceDays];
      const index = days.indexOf(day);

      if (index === -1) {
        days.push(day);
      } else {
        days.splice(index, 1);
      }

      return {
        ...prev,
        recurrenceDays: days,
      };
    });
  };

  const calculateNextMatch = () => {
    if (
      formData.recurrenceType === 'NONE' ||
      formData.recurrenceDays.length === 0
    ) {
      return null;
    }

    const today = new Date();
    const todayDay = today.getDay();

    const sortedDays = [...formData.recurrenceDays].sort();

    let nextDay: number | null = null;
    for (const day of sortedDays) {
      if (day > todayDay) {
        nextDay = day;
        break;
      }
    }

    if (nextDay === null && sortedDays.length > 0) {
      nextDay = sortedDays[0];
    } else if (nextDay === null) {
      return null;
    }

    let daysToAdd = nextDay - todayDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    const nextMatchDate = new Date(today);
    nextMatchDate.setDate(today.getDate() + daysToAdd);

    if (formData.recurrenceTime) {
      const [hours, minutes] = formData.recurrenceTime.split(':').map(Number);
      nextMatchDate.setHours(hours, minutes, 0, 0);
    }

    return nextMatchDate;
  };

  const getDefaultRequiredPlayers = (sport: string): number => {
    switch (sport) {
      case 'Fútbol':
        return 10;
      case 'Baloncesto':
        return 6;
      case 'Pádel':
        return 4;
      case 'Tenis':
        return 2;
      case 'Voleibol':
        return 6;
      case 'Natación':
        return 4;
      default:
        return 4;
    }
  };

  return (
    <Layout>
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='bg-white rounded-xl shadow-md p-6'>
          <div className='flex items-center gap-4 mb-6'>
            <Button
              variant='outline'
              onClick={() => router.back()}
              className='flex items-center gap-2'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                  clipRule='evenodd'
                />
              </svg>
              Volver
            </Button>
            <h1 className='text-2xl font-bold text-gray-800'>
              Crear Nuevo Grupo
            </h1>
          </div>

          {error && (
            <div className='mb-4 p-3 bg-red-100 text-red-700 rounded-lg'>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div>
              <label
                htmlFor='name'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Nombre del Grupo
              </label>
              <input
                type='text'
                id='name'
                name='name'
                value={formData.name}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                placeholder='Ej: Fútbol Los Domingos'
              />
            </div>

            <div>
              <label
                htmlFor='sport'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Deporte
              </label>
              <select
                id='sport'
                name='sport'
                value={formData.sport}
                onChange={handleChange}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='Fútbol'>Fútbol</option>
                <option value='Baloncesto'>Baloncesto</option>
                <option value='Pádel'>Pádel</option>
                <option value='Tenis'>Tenis</option>
                <option value='Voleibol'>Voleibol</option>
                <option value='Otros'>Otros</option>
              </select>
            </div>

            <div>
              <label
                htmlFor='description'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Descripción
              </label>
              <textarea
                id='description'
                name='description'
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                placeholder='Describe tu grupo...'
              />
            </div>

            <div>
              <label
                htmlFor='location'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Ubicación
              </label>
              <input
                type='text'
                id='location'
                name='location'
                value={formData.location}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='teamAName'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Nombre del Equipo A
              </label>
              <input
                type='text'
                id='teamAName'
                name='teamAName'
                value={formData.teamAName}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                placeholder='Ej: Rojos'
              />
            </div>

            <div>
              <label
                htmlFor='teamBName'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Nombre del Equipo B
              </label>
              <input
                type='text'
                id='teamBName'
                name='teamBName'
                value={formData.teamBName}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                placeholder='Ej: Azules'
              />
            </div>

            <div>
              <label
                htmlFor='requiredPlayers'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Cantidad de jugadores
              </label>
              <input
                type='number'
                id='requiredPlayers'
                name='requiredPlayers'
                value={formData.requiredPlayers}
                onChange={handleChange}
                min={2}
                required
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
              <p className='mt-1 text-sm text-gray-500'>
                Número total de jugadores que participarán en el partido (debe
                ser par)
              </p>
            </div>

            {/* Sección de recurrencia */}
            <div className='border-t pt-4'>
              <h3 className='text-md font-medium text-gray-700 mb-3'>
                Programación de partidos
              </h3>

              <div className='mb-4'>
                <label
                  htmlFor='recurrenceType'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Frecuencia
                </label>
                <select
                  id='recurrenceType'
                  name='recurrenceType'
                  value={formData.recurrenceType}
                  onChange={handleChange}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='NONE'>Sin programación automática</option>
                  <option value='WEEKLY'>Semanal</option>
                  <option value='BIWEEKLY'>Quincenal</option>
                  <option value='MONTHLY'>Mensual</option>
                </select>
              </div>

              {formData.recurrenceType !== 'NONE' && (
                <>
                  <div className='mb-4'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Días de la semana
                    </label>
                    <div className='grid grid-cols-7 gap-2'>
                      {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
                        <div key={index} className='text-center'>
                          <label className='flex flex-col items-center'>
                            <span className='text-sm'>{day}</span>
                            <input
                              type='checkbox'
                              checked={formData.recurrenceDays.includes(index)}
                              onChange={() => handleDayChange(index)}
                              className='mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='mb-4'>
                    <label
                      htmlFor='recurrenceTime'
                      className='block text-sm font-medium text-gray-700 mb-1'
                    >
                      Hora
                    </label>
                    <input
                      type='time'
                      id='recurrenceTime'
                      name='recurrenceTime'
                      value={formData.recurrenceTime || '18:00'}
                      onChange={handleChange}
                      className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>

                  <div className='p-3 bg-blue-50 text-blue-800 rounded-lg mb-4'>
                    {formData.recurrenceDays.length > 0 ? (
                      <div>
                        <p className='font-medium'>Próximo partido:</p>
                        <p>
                          {calculateNextMatch()?.toLocaleDateString('es-ES', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) || 'Selecciona al menos un día de la semana'}
                        </p>
                      </div>
                    ) : (
                      <p>Selecciona al menos un día de la semana</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className='flex space-x-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => router.push('/groups')}
                fullWidth
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type='submit'
                variant='primary'
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creando...' : 'Crear Grupo'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
