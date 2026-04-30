/**
 * Демо-дата для страницы /platform (standalone preview):
 * там пользователь часто не авторизован, но мы хотим показывать «шаблонный» дашборд эксперта
 * (как на скриншоте в лендинге).
 */
export function hydrateLandingExpertDashboard(shadowRoot: ShadowRoot): void {
  const screen = shadowRoot.getElementById('screen-e-dashboard');
  if (!screen) return;

  const sub = screen.querySelector('[data-ep-e-dashboard-sub]') as HTMLElement | null;
  const monthBtn = screen.querySelector('[data-ep-e-dashboard-month-btn]') as HTMLButtonElement | null;
  const stStudents = screen.querySelector('[data-ep-e-dashboard-stat-students]') as HTMLElement | null;
  const stStudentsDelta = screen.querySelector('[data-ep-e-dashboard-stat-students-delta]') as HTMLElement | null;
  const stRefRub = screen.querySelector('[data-ep-e-dashboard-stat-referral-rub]') as HTMLElement | null;
  const stRefLbl = screen.querySelector('[data-ep-e-dashboard-stat-referral-lbl]') as HTMLElement | null;
  const stRefDelta = screen.querySelector('[data-ep-e-dashboard-stat-referral-delta]') as HTMLElement | null;
  const stPub = screen.querySelector('[data-ep-e-dashboard-stat-published]') as HTMLElement | null;
  const stDrafts = screen.querySelector('[data-ep-e-dashboard-stat-drafts]') as HTMLElement | null;
  const stHwPend = screen.querySelector('[data-ep-e-dashboard-stat-hw-pending]') as HTMLElement | null;
  const stHwNew = screen.querySelector('[data-ep-e-dashboard-stat-hw-new]') as HTMLElement | null;
  const tbody = screen.querySelector('[data-ep-e-dashboard-courses-tbody]') as HTMLElement | null;
  const hwHost = screen.querySelector('[data-ep-e-dashboard-hw-host]') as HTMLElement | null;
  const actHost = screen.querySelector('[data-ep-e-dashboard-activity-host]') as HTMLElement | null;

  // Match landing “template” screenshot: placeholders + “Загрузка…”.
  if (sub) sub.textContent = 'Загрузка…';
  if (monthBtn) monthBtn.textContent = '—';

  if (stStudents) stStudents.textContent = '—';
  if (stStudentsDelta) stStudentsDelta.textContent = '↑ +0 за месяц';

  if (stRefLbl) stRefLbl.textContent = 'Реферальные выплаты';
  if (stRefRub) stRefRub.textContent = '—';
  if (stRefDelta) stRefDelta.textContent = '↑ +0 ₽';

  if (stPub) stPub.textContent = '—';
  if (stDrafts) stDrafts.textContent = '—';

  if (stHwPend) stHwPend.textContent = '—';
  if (stHwNew) stHwNew.textContent = '↑ 0 новых сегодня';

  if (tbody) {
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.textAlign = 'center';
    td.style.color = 'var(--t3)';
    td.style.fontSize = '12px';
    td.style.padding = '20px 12px';
    td.textContent = 'Загрузка…';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  if (hwHost) {
    hwHost.replaceChildren();
    // Leave empty: matches template (only CTA button below).
  }

  if (actHost) {
    actHost.replaceChildren();
    // Leave empty: matches template (only “Вся активность” CTA below).
  }
}

