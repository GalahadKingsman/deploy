import React from 'react';

export function FormField({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="edify-field">
      {label ? <label className="edify-field__label">{label}</label> : null}
      {children}
      {hint ? <p className="edify-field__hint">{hint}</p> : null}
    </div>
  );
}

export function FormInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`edify-field__input ${className}`.trim()} {...props} />;
}

export function FormTextarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`edify-field__textarea ${className}`.trim()} {...props} />;
}

export function FormSelect({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`edify-field__select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
