import './edify.css';
import { ACCESS_TOKEN_KEY, getAccessToken } from './authSession.js';
import { getApiBaseUrl } from './env.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';
import { mountPlatformShell } from './platform/mountPlatformShell.js';
import { normalizeRutubeEmbedUrl } from './util/rutubeEmbed.js';
import { downloadAuthenticatedFile, previewAuthenticatedFile } from './downloadAuthenticatedFile.js';
import { setRichTextWithLinks } from './renderTextWithLinksDom.js';

function renderAuthGate(): void {
  document.body.classList.add('platform-gate');
  document.body.style.overflow = '';
  document.body.replaceChildren(
    Object.assign(document.createElement('div'), {
      className: 'platform-gate__wrap',
      innerHTML:
        '<div class="platform-gate__card">' +
        '<div class="platform-gate__title">Авторизуйтесь для перехода на платформу</div>' +
        '<div class="platform-gate__sub">Вернитесь на лендинг и нажмите «Войти».</div>' +
        '<a class="btn-outline platform-gate__btn" href="/">← На лендинг</a>' +
        '</div>',
    }),
  );
}

async function runAuthFlow(): Promise<void> {
  await claimSiteLoginFromUrl();
  await refreshNavAuth();
}

void runAuthFlow();

/** Возврат из внешнего браузера (openLink) с ?login= — bfcache и переключение вкладок. */
window.addEventListener('pageshow', (ev) => {
  if (ev.persisted) void runAuthFlow();
});

window.addEventListener('focus', () => {
  try {
    if (new URL(window.location.href).searchParams.has('login')) void runAuthFlow();
  } catch {
    /* ignore */
  }
  void refreshNavAuth();
});

window.addEventListener('storage', (ev) => {
  if (ev.key === ACCESS_TOKEN_KEY || ev.key === null) void refreshNavAuth();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshNavAuth();
});

const platformMount = document.getElementById('edify-platform-mount');
if (platformMount) {
  if (!getAccessToken()) {
    renderAuthGate();
  } else {
    type CourseV1 = {
      id: string;
      title: string;
      coverUrl?: string | null;
      authorName?: string | null;
      priceCents?: number;
      currency?: string;
    };

    type LibraryResponseV1 = { courses: CourseV1[]; recommended?: CourseV1[] };
    type MyCoursesResponseV1 = { items: { course: CourseV1; progressPercent: number }[] };
    type CourseDetailResponseV1 = { course: CourseV1; lessons: { id: string }[] };

    type ExpertCourseStatusV1 = 'draft' | 'published' | 'archived';
    type ExpertCourseDashboardItemV1 = {
      id: string;
      expertId: string;
      title: string;
      description?: string | null;
      coverUrl?: string | null;
      priceCents: number;
      currency: string;
      status: ExpertCourseStatusV1;
      visibility: string;
      publishedAt?: string | null;
      deletedAt?: string | null;
      createdAt: string;
      updatedAt: string;
      modulesCount: number;
      lessonsCount: number;
      activeStudentsCount: number;
      avgCompletionPercent: number | null;
    };
    type ListExpertCoursesDashboardResponseV1 = { items: ExpertCourseDashboardItemV1[] };

    const myCourseIds = new Set<string>();

    function formatPrice(course: CourseV1): string {
      const cents = course.priceCents ?? 0;
      if (!Number.isFinite(cents) || cents <= 0) return 'Бесплатно';
      const amount = Math.round(cents / 100);
      const cur = (course.currency ?? 'RUB').toUpperCase();
      const suffix = cur === 'RUB' ? ' ₽' : ` ${cur}`;
      return `${amount.toLocaleString('ru-RU')}${suffix}`;
    }

    function initialsFromTitle(title: string): string {
      const t = (title || '').trim();
      if (!t) return 'ED';
      const parts = t.split(/\s+/).filter(Boolean);
      const a = (parts[0]?.[0] ?? '').toUpperCase();
      const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
      return (a + b).slice(0, 2) || 'ED';
    }

    function normalizeAssetUrl(raw: string | null | undefined): string | null {
      const u = (raw ?? '').trim();
      if (!u) return null;
      if (/^https?:\/\//i.test(u)) return u;
      // В API часто приходят относительные пути (например /uploads/..)
      const api = getApiBaseUrl();
      if (u.startsWith('/') && api) return `${api}${u}`;
      // Фоллбек: как есть (вдруг это data: или относительный к текущему origin путь)
      return u;
    }

    function renderCourseCard(course: CourseV1): HTMLElement {
      const card = document.createElement('div');
      card.className = 'course-card-s';
      card.dataset.epScreen = 's-lesson';
      card.dataset.epCourseId = course.id;

      const thumb = document.createElement('div');
      thumb.className = 'cc-thumb';
      const cover = normalizeAssetUrl(course.coverUrl ?? null);
      const setPlaceholder = () => {
        thumb.replaceChildren();
        thumb.style.background = 'linear-gradient(135deg,#0e2c38,#1a4a58)';
        const span = document.createElement('span');
        span.style.fontFamily = 'var(--fd)';
        span.style.fontSize = '40px';
        span.style.fontWeight = '900';
        span.style.color = 'rgba(10,168,200,.4)';
        span.textContent = initialsFromTitle(course.title);
        thumb.appendChild(span);
      };
      if (cover) {
        // Используем <img>, чтобы иметь onerror и гарантированный фоллбек
        const img = document.createElement('img');
        img.alt = '';
        img.src = cover;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.addEventListener('error', () => setPlaceholder(), { once: true });
        // Фон оставим светлым: если картинка грузится — будет ок; если нет — заменим.
        thumb.style.background = 'var(--surface2)';
        thumb.appendChild(img);
      } else {
        setPlaceholder();
      }

      const body = document.createElement('div');
      body.className = 'cc-body';

      const title = document.createElement('div');
      title.className = 'cc-title';
      title.textContent = course.title;

      const author = document.createElement('div');
      author.className = 'cc-author';
      author.textContent = course.authorName ? course.authorName : 'EDIFY';

      const price = document.createElement('div');
      price.className = 'cc-price';
      price.textContent = formatPrice(course);
      if ((course.priceCents ?? 0) <= 0) price.classList.add('cc-price-free');

      body.append(title, author, price);
      card.append(thumb, body);
      return card;
    }

    function renderMyCourseCard(item: { course: CourseV1; progressPercent: number }): HTMLElement {
      const card = renderCourseCard(item.course);
      const body = card.querySelector('.cc-body') as HTMLElement;

      // вставим цену сразу после автора (чтобы сохранить требования: цена+автор+прогресс)
      const price = body.querySelector('.cc-price');
      if (price) price.remove();

      const author = body.querySelector('.cc-author');
      const price2 = document.createElement('div');
      price2.className = 'cc-price';
      price2.textContent = formatPrice(item.course);
      if ((item.course.priceCents ?? 0) <= 0) price2.classList.add('cc-price-free');

      const pct = Math.max(0, Math.min(100, Math.round(item.progressPercent ?? 0)));
      const progWrap = document.createElement('div');
      progWrap.className = 'prog-wrap';
      progWrap.style.margin = '10px 0 4px';
      progWrap.innerHTML =
        '<div class="prog-bar"><div class="prog-fill"></div></div>' +
        `<div class="prog-val">${pct}%</div>`;
      const fill = progWrap.querySelector('.prog-fill') as HTMLElement | null;
      if (fill) fill.style.width = `${pct}%`;

      const meta = document.createElement('div');
      meta.style.fontSize = '10px';
      meta.style.color = 'var(--t3)';
      meta.style.marginBottom = '12px';
      meta.textContent = pct === 0 ? 'Не начат' : `Прогресс: ${pct}%`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-accent btn-sm';
      btn.style.width = '100%';
      btn.style.justifyContent = 'center';
      btn.textContent = pct > 0 ? 'Продолжить →' : 'Начать →';
      btn.dataset.epScreen = 's-lesson';
      btn.dataset.epStopProp = '1';
      btn.dataset.epCourseId = item.course.id;

      if (author?.nextSibling) {
        body.insertBefore(price2, author.nextSibling);
      } else {
        body.appendChild(price2);
      }
      body.append(progWrap, meta, btn);

      return card;
    }

    async function fetchJson<T>(path: string, token?: string): Promise<T> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
      return (await res.json()) as T;
    }

    async function fetchMultipartJson<T>(path: string, form: FormData, token?: string): Promise<T> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
      return (await res.json()) as T;
    }

    async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail ? `HTTP ${res.status}: ${detail.slice(0, 200)}` : `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    }

    async function deleteJson(path: string, token?: string): Promise<void> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    }

    type MyRecentSubmissionRowV1 = {
      id: string;
      lessonId: string;
      status: string;
      score?: number | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
    };

    function recentSubmissionStatusUi(status: string): { label: string; tagClass: string } {
      if (status === 'accepted') return { label: 'Проверено', tagClass: 'tag tag-live' };
      if (status === 'rework') return { label: 'На доработку', tagClass: 'tag tag-draft' };
      return { label: 'На проверке', tagClass: 'tag tag-new' };
    }

    async function hydrateRecentSubmissionsTable(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      const tbody = root.querySelector(
        '#screen-s-homework [data-ep-recent-submissions-tbody]',
      ) as HTMLElement | null;
      if (!tbody) return;
      const token = getAccessToken();
      const emptyHint = (text: string, color: string) => {
        tbody.replaceChildren();
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.style.textAlign = 'center';
        td.style.fontSize = '13px';
        td.style.padding = '18px 12px';
        td.style.color = color;
        td.textContent = text;
        tr.appendChild(td);
        tbody.appendChild(tr);
      };
      if (!token) {
        emptyHint('Войдите в аккаунт, чтобы видеть отправленные задания.', 'var(--t3)');
        return;
      }
      tbody.replaceChildren();
      const loadingTr = document.createElement('tr');
      const loadingTd = document.createElement('td');
      loadingTd.colSpan = 3;
      loadingTd.style.textAlign = 'center';
      loadingTd.style.color = 'var(--t3)';
      loadingTd.textContent = 'Загрузка…';
      loadingTr.appendChild(loadingTd);
      tbody.appendChild(loadingTr);
      try {
        const res = await fetchJson<{ items: MyRecentSubmissionRowV1[] }>(
          '/me/submissions/recent?limit=3',
          token,
        );
        const items = res.items ?? [];
        tbody.replaceChildren();
        if (items.length === 0) {
          emptyHint('Пока нет отправленных домашних заданий.', 'var(--t3)');
          return;
        }
        for (const it of items) {
          const tr = document.createElement('tr');
          tr.dataset.epRecentLesson = it.lessonId;
          const td1 = document.createElement('td');
          const name = document.createElement('div');
          name.className = 'td-name';
          name.textContent = `ДЗ к уроку ${(it.lessonTitle || '—').trim() || '—'}`;
          const sub = document.createElement('div');
          sub.style.fontSize = '10px';
          sub.style.color = 'var(--t3)';
          sub.textContent = `${(it.courseTitle || '—').trim() || '—'} / ${(it.moduleTitle || '—').trim() || '—'}`;
          td1.append(name, sub);
          const td2 = document.createElement('td');
          td2.className = 'tbl-col-center';
          if (typeof it.score === 'number' && it.score >= 1 && it.score <= 5) {
            const sp = document.createElement('span');
            sp.className = 'ep-recent-sub-stars';
            sp.setAttribute('aria-label', `Оценка ${it.score} из 5`);
            sp.textContent = '★'.repeat(it.score) + '☆'.repeat(5 - it.score);
            td2.appendChild(sp);
          } else {
            const dash = document.createElement('span');
            dash.style.color = 'var(--t3)';
            dash.style.fontSize = '12px';
            dash.textContent = '—';
            td2.appendChild(dash);
          }
          const td3 = document.createElement('td');
          td3.className = 'tbl-col-right';
          const tag = document.createElement('span');
          const u = recentSubmissionStatusUi(it.status);
          tag.className = u.tagClass;
          tag.textContent = u.label;
          td3.appendChild(tag);
          tr.append(td1, td2, td3);
          tbody.appendChild(tr);
        }
      } catch {
        tbody.replaceChildren();
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.style.textAlign = 'center';
        td.style.color = 'var(--err)';
        td.style.fontSize = '13px';
        td.style.padding = '18px 12px';
        td.textContent = 'Не удалось загрузить список.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
    }

    /** Доступ к кабинету эксперта: только при членстве в команде эксперта (GET /me/expert-memberships). */
    const expertShellAccess = { allowed: false };
    /** Первый expertId из членств (рабочее пространство для API `/experts/:id/...`). */
    let activeExpertId: string | null = null;
    let expertCoursesSearchTimer: ReturnType<typeof setTimeout> | undefined;

    const shell = mountPlatformShell(platformMount, {
      initialRole: 'student',
      initialScreenId: 's-catalog',
      beforeSetRole(role) {
        if (role !== 'expert') return true;
        if (expertShellAccess.allowed) return true;
        window.alert(
          'Кабинет эксперта доступен только участникам команды эксперта. Если вас добавили в команду, обновите страницу.',
        );
        return false;
      },
      onAction(action) {
        if (import.meta.env.DEV) console.debug('[edify-platform-page]', action);
        if (action.type === 'navigate' && action.screenId === 's-homework') {
          void hydrateRecentSubmissionsTable(action.shadowRoot);
          void hydratePendingHomeworkHub(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-courses') {
          void hydrateExpertCourses(action.shadowRoot);
        }
      },
    });

    type ModuleV1 = { id: string; title: string; position?: number };
    type LessonV1 = { id: string; title: string; order?: number; contentMarkdown?: string | null };
    type AssignmentV1 = { id: string; lessonId: string; promptMarkdown?: string | null };
    type AssignmentFileV1 = { id: string; filename: string; sizeBytes?: number | null };
    type MySubmissionV1 = {
      id: string;
      status: string;
      text?: string | null;
      link?: string | null;
      fileKey?: string | null;
      score?: number | null;
      reviewerComment?: string | null;
      createdAt: string;
    };

    let currentCourseId: string | null = null;
    const lessonMetaById = new Map<string, { moduleTitle: string; lessonNo: number }>();
    const unlockedLessonIds = new Set<string>();
    /** Lesson ids per module (API order) — for «previous lesson» within the same module only */
    let modulesOrderedLessonIds: string[][] = [];

    function previousLessonInModule(lessonId: string): string | null {
      for (const ids of modulesOrderedLessonIds) {
        const i = ids.indexOf(lessonId);
        if (i === -1) continue;
        if (i <= 0) return null;
        return ids[i - 1] ?? null;
      }
      return null;
    }

    function updatePrevLessonUi(root: ShadowRoot, lessonId: string): void {
      const prev = root.querySelector('#screen-s-lesson [data-ep-prev-lesson]') as HTMLButtonElement | null;
      if (!prev) return;
      const prevId = previousLessonInModule(lessonId);
      if (!prevId) {
        prev.style.display = 'none';
        delete prev.dataset.epPrevTarget;
      } else {
        prev.style.display = '';
        prev.dataset.epPrevTarget = prevId;
      }
    }

    function submissionStatusUi(s: MySubmissionV1): { label: string; tagClass: string } {
      if (s.status === 'accepted') return { label: 'Принято', tagClass: 'ep-my-sub-tag ep-my-sub-tag--ok' };
      if (s.status === 'rework') return { label: 'На доработку', tagClass: 'ep-my-sub-tag ep-my-sub-tag--rework' };
      return { label: 'На проверке', tagClass: 'ep-my-sub-tag ep-my-sub-tag--wait' };
    }

    function renderMySubmission(root: ShadowRoot, sub: MySubmissionV1 | null, hasExpertHomework: boolean): void {
      const wrap = root.querySelector('#screen-s-lesson [data-ep-my-submission-wrap]') as HTMLElement | null;
      const host = root.querySelector('#screen-s-lesson [data-ep-my-submission]') as HTMLElement | null;
      if (!wrap || !host) return;
      host.replaceChildren();
      if (!sub) {
        wrap.style.display = 'none';
        return;
      }
      const hasBody =
        !!(sub.text && sub.text.trim()) ||
        !!(sub.link && sub.link.trim()) ||
        !!(sub.fileKey && sub.fileKey.trim()) ||
        !!(sub.reviewerComment && sub.reviewerComment.trim());
      if (!hasBody) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = '';

      const card = document.createElement('div');
      card.className = 'ep-my-sub-card';

      const head = document.createElement('div');
      head.className = 'ep-my-sub-head';
      const left = document.createElement('div');
      const st = submissionStatusUi(sub);
      const tag = document.createElement('span');
      tag.className = st.tagClass;
      tag.textContent = st.label;
      let dateStr = '';
      try {
        dateStr = new Date(sub.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        dateStr = '';
      }
      const meta = document.createElement('div');
      meta.className = 'ep-my-sub-meta';
      if (dateStr) meta.textContent = `Отправлено: ${dateStr}`;
      left.append(tag, meta);
      head.append(left);

      if (typeof sub.score === 'number' && sub.score >= 1 && sub.score <= 5) {
        const stars = document.createElement('div');
        stars.className = 'ep-my-sub-stars';
        stars.setAttribute('aria-label', `Оценка ${sub.score} из 5`);
        stars.textContent = '★'.repeat(sub.score) + '☆'.repeat(5 - sub.score);
        head.appendChild(stars);
      }
      card.appendChild(head);

      const textRaw = (sub.text ?? '').trim();
      if (textRaw) {
        const blk = document.createElement('div');
        blk.className = 'ep-my-sub-block';
        const lab = document.createElement('div');
        lab.className = 'ep-my-sub-label';
        lab.textContent = 'Текст ответа';
        const body = document.createElement('div');
        setRichTextWithLinks(body, textRaw);
        blk.append(lab, body);
        card.appendChild(blk);
      }

      const linkRaw = (sub.link ?? '').trim();
      if (linkRaw) {
        const blk = document.createElement('div');
        blk.className = 'ep-my-sub-block';
        const lab = document.createElement('div');
        lab.className = 'ep-my-sub-label';
        lab.textContent = 'Ссылка';
        const a = document.createElement('a');
        let href = linkRaw;
        if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
        try {
          const u = new URL(href);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
          a.href = u.href;
        } catch {
          a.href = '#';
          a.addEventListener('click', (e) => e.preventDefault());
        }
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = linkRaw;
        a.style.color = 'var(--a)';
        a.style.wordBreak = 'break-all';
        blk.append(lab, a);
        card.appendChild(blk);
      }

      const fk = (sub.fileKey ?? '').trim();
      if (fk) {
        const blk = document.createElement('div');
        blk.className = 'ep-my-sub-block';
        const lab = document.createElement('div');
        lab.className = 'ep-my-sub-label';
        lab.textContent = 'Файл';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline btn-sm';
        btn.textContent = '⬇ Скачать вложение';
        btn.dataset.epSubmissionFileKey = fk;
        blk.append(lab, btn);
        card.appendChild(blk);
      }

      const comRaw = (sub.reviewerComment ?? '').trim();
      if (comRaw) {
        const blk = document.createElement('div');
        blk.className = 'ep-my-sub-block';
        blk.style.borderLeft = '3px solid rgba(201,162,39,.55)';
        const lab = document.createElement('div');
        lab.className = 'ep-my-sub-label';
        lab.textContent = 'Комментарий эксперта';
        const body = document.createElement('div');
        setRichTextWithLinks(body, comRaw);
        blk.append(lab, body);
        card.appendChild(blk);
      }

      if (sub.status !== 'accepted' && hasExpertHomework) {
        const actions = document.createElement('div');
        actions.className = 'ep-my-sub-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-outline';
        editBtn.textContent = 'Изменить ответ';
        editBtn.dataset.epHomeworkEdit = '1';
        actions.appendChild(editBtn);
        card.appendChild(actions);
      }

      host.appendChild(card);
    }

    async function fetchModules(courseId: string): Promise<ModuleV1[]> {
      const token = getAccessToken() ?? undefined;
      const res = await fetchJson<{ items: ModuleV1[] }>(`/courses/${encodeURIComponent(courseId)}/modules`, token);
      return res.items ?? [];
    }

    async function fetchModuleLessons(courseId: string, moduleId: string): Promise<{
      items: LessonV1[];
      unlockedLessonIds: string[];
      completedLessonIds: string[];
    }> {
      const token = getAccessToken() ?? undefined;
      return await fetchJson(
        `/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons`,
        token,
      );
    }

    function setProgress(root: ShadowRoot, completedCount: number, totalCount: number): void {
      const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const progVals = root.querySelectorAll('#screen-s-lesson .prog-val');
      progVals.forEach((el) => {
        (el as HTMLElement).textContent = `${pct}%`;
      });
      const fills = root.querySelectorAll('#screen-s-lesson .prog-fill');
      fills.forEach((el) => {
        (el as HTMLElement).style.width = `${pct}%`;
      });
      const captions = root.querySelectorAll('#screen-s-lesson [data-ep-progress-caption]');
      captions.forEach((c) => {
        (c as HTMLElement).textContent = totalCount > 0 ? `${completedCount} из ${totalCount} уроков` : 'Нет уроков';
      });
    }

    function renderLessonTree(params: {
      root: ShadowRoot;
      courseTitle: string;
      modules: Array<{
        id: string;
        title: string;
        lessons: LessonV1[];
        unlocked: Set<string>;
        completed: Set<string>;
      }>;
      activeLessonId: string | null;
    }): void {
      const screen = params.root.getElementById('screen-s-lesson');
      if (!screen) return;

      const treeHost = screen.querySelector('.mod-tree') as HTMLElement | null;
      if (!treeHost) return;
      treeHost.replaceChildren();

      const titleEl = screen.querySelector('[data-ep-course-title]') as HTMLElement | null;
      if (titleEl) titleEl.textContent = params.courseTitle;

      for (const m of params.modules) {
        const modItem = document.createElement('div');
        modItem.className = 'mod-item';

        const head = document.createElement('div');
        head.className = 'mod-head';
        head.dataset.epModToggle = '1';

        const arrow = document.createElement('span');
        arrow.className = 'mod-arrow open';
        arrow.textContent = '▶';

        const name = document.createElement('span');
        name.className = 'mod-name';
        name.textContent = m.title;

        head.append(arrow, name);

        const lessonsWrap = document.createElement('div');
        lessonsWrap.className = 'mod-lessons open';

        for (const l of m.lessons) {
          const row = document.createElement('div');
          row.className = 'lesson-row';
          row.dataset.epLessonId = l.id;

          const isDone = m.completed.has(l.id);
          const isUnlocked = m.unlocked.has(l.id);
          const isActive = params.activeLessonId === l.id;

          const ico = document.createElement('span');
          ico.className = 'lesson-ico';
          if (isDone) {
            ico.textContent = '✓';
            ico.style.color = 'var(--ok)';
          } else if (isUnlocked) {
            ico.textContent = '▶';
          } else {
            ico.textContent = '🔒';
            row.style.color = 'var(--t3)';
            row.dataset.epLocked = '1';
          }

          const lname = document.createElement('span');
          lname.className = 'lesson-name';
          lname.textContent = l.title;

          row.append(ico, lname);
          if (isActive) row.classList.add('active');
          lessonsWrap.appendChild(row);
        }

        modItem.append(head, lessonsWrap);
        treeHost.appendChild(modItem);
      }
    }

    function setLessonContent(
      root: ShadowRoot,
      params: { moduleTitle: string; lessonTitle: string; bodyText: string },
    ): void {
      const screen = root.getElementById('screen-s-lesson');
      if (!screen) return;
      const meta = screen.querySelector('[data-ep-lesson-meta]') as HTMLElement | null;
      const title = screen.querySelector('[data-ep-lesson-title]') as HTMLElement | null;
      const body = screen.querySelector('[data-ep-lesson-body]') as HTMLElement | null;
      if (meta) meta.textContent = params.moduleTitle;
      if (title) title.textContent = params.lessonTitle;
      setRichTextWithLinks(body, params.bodyText);
    }

    function setActiveLessonRow(root: ShadowRoot, lessonId: string): void {
      root.querySelectorAll('#screen-s-lesson .lesson-row').forEach((el) => el.classList.remove('active'));
      (root.querySelector(`#screen-s-lesson .lesson-row[data-ep-lesson-id="${CSS.escape(lessonId)}"]`) as
        | HTMLElement
        | null)?.classList.add('active');
    }

    function labelFromSubmissionFileKey(key: string): string {
      const tail = key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key;
      const withoutTs = tail.replace(/^\d+-/, '');
      return (withoutTs || tail || 'файл').trim() || 'файл';
    }

    let hwDraft: { lessonId: string | null; uploadedFileKey: string | null; selectedFile: File | null } = {
      lessonId: null,
      uploadedFileKey: null,
      selectedFile: null,
    };

    function syncHomeworkFileRow(root: ShadowRoot): void {
      const row = root.querySelector('#screen-s-homework [data-ep-homework-file-row]') as HTMLElement | null;
      const lbl = root.querySelector('#screen-s-homework [data-ep-homework-file-label]') as HTMLElement | null;
      if (!row || !lbl) return;
      if (hwDraft.selectedFile) {
        row.style.display = 'flex';
        lbl.textContent = hwDraft.selectedFile.name;
      } else if (hwDraft.uploadedFileKey) {
        row.style.display = 'flex';
        lbl.textContent = labelFromSubmissionFileKey(hwDraft.uploadedFileKey);
      } else {
        row.style.display = 'none';
        lbl.textContent = '';
      }
    }

    function setHomeworkStatusBadge(el: HTMLElement | null, status: string | undefined): void {
      if (!el) return;
      el.className = 'tag';
      if (status === 'accepted') {
        el.classList.add('tag-live');
        el.textContent = 'Принято';
      } else if (status === 'rework') {
        el.classList.add('tag-draft');
        el.textContent = 'На доработку';
      } else if (status === 'submitted') {
        el.classList.add('tag-live');
        el.textContent = 'На проверке';
      } else {
        el.classList.add('tag-err');
        el.textContent = 'Не сдано';
      }
    }

    type EpHomeworkCtx = {
      lessonId: string;
      lessonTitle?: string;
      prompt?: string;
      hasHomework?: boolean;
      /** Из экрана «Домашние задания»: вторая строка «курс / модуль» */
      courseModuleLine?: string | null;
    };

    type NextPendingHomeworkApi = {
      lessonId: string;
      lessonTitle: string;
      courseTitle: string;
      moduleTitle: string;
      promptMarkdown: string | null;
      hasExpertFiles: boolean;
    };

    async function fillHomeworkFormCard(root: ShadowRoot, hw: EpHomeworkCtx): Promise<void> {
      const token = getAccessToken() ?? undefined;
      const subEl = root.querySelector('#screen-s-homework [data-ep-homework-sub]') as HTMLElement | null;
      const titleEl = root.querySelector('#screen-s-homework [data-ep-homework-title]') as HTMLElement | null;
      const metaEl = root.querySelector('#screen-s-homework [data-ep-homework-meta]') as HTMLElement | null;
      const qEl = root.querySelector('#screen-s-homework [data-ep-homework-q]') as HTMLElement | null;
      const ta = root.querySelector('#screen-s-homework [data-ep-homework-textarea]') as HTMLTextAreaElement | null;
      const statusEl = root.querySelector('#screen-s-homework [data-ep-homework-status]') as HTMLElement | null;
      const acceptedBanner = root.querySelector('#screen-s-homework [data-ep-homework-accepted]') as HTMLElement | null;
      const editable = root.querySelector('#screen-s-homework [data-ep-homework-editable]') as HTMLElement | null;
      const fileInp = root.querySelector('#screen-s-homework [data-ep-homework-file-input]') as HTMLInputElement | null;

      if (subEl) subEl.textContent = 'Задание к текущему уроку';
      const cm = (hw.courseModuleLine ?? '').trim();
      if (cm) {
        if (titleEl) titleEl.textContent = (hw.lessonTitle ?? '').trim() || 'Домашнее задание';
        if (metaEl) metaEl.textContent = cm;
      } else {
        if (titleEl) titleEl.textContent = 'Домашнее задание';
        if (metaEl) metaEl.textContent = (hw.lessonTitle ?? '').trim() || '—';
      }
      const prompt = (hw.prompt ?? '').trim();
      setRichTextWithLinks(qEl, prompt || 'Формулировка задания не указана.');

      hwDraft = { lessonId: hw.lessonId, uploadedFileKey: null, selectedFile: null };
      if (fileInp) fileInp.value = '';

      let latest: MySubmissionV1 | undefined;
      try {
        const subsRes = await fetchJson<{ items: MySubmissionV1[] }>(
          `/lessons/${encodeURIComponent(hw.lessonId)}/submissions/me`,
          token,
        );
        latest = subsRes.items?.[0];
      } catch {
        latest = undefined;
      }

      if (latest?.status === 'accepted') {
        if (acceptedBanner) acceptedBanner.style.display = '';
        if (editable) editable.style.display = 'none';
        setHomeworkStatusBadge(statusEl, 'accepted');
        if (ta) {
          ta.value = '';
          ta.disabled = true;
        }
        return;
      }

      if (acceptedBanner) acceptedBanner.style.display = 'none';
      if (editable) editable.style.display = 'block';
      if (ta) {
        ta.disabled = false;
        ta.value =
          latest && latest.status !== 'accepted' && typeof latest.text === 'string' && latest.text.trim()
            ? latest.text
            : '';
      }
      hwDraft.uploadedFileKey =
        latest && latest.status !== 'accepted' && latest.fileKey?.trim() ? latest.fileKey.trim() : null;
      hwDraft.selectedFile = null;
      setHomeworkStatusBadge(statusEl, latest?.status);
      syncHomeworkFileRow(root);
    }

    async function hydratePendingHomeworkHub(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      const active = root.querySelector('#screen-s-homework [data-ep-homework-hub-active]') as HTMLElement | null;
      const empty = root.querySelector('#screen-s-homework [data-ep-homework-hub-empty]') as HTMLElement | null;
      if (!active || !empty) return;

      const token = getAccessToken();
      if (!token) {
        active.style.display = 'none';
        empty.style.display = '';
        empty.textContent = 'Войдите в аккаунт, чтобы видеть актуальные задания.';
        (root as any).__epHomework = { hasHomework: false };
        return;
      }

      try {
        const res = await fetchJson<{ homework: NextPendingHomeworkApi | null }>(
          '/me/homework/next-pending',
          token,
        );
        const h = res.homework;
        if (!h) {
          active.style.display = 'none';
          empty.style.display = '';
          empty.textContent =
            'Сейчас нет домашних заданий, которые нужно отправить: всё уже сдано или ваши ответы на проверке у эксперта.';
          (root as any).__epHomework = { hasHomework: false };
          return;
        }

        active.style.display = '';
        empty.style.display = 'none';
        const promptTrim = (h.promptMarkdown ?? '').trim();
        const courseMod = `${(h.courseTitle || '—').trim() || '—'} / ${(h.moduleTitle || '—').trim() || '—'}`;
        (root as any).__epHomework = {
          lessonId: h.lessonId,
          lessonTitle: h.lessonTitle,
          prompt: promptTrim,
          hasHomework: true,
          courseModuleLine: courseMod,
        };
        await fillHomeworkFormCard(root, (root as any).__epHomework as EpHomeworkCtx);
      } catch {
        active.style.display = 'none';
        empty.style.display = '';
        empty.textContent = 'Не удалось загрузить актуальное задание. Попробуйте позже.';
        (root as any).__epHomework = { hasHomework: false };
      }
    }

    async function prepareHomeworkScreen(): Promise<void> {
      const root = shell.shadowRoot;
      const hw = (root as any).__epHomework as EpHomeworkCtx | undefined;
      if (!hw?.lessonId) {
        window.alert('Сначала откройте урок с заданием.');
        return;
      }
      if (hw.hasHomework === false) {
        window.alert('У этого урока нет домашнего задания от эксперта.');
        return;
      }
      shell.showScreen('s-homework');
      await fillHomeworkFormCard(root, hw);
    }

    async function submitHomeworkFromForm(): Promise<void> {
      const root = shell.shadowRoot;
      const lessonId = hwDraft.lessonId;
      if (!lessonId) return;
      const token = getAccessToken() ?? undefined;
      const ta = root.querySelector('#screen-s-homework [data-ep-homework-textarea]') as HTMLTextAreaElement | null;
      const submitBtn = root.querySelector('#screen-s-homework [data-ep-homework-submit]') as HTMLButtonElement | null;
      let fileKey = hwDraft.uploadedFileKey;
      const text = (ta?.value ?? '').trim();

      if (hwDraft.selectedFile && !fileKey) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Загрузка…';
        }
        try {
          const form = new FormData();
          form.append('lessonId', lessonId);
          form.append('file', hwDraft.selectedFile, hwDraft.selectedFile.name);
          const up = await fetchMultipartJson<{ fileKey: string }>('/uploads/submissions', form, token);
          fileKey = up.fileKey;
          hwDraft.uploadedFileKey = fileKey;
          hwDraft.selectedFile = null;
          const fileInp = root.querySelector('#screen-s-homework [data-ep-homework-file-input]') as HTMLInputElement | null;
          if (fileInp) fileInp.value = '';
          syncHomeworkFileRow(root);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : 'Не удалось загрузить файл');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить на проверку';
          }
          return;
        }
        if (submitBtn) {
          submitBtn.textContent = 'Отправить на проверку';
          submitBtn.disabled = false;
        }
      }

      if (!text && !fileKey) {
        window.alert('Добавьте текст ответа и/или файл.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка…';
      }
      try {
        await postJson<{ submission: MySubmissionV1 }>(
          `/lessons/${encodeURIComponent(lessonId)}/submissions`,
          { text: text ? text : null, link: null, fileKey: fileKey ?? null },
          token,
        );
        window.alert('Домашнее задание отправлено.');
        shell.showScreen('s-lesson');
        await openLesson(lessonId);
        void hydrateRecentSubmissionsTable(shell.shadowRoot);
        void hydratePendingHomeworkHub(shell.shadowRoot);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Не удалось отправить ответ');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Отправить на проверку';
        }
      }
    }

    /** Есть ли у эксперта осмысленный текст задания (не только пробелы / пустой HTML). */
    function homeworkPromptHasBody(raw: string | null | undefined): boolean {
      if (raw == null) return false;
      let s = String(raw)
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
        .trim();
      if (!s) return false;
      const noTags = s.replace(/<[^>]+>/g, ' ');
      const collapsed = noTags.replace(/\s+/g, ' ').trim();
      return collapsed.length > 0;
    }

    function setGoHomeworkButtonVisible(btn: HTMLElement | null, visible: boolean): void {
      if (!btn) return;
      btn.classList.toggle('ep-hw-submit--hidden', !visible);
    }

    async function openLesson(lessonId: string): Promise<void> {
      if (!currentCourseId) return;
      if (!unlockedLessonIds.has(lessonId)) {
        window.alert('Доступ к этому уроку появится после проверки домашнего задания.');
        return;
      }
      const root = shell.shadowRoot;
      setActiveLessonRow(root, lessonId);
      const token = getAccessToken() ?? undefined;
      const meta = lessonMetaById.get(lessonId);
      let lesson: LessonV1 | null = null;
      try {
        const lessonRes = await fetchJson<{ lesson: LessonV1 }>(`/lessons/${encodeURIComponent(lessonId)}`, token);
        lesson = lessonRes.lesson;
        setLessonContent(root, {
          moduleTitle: meta ? `${meta.moduleTitle} · Урок ${meta.lessonNo}` : 'Текущий урок',
          lessonTitle: lesson.title,
          bodyText: (lesson.contentMarkdown ?? '').trim() || 'Содержимое урока появится здесь.',
        });
      } catch {
        setLessonContent(root, {
          moduleTitle: meta ? `${meta.moduleTitle} · Урок ${meta.lessonNo}` : 'Текущий урок',
          lessonTitle: 'Урок',
          bodyText: 'Не удалось загрузить урок. Возможно, он пока закрыт.',
        });
      }

      // Video: reuse the same Rutube embed logic as in Telegram webapp
      const videoHost = root.querySelector('#screen-s-lesson [data-ep-video]') as HTMLElement | null;
      if (videoHost) {
        // clean previous iframe if any
        videoHost.querySelectorAll('iframe').forEach((x) => x.remove());

        const raw = lesson && (lesson as any).video && (lesson as any).video.kind === 'rutube'
          ? ((lesson as any).video.url as string)
          : null;
        const embed = raw ? normalizeRutubeEmbedUrl(raw) ?? raw : null;

        if (embed) {
          videoHost.style.display = '';
          // hide placeholder play button (we will embed)
          const play = videoHost.querySelector('.play-btn') as HTMLElement | null;
          if (play) play.style.display = 'none';
          const overlay = videoHost.querySelector('.video-overlay-bottom') as HTMLElement | null;
          if (overlay) overlay.style.display = 'none';

          const iframe = document.createElement('iframe');
          iframe.src = embed;
          iframe.title = 'Rutube video';
          iframe.allow = 'autoplay; fullscreen; picture-in-picture';
          iframe.allowFullscreen = true;
          iframe.style.position = 'absolute';
          iframe.style.inset = '0';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = '0';
          iframe.referrerPolicy = 'no-referrer';
          videoHost.style.position = 'relative';
          videoHost.appendChild(iframe);
        } else {
          // no video -> hide whole block
          videoHost.style.display = 'none';
          const play = videoHost.querySelector('.play-btn') as HTMLElement | null;
          if (play) play.style.display = '';
          const overlay = videoHost.querySelector('.video-overlay-bottom') as HTMLElement | null;
          if (overlay) overlay.style.display = '';
        }
      }

      // Homework + materials
      const hwPrompt = root.querySelector('#screen-s-lesson [data-ep-homework-prompt]') as HTMLElement | null;
      const hwAssignmentFiles = root.querySelector(
        '#screen-s-lesson [data-ep-homework-assignment-files]',
      ) as HTMLElement | null;
      const hwWrap = root.querySelector('#screen-s-lesson [data-ep-homework]') as HTMLElement | null;
      const goHwBtn = root.querySelector('#screen-s-lesson [data-ep-go-homework]') as HTMLElement | null;
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();

      let homeworkPrompt = '';
      let hasExpertHomework = false;
      try {
        const assRes = await fetchJson<{ assignment: AssignmentV1 | null; files: any[] }>(
          `/lessons/${encodeURIComponent(lessonId)}/assignment`,
          token,
        );
        const assignment = assRes.assignment;
        const files = (assRes.files ?? []) as Array<{ id: string; filename: string; sizeBytes?: number | null }>;
        homeworkPrompt = (assignment?.promptMarkdown ?? '').trim();
        hasExpertHomework =
          Boolean(assignment) &&
          (homeworkPromptHasBody(assignment?.promptMarkdown ?? null) || (files?.length ?? 0) > 0);

        const hasPromptBody = homeworkPromptHasBody(assignment?.promptMarkdown ?? null);

        // Файлы задания эксперта — под текстом ДЗ (как в мини-приложении), не в «Материалы к уроку»
        if (hwAssignmentFiles) {
          hwAssignmentFiles.replaceChildren();
          hwAssignmentFiles.classList.remove('hw-panel__files--after-text');
          if (files.length > 0) {
            hwAssignmentFiles.style.display = 'flex';
            if (hasPromptBody) hwAssignmentFiles.classList.add('hw-panel__files--after-text');
            files.forEach((f) => {
              const row = document.createElement('div');
              row.className = 'material-row';
              row.style.cursor = 'pointer';
              row.dataset.epAssignmentPreview = '1';
              row.dataset.epAssignmentFileId = f.id;
              row.dataset.epLessonId = lessonId;
              row.dataset.epAssignmentFilename = encodeURIComponent(f.filename);

              const ico = document.createElement('div');
              ico.className = 'mat-ico';
              ico.style.background = 'rgba(10,168,200,.08)';
              ico.textContent = '📎';

              const body = document.createElement('div');
              body.style.flex = '1';
              const nameEl = document.createElement('div');
              nameEl.className = 'mat-name';
              nameEl.textContent = f.filename;
              const metaEl = document.createElement('div');
              metaEl.className = 'mat-meta';
              metaEl.textContent = f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} КБ` : 'Файл';
              body.append(nameEl, metaEl);

              const btn = document.createElement('button');
              btn.className = 'btn btn-outline btn-sm';
              btn.type = 'button';
              btn.textContent = '⬇ Скачать';
              btn.dataset.epAssignmentDownload = '1';
              btn.dataset.epAssignmentFileId = f.id;
              btn.dataset.epLessonId = lessonId;
              btn.dataset.epAssignmentFilename = encodeURIComponent(f.filename);

              row.append(ico, body, btn);
              hwAssignmentFiles.appendChild(row);
            });
          } else {
            hwAssignmentFiles.style.display = 'none';
          }
        }

        if (matsTitle) matsTitle.style.display = 'none';

        // homework prompt (блок «Домашнее задание»: текст и/или смысл через материалы)
        if (hwWrap) hwWrap.style.display = hasExpertHomework ? '' : 'none';
        if (hwPrompt) {
          if (hasExpertHomework) setRichTextWithLinks(hwPrompt, homeworkPrompt || '');
          else hwPrompt.replaceChildren();
        }
      } catch {
        if (matsTitle) matsTitle.style.display = 'none';
        if (hwWrap) hwWrap.style.display = 'none';
        if (hwPrompt) hwPrompt.replaceChildren();
        if (hwAssignmentFiles) {
          hwAssignmentFiles.replaceChildren();
          hwAssignmentFiles.classList.remove('hw-panel__files--after-text');
          hwAssignmentFiles.style.display = 'none';
        }
        homeworkPrompt = '';
        hasExpertHomework = false;
      }

      (root as any).__epHomework = {
        lessonId,
        lessonTitle: lesson?.title ?? 'Урок',
        prompt: homeworkPrompt,
        hasHomework: hasExpertHomework,
      };

      let latestSub: MySubmissionV1 | null = null;
      try {
        const subsRes = await fetchJson<{ items: MySubmissionV1[] }>(
          `/lessons/${encodeURIComponent(lessonId)}/submissions/me`,
          token,
        );
        latestSub = subsRes.items?.[0] ?? null;
        renderMySubmission(root, latestSub, hasExpertHomework);
      } catch {
        renderMySubmission(root, null, hasExpertHomework);
      }

      setGoHomeworkButtonVisible(goHwBtn, hasExpertHomework && !latestSub);

      updatePrevLessonUi(root, lessonId);
    }

    async function openCourse(courseId: string): Promise<void> {
      shell.setRole('student');
      shell.showScreen('s-lesson');

      const root = shell.shadowRoot;
      currentCourseId = courseId;
      lessonMetaById.clear();
      unlockedLessonIds.clear();
      modulesOrderedLessonIds = [];

      const token = getAccessToken() ?? undefined;
      const myCourses = await fetchJson<MyCoursesResponseV1>('/me/courses', token);
      const knownTitle = myCourses.items?.find((x) => x.course.id === courseId)?.course?.title ?? 'Курс';

      // Avoid showing design placeholders while data is loading
      setLessonContent(root, {
        moduleTitle: 'Загрузка…',
        lessonTitle: knownTitle,
        bodyText: 'Загрузка содержимого курса…',
      });
      const videoHost = root.querySelector('#screen-s-lesson [data-ep-video]') as HTMLElement | null;
      if (videoHost) {
        videoHost.style.display = 'none';
        videoHost.querySelectorAll('iframe').forEach((x) => x.remove());
      }
      const hwWrap = root.querySelector('#screen-s-lesson [data-ep-homework]') as HTMLElement | null;
      const hwAssignFiles0 = root.querySelector(
        '#screen-s-lesson [data-ep-homework-assignment-files]',
      ) as HTMLElement | null;
      if (hwAssignFiles0) {
        hwAssignFiles0.replaceChildren();
        hwAssignFiles0.classList.remove('hw-panel__files--after-text');
        hwAssignFiles0.style.display = 'none';
      }
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();
      if (matsTitle) matsTitle.style.display = 'none';
      if (hwWrap) hwWrap.style.display = 'none';
      const prevBtn0 = root.querySelector('#screen-s-lesson [data-ep-prev-lesson]') as HTMLElement | null;
      if (prevBtn0) {
        prevBtn0.style.display = 'none';
        delete (prevBtn0 as HTMLButtonElement).dataset.epPrevTarget;
      }
      const subWrap0 = root.querySelector('#screen-s-lesson [data-ep-my-submission-wrap]') as HTMLElement | null;
      if (subWrap0) subWrap0.style.display = 'none';
      const goHwBtn0 = root.querySelector('#screen-s-lesson [data-ep-go-homework]') as HTMLElement | null;
      setGoHomeworkButtonVisible(goHwBtn0, false);

      const modules = await fetchModules(courseId);
      const moduleLessons = await Promise.all(
        modules.map(async (m) => {
          const res = await fetchModuleLessons(courseId, m.id);
          return { module: m, res };
        }),
      );

      modulesOrderedLessonIds = moduleLessons.map(({ res }) => (res.items ?? []).map((x) => x.id));

      let activeLessonId: string | null = null;
      let activeModuleTitle = 'Текущий урок';
      let activeLessonNo = 1;
      const completedAll = new Set<string>();
      let total = 0;

      for (const { module, res } of moduleLessons) {
        const completed = new Set(res.completedLessonIds ?? []);
        const unlocked = new Set(res.unlockedLessonIds ?? []);
        (res.unlockedLessonIds ?? []).forEach((id) => unlockedLessonIds.add(id));
        for (const l of res.items ?? []) {
          total += 1;
          if (completed.has(l.id)) completedAll.add(l.id);
          // store lesson meta for later “module · lesson N” label
          const lessonNo = (l.order && l.order > 0 ? l.order : (res.items ?? []).indexOf(l) + 1) | 0;
          lessonMetaById.set(l.id, { moduleTitle: module.title, lessonNo: lessonNo || (res.items ?? []).indexOf(l) + 1 });
          if (!activeLessonId && unlocked.has(l.id) && !completed.has(l.id)) {
            activeLessonId = l.id;
            activeModuleTitle = module.title;
            activeLessonNo = lessonNo || 1;
          }
        }
      }

      renderLessonTree({
        root,
        courseTitle: knownTitle,
        modules: moduleLessons.map(({ module, res }) => ({
          id: module.id,
          title: module.title,
          lessons: res.items ?? [],
          unlocked: new Set(res.unlockedLessonIds ?? []),
          completed: new Set(res.completedLessonIds ?? []),
        })),
        activeLessonId,
      });

      setProgress(root, completedAll.size, total);

      if (activeLessonId) {
        // Reuse openLesson to hydrate video/materials/homework too
        await openLesson(activeLessonId);
      } else {
        setLessonContent(root, {
          moduleTitle: 'Готово',
          lessonTitle: 'Курс завершён',
          bodyText: 'Все уроки пройдены.',
        });
        const prevDone = root.querySelector('#screen-s-lesson [data-ep-prev-lesson]') as HTMLElement | null;
        if (prevDone) {
          prevDone.style.display = 'none';
          delete (prevDone as HTMLButtonElement).dataset.epPrevTarget;
        }
        const goDone = root.querySelector('#screen-s-lesson [data-ep-go-homework]') as HTMLElement | null;
        setGoHomeworkButtonVisible(goDone, false);
        renderMySubmission(root, null, false);
      }
    }

    type MeUserV1 = {
      id: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
      platformRole: string;
    };

    function displayName(u: MeUserV1): string {
      const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      if (n) return n;
      if (u.username) return u.username;
      return 'Пользователь';
    }

    function initialsFromName(name: string): string {
      const t = (name || '').trim();
      if (!t) return 'ED';
      const parts = t.split(/\s+/).filter(Boolean);
      const a = (parts[0]?.[0] ?? '').toUpperCase();
      const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
      return (a + b).slice(0, 2) || 'ED';
    }

    async function hydrateTopbarUser(): Promise<void> {
      const token = getAccessToken();
      if (!token) {
        expertShellAccess.allowed = false;
        activeExpertId = null;
        return;
      }

      const root = shell.shadowRoot;
      const nameEl = root.querySelector('.topbar-user .user-name') as HTMLElement | null;
      const roleEl = root.querySelector('.topbar-user .user-role') as HTMLElement | null;
      const avatarEl = root.querySelector('.topbar-user .avatar') as HTMLElement | null;
      if (!nameEl || !roleEl || !avatarEl) return;

      try {
        const me = await fetchJson<{ user?: MeUserV1 }>('/me', token);
        const u = me.user;
        if (!u) {
          expertShellAccess.allowed = false;
          activeExpertId = null;
          return;
        }
        let inExpertTeam = false;
        activeExpertId = null;
        try {
          const mem = await fetchJson<{ items?: { expertId: string }[] }>('/me/expert-memberships', token);
          const mItems = mem.items ?? [];
          inExpertTeam = mItems.length > 0;
          activeExpertId = mItems[0]?.expertId ?? null;
        } catch {
          inExpertTeam = false;
          activeExpertId = null;
        }
        expertShellAccess.allowed = inExpertTeam;
        const name = displayName(u);
        nameEl.textContent = name;
        roleEl.textContent = inExpertTeam ? 'Эксперт' : 'Ученик';
        avatarEl.textContent = initialsFromName(name);
      } catch {
        expertShellAccess.allowed = false;
        activeExpertId = null;
        // не ломаем интерфейс, если /me недоступен
      }
    }

    async function hydrateStudentCatalog(): Promise<void> {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-catalog');
      const grid = screen?.querySelector('.grid3');
      if (!grid) return;
      grid.replaceChildren();

      const data = await fetchJson<LibraryResponseV1>('/library');
      const courses = (data.courses ?? []).slice(0, 12);
      courses.forEach((c) => grid.appendChild(renderCourseCard(c)));
    }

    async function hydrateMyCourses(): Promise<void> {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-mycourses');
      const grid = screen?.querySelector('.grid3');
      if (!grid) return;
      grid.replaceChildren();

      const token = getAccessToken();
      const data = await fetchJson<MyCoursesResponseV1>('/me/courses', token ?? undefined);
      const items = (data.items ?? []).slice(0, 12);
      myCourseIds.clear();
      (data.items ?? []).forEach((it) => myCourseIds.add(it.course.id));
      items.forEach((it) => grid.appendChild(renderMyCourseCard(it)));

      const sub = screen?.querySelector('.page-sub');
      if (sub) sub.textContent = `${items.length} активных курса`;
    }

    function pluralRu(n: number, forms: readonly [string, string, string]): string {
      const k = Math.abs(Math.trunc(n)) % 100;
      const k1 = k % 10;
      if (k > 10 && k < 20) return forms[2];
      if (k1 > 1 && k1 < 5) return forms[1];
      if (k1 === 1) return forms[0];
      return forms[2];
    }

    async function resolveActiveExpertId(): Promise<string | null> {
      if (activeExpertId) return activeExpertId;
      const token = getAccessToken();
      if (!token) return null;
      try {
        const mem = await fetchJson<{ items?: { expertId: string }[] }>('/me/expert-memberships', token);
        activeExpertId = mem.items?.[0]?.expertId ?? null;
      } catch {
        activeExpertId = null;
      }
      return activeExpertId;
    }

    function renderExpertCourseDashboardCard(item: ExpertCourseDashboardItemV1, index: number): HTMLElement {
      const gradients = [
        ['linear-gradient(135deg,#0e2c38,#1a4a58)', 'rgba(10,168,200,.5)'],
        ['linear-gradient(135deg,#1c1428,#2e1f4a)', 'rgba(124,58,237,.5)'],
        ['linear-gradient(135deg,#1c1409,#2e2010)', 'rgba(245,158,11,.4)'],
      ] as const;
      const [bg, ac] = gradients[index % gradients.length]!;

      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.epExpertCourseCard = '1';
      card.style.overflow = 'hidden';
      card.style.cursor = 'pointer';
      if (item.status === 'draft') card.style.opacity = '0.88';

      const thumb = document.createElement('div');
      thumb.style.height = '120px';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';
      thumb.style.position = 'relative';
      thumb.style.background = bg;

      const initials = document.createElement('span');
      initials.style.fontFamily = 'var(--fd)';
      initials.style.fontSize = '36px';
      initials.style.fontWeight = '900';
      initials.style.color = ac;
      initials.textContent = initialsFromTitle(item.title);

      const cover = normalizeAssetUrl(item.coverUrl ?? null);
      if (cover) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = cover;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.position = 'absolute';
        img.style.inset = '0';
        img.addEventListener(
          'error',
          () => {
            img.remove();
            thumb.appendChild(initials);
          },
          { once: true },
        );
        thumb.appendChild(img);
      } else {
        thumb.appendChild(initials);
      }

      const body = document.createElement('div');
      body.style.padding = '16px';

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
      } else if (item.status === 'archived') {
        tag.classList.add('tag-purple');
        tag.textContent = 'Архив';
      } else {
        tag.classList.add('tag-draft');
        tag.textContent = 'Черновик';
      }

      const lessonsMeta = document.createElement('span');
      lessonsMeta.style.fontFamily = 'var(--fm)';
      lessonsMeta.style.fontSize = '9px';
      lessonsMeta.style.color = 'var(--t3)';
      lessonsMeta.textContent = `${item.lessonsCount} ${pluralRu(item.lessonsCount, ['урок', 'урока', 'уроков'])}`;
      row1.append(tag, lessonsMeta);

      const titleEl = document.createElement('div');
      titleEl.style.fontFamily = 'var(--fd)';
      titleEl.style.fontSize = '13px';
      titleEl.style.fontWeight = '700';
      titleEl.style.color = 'var(--t1)';
      titleEl.style.marginBottom = '4px';
      titleEl.style.letterSpacing = '-.01em';
      titleEl.textContent = item.title;

      const meta = document.createElement('div');
      meta.style.fontSize = '11px';
      meta.style.color = 'var(--t3)';
      meta.style.marginBottom = '12px';
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
      progCaption.style.fontSize = '10px';
      progCaption.style.color = 'var(--t3)';
      progCaption.style.marginTop = '4px';
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
        bMain.dataset.epExpertCourseEdit = '1';
        bMain.dataset.epExpertCourseId = item.id;
        bMain.textContent = '✏️ Продолжить';

        const bDel = document.createElement('button');
        bDel.type = 'button';
        bDel.className = 'btn btn-ghost btn-sm btn-icon';
        bDel.dataset.epExpertCourseDelete = '1';
        bDel.dataset.epExpertCourseId = item.id;
        bDel.setAttribute('aria-label', 'Удалить курс');
        bDel.textContent = '🗑';
        foot.append(bMain, bDel);
      } else {
        const bEdit = document.createElement('button');
        bEdit.type = 'button';
        bEdit.className = 'btn btn-outline btn-sm';
        bEdit.style.flex = '1';
        bEdit.style.justifyContent = 'center';
        bEdit.dataset.epExpertCourseEdit = '1';
        bEdit.dataset.epExpertCourseId = item.id;
        bEdit.textContent = '✏️ Редактировать';

        const bChart = document.createElement('button');
        bChart.type = 'button';
        bChart.className = 'btn btn-ghost btn-sm btn-icon';
        bChart.dataset.epExpertCourseAnalytics = '1';
        bChart.dataset.epExpertCourseId = item.id;
        bChart.setAttribute('aria-label', 'Аналитика');
        bChart.textContent = '📊';

        const bEye = document.createElement('button');
        bEye.type = 'button';
        bEye.className = 'btn btn-ghost btn-sm btn-icon';
        bEye.dataset.epExpertCoursePreview = '1';
        bEye.dataset.epExpertCourseId = item.id;
        bEye.setAttribute('aria-label', 'Предпросмотр');
        bEye.textContent = '👁';
        foot.append(bEdit, bChart, bEye);
      }

      body.append(row1, titleEl, meta, progWrap, progCaption, div, foot);
      card.append(thumb, body);
      return card;
    }

    async function hydrateExpertCourses(
      root: ShadowRoot | null | undefined,
      opts?: { q?: string },
    ): Promise<void> {
      if (!root) return;
      const screen = root.getElementById('screen-e-courses');
      const grid = screen?.querySelector('[data-ep-expert-courses-grid]') as HTMLElement | null;
      const sub = screen?.querySelector('[data-ep-expert-courses-sub]') as HTMLElement | null;
      if (!grid || !sub) return;

      const token = getAccessToken();
      if (!token) {
        grid.replaceChildren();
        const msg = document.createElement('div');
        msg.className = 'card';
        msg.style.padding = '20px';
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--t3)';
        msg.textContent = 'Войдите, чтобы видеть свои курсы.';
        grid.appendChild(msg);
        sub.textContent = '—';
        return;
      }

      const eid = await resolveActiveExpertId();
      if (!eid) {
        grid.replaceChildren();
        const msg = document.createElement('div');
        msg.className = 'card';
        msg.style.padding = '20px';
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--t3)';
        msg.textContent = 'Нет доступа к команде эксперта.';
        grid.appendChild(msg);
        sub.textContent = '—';
        return;
      }

      grid.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'card';
      loading.style.padding = '20px';
      loading.style.textAlign = 'center';
      loading.style.color = 'var(--t3)';
      loading.textContent = 'Загрузка курсов…';
      grid.appendChild(loading);
      sub.textContent = 'Загрузка…';

      const qRaw = opts?.q?.trim() ?? '';
      const qParam = qRaw ? `&q=${encodeURIComponent(qRaw)}` : '';

      try {
        const data = await fetchJson<ListExpertCoursesDashboardResponseV1>(
          `/experts/${encodeURIComponent(eid)}/courses/dashboard?limit=100${qParam}`,
          token,
        );
        grid.replaceChildren();
        const items = data.items ?? [];
        const totalStud = items.reduce((s, it) => s + (it.activeStudentsCount ?? 0), 0);
        sub.textContent = `${items.length} ${pluralRu(items.length, ['курс', 'курса', 'курсов'])} · ${totalStud} ${pluralRu(totalStud, ['студент', 'студента', 'студентов'])} суммарно`;
        if (items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'card';
          empty.style.padding = '22px';
          empty.style.textAlign = 'center';
          empty.style.color = 'var(--t3)';
          empty.textContent = qRaw ? 'Ничего не найдено по запросу.' : 'У вас пока нет курсов. Создайте первый курс.';
          grid.appendChild(empty);
          return;
        }
        items.forEach((it, i) => grid.appendChild(renderExpertCourseDashboardCard(it, i)));
      } catch {
        grid.replaceChildren();
        const err = document.createElement('div');
        err.className = 'card';
        err.style.padding = '20px';
        err.style.textAlign = 'center';
        err.style.color = 'var(--err)';
        err.textContent = 'Не удалось загрузить курсы.';
        grid.appendChild(err);
        sub.textContent = '—';
      }
    }

    // Подгружаем данные на старте
    void hydrateTopbarUser();
    void hydrateStudentCatalog();
    void hydrateMyCourses();

    function fillCoursePreview(course: CourseV1, lessonsCount: number): void {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-course');
      if (!screen) return;

      (screen.querySelector('[data-ep-course-preview-title]') as HTMLElement | null)?.replaceChildren(
        document.createTextNode('Курс'),
      );
      (screen.querySelector('[data-ep-course-preview-h1]') as HTMLElement | null)!.textContent = course.title;
      (screen.querySelector('[data-ep-course-preview-author]') as HTMLElement | null)!.textContent =
        course.authorName?.trim() ? course.authorName : 'EDIFY';
      (screen.querySelector('[data-ep-course-preview-price]') as HTMLElement | null)!.textContent = formatPrice(course);
      setRichTextWithLinks(
        screen.querySelector('[data-ep-course-preview-desc]') as HTMLElement | null,
        (course.description ?? '').trim() || 'Описание курса появится здесь.',
      );
      (screen.querySelector('[data-ep-course-preview-sub]') as HTMLElement | null)!.textContent =
        lessonsCount > 0 ? `${lessonsCount} уроков` : 'Уроки появятся после публикации';
      (screen.querySelector('[data-ep-course-preview-lessons]') as HTMLElement | null)!.textContent =
        lessonsCount > 0 ? `Уроков: ${lessonsCount}` : 'Уроков: —';

      const coverHost = screen.querySelector('[data-ep-course-preview-cover]') as HTMLElement | null;
      const initials = screen.querySelector('[data-ep-course-preview-initials]') as HTMLElement | null;
      if (coverHost) {
        coverHost.style.backgroundImage = '';
        coverHost.style.backgroundSize = '';
        coverHost.style.backgroundPosition = '';
        coverHost.style.background = 'var(--bg2)';
        coverHost.querySelectorAll('img').forEach((x) => x.remove());
        const cover = normalizeAssetUrl(course.coverUrl ?? null);
        if (cover) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = cover;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.display = 'block';
          img.addEventListener(
            'error',
            () => {
              if (initials) initials.style.display = '';
            },
            { once: true },
          );
          coverHost.appendChild(img);
          if (initials) initials.style.display = 'none';
        } else if (initials) {
          initials.style.display = '';
          initials.textContent = initialsFromTitle(course.title);
        }
      }

      const openBtn = screen.querySelector('[data-ep-course-preview-open]') as HTMLButtonElement | null;
      if (openBtn) openBtn.disabled = true;
    }

    async function openCoursePreview(courseId: string): Promise<void> {
      shell.setRole('student');
      shell.showScreen('s-course');
      const token = getAccessToken() ?? undefined;
      const res = await fetchJson<CourseDetailResponseV1>(`/courses/${encodeURIComponent(courseId)}`, token);
      fillCoursePreview(res.course, (res.lessons ?? []).length);
    }

    // Reactions to UI actions (course / lesson)
    const prevOnAction = (shell as any).__onAction as ((action: any, ev: Event) => void) | undefined;
    // (we cannot modify mountPlatformShell to store handler; instead we listen to emitted actions by wrapping at mount time)
    // Since we already have `onAction` above, we handle actions via ShadowRoot click hooks:
    shell.shadowRoot.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement | null;

      const prevLessonBtn = t?.closest('[data-ep-prev-lesson]') as HTMLButtonElement | null;
      const prevTarget = prevLessonBtn?.dataset.epPrevTarget;
      if (prevLessonBtn && prevTarget) {
        ev.preventDefault();
        void openLesson(prevTarget);
        return;
      }

      const recentLessonRow = t?.closest('tr[data-ep-recent-lesson]') as HTMLElement | null;
      const recentLid = recentLessonRow?.dataset.epRecentLesson;
      if (recentLessonRow && recentLid) {
        ev.preventDefault();
        shell.showScreen('s-lesson');
        void openLesson(recentLid);
        return;
      }

      const subFileBtn = t?.closest('[data-ep-submission-file-key]') as HTMLElement | null;
      const subFileKey = subFileBtn?.dataset.epSubmissionFileKey;
      if (subFileKey) {
        ev.preventDefault();
        void (async () => {
          try {
            const api = getApiBaseUrl();
            if (!api) throw new Error('API base url is empty');
            const url = `${api}/files?key=${encodeURIComponent(subFileKey)}`;
            const name = subFileKey.includes('/') ? subFileKey.slice(subFileKey.lastIndexOf('/') + 1) : subFileKey;
            await downloadAuthenticatedFile({ url, fallbackFilename: name || 'file' });
          } catch {
            window.alert('Не удалось скачать вложение');
          }
        })();
        return;
      }

      const exCard = t?.closest('[data-ep-expert-course-card]') as HTMLElement | null;
      if (exCard) {
        const btn = t?.closest('button') as HTMLButtonElement | null;
        const exCid = btn?.dataset.epExpertCourseId;
        if (btn?.dataset.epExpertCourseEdit && exCid) {
          ev.preventDefault();
          ev.stopPropagation();
          shell.showScreen('e-builder');
          return;
        }
        if (btn?.dataset.epExpertCourseAnalytics && exCid) {
          ev.preventDefault();
          ev.stopPropagation();
          window.alert('Аналитика курса появится в этом разделе позже.');
          return;
        }
        if (btn?.dataset.epExpertCoursePreview && exCid) {
          ev.preventDefault();
          ev.stopPropagation();
          void openCoursePreview(exCid);
          return;
        }
        if (btn?.dataset.epExpertCourseDelete && exCid) {
          ev.preventDefault();
          ev.stopPropagation();
          void (async () => {
            const tok = getAccessToken();
            const eid = await resolveActiveExpertId();
            if (!tok || !eid) return;
            if (!window.confirm('Удалить курс? Доступ учеников будет отозван после удаления.')) return;
            try {
              await deleteJson(`/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(exCid)}`, tok);
              await hydrateExpertCourses(shell.shadowRoot);
            } catch {
              window.alert('Не удалось удалить курс. Нужна роль менеджера или выше.');
            }
          })();
          return;
        }
        if (!btn) {
          ev.preventDefault();
          shell.showScreen('e-builder');
        }
        return;
      }

      const courseId = (t?.closest('[data-ep-course-id]') as HTMLElement | null)?.dataset.epCourseId;
      if (courseId) {
        // If enrolled -> go to current lesson; else open preview screen
        if (myCourseIds.has(courseId)) void openCourse(courseId);
        else void openCoursePreview(courseId);
      }

      const lessonEl = t?.closest('[data-ep-lesson-id]') as HTMLElement | null;
      const lessonId = lessonEl?.dataset.epLessonId;
      if (lessonEl && lessonId) {
        ev.preventDefault();
        void openLesson(lessonId);
      }

      // Assignment materials: row → open preview; "Скачать" → attachment download
      const dlEl = t?.closest('[data-ep-assignment-download]') as HTMLElement | null;
      const dlFileId = dlEl?.dataset.epAssignmentFileId;
      const dlLessonId = dlEl?.dataset.epLessonId;
      if (dlFileId && dlLessonId) {
        ev.preventDefault();
        ev.stopPropagation();
        void (async () => {
          try {
            const api = getApiBaseUrl();
            if (!api) throw new Error('API base url is empty');
            const encName = dlEl?.dataset.epAssignmentFilename;
            const fallbackFilename = encName ? decodeURIComponent(encName) : 'file';
            const url = `${api}/lessons/${encodeURIComponent(dlLessonId)}/assignment/files/${encodeURIComponent(dlFileId)}/download`;
            await downloadAuthenticatedFile({ url, fallbackFilename });
          } catch {
            window.alert('Не удалось скачать файл');
          }
        })();
      } else {
        const prevEl = t?.closest('[data-ep-assignment-preview]') as HTMLElement | null;
        const prevFileId = prevEl?.dataset.epAssignmentFileId;
        const prevLessonId = prevEl?.dataset.epLessonId;
        if (prevFileId && prevLessonId) {
          ev.preventDefault();
          void (async () => {
            try {
              const api = getApiBaseUrl();
              if (!api) throw new Error('API base url is empty');
              const url = `${api}/lessons/${encodeURIComponent(prevLessonId)}/assignment/files/${encodeURIComponent(prevFileId)}/download?inline=1`;
              await previewAuthenticatedFile({ url });
            } catch {
              window.alert('Не удалось открыть файл');
            }
          })();
        }
      }

      const clearHwFile = t?.closest('[data-ep-homework-clear-file]') as HTMLElement | null;
      if (clearHwFile) {
        ev.preventDefault();
        hwDraft.selectedFile = null;
        hwDraft.uploadedFileKey = null;
        const inp = shell.shadowRoot.querySelector(
          '#screen-s-homework [data-ep-homework-file-input]',
        ) as HTMLInputElement | null;
        if (inp) inp.value = '';
        syncHomeworkFileRow(shell.shadowRoot);
        return;
      }

      const uploadZone = t?.closest('[data-ep-homework-upload-zone]') as HTMLElement | null;
      if (uploadZone) {
        ev.preventDefault();
        const inp = shell.shadowRoot.querySelector(
          '#screen-s-homework [data-ep-homework-file-input]',
        ) as HTMLInputElement | null;
        inp?.click();
        return;
      }

      const submitHw = t?.closest('[data-ep-homework-submit]') as HTMLElement | null;
      if (submitHw) {
        ev.preventDefault();
        void submitHomeworkFromForm();
        return;
      }

      const editHwFromLesson = t?.closest('[data-ep-homework-edit]') as HTMLElement | null;
      if (editHwFromLesson) {
        ev.preventDefault();
        void prepareHomeworkScreen();
        return;
      }

      // Go to homework submit screen
      const goHw = t?.closest('[data-ep-go-homework]') as HTMLElement | null;
      if (goHw) {
        ev.preventDefault();
        void prepareHomeworkScreen();
      }
    });

    shell.shadowRoot.addEventListener('change', (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t?.matches('input[data-ep-homework-file-input]')) return;
      const inp = t as HTMLInputElement;
      const f = inp.files?.[0] ?? null;
      const maxBytes = 50 * 1024 * 1024;
      if (f && f.size > maxBytes) {
        window.alert('Файл больше 50 МБ.');
        inp.value = '';
        return;
      }
      hwDraft.selectedFile = f;
      if (f) hwDraft.uploadedFileKey = null;
      syncHomeworkFileRow(shell.shadowRoot);
    });

    shell.shadowRoot.addEventListener('input', (ev) => {
      const inp = ev.target as HTMLInputElement | null;
      if (!inp?.matches?.('[data-ep-expert-courses-search]')) return;
      window.clearTimeout(expertCoursesSearchTimer);
      expertCoursesSearchTimer = window.setTimeout(() => {
        void hydrateExpertCourses(shell.shadowRoot, { q: inp.value });
      }, 350);
    });
  }
}

// Reveal анимации — на этой странице тоже полезны.
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1 },
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

