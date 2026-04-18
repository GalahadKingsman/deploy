/** База URL бэкенда для будущих fetch (логин, каталог и т.д.). Пустая строка — только статика. */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  return typeof v === 'string' ? v.replace(/\/$/, '') : '';
}
