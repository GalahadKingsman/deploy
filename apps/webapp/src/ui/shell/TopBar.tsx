import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function isRootTab(pathname: string): boolean {
  return pathname === '/learn' || pathname === '/library' || pathname === '/account';
}

export function TopBar() {
  const nav = useNavigate();
  const loc = useLocation();
  const showBack = !isRootTab(loc.pathname);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        minHeight: 'calc(var(--topbar-h) + var(--safe-top, 0px))',
        boxSizing: 'border-box',
        paddingTop: 'var(--safe-top, 0px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--chrome-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--chrome-border)',
        zIndex: 100,
        paddingLeft: 'var(--sp-4)',
        paddingRight: 'var(--sp-4)',
      }}
    >
      {showBack && (
        <button
          type="button"
          onClick={() => nav(-1)}
          style={{
            position: 'absolute',
            left: 'var(--sp-4)',
            top: 'calc(var(--safe-top, 0px) + 6px)',
            height: 'calc(var(--topbar-h) - 12px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--fg)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
          aria-label="Назад"
        >
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }} aria-hidden>
            ‹
          </span>
          Назад
        </button>
      )}
      <span
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--fg)',
        }}
      >
        Edify
      </span>
    </header>
  );
}
