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

  if (sub) sub.textContent = 'Добро пожаловать, Алина · Апрель 2026';
  if (monthBtn) monthBtn.textContent = 'Апрель 2026';

  if (stStudents) stStudents.textContent = '38';
  if (stStudentsDelta) stStudentsDelta.textContent = '↑ +3 за месяц';

  if (stRefLbl) stRefLbl.textContent = 'Реферальные выплаты (апрель 2026)';
  if (stRefRub) stRefRub.textContent = '14\u00a0200\u00a0₽';
  if (stRefDelta) stRefDelta.textContent = '↑ +2\u00a0100\u00a0₽';

  if (stPub) stPub.textContent = '3';
  if (stDrafts) stDrafts.textContent = '1 черновик';

  if (stHwPend) stHwPend.textContent = '12';
  if (stHwNew) stHwNew.textContent = '↑ 4 новых сегодня';

  if (tbody) {
    tbody.replaceChildren();
    const rows = [
      { title: 'Маркетинг в интернете 2025', students: 22, status: 'Активен', statusCls: 'tag tag-live' },
      { title: 'Продажи без скриптов', students: 10, status: 'Активен', statusCls: 'tag tag-live' },
      { title: 'Финансовая грамотность', students: 0, status: 'Черновик', statusCls: 'tag tag-draft' },
    ] as const;
    for (const r of rows) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = r.title;
      const td2 = document.createElement('td');
      td2.textContent = String(r.students);
      const td3 = document.createElement('td');
      const tag = document.createElement('span');
      tag.className = r.statusCls;
      tag.textContent = r.status;
      td3.appendChild(tag);
      const td4 = document.createElement('td');
      td4.className = 'tbl-col-center';
      td4.innerHTML = '<span style="opacity:.5">✏️</span> <span style="opacity:.5">👁</span>';
      tr.append(td1, td2, td3, td4);
      tbody.appendChild(tr);
    }
  }

  if (hwHost) {
    hwHost.replaceChildren();
    const p = document.createElement('div');
    p.style.color = 'var(--t3)';
    p.style.fontSize = '12px';
    p.textContent = 'Войдите, чтобы видеть задания за месяц.';
    hwHost.appendChild(p);
  }

  if (actHost) {
    actHost.replaceChildren();
    const p = document.createElement('div');
    p.style.color = 'var(--t3)';
    p.style.fontSize = '12px';
    p.textContent = 'Войдите, чтобы видеть активность студентов.';
    actHost.appendChild(p);
  }
}

