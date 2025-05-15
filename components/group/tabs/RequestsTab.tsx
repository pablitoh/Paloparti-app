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
        <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
          <ul className='divide-y divide-gray-200'>
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className='hover:bg-gray-50 transition-colors'
              >
                <div className='px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0 h-10 w-10'>
                      <Avatar
                        className='h-10 w-10 rounded-full'
                        src={request.avatar || ''}
                        alt={request.name || ''}
                      />
                    </div>
                    <div className='ml-4'>
                      <div className='flex items-center'>
                        <div className='text-sm font-medium text-gray-900'>
                          {request.name}
                        </div>
                        <span className='ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700'>
                          Pendiente
                        </span>
                      </div>
                      {request.email && (
                        <div className='text-sm text-gray-500'>
                          {request.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='flex space-x-2 mt-3 sm:mt-0'>
                    <button
                      onClick={() =>
                        handleMembershipRequest(request.userId, 'APPROVE')
                      }
                      className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors'
                    >
                      <CheckCircleIcon className='h-4 w-4 mr-1' />
                      Aprobar
                    </button>
                    <button
                      onClick={() =>
                        handleMembershipRequest(request.userId, 'REJECT')
                      }
                      className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors'
                    >
                      <XCircleIcon className='h-4 w-4 mr-1' />
                      Rechazar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='bg-white rounded-lg p-6 text-center border border-gray-200 shadow-sm'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-12 w-12 mx-auto text-gray-400 mb-4'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1}
              d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
            />
          </svg>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            No hay solicitudes pendientes
          </h3>
          <p className='text-gray-500 max-w-md mx-auto'>
            No tienes usuarios esperando aprobación para unirse al grupo en este
            momento.
          </p>
        </div>
      )}
    </div>
  );
};

export default RequestsTab;
