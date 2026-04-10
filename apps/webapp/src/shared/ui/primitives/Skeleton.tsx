import React from 'react';
import { cn } from '../utils/cn.js';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = '1em',
  radius = 'md',
  className,
  style,
}: SkeletonProps) {
  const radiusMap: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'var(--r-sm)',
    md: 'var(--r-md)',
    lg: 'var(--r-lg)',
    xl: 'var(--r-xl)',
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite linear;
          background: linear-gradient(
            to right,
            var(--card-2) 0%,
            var(--card) 50%,
            var(--card-2) 100%
          );
          background-size: 1000px 100%;
        }
      `}</style>
      <div
        className={cn('skeleton-shimmer', className)}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          borderRadius: radiusMap[radius],
          ...style,
        }}
      />
    </>
  );
}
