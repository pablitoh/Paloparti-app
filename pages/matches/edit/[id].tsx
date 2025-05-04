import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input, Form } from 'antd';
import Layout from '../../../components/Layout';
import dayjs from 'dayjs';
import {
  showSuccessToast,
  showErrorToast,
} from '../../../services/toastService';

export default function EditMatchPage() {
  const router = useRouter();
  const { id, groupId } = router.query;
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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

  // Establecer valores iniciales del formulario cuando se cargan los datos
  useEffect(() => {
    if (match) {
      form.setFieldsValue({
        date: match.date ? dayjs(match.date) : null,
        location: match.location || '',
      });
    }
  }, [match, form]);

  // Manejar envío del formulario
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await editMatchMutation.mutateAsync({
        date: values.date?.toISOString(),
        location: values.location,
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
        <div className='container mx-auto px-4 py-8'>
          <div className='flex justify-center items-center h-64'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500'></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-2xl font-bold mb-6'>Editar partido</h1>

        <div className='bg-white rounded-lg shadow-sm p-6'>
          <Form
            form={form}
            layout='vertical'
            onFinish={handleSubmit}
            initialValues={{
              date: match?.date ? dayjs(match.date) : null,
              location: match?.location || '',
            }}
          >
            <Form.Item
              label='Fecha y hora'
              name='date'
              rules={[
                {
                  required: true,
                  message: 'Por favor selecciona fecha y hora',
                },
              ]}
            >
              <DatePicker
                showTime
                format='DD/MM/YYYY HH:mm'
                placeholder='Selecciona fecha y hora'
                className='w-full'
              />
            </Form.Item>

            <Form.Item
              label='Ubicación'
              name='location'
              rules={[
                { required: true, message: 'Por favor ingresa una ubicación' },
              ]}
            >
              <Input placeholder='Ingresa la ubicación del partido' />
            </Form.Item>

            <div className='flex justify-end space-x-4 mt-6'>
              <Button onClick={handleCancel}>Cancelar</Button>
              <Button type='primary' htmlType='submit' loading={loading}>
                Guardar cambios
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </Layout>
  );
}
