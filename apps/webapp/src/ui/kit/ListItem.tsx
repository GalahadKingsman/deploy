import React from 'react';
import { SIZES } from './constants.js';

export interface ListItemProps {
  left?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}

export function ListItem({ left, title, subtitle, right, onClick }: ListItemProps) {
  const chevronIcon =
    right === undefined && onClick ? (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M7 5l5 5-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: SIZES.LIST_ITEM_MIN_HEIGHT,
        padding: 'var(--spacing-6, 8px) var(--spacing-10, 16px)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
        borderBottom: '1px solid var(--color-stroke)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {left && (
        <div
          style={{
            marginRight: 'var(--spacing-6, 8px)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {left}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: '500',
            color: 'var(--color-text-0)',
            marginBottom: subtitle ? 'var(--spacing-2, 2px)' : 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right !== undefined ? (
        <div
          style={{
            marginLeft: 'var(--spacing-6, 8px)',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-muted)',
          }}
        >
          {right}
        </div>
      ) : (
        chevronIcon && (
          <div
            style={{
              marginLeft: 'var(--spacing-6, 8px)',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--color-muted)',
            }}
          >
            {chevronIcon}
          </div>
        )
      )}
    </div>
  );
}
