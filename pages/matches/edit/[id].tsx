import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../../components/Layout';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';
import {
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';

export default function EditMatchPage() {
  const router = useRouter();
  const { id, groupId } = router.query;
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [location, setLocation] = useState('');
  const [locationError, setLocationError] = useState('');
  const [dateError, setDateError] = useState('');

  // Cargar los datos del partido
  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      if (!id) return null;

      const res = await fetch(`/api/matches/${id}`);
      if (!res.ok) {
        throw new Error('Error al cargar los datos del partido');
      }
      return res.json();
    },
    enabled: !!id,
  });

  // Mutación para actualizar el partido
  const editMatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/matches/${id}/edit-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al actualizar el partido');
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidar consultas relacionadas para forzar la recarga de datos
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      queryClient.invalidateQueries({
        queryKey: ['group', groupId, 'next-match'],
      });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });

      showSuccessToast('Partido actualizado correctamente');

      // Redirigir de vuelta al grupo
      router.push(`/group/${groupId}`);
    },
    onError: (error: Error) => {
      console.error('Error al actualizar el partido:', error);
      showErrorToast(error.message || 'Error al actualizar el partido');
    },
  });

  // Establecer valores iniciales cuando se cargan los datos
  useEffect(() => {
    if (match) {
      setLocation(match.location || '');
      if (match.date) {
        // Convertir fecha a formato local para input datetime-local
        const date = new Date(match.date);
        const localDate = new Date(
          date.getTime() - date.getTimezoneOffset() * 60000
        );
        setSelectedDate(localDate.toISOString().slice(0, 16));
      }
    }
  }, [match]);

  // Validar el formulario
  const validateForm = () => {
    let isValid = true;

    if (!selectedDate) {
      setDateError('Por favor selecciona fecha y hora');
      isValid = false;
    } else {
      setDateError('');
    }

    if (!location.trim()) {
      setLocationError('Por favor ingresa una ubicación');
      isValid = false;
    } else {
      setLocationError('');
    }

    return isValid;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await editMatchMutation.mutateAsync({
        date: new Date(selectedDate).toISOString(),
        location: location,
        action: 'update',
        groupId: groupId,
      });
    } catch (error) {
      console.error('Error al actualizar el partido:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cancelación
  const handleCancel = () => {
    router.push(`/group/${groupId}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <Box className='container mx-auto px-4 py-8'>
          <Box className='flex justify-center items-center h-64'>
            <CircularProgress />
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box className='container mx-auto px-4 py-8'>
        <Typography variant='h4' component='h1' className='mb-6 font-bold'>
          Editar partido
        </Typography>

        <Paper elevation={1} className='p-6'>
          <Box component='form' onSubmit={handleSubmit} noValidate>
            <Box mb={3}>
              <Typography
                variant='body1'
                component='label'
                htmlFor='match-date'
                className='block mb-1 font-medium'
              >
                Fecha y hora
              </Typography>
              <input
                id='match-date'
                type='datetime-local'
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className='w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              {dateError && (
                <Typography color='error' variant='caption' className='mt-1'>
                  {dateError}
                </Typography>
              )}
            </Box>

            <Box mb={3}>
              <TextField
                fullWidth
                label='Ubicación'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                error={!!locationError}
                helperText={locationError}
                placeholder='Ingresa la ubicación del partido'
                variant='outlined'
              />
            </Box>

            <Box display='flex' justifyContent='flex-end' gap={2} mt={3}>
              <Button variant='outlined' onClick={handleCancel}>
                Cancelar
              </Button>
              <Button
                variant='contained'
                color='primary'
                type='submit'
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Guardar cambios'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Layout>
  );
}
