/**
 * Демо для лендинга и /platform без авторизации: там нет platformPage.ts и API,
 * поэтому экраны студента «Каталог» и «Мои курсы» заполняем статично (как раньше в shellBody).
 */

type DemoStudentCourse = {
  title: string;
  authorLine: string;
  lessonsLabel: string;
  tag: 'live' | 'new';
  grad: string;
  accent: string;
  progressPct: number;
  myMeta: string;
  cta: string;
  ctaVariant: 'accent' | 'outline';
};

const DEMO_STUDENT_COURSES: DemoStudentCourse[] = [
  {
    title: 'Маркетинг в интернете 2025',
    authorLine: 'Алина Карпова · 22 студента',
    lessonsLabel: '12 уроков',
    tag: 'live',
    grad: 'linear-gradient(135deg,#0e2c38,#1a4a58)',
    accent: 'rgba(10,168,200,.4)',
    progressPct: 65,
    myMeta: '8 из 12 уроков',
    cta: 'Продолжить урок 9 →',
    ctaVariant: 'accent',
  },
  {
    title: 'Продажи без скриптов',
    authorLine: 'Алина Карпова · 10 студентов',
    lessonsLabel: '8 уроков',
    tag: 'new',
    grad: 'linear-gradient(135deg,#1c1428,#2e1f4a)',
    accent: 'rgba(124,58,237,.35)',
    progressPct: 30,
    myMeta: '3 из 8 уроков',
    cta: 'Продолжить →',
    ctaVariant: 'outline',
  },
  {
    title: 'UI/UX Design основы',
    authorLine: 'Другой эксперт · 55 студентов',
    lessonsLabel: '6 уроков',
    tag: 'live',
    grad: 'linear-gradient(135deg,#0d1f18,#143326)',
    accent: 'rgba(22,163,74,.35)',
    progressPct: 0,
    myMeta: 'Не начат',
    cta: 'Начать',
    ctaVariant: 'outline',
  },
];

function initialsFromTitle(title: string): string {
  const t = (title || '').trim();
  if (!t) return 'ED';
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '').toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
  return (a + b).slice(0, 2) || 'ED';
}

function buildCatalogDemoCard(d: DemoStudentCourse): HTMLElement {
  const card = document.createElement('div');
  card.className = 'course-card-s';
  card.dataset.epScreen = 's-lesson';

  const thumb = document.createElement('div');
  thumb.className = 'cc-thumb';
  thumb.style.background = d.grad;
  const span = document.createElement('span');
  span.style.fontFamily = 'var(--fd)';
  span.style.fontSize = '40px';
  span.style.fontWeight = '900';
  span.style.color = d.accent;
  span.textContent = initialsFromTitle(d.title);
  thumb.appendChild(span);

  const scrim = document.createElement('div');
  scrim.className = 'cc-scrim';

  const body = document.createElement('div');
  body.className = 'cc-body';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.alignItems = 'center';
  row.style.marginBottom = '8px';

  const tag = document.createElement('span');
  tag.className = d.tag === 'new' ? 'tag tag-new' : 'tag tag-live';
  tag.textContent = d.tag === 'new' ? 'Новинка' : 'Активен';

  const lessons = document.createElement('span');
  lessons.style.fontFamily = 'var(--fm)';
  lessons.style.fontSize = '10px';
  lessons.style.color = 'rgba(248,250,252,.82)';
  lessons.textContent = d.lessonsLabel;

  row.append(tag, lessons);

  const title = document.createElement('div');
  title.className = 'cc-title';
  title.textContent = d.title;

  const author = document.createElement('div');
  author.className = 'cc-author';
  author.textContent = d.authorLine;

  body.append(row, title, author);
  card.append(thumb, scrim, body);
  return card;
}

function buildMyCoursesDemoCard(d: DemoStudentCourse): HTMLElement {
  const card = document.createElement('div');
  card.className = 'course-card-s';
  card.dataset.epScreen = 's-lesson';

  const thumb = document.createElement('div');
  thumb.className = 'cc-thumb';
  thumb.style.background = d.grad;
  const span = document.createElement('span');
  span.style.fontFamily = 'var(--fd)';
  span.style.fontSize = '40px';
  span.style.fontWeight = '900';
  span.style.color = d.accent;
  span.textContent = initialsFromTitle(d.title);
  thumb.appendChild(span);

  const scrim = document.createElement('div');
  scrim.className = 'cc-scrim';

  const body = document.createElement('div');
  body.className = 'cc-body';

  const title = document.createElement('div');
  title.className = 'cc-title';
  title.textContent = d.title;

  const author = document.createElement('div');
  author.className = 'cc-author';
  author.textContent = d.authorLine.split('·')[0]?.trim() ?? d.authorLine;

  const pct = Math.max(0, Math.min(100, d.progressPct));
  const progWrap = document.createElement('div');
  progWrap.className = 'prog-wrap';
  progWrap.style.margin = '10px 0 4px';
  progWrap.innerHTML =
    '<div class="prog-bar"><div class="prog-fill"></div></div>' + `<div class="prog-val">${pct}%</div>`;
  const fill = progWrap.querySelector('.prog-fill') as HTMLElement | null;
  if (fill) fill.style.width = `${pct}%`;

  const meta = document.createElement('div');
  meta.className = 'cc-mycourse-meta';
  meta.textContent = d.myMeta;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    d.ctaVariant === 'accent' ? 'btn btn-accent btn-sm' : 'btn btn-outline btn-sm';
  btn.style.width = '100%';
  btn.style.justifyContent = 'center';
  btn.textContent = d.cta;
  btn.dataset.epScreen = 's-lesson';
  btn.dataset.epStopProp = '1';

  body.append(title, author, progWrap, meta, btn);
  card.append(thumb, scrim, body);
  return card;
}

function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const k = Math.abs(Math.trunc(n)) % 100;
  const k1 = k % 10;
  if (k > 10 && k < 20) return forms[2];
  if (k1 > 1 && k1 < 5) return forms[1];
  if (k1 === 1) return forms[0];
  return forms[2];
}

/** Заполняет студенческие сетки статичными карточками (лендинг, раздел «Платформа изнутри»). */
export function hydrateLandingStudentScreens(shadowRoot: ShadowRoot): void {
  const catGrid = shadowRoot.querySelector('[data-ep-student-catalog-grid]') as HTMLElement | null;
  if (catGrid) {
    catGrid.replaceChildren();
    DEMO_STUDENT_COURSES.forEach((d) => catGrid.appendChild(buildCatalogDemoCard(d)));
  }

  const myGrid = shadowRoot.querySelector('[data-ep-student-mycourses-grid]') as HTMLElement | null;
  const mySub = shadowRoot.querySelector('[data-ep-student-mycourses-sub]') as HTMLElement | null;
  if (myGrid) {
    myGrid.replaceChildren();
    DEMO_STUDENT_COURSES.forEach((d) => myGrid.appendChild(buildMyCoursesDemoCard(d)));
  }
  if (mySub) {
    const n = DEMO_STUDENT_COURSES.length;
    mySub.textContent = `${n} ${pluralRu(n, ['активный курс', 'активных курса', 'активных курсов'])}`;
  }
}
