import React, { useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

const COMMON_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#6B7280', // gray-500
  '#111827', // gray-900
  '#059669', // emerald-600
  '#DC2626', // red-600
  '#2563EB', // blue-600
  '#D97706', // amber-600
  '#7C3AED', // violet-600
];

export default function ColorPicker({
  value,
  onChange,
  label,
  className = '',
}: ColorPickerProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className='block text-sm font-medium text-gray-700'>
          {label}
        </label>
      )}

      <div className='flex items-center gap-3'>
        {/* Vista previa del color actual */}
        <div
          className='w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm cursor-pointer hover:border-gray-400 transition-colors'
          style={{ backgroundColor: value }}
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          title='Click para color personalizado'
        />

        {/* Input de color personalizado */}
        {showCustomPicker && (
          <input
            type='color'
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className='w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer'
          />
        )}

        {/* Paleta de colores comunes */}
        <div className='flex flex-wrap gap-1'>
          {COMMON_COLORS.map((color) => (
            <button
              key={color}
              type='button'
              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                value === color
                  ? 'border-gray-800 scale-110'
                  : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
              title={`Seleccionar ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Mostrar código del color */}
      <div className='text-xs text-gray-500 font-mono'>{value}</div>
    </div>
  );
}
