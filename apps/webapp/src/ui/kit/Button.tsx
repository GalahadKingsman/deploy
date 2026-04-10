import React from 'react';
import { SIZES } from './constants.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 'var(--radius-md, 8px)',
    fontWeight: '600',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled || loading ? 0.6 : 1,
    position: 'relative',
    ...style,
  };

  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-accent)',
      color: 'var(--color-text-0)',
    },
    secondary: {
      backgroundColor: 'var(--color-bg-1)',
      color: 'var(--color-text-0)',
      border: '1px solid var(--color-stroke)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-0)',
    },
  };

  const sizeStyles: Record<typeof size, React.CSSProperties> = {
    sm: {
      minHeight: SIZES.BUTTON_HEIGHT_SM,
      padding: 'var(--spacing-3, 4px) var(--spacing-8, 12px)',
      fontSize: '14px',
    },
    md: {
      minHeight: SIZES.BUTTON_HEIGHT_MD,
      padding: 'var(--spacing-4, 6px) var(--spacing-10, 16px)',
      fontSize: '15px',
    },
    lg: {
      minHeight: SIZES.BUTTON_HEIGHT_LG,
      padding: 'var(--spacing-6, 8px) var(--spacing-12, 24px)',
      fontSize: '16px',
    },
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    props.onClick?.(e);
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!disabled && !loading && variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-1)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      {...(props as Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        'onClick' | 'onMouseEnter' | 'onMouseLeave'
      >)}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            marginRight: children ? 'var(--spacing-3, 4px)' : 0,
          }}
        />
      )}
      {children}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </button>
  );
}
