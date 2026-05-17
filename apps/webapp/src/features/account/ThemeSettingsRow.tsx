import React from 'react';
import { useTheme, type ThemeId } from '../../shared/theme/ThemeContext.js';

function ThemeSegment({
  id,
  label,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  return (
    <button
      type="button"
      className={`edify-theme-segment__btn${active ? ' edify-theme-segment__btn--active' : ''}`}
      aria-pressed={active}
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );
}

/** Переключатель светлой / тёмной темы (сохранение в localStorage). */
export function ThemeSettingsRow() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="edify-theme-settings" role="group" aria-label="Тема оформления">
      <div className="edify-theme-settings__text">
        <div className="edify-menu-row__title">Тема</div>
        <div className="edify-menu-row__sub">{theme === 'light' ? 'Светлая' : 'Тёмная'}</div>
      </div>
      <div className="edify-theme-segment">
        <ThemeSegment id="light" label="Светлая" active={theme === 'light'} onSelect={setTheme} />
        <ThemeSegment id="dark" label="Тёмная" active={theme === 'dark'} onSelect={setTheme} />
      </div>
    </div>
  );
}
