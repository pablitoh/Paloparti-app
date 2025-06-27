import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Button from '../components/Button';
import Layout from '../components/Layout';
import ColorPicker from '../components/ColorPicker';
import { useAuth } from '../contexts/AuthContext';
import { RecurrenceType } from '../types/match';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function CreateGroup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    sport: 'Fútbol',
    teamAName: 'Equipo A',
    teamBName: 'Equipo B',
    teamAColor: '#3B82F6', // Azul por defecto
    teamBColor: '#EF4444', // Rojo por defecto
    recurrenceType: 'NONE',
    recurrenceDays: [] as number[],
    recurrenceTime: '18:00',
    requiredPlayers: 5,
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
        <div className='min-h-screen bg-gradient-green-soft flex justify-center items-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4'></div>
            <p className='text-primary-700 font-medium'>Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      const dayValue = parseInt(checkbox.value);

      if (checkbox.checked) {
        setFormData((prev) => ({
          ...prev,
          recurrenceDays: [...prev.recurrenceDays, dayValue],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          recurrenceDays: prev.recurrenceDays.filter((day) => day !== dayValue),
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Calcular próxima fecha de partido
      const nextMatch = new Date();
      nextMatch.setDate(nextMatch.getDate() + 7); // Una semana en el futuro

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          requiredPlayers: Number(formData.requiredPlayers),
          nextMatch: nextMatch ? nextMatch.toISOString() : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear el grupo');
      }

      // Redirect to the new group
      router.push(`/group/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayOptions = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
  ];

  return (
    <Layout>
      <div className='min-h-screen bg-gradient-green-soft py-8 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-2xl mx-auto'>
          <div className='bg-white rounded-2xl shadow-green-lg p-8'>
            {/* Header */}
            <div className='flex items-center gap-4 mb-8'>
              <Link
                href='/groups'
                className='inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors bg-primary-50 px-4 py-2 rounded-xl hover:bg-primary-100'
              >
                <ArrowLeftIcon className='h-4 w-4 mr-1' />
                Volver a grupos
              </Link>
            </div>

            <div className='text-center mb-8'>
              <div className='mx-auto w-16 h-16 bg-gradient-green rounded-full flex items-center justify-center mb-4'>
                <svg
                  className='w-8 h-8 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                  />
                </svg>
              </div>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Crear Nuevo Grupo
              </h1>
              <p className='text-gray-600'>
                Configura tu grupo deportivo y empieza a organizar partidos
              </p>
            </div>

            {error && (
              <div className='mb-6 p-4 bg-error-50 border border-error-200 text-error-600 rounded-xl'>
                <p className='font-medium'>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-6'>
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-gray-700 mb-2'
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
                  className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                  placeholder='Ej: Fútbol Los Domingos'
                />
              </div>

              <div>
                <label
                  htmlFor='description'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Descripción
                </label>
                <input
                  type='text'
                  id='description'
                  name='description'
                  value={formData.description}
                  onChange={handleChange}
                  className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                  placeholder='Describe brevemente tu grupo...'
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div>
                  <label
                    htmlFor='sport'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Deporte
                  </label>
                  <select
                    id='sport'
                    name='sport'
                    value={formData.sport}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                  >
                    <option value='Fútbol'>Fútbol</option>
                    <option value='Baloncesto'>Baloncesto</option>
                    <option value='Tenis'>Tenis</option>
                    <option value='Pádel'>Pádel</option>
                    <option value='Voleibol'>Voleibol</option>
                    <option value='Hockey'>Hockey</option>
                    <option value='Rugby'>Rugby</option>
                    <option value='Otro'>Otro</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='location'
                    className='block text-sm font-medium text-gray-700 mb-2'
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
                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                    placeholder='Ej: Parque Central'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div>
                  <label
                    htmlFor='teamAName'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Nombre del Equipo A
                  </label>
                  <input
                    type='text'
                    id='teamAName'
                    name='teamAName'
                    value={formData.teamAName}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                  />
                </div>

                <div>
                  <label
                    htmlFor='teamBName'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Nombre del Equipo B
                  </label>
                  <input
                    type='text'
                    id='teamBName'
                    name='teamBName'
                    value={formData.teamBName}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <ColorPicker
                  label='Color del Equipo A'
                  value={formData.teamAColor}
                  onChange={(color) =>
                    setFormData((prev) => ({ ...prev, teamAColor: color }))
                  }
                />

                <ColorPicker
                  label='Color del Equipo B'
                  value={formData.teamBColor}
                  onChange={(color) =>
                    setFormData((prev) => ({ ...prev, teamBColor: color }))
                  }
                />
              </div>

              <div>
                <label
                  htmlFor='requiredPlayers'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Total de Jugadores Requeridos
                </label>
                <input
                  type='number'
                  id='requiredPlayers'
                  name='requiredPlayers'
                  value={formData.requiredPlayers}
                  onChange={handleChange}
                  min='2'
                  max='30'
                  className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                />
                <p className='mt-1 text-sm text-gray-500'>
                  Número total de jugadores necesarios para el partido
                </p>
              </div>

              {/* Recurrence Section */}
              <div className='bg-primary-50 rounded-xl p-6 border border-primary-200'>
                <h3 className='text-lg font-medium text-primary-900 mb-4'>
                  Configuración de Recurrencia (Opcional)
                </h3>
                <div className='space-y-4'>
                  <div>
                    <label
                      htmlFor='recurrenceType'
                      className='block text-sm font-medium text-gray-700 mb-2'
                    >
                      Tipo de Recurrencia
                    </label>
                    <select
                      id='recurrenceType'
                      name='recurrenceType'
                      value={formData.recurrenceType}
                      onChange={handleChange}
                      className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                    >
                      <option value='NONE'>Sin recurrencia</option>
                      <option value='WEEKLY'>Semanal</option>
                      <option value='BIWEEKLY'>Quincenal</option>
                      <option value='MONTHLY'>Mensual</option>
                    </select>
                  </div>

                  {formData.recurrenceType !== 'NONE' && (
                    <>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Días de la Semana
                        </label>
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                          {dayOptions.map((day) => (
                            <label
                              key={day.value}
                              className='flex items-center space-x-2 p-2 rounded-lg hover:bg-primary-100 transition-colors'
                            >
                              <input
                                type='checkbox'
                                value={day.value}
                                checked={formData.recurrenceDays.includes(
                                  day.value
                                )}
                                onChange={handleChange}
                                className='rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200'
                              />
                              <span className='text-sm text-gray-700'>
                                {day.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor='recurrenceTime'
                          className='block text-sm font-medium text-gray-700 mb-2'
                        >
                          Hora Predeterminada
                        </label>
                        <input
                          type='time'
                          id='recurrenceTime'
                          name='recurrenceTime'
                          value={formData.recurrenceTime}
                          onChange={handleChange}
                          className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all duration-200'
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className='flex flex-col sm:flex-row gap-4 pt-6'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => router.back()}
                  className='flex-1'
                >
                  Cancelar
                </Button>
                <Button
                  type='submit'
                  variant='primary'
                  disabled={isSubmitting}
                  className='flex-1 shadow-green'
                >
                  {isSubmitting ? (
                    <div className='flex items-center justify-center'>
                      <div className='animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2'></div>
                      Creando grupo...
                    </div>
                  ) : (
                    'Crear Grupo'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Elementos decorativos */}
          <div className='absolute top-10 right-10 w-20 h-20 bg-accent-200 rounded-full opacity-30 animate-pulse pointer-events-none'></div>
          <div
            className='absolute bottom-20 left-10 w-16 h-16 bg-primary-300 rounded-full opacity-40 animate-pulse pointer-events-none'
            style={{ animationDelay: '2s' }}
          ></div>
        </div>
      </div>
    </Layout>
  );
}
