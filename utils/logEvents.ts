// Este archivo es un barrel file que simplemente re-exporta
// cosas de otros archivos para mantener la compatibilidad
// con el código existente.

// Comprobamos si estamos en el servidor
const isServer = typeof window === 'undefined';

// Siempre exportamos los tipos
export { LogAction } from './logTypes';

// Solo exportamos las funciones si estamos en el servidor
// Esta es una técnica para evitar que el código del cliente
// importe funciones que solo funcionan en el servidor
export const logGroupEvent = isServer
  ? require('./serverLogEvents').logGroupEvent
  : () => {
      console.warn(
        'logGroupEvent fue llamado en el cliente. Esta función solo debe usarse en el servidor.'
      );
      return Promise.resolve();
    };

export const getGroupLogs = isServer
  ? require('./serverLogEvents').getGroupLogs
  : () => {
      console.warn(
        'getGroupLogs fue llamado en el cliente. Esta función solo debe usarse en el servidor.'
      );
      return Promise.resolve({
        logs: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 20,
        },
      });
    };
