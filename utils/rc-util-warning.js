/**
 * Este es un reemplazo simplificado para rc-util/es/warning
 * para evitar problemas con importaciones ESM en Next.js
 */

function warning(valid, message) {
  if (
    process.env.NODE_ENV !== 'production' &&
    !valid &&
    console !== undefined
  ) {
    console.error(`Warning: ${message}`);
  }
}

// Exportar como default y como nombre para compatibilidad
export default warning;
export { warning };

// Función usada en rc-select/es/utils/warningPropsUtil.js
export const noteOnce = function noteOnce(valid, message) {
  if (
    process.env.NODE_ENV !== 'production' &&
    !valid &&
    console !== undefined
  ) {
    console.warn(`Warning: ${message}`);
  }
};

export const note = function note(valid, message) {
  if (
    process.env.NODE_ENV !== 'production' &&
    !valid &&
    console !== undefined
  ) {
    console.warn(`Warning: ${message}`);
  }
};

export const resetWarned = () => {};
export const call = warning;
export const warningOnce = warning;
