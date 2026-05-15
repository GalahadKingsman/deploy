import React from 'react';

export function EditorMetaLine({ tag, parts }: { tag?: string; parts: string[] }) {
  if (!tag && parts.length === 0) return null;
  return (
    <div className="edify-item-meta">
      {tag ? <span className="edify-item-meta-tag">{tag}</span> : null}
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {tag || index > 0 ? <span className="edify-item-meta-dot" aria-hidden /> : null}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
