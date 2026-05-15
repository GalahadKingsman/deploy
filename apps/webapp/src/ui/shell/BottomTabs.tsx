import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  {
    path: '/library',
    label: 'Библиотека',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    path: '/learn',
    label: 'Обучение',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    path: '/account',
    label: 'Аккаунт',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function BottomTabs() {
  const location = useLocation();

  return (
    <nav
      className="edify-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 'calc(var(--tabs-h) + var(--safe-bottom, 0px))',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        backgroundColor: 'var(--chrome-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--hairline)',
        paddingTop: 'var(--sp-2)',
        paddingBottom: 'var(--safe-bottom, 0px)',
        zIndex: 1000,
      }}
    >
      {tabs.map((tab) => {
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
              gap: 5,
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '0.04em',
              minWidth: 0,
              padding: '4px 12px',
            }}
          >
            {tab.icon}
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
