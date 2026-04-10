import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn.js';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  as?: 'div' | 'button' | 'a';
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ListItem({
  title,
  subtitle,
  right,
  onClick,
  as = onClick ? 'button' : 'div',
  href,
  className,
  style,
}: ListItemProps) {
  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-3) var(--sp-4)',
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    marginBottom: 'var(--sp-2)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background-color 0.2s',
    textAlign: 'left',
    width: '100%',
    ...style,
  };

  const content = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--fg)',
            marginBottom: subtitle ? 'var(--sp-1)' : 0,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted-fg)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right && <div>{right}</div>}
    </>
  );

  const interactiveClassName = onClick ? 'list-item-interactive' : '';

  return (
    <>
      {onClick && (
        <style>{`
          .list-item-interactive:hover {
            background-color: var(--card-2) !important;
          }
          .list-item-interactive:active {
            background-color: var(--card-2) !important;
            opacity: 0.9;
          }
        `}</style>
      )}
      {as === 'a' && href ? (
        <Link
          to={href}
          className={cn(className, interactiveClassName)}
          style={baseStyles}
          onClick={onClick}
        >
          {content}
        </Link>
      ) : as === 'button' ? (
        <button
          type="button"
          className={cn(className, interactiveClassName)}
          style={{
            ...baseStyles,
            border: 'none',
            fontFamily: 'var(--font-sans)',
          }}
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <div className={cn(className, interactiveClassName)} style={baseStyles} onClick={onClick}>
          {content}
        </div>
      )}
    </>
  );
}
