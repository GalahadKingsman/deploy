import React from 'react';

export function PageScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="edify-screen">
      <div className="edify-screen__inner">{children}</div>
    </div>
  );
}
