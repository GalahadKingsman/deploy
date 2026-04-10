import React from 'react';
import { cn } from '../utils/cn.js';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'as'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  children,
  className,
  onClick,
  type = 'button',
  asChild = false,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    border: 'none',
    borderRadius: 'var(--r-md)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    transition: 'opacity 0.2s, background-color 0.2s',
    opacity: disabled ? 0.5 : 1,
  };

  const sizeStyles: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
    sm: {
      padding: 'var(--sp-2) var(--sp-3)',
      fontSize: 'var(--text-sm)',
    },
    md: {
      padding: 'var(--sp-3) var(--sp-4)',
      fontSize: 'var(--text-md)',
    },
    lg: {
      padding: 'var(--sp-4) var(--sp-6)',
      fontSize: 'var(--text-lg)',
    },
  };

  const variantStyles: Record<'primary' | 'secondary' | 'ghost' | 'danger', React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent)',
      color: 'var(--bg)',
    },
    secondary: {
      backgroundColor: 'var(--card)',
      color: 'var(--fg)',
      border: '1px solid var(--border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--fg)',
    },
    danger: {
      backgroundColor: 'var(--danger)',
      color: '#fff',
    },
  };

  const spinnerStyles: React.CSSProperties = {
    width: '1em',
    height: '1em',
    border: '2px solid currentColor',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  };

  const combinedStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  // If asChild, clone the child element and apply styles
  // Note: If Button is converted to use forwardRef in the future,
  // consider using @radix-ui/react-slot (Slot) instead of cloneElement
  // for proper ref forwarding.
  if (asChild && React.isValidElement(children)) {
    const child = React.Children.only(children) as React.ReactElement;

    // Handle onClick for disabled state - prevent navigation/action
    // For <a> and <Link> elements, disabled is not native, so we prevent
    // navigation via preventDefault() and use aria-disabled for accessibility
    const handleClick = (e: React.MouseEvent) => {
      if (disabled || isLoading) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Call Button's onClick if provided
      if (onClick) {
        onClick(e);
      }
      // Call child's onClick if provided
      if (child.props.onClick) {
        child.props.onClick(e);
      }
    };

    // Handle keyboard events (Enter/Space) for disabled state
    // React Router Link handles Enter natively, but we need to block it when disabled
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled || isLoading) {
        // Block Enter and Space keys when disabled
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      // Call child's onKeyDown if provided
      if (child.props.onKeyDown) {
        child.props.onKeyDown(e);
      }
    };

    return (
      <>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .button-as-child:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
          }
        `}</style>
        {React.cloneElement(child, {
          className: cn(className, 'button-as-child', child.props.className),
          style: {
            ...combinedStyles,
            textDecoration: 'none',
            ...child.props.style,
          },
          onClick: handleClick,
          onKeyDown: handleKeyDown,
          ...(disabled && { 'aria-disabled': true }),
          ...props,
        })}
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `}</style>
      <button
        type={type}
        disabled={disabled || isLoading}
        onClick={onClick}
        className={cn(className)}
        style={combinedStyles}
        {...props}
      >
        {isLoading && <span style={spinnerStyles} />}
        {!isLoading && leftIcon && <span>{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span>{rightIcon}</span>}
      </button>
    </>
  );
}
