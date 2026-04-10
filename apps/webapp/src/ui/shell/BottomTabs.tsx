import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/library', label: 'Библиотека', icon: '📚' },
  { path: '/learn', label: 'Обучение', icon: '📖', isPrimary: true },
  { path: '/account', label: 'Аккаунт', icon: '👤' },
];

export function BottomTabs() {
  const location = useLocation();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        /* Total height = content area (--tabs-h) + safe-area; content area is never squeezed */
        minHeight: 'calc(var(--tabs-h) + var(--safe-bottom, 0px))',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        backgroundColor: 'var(--chrome-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--chrome-border)',
        paddingTop: 'var(--sp-2)',
        paddingBottom: 'var(--safe-bottom, 0px)',
        paddingLeft: 'var(--sp-2)',
        paddingRight: 'var(--sp-2)',
        zIndex: 1000,
      }}
    >
      {tabs.map((tab) => {
        const isPrimary = tab.isPrimary || false;
        const isActive =
          location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');

        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-1)',
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted-fg)',
              fontWeight:
                isActive || isPrimary
                  ? 'var(--font-weight-semibold)'
                  : 'var(--font-weight-regular)',
              fontSize: isPrimary ? 'var(--text-sm)' : 'var(--text-xs)',
              minWidth: 0,
              transition: 'color 0.2s',
            }}
          >
            <span style={{ fontSize: isPrimary ? '22px' : '20px', lineHeight: 1 }}>{tab.icon}</span>
            <span
              style={{
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {tab.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
