import React, { createContext, useContext } from 'react';

/**
 * Diagnostic snapshot from bootstrap (Telegram ready, initData, auth result).
 * Only set in DEV; used to show auth status in the UI.
 */
export type AuthDiagnostic = {
  telegramReady: boolean;
  hasInitData: boolean;
  initDataLength: number;
  authResult: {
    mode: 'no-initdata' | 'authenticated' | 'rejected' | 'error';
    error?: Error;
  } | null;
};

const AuthDiagnosticContext = createContext<AuthDiagnostic | null>(null);

export function AuthDiagnosticProvider({
  value,
  children,
}: {
  value: AuthDiagnostic | null;
  children: React.ReactNode;
}) {
  return <AuthDiagnosticContext.Provider value={value}>{children}</AuthDiagnosticContext.Provider>;
}

export function useAuthDiagnostic(): AuthDiagnostic | null {
  return useContext(AuthDiagnosticContext);
}
