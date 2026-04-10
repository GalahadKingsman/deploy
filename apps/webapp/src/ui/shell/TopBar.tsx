import React from 'react';

export function TopBar() {
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
