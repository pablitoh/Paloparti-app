import { toast, ToastOptions } from 'react-hot-toast';

// Objeto para controlar los toasts activos
const activeToasts: Record<string, boolean> = {};
let lastToastTime = 0;

// Tiempo mínimo entre toasts (en ms)
const MIN_TOAST_INTERVAL = 300;

// Configuración común para todos los toasts
const defaultOptions: ToastOptions = {
  duration: 3000,
  position: 'bottom-right',
};

// Opciones específicas para cada tipo de toast
const successOptions: ToastOptions = {
  ...defaultOptions,
  style: {
    background: '#10B981',
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: '500',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
};

const errorOptions: ToastOptions = {
  ...defaultOptions,
  duration: 4000, // Dejamos los errores más tiempo
  style: {
    background: '#EF4444',
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: '500',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
};

/**
 * Muestra un toast de éxito controlado
 */
export function showSuccessToast(message: string): string | null {
  const now = Date.now();

  // Si hay demasiados toasts activos o ha pasado poco tiempo, ignorar
  if (
    Object.keys(activeToasts).length > 2 ||
    now - lastToastTime < MIN_TOAST_INTERVAL
  ) {
    console.log(
      'Toast ignorado (demasiados activos o muy frecuente):',
      message
    );
    return null;
  }

  // Generar ID único para este toast
  const id = `success-${now}`;
  activeToasts[id] = true;
  lastToastTime = now;

  // Mostrar toast y eliminar del registro cuando se cierre
  toast.success(message, {
    ...successOptions,
    id,
  });

  // Programar la eliminación del registro cuando expire el toast
  setTimeout(() => {
    delete activeToasts[id];
  }, successOptions.duration || 3000);

  return id;
}

/**
 * Muestra un toast de error controlado
 */
export function showErrorToast(message: string): string | null {
  const now = Date.now();

  // Si hay demasiados toasts activos o ha pasado poco tiempo, ignorar
  if (
    Object.keys(activeToasts).length > 2 ||
    now - lastToastTime < MIN_TOAST_INTERVAL
  ) {
    console.log(
      'Toast de error ignorado (demasiados activos o muy frecuente):',
      message
    );
    return null;
  }

  // Generar ID único para este toast
  const id = `error-${now}`;
  activeToasts[id] = true;
  lastToastTime = now;

  // Mostrar toast y eliminar del registro cuando se cierre
  toast.error(message, {
    ...errorOptions,
    id,
  });

  // Programar la eliminación del registro cuando expire el toast
  setTimeout(() => {
    delete activeToasts[id];
  }, errorOptions.duration || 4000);

  return id;
}

/**
 * Limpia todos los toasts activos
 */
export function clearAllToasts(): void {
  toast.dismiss();
  Object.keys(activeToasts).forEach((id) => {
    delete activeToasts[id];
  });
}
