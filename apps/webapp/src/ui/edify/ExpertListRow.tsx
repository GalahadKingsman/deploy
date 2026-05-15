import React from 'react';
import { Link } from 'react-router-dom';

const Chevron = () => (
  <svg className="edify-list-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function ExpertListRow({
  to,
  title,
  subtitle,
  icon,
  onClick,
}: {
  to?: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="edify-list-icon">{icon}</div>
      <div className="edify-list-text">
        <div className="edify-list-title">{title}</div>
        {subtitle ? <div className="edify-list-sub">{subtitle}</div> : null}
      </div>
      <Chevron />
    </>
  );

  if (to) {
    return (
      <Link to={to} className="edify-list-row">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="edify-list-row" onClick={onClick}>
      {content}
    </button>
  );
}
