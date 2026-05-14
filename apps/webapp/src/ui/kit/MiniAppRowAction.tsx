import React from 'react';
import { Link } from 'react-router-dom';

export type MiniAppRowActionProps = {
  /** Internal navigation (react-router). */
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: 'chevron' | 'plus';
  disabled?: boolean;
  'aria-label'?: string;
};

const rowBase: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--sp-3)',
  minHeight: 60,
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(28,28,30,0.92)',
  boxSizing: 'border-box',
  cursor: 'pointer',
  textAlign: 'left',
  WebkitTapHighlightColor: 'transparent',
};

const iconShellStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--fg)',
};

function Trailing({ kind }: { kind: 'chevron' | 'plus' }) {
  if (kind === 'plus') {
    return (
      <span style={{ fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.85)', flexShrink: 0 }} aria-hidden>
        +
      </span>
    );
  }
  return (
    <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} aria-hidden>
      ›
    </span>
  );
}

export function MiniAppRowAction({
  to,
  onClick,
  icon,
  title,
  subtitle,
  trailing = 'chevron',
  disabled,
  'aria-label': ariaLabel,
}: MiniAppRowActionProps) {
  const inner = (
    <>
      <div style={iconShellStyle}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', lineHeight: 1.35 }}>{subtitle}</div>
        ) : null}
      </div>
      <Trailing kind={trailing} />
    </>
  );

  const label = ariaLabel ?? title;
  const dimmed = Boolean(disabled);
  const interactiveStyle: React.CSSProperties = {
    ...rowBase,
    opacity: dimmed ? 0.5 : 1,
    pointerEvents: dimmed ? 'none' : 'auto',
  };

  if (to && !dimmed) {
    return (
      <Link to={to} aria-label={label} style={{ ...interactiveStyle, textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={dimmed ? undefined : onClick}
      disabled={disabled}
      style={{ ...interactiveStyle, font: 'inherit', margin: 0 }}
    >
      {inner}
    </button>
  );
}
