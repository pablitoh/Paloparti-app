/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Fuentes para titulares y botones
        heading: ['Poppins', 'Rubik', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        rubik: ['Rubik', 'sans-serif'],
        // Fuentes para texto y descripciones
        body: ['Inter', 'Nunito', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        // Paleta verde principal basada en la imagen
        primary: {
          50: '#ecfdf5', // Verde muy claro
          100: '#d1fae5', // Verde claro
          200: '#a7f3d0', // Verde suave
          300: '#6ee7b7', // Verde medio claro
          400: '#34d399', // Verde medio
          500: '#10b981', // Verde principal
          600: '#059669', // Verde fuerte
          700: '#047857', // Verde oscuro
          800: '#065f46', // Verde muy oscuro
          900: '#064e3b', // Verde más oscuro
        },
        // Colores secundarios para complementar
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Colores de estado manteniendo la consistencia verde
        success: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      backgroundImage: {
        'gradient-green': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-green-light':
          'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        'gradient-green-soft':
          'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      },
      boxShadow: {
        green: '0 4px 14px 0 rgba(16, 185, 129, 0.25)',
        'green-lg': '0 10px 40px rgba(16, 185, 129, 0.2)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
