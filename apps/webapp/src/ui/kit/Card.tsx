import React from 'react';
import { SIZES } from './constants.js';

export interface CardProps {
  variant?: 'default' | 'glass';
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ variant = 'default', padding = 'md', children, style, onClick }: CardProps) {
  const baseStyle: React.CSSProperties = {
    borderRadius: SIZES.CARD_RADIUS,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s',
    ...style,
  };

  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-stroke)',
      boxShadow: 'var(--shadow-card)',
    },
    glass: {
      backgroundColor: 'rgba(37, 37, 37, 0.8)',
      backdropFilter: 'var(--blur-surface)',
      border: '1px solid rgba(58, 58, 58, 0.4)',
    },
  };

  const paddingStyles: Record<typeof padding, React.CSSProperties> = {
    sm: { padding: 'var(--spacing-6, 8px)' },
    md: { padding: 'var(--spacing-10, 16px)' },
    lg: { padding: 'var(--spacing-12, 24px)' },
  };

  return (
    <div
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...paddingStyles[padding],
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.opacity = '0.9';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.opacity = '1';
        }
      }}
    >
      {children}
    </div>
  );
}
