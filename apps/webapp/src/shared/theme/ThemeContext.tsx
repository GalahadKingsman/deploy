import React from 'react';
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  syncTelegramChromeColors,
  type ThemeId,
} from './theme.js';

export type { ThemeId } from './theme.js';

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeId>(() => readStoredTheme());

  const setTheme = React.useCallback((next: ThemeId) => {
    setThemeState(next);
    persistTheme(next);
    applyThemeToDocument(next);
    syncTelegramChromeColors(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  React.useEffect(() => {
    applyThemeToDocument(theme);
    syncTelegramChromeColors(theme);
  }, [theme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
