import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  ...props
}) => {
  const baseStyles =
    'rounded-lg font-medium transition-all duration-200 transform active:scale-95';

  const variantStyles = {
    primary:
      'bg-gradient-green text-white hover:shadow-green focus:ring-4 focus:ring-primary-200',
    secondary:
      'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-4 focus:ring-gray-200',
    outline:
      'border-2 border-primary-500 text-primary-600 hover:bg-primary-50 focus:ring-4 focus:ring-primary-200',
    danger:
      'bg-error-500 text-white hover:bg-error-600 focus:ring-4 focus:ring-error-200',
    success:
      'bg-success-500 text-white hover:bg-success-600 focus:ring-4 focus:ring-success-200',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  // Estilos para botones deshabilitados
  const disabledStyles = disabled
    ? 'opacity-60 cursor-not-allowed bg-gray-300 text-gray-500 border-gray-300 hover:bg-gray-300 hover:text-gray-500 hover:border-gray-300 hover:shadow-none focus:ring-0 transform-none'
    : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${disabledStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
