import React from 'react';
import { cn } from '../utils/cn.js';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, style, ...props }: CardProps) {
  return (
    <div
      className={cn(className)}
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-1)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className, style, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(className)}
      style={{
        padding: 'var(--sp-4) var(--sp-4) var(--sp-2)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CardTitle({ children, className, style, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(className)}
      style={{
        margin: 0,
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--fg)',
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function CardDescription({ children, className, style, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn(className)}
      style={{
        margin: 'var(--sp-1) 0 0',
        fontSize: 'var(--text-sm)',
        color: 'var(--muted-fg)',
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({ children, className, style, ...props }: CardContentProps) {
  return (
    <div
      className={cn(className)}
      style={{
        padding: 'var(--sp-2) var(--sp-4) var(--sp-4)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
