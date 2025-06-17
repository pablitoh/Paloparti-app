import React from 'react';
import { Avatar } from '@mui/material';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface RequestsTabProps {
  pendingRequests: Array<{
    id: string;
    userId: string;
    name: string;
    email?: string;
    avatar?: string;
  }>;
  isLoading?: boolean;
  handleMembershipRequest: (
    userId: string,
    action: 'APPROVE' | 'REJECT'
  ) => Promise<void>;
}

const RequestsTab: React.FC<RequestsTabProps> = ({
  pendingRequests = [],
  isLoading = false,
  handleMembershipRequest,
}) => {
  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-semibold text-gray-900'>
          Solicitudes pendientes
        </h3>
        <span className='text-sm text-gray-500'>
          {pendingRequests.length || 0} solicitudes
        </span>
      </div>

      {pendingRequests && pendingRequests.length > 0 ? (
        <div className='bg-white rounded-2xl border border-primary-200 shadow-green-lg overflow-hidden'>
          <ul className='divide-y divide-primary-100'>
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className='hover:bg-primary-25 transition-colors duration-200'
              >
                <div className='px-6 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0 h-12 w-12'>
                      <Avatar
                        className='h-12 w-12 rounded-full border-2 border-primary-100'
                        src={request.avatar || ''}
                        alt={request.name || ''}
                      />
                    </div>
                    <div className='ml-4'>
                      <div className='flex items-center'>
                        <div className='text-sm font-semibold text-primary-900'>
                          {request.name}
                        </div>
                        <span className='ml-2 px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 border border-orange-200'>
                          Pendiente
                        </span>
                      </div>
                      {request.email && (
                        <div className='text-sm text-primary-600 mt-1'>
                          {request.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='flex space-x-3 mt-4 sm:mt-0'>
                    <button
                      onClick={() =>
                        handleMembershipRequest(request.userId, 'APPROVE')
                      }
                      className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-green-sm text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all duration-200'
                    >
                      <CheckCircleIcon className='h-4 w-4 mr-2' />
                      Aprobar
                    </button>
                    <button
                      onClick={() =>
                        handleMembershipRequest(request.userId, 'REJECT')
                      }
                      className='inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-lg shadow-sm text-red-700 bg-white hover:bg-red-50 transition-all duration-200'
                    >
                      <XCircleIcon className='h-4 w-4 mr-2' />
                      Rechazar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='bg-white rounded-2xl p-8 text-center border border-primary-200 shadow-green-lg'>
          <div className='w-16 h-16 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
            <span className='text-2xl' role='img' aria-label='requests'>
              📋
            </span>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            No hay solicitudes pendientes
          </h3>
          <p className='text-primary-600 max-w-md mx-auto'>
            Todas las solicitudes han sido procesadas. Las nuevas solicitudes
            aparecerán aquí.
          </p>
        </div>
      )}
    </div>
  );
};

export default RequestsTab;
