import React from 'react';
import { format } from 'date-fns';

interface DatePickerFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  minDate,
  maxDate,
  className = '',
}) => {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className='block text-sm font-medium text-gray-700 mb-1'
      >
        {label} {required && <span className='text-red-500'>*</span>}
      </label>
      <input
        id={id}
        name={name}
        type='date'
        value={value}
        onChange={onChange}
        required={required}
        min={minDate}
        max={maxDate}
        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
      />
    </div>
  );
};

export default DatePickerField;

export const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return '';

  try {
    const dateObj = new Date(date);
    // Evitar problemas de zona horaria usando los componentes de fecha locales
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
};

export const parseInputDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  try {
    // Parsear la fecha en formato YYYY-MM-DD evitando problemas de zona horaria
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    // Crear fecha local (month es 0-indexed en JS)
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    console.error('Error parsing input date:', error);
    return null;
  }
};
