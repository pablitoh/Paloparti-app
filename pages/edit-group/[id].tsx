import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Button from '../../components/Button';
import Layout from '../../components/Layout';
import { useSession } from 'next-auth/react';
import { RecurrenceType } from '../../types/match';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  avatar: string | null;
  role: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  location: string;
  members: Member[];
  recurrenceType?: string | null;
  recurrenceDays?: number[];
  recurrenceTime?: string | null;
  requiredPlayers: number;
  teamAName: string;
  teamBName: string;
  isAdmin: boolean;
}

export default function EditGroup() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    sport: '',
    description: '',
    location: '',
    recurrenceType: 'NONE',
    recurrenceDays: [] as number[],
    recurrenceTime: '18:00', // Por defecto, 6 PM
    requiredPlayers: 10,
    teamAName: 'Equipo A',
    teamBName: 'Equipo B',
  });
  const { id } = router.query;

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Obtener los datos del grupo
  useEffect(() => {
    const fetchGroupDetails = async () => {
      if (!id || !session?.user) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/groups/${id}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.message || 'Error al cargar los detalles del grupo'
          );
        }

        const data = await response.json();
        console.log('Group data received:', data);
        console.log('Current authenticated user:', session.user);

        // También obtener los miembros del grupo
        try {
          const membersResponse = await fetch(`/api/groups/${id}/members`);

          if (membersResponse.ok) {
            const membersResult = await membersResponse.json();
            console.log('Members data received:', membersResult);
            if (membersResult.members && Array.isArray(membersResult.members)) {
              setMembers(membersResult.members);
            }
          } else {
            console.error('Error al cargar los miembros del grupo');
          }
        } catch (membersError) {
          console.error('Error fetching members:', membersError);
        }

        // Guardar datos del grupo
        setGroup(data);

        // Inicializar el formulario con los datos actuales
        setFormData({
          name: data.name,
          sport: data.sport,
          description: data.description || '',
          location: data.location,
          recurrenceType: data.recurrenceType || 'NONE',
          recurrenceDays: data.recurrenceDays || [],
          recurrenceTime: data.recurrenceTime || '18:00',
          requiredPlayers: data.requiredPlayers || 10,
          teamAName: data.teamAName || 'Equipo A',
          teamBName: data.teamBName || 'Equipo B',
        });

        // Usar directamente el campo isAdmin de la API
        const isAdminFromApi = data.isAdmin === true;
        setIsAdmin(isAdminFromApi);

        console.log('User ID:', session.user.id);
        console.log('Is Admin from API:', isAdminFromApi);

        if (!isAdminFromApi) {
          // Redirigir si no es administrador
          router.push(`/group/${id}`);
        }
      } catch (error) {
        console.error('Error fetching group details:', error);
        setError('Ha ocurrido un error al cargar los datos del grupo');
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      fetchGroupDetails();
    }
  }, [id, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user || !isAdmin) {
      setError('No tienes permisos para editar este grupo');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      // Validar que requiredPlayers sea un número par
      if (formData.requiredPlayers % 2 !== 0) {
        setError('El número de jugadores requeridos debe ser par');
        setIsSubmitting(false);
        return;
      }

      // Calcular próxima fecha de partido si corresponde
      const nextMatch = calculateNextMatch();

      // Log the current form data
      console.log('Current form data:', formData);
      console.log('Team A name:', formData.teamAName);
      console.log('Team B name:', formData.teamBName);

      // Ensure teamAName and teamBName are properly formed
      const validatedTeamAName = formData.teamAName
        ? String(formData.teamAName)
        : 'Equipo A';
      const validatedTeamBName = formData.teamBName
        ? String(formData.teamBName)
        : 'Equipo B';

      const dataToSend = {
        ...formData,
        teamAName: validatedTeamAName,
        teamBName: validatedTeamBName,
        nextMatch: nextMatch ? nextMatch.toISOString() : null,
        requiredPlayers: Number(formData.requiredPlayers),
      };

      console.log(
        'Sending group update data:',
        JSON.stringify(dataToSend, null, 2)
      );
      console.log('Team names in request:', {
        teamAName: dataToSend.teamAName,
        teamBName: dataToSend.teamBName,
      });
      console.log('Request URL:', `/api/groups/${id}`);

      const response = await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar el grupo');
      }

      setSuccess('Grupo actualizado correctamente');

      // Redirect to group page after successful update
      setTimeout(() => {
        router.push(`/group/${id}`);
      }, 1000);
    } catch (error) {
      console.error('Error al actualizar grupo:', error);
      setError(
        error instanceof Error ? error.message : 'Error al actualizar el grupo'
      );
    } finally {
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
        [name]: name === 'requiredPlayers' ? Number(value) : value,
      };

      // If sport changes, update requiredPlayers
      if (name === 'sport') {
        newData.requiredPlayers = getDefaultRequiredPlayers(value);
      }

      return newData;
    });
  };

  // Función para manejar cambios en los checkbox de días
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

  // Función para calcular la próxima fecha de partido basado en la recurrencia
  const calculateNextMatch = () => {
    if (
      formData.recurrenceType === 'NONE' ||
      formData.recurrenceDays.length === 0
    ) {
      return null;
    }

    const today = new Date();
    const todayDay = today.getDay(); // 0 = domingo, 6 = sábado

    // Ordenamos los días seleccionados
    const sortedDays = [...formData.recurrenceDays].sort();

    // Buscamos el próximo día de la semana que ocurra
    let nextDay: number | null = null;
    for (const day of sortedDays) {
      if (day > todayDay) {
        nextDay = day;
        break;
      }
    }

    // Si no encontramos un día mayor, tomamos el primero (próxima semana)
    if (nextDay === null && sortedDays.length > 0) {
      nextDay = sortedDays[0];
    } else if (nextDay === null) {
      return null;
    }

    // Calculamos cuántos días tenemos que avanzar
    let daysToAdd = nextDay - todayDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Avanzamos a la próxima semana
    }

    // Creamos la fecha para el próximo partido
    const nextMatchDate = new Date(today);
    nextMatchDate.setDate(today.getDate() + daysToAdd);

    // Establecemos la hora
    if (formData.recurrenceTime) {
      const [hours, minutes] = formData.recurrenceTime.split(':').map(Number);
      nextMatchDate.setHours(hours, minutes, 0, 0);
    }

    return nextMatchDate;
  };

  const handleMemberAction = async (
    memberId: string,
    action: 'promote' | 'demote' | 'remove'
  ) => {
    if (!isAdmin || !group) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      console.log('Sending member action:', { memberId, action });

      // Find the member in the members array by userId
      const memberToUpdate = members.find(
        (member) => member.userId === memberId
      );

      if (!memberToUpdate) {
        throw new Error('Miembro no encontrado');
      }

      console.log('Found member to update:', memberToUpdate);

      // Use the new API endpoint for member role management
      const response = await fetch(`/api/groups/${id}/member-role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberId,
          action,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Error al modificar el miembro');
      }

      // Actualizar la lista de miembros localmente para reflejar el cambio
      let updatedMembers;

      if (action === 'remove') {
        // Eliminar miembro de la lista - filter by userId, not by member.id
        updatedMembers = members.filter((member) => member.userId !== memberId);
      } else {
        // Actualizar rol del miembro - map by userId, not by member.id
        updatedMembers = members.map((member) => {
          if (member.userId === memberId) {
            return {
              ...member,
              role: action === 'promote' ? 'ADMIN' : 'MEMBER',
            };
          }
          return member;
        });
      }

      setMembers(updatedMembers);

      setSuccess(data.message || 'Operación completada con éxito');
    } catch (error) {
      console.error('Error:', error);
      setError(
        error instanceof Error ? error.message : 'Error al realizar la acción'
      );
    } finally {
      setIsSubmitting(false);
    }
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

  if (isLoading) {
    return (
      <Layout>
        <div className='flex justify-center items-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
        </div>
      </Layout>
    );
  }

  if (error && !group) {
    return (
      <Layout>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-gray-900 mb-4'>
            Error al cargar el grupo
          </h2>
          <p className='text-gray-500 mb-6'>{error}</p>
          <Button onClick={() => router.back()} variant='primary'>
            Volver
          </Button>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-gray-900 mb-4'>
            Acceso restringido
          </h2>
          <p className='text-gray-500 mb-6'>
            No tienes permisos para editar este grupo
          </p>
          <Button onClick={() => router.push(`/group/${id}`)} variant='primary'>
            Volver al grupo
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <div className='mb-8'>
          <div className='flex items-center gap-4 mb-6'>
            <Button
              variant='outline'
              onClick={() => router.push(`/group/${id}`)}
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
              Volver al grupo
            </Button>
            <h1 className='text-2xl font-bold text-gray-800'>
              Editar Grupo: {group?.name}
            </h1>
          </div>

          {error && (
            <div className='mb-4 p-3 bg-red-100 text-red-700 rounded-lg'>
              {error}
            </div>
          )}

          {success && (
            <div className='mb-4 p-3 bg-green-100 text-green-700 rounded-lg'>
              {success}
            </div>
          )}

          {/* Sección 1: Información básica del grupo */}
          <div className='bg-white rounded-xl shadow-md p-6 mb-6'>
            <h2 className='text-lg font-semibold text-gray-700 mb-4'>
              Información del grupo
            </h2>

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
                  placeholder='Descripción opcional del grupo'
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
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
                  placeholder='Ubicación para los partidos'
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div>
                <label
                  htmlFor='requiredPlayers'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Jugadores requeridos para sortear
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
                  Número mínimo de jugadores confirmados necesarios para sortear
                  los equipos (debe ser par)
                </p>
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
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
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
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
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
                        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(
                          (day, index) => (
                            <div key={index} className='text-center'>
                              <label className='flex flex-col items-center'>
                                <span className='text-sm'>{day}</span>
                                <input
                                  type='checkbox'
                                  checked={formData.recurrenceDays.includes(
                                    index
                                  )}
                                  onChange={() => handleDayChange(index)}
                                  className='mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                                />
                              </label>
                            </div>
                          )
                        )}
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

              <div className='flex justify-end'>
                <Button type='submit' variant='primary' disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </div>

          {/* Sección 2: Miembros del grupo */}
          <div className='bg-white rounded-xl shadow-md p-6'>
            <h2 className='text-lg font-semibold text-gray-700 mb-4'>
              Administrar miembros
            </h2>

            {/* Lista de miembros */}
            <div className='space-y-4'>
              {members.length > 0 ? (
                members.map((member) => (
                  <div
                    key={member.id}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <div className='flex items-center gap-3'>
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name || ''}
                          className='w-10 h-10 rounded-full'
                        />
                      ) : (
                        <div className='w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600'>
                          {member.name?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <p className='font-medium'>
                          {member.name || 'Sin nombre'}
                          {member.userId === session?.user?.id && (
                            <span className='ml-2 text-xs text-blue-600'>
                              (Tú)
                            </span>
                          )}
                        </p>
                        <p className='text-xs text-gray-500'>
                          {member.role === 'ADMIN'
                            ? 'Administrador'
                            : 'Miembro'}
                        </p>
                      </div>
                    </div>

                    {/* Acciones para miembros */}
                    {member.userId !== session?.user?.id && (
                      <div className='flex space-x-2'>
                        {member.role === 'MEMBER' ? (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              handleMemberAction(member.userId, 'promote')
                            }
                            disabled={isSubmitting}
                          >
                            Hacer admin
                          </Button>
                        ) : (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              handleMemberAction(member.userId, 'demote')
                            }
                            disabled={isSubmitting}
                          >
                            Quitar admin
                          </Button>
                        )}
                        <Button
                          variant='danger'
                          size='sm'
                          onClick={() => {
                            if (
                              confirm(
                                '¿Estás seguro de eliminar a este miembro del grupo?'
                              )
                            ) {
                              handleMemberAction(member.userId, 'remove');
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className='text-center py-4 text-gray-500'>
                  No hay miembros para mostrar
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
