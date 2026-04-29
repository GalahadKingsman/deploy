/**
 * Демо-дата для лендинга (#edify-platform-mount): там нет platformPage.ts,
 * поэтому экран эксперта «Мои курсы» нужно заполнять статично —
 * теми же названиями, что на экране студента «Мои курсы» / дашборд.
 */

export function hydrateLandingExpertCourses(shadowRoot: ShadowRoot): void {
  const screen = shadowRoot.getElementById('screen-e-courses');
  const grid = screen?.querySelector('[data-ep-expert-courses-grid]') as HTMLElement | null;
  const sub = screen?.querySelector('[data-ep-expert-courses-sub]') as HTMLElement | null;
  if (!grid || !sub) return;

  const items = DEMO_EXPERT_DASHBOARD_ITEMS;
  const totalStud = items.reduce((s, it) => s + it.activeStudentsCount, 0);
  sub.textContent = `${items.length} ${pluralRu(items.length, ['курс', 'курса', 'курсов'])} · ${totalStud} ${pluralRu(totalStud, ['студент', 'студента', 'студентов'])} суммарно`;

  grid.replaceChildren();
  items.forEach((it, i) => grid.appendChild(buildDemoExpertCourseCard(it, i)));
}

function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const k = Math.abs(Math.trunc(n)) % 100;
  const k1 = k % 10;
  if (k > 10 && k < 20) return forms[2];
  if (k1 > 1 && k1 < 5) return forms[1];
  if (k1 === 1) return forms[0];
  return forms[2];
}

function initialsFromTitle(title: string): string {
  const t = (title || '').trim();
  if (!t) return 'ED';
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '').toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
  return (a + b).slice(0, 2) || 'ED';
}

type DemoDashboardItem = {
  id: string;
  expertId: string;
  title: string;
  status: 'draft' | 'published';
  lessonsCount: number;
  modulesCount: number;
  activeStudentsCount: number;
  avgCompletionPercent: number | null;
};

/** Совпадает с карточками студента «Мои курсы» + цифрами из дашборда (та «Маркетинг…» и соседи). */
const DEMO_EXPERT_DASHBOARD_ITEMS: DemoDashboardItem[] = [
  {
    id: 'f0000000-0000-4000-a000-000000000021',
    expertId: 'f0000000-0000-4000-a000-000000000099',
    title: 'Маркетинг в интернете 2025',
    status: 'published',
    lessonsCount: 12,
    modulesCount: 3,
    activeStudentsCount: 22,
    avgCompletionPercent: 65,
  },
  {
    id: 'f0000000-0000-4000-a000-000000000022',
    expertId: 'f0000000-0000-4000-a000-000000000099',
    title: 'Продажи без скриптов',
    status: 'published',
    lessonsCount: 8,
    modulesCount: 2,
    activeStudentsCount: 10,
    avgCompletionPercent: 30,
  },
  {
    id: 'f0000000-0000-4000-a000-000000000023',
    expertId: 'f0000000-0000-4000-a000-000000000099',
    title: 'UI/UX Design основы',
    status: 'published',
    lessonsCount: 6,
    modulesCount: 2,
    activeStudentsCount: 0,
    avgCompletionPercent: 0,
  },
];

/** Копия визуальной структуры `renderExpertCourseDashboardCard` из platformPage (без API). */
function buildDemoExpertCourseCard(item: DemoDashboardItem, index: number): HTMLElement {
  const gradients = [
    ['linear-gradient(135deg,#0e2c38,#1a4a58)', 'rgba(10,168,200,.5)'],
    ['linear-gradient(135deg,#1c1428,#2e1f4a)', 'rgba(124,58,237,.5)'],
    ['linear-gradient(135deg,#0d1f18,#143326)', 'rgba(22,163,74,.35)'],
  ] as const;
  const [gradBg, accent] = gradients[index % gradients.length]!;

  const card = document.createElement('div');
  card.className = 'card ep-expert-course-card';
  card.dataset.epExpertCourseCard = '1';
  card.dataset.epExpertEditorCourseId = item.id;
  card.dataset.epExpertEditorExpertId = item.expertId;
  card.style.cursor = 'default';
  if (item.status === 'draft') card.style.opacity = '0.88';

  const bg = document.createElement('div');
  bg.className = 'ep-expert-course-card__bg';
  bg.style.background = gradBg;

  const initials = document.createElement('span');
  initials.style.fontFamily = 'var(--fd)';
  initials.style.fontSize = '36px';
  initials.style.fontWeight = '900';
  initials.style.color = accent;
  initials.style.position = 'relative';
  initials.style.zIndex = '0';
  initials.textContent = initialsFromTitle(item.title);
  bg.appendChild(initials);

  const scrim = document.createElement('div');
  scrim.className = 'ep-expert-course-card__scrim';

  const body = document.createElement('div');
  body.className = 'ep-expert-course-card__body';

  const row1 = document.createElement('div');
  row1.style.display = 'flex';
  row1.style.alignItems = 'center';
  row1.style.justifyContent = 'space-between';
  row1.style.marginBottom = '8px';

  const tag = document.createElement('span');
  tag.className = 'tag';
  if (item.status === 'published') {
    tag.classList.add('tag-live');
    tag.textContent = 'Активен';
  } else {
    tag.classList.add('tag-draft');
    tag.textContent = 'Черновик';
  }

  const lessonsMeta = document.createElement('span');
  lessonsMeta.className = 'ep-ecd-lessons';
  lessonsMeta.textContent = `${item.lessonsCount} ${pluralRu(item.lessonsCount, ['урок', 'урока', 'уроков'])}`;
  row1.append(tag, lessonsMeta);

  const titleEl = document.createElement('div');
  titleEl.className = 'ep-ecd-title';
  titleEl.textContent = item.title;

  const meta = document.createElement('div');
  meta.className = 'ep-ecd-meta';
  meta.textContent = `${item.modulesCount} ${pluralRu(item.modulesCount, ['модуль', 'модуля', 'модулей'])} · ${item.activeStudentsCount} ${pluralRu(item.activeStudentsCount, ['студент', 'студента', 'студентов'])}`;

  const progWrap = document.createElement('div');
  progWrap.className = 'prog-wrap';
  const progBar = document.createElement('div');
  progBar.className = 'prog-bar';
  const progFill = document.createElement('div');
  progFill.className = 'prog-fill';
  const progVal = document.createElement('div');
  progVal.className = 'prog-val';

  const pct = item.avgCompletionPercent;
  const showDraftProg = item.status === 'draft';
  if (showDraftProg) {
    progFill.style.width = '0%';
    progVal.textContent = '—';
  } else if (pct != null) {
    progFill.style.width = `${pct}%`;
    progVal.textContent = `${pct}%`;
  } else {
    progFill.style.width = '0%';
    progVal.textContent = '—';
  }
  progBar.appendChild(progFill);
  progWrap.append(progBar, progVal);

  const progCaption = document.createElement('div');
  progCaption.className = 'ep-ecd-cap';
  progCaption.textContent = showDraftProg ? 'курс не опубликован' : 'среднее завершение';

  const div = document.createElement('div');
  div.className = 'div';

  const foot = document.createElement('div');
  foot.style.display = 'flex';
  foot.style.gap = '6px';

  if (item.status === 'draft') {
    const bMain = document.createElement('button');
    bMain.type = 'button';
    bMain.className = 'btn btn-primary btn-sm';
    bMain.style.flex = '1';
    bMain.style.justifyContent = 'center';
    bMain.textContent = '✏️ Продолжить';

    const bDel = document.createElement('button');
    bDel.type = 'button';
    bDel.className = 'btn btn-ghost btn-sm btn-icon';
    bDel.setAttribute('aria-label', 'Удалить курс');
    bDel.textContent = '🗑';
    foot.append(bMain, bDel);
  } else {
    const bEdit = document.createElement('button');
    bEdit.type = 'button';
    bEdit.className = 'btn btn-outline btn-sm';
    bEdit.style.flex = '1';
    bEdit.style.justifyContent = 'center';
    bEdit.textContent = '✏️ Редактировать';

    const bChart = document.createElement('button');
    bChart.type = 'button';
    bChart.className = 'btn btn-ghost btn-sm btn-icon';
    bChart.setAttribute('aria-label', 'Аналитика');
    bChart.textContent = '📊';

    const bEye = document.createElement('button');
    bEye.type = 'button';
    bEye.className = 'btn btn-ghost btn-sm btn-icon';
    bEye.setAttribute('aria-label', 'Предпросмотр');
    bEye.textContent = '👁';
    foot.append(bEdit, bChart, bEye);
  }

  body.append(row1, titleEl, meta, progWrap, progCaption, div, foot);
  card.append(bg, scrim, body);
  return card;
}
