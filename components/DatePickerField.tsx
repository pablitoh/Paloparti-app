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
    return format(new Date(date), 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
};

export const parseInputDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    console.error('Error parsing input date:', error);
    return null;
  }
};
