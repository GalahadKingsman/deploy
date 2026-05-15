import React from 'react';

type PageScreenVariant = 'default' | 'editor';

export function PageScreen({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: PageScreenVariant;
}) {
  const innerClass =
    variant === 'editor' ? 'edify-screen__inner edify-editor' : 'edify-screen__inner';
  return (
    <div className="edify-screen">
      <div className={innerClass}>{children}</div>
    </div>
  );
}
