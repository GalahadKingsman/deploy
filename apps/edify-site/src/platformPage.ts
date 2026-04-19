import './edify.css';
import { ACCESS_TOKEN_KEY, getAccessToken } from './authSession.js';
import { getApiBaseUrl } from './env.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';
import { mountPlatformShell } from './platform/mountPlatformShell.js';
import { normalizeRutubeEmbedUrl } from './util/rutubeEmbed.js';

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

    const shell = mountPlatformShell(platformMount, {
      initialRole: 'student',
      initialScreenId: 's-catalog',
      onAction(action) {
        if (import.meta.env.DEV) console.debug('[edify-platform-page]', action);
      },
    });

    type ModuleV1 = { id: string; title: string; position?: number };
    type LessonV1 = { id: string; title: string; order?: number; contentMarkdown?: string | null };
    type AssignmentV1 = { id: string; lessonId: string; promptMarkdown?: string | null };
    type AssignmentFileV1 = { id: string; filename: string; sizeBytes?: number | null };

    let currentCourseId: string | null = null;
    const lessonMetaById = new Map<string, { moduleTitle: string; lessonNo: number }>();
    const unlockedLessonIds = new Set<string>();

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
      if (body) body.innerHTML = params.bodyText.replace(/\n/g, '<br>');
    }

    function setActiveLessonRow(root: ShadowRoot, lessonId: string): void {
      root.querySelectorAll('#screen-s-lesson .lesson-row').forEach((el) => el.classList.remove('active'));
      (root.querySelector(`#screen-s-lesson .lesson-row[data-ep-lesson-id="${CSS.escape(lessonId)}"]`) as
        | HTMLElement
        | null)?.classList.add('active');
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
      const hwWrap = root.querySelector('#screen-s-lesson [data-ep-homework]') as HTMLElement | null;
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();

      try {
        const assRes = await fetchJson<{ assignment: AssignmentV1 | null; files: any[] }>(
          `/lessons/${encodeURIComponent(lessonId)}/assignment`,
          token,
        );
        const assignment = assRes.assignment;
        const files = (assRes.files ?? []) as Array<{ id: string; filename: string; sizeBytes?: number | null }>;

        // materials (files)
        if (mats && files.length > 0) {
          if (matsTitle) matsTitle.style.display = '';
          files.forEach((f) => {
            const row = document.createElement('div');
            row.className = 'material-row';
            row.style.cursor = 'pointer';
            row.dataset.epAssignmentFileId = f.id;
            row.dataset.epLessonId = lessonId;

            const ico = document.createElement('div');
            ico.className = 'mat-ico';
            ico.style.background = 'rgba(10,168,200,.08)';
            ico.textContent = '📎';

            const body = document.createElement('div');
            body.style.flex = '1';
            body.innerHTML =
              `<div class="mat-name">${f.filename}</div>` +
              `<div class="mat-meta">${f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} КБ` : 'Файл'}</div>`;

            const btn = document.createElement('button');
            btn.className = 'btn btn-outline btn-sm';
            btn.type = 'button';
            btn.textContent = '⬇ Скачать';
            btn.dataset.epAssignmentFileId = f.id;
            btn.dataset.epLessonId = lessonId;

            row.append(ico, body, btn);
            mats.appendChild(row);
          });
        } else {
          if (matsTitle) matsTitle.style.display = 'none';
        }

        // homework prompt
        const prompt = (assignment?.promptMarkdown ?? '').trim();
        if (hwWrap) hwWrap.style.display = prompt ? '' : 'none';
        if (hwPrompt) hwPrompt.textContent = prompt || '';

        // remember current homework for the submit screen
        (root as any).__epHomework = {
          lessonId,
          title: assignment ? `ДЗ к уроку` : '',
          prompt,
        };
      } catch {
        if (matsTitle) matsTitle.style.display = 'none';
        if (hwWrap) hwWrap.style.display = 'none';
      }
    }

    async function openCourse(courseId: string): Promise<void> {
      shell.setRole('student');
      shell.showScreen('s-lesson');

      const root = shell.shadowRoot;
      currentCourseId = courseId;
      lessonMetaById.clear();
      unlockedLessonIds.clear();

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
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();
      if (matsTitle) matsTitle.style.display = 'none';
      if (hwWrap) hwWrap.style.display = 'none';

      const modules = await fetchModules(courseId);
      const moduleLessons = await Promise.all(
        modules.map(async (m) => {
          const res = await fetchModuleLessons(courseId, m.id);
          return { module: m, res };
        }),
      );

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

    function isExpertRole(role: string): boolean {
      const r = (role || '').toLowerCase();
      return r === 'expert' || r === 'owner' || r === 'admin' || r === 'moderator';
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
      if (!token) return;

      const root = shell.shadowRoot;
      const nameEl = root.querySelector('.topbar-user .user-name') as HTMLElement | null;
      const roleEl = root.querySelector('.topbar-user .user-role') as HTMLElement | null;
      const avatarEl = root.querySelector('.topbar-user .avatar') as HTMLElement | null;
      if (!nameEl || !roleEl || !avatarEl) return;

      try {
        const me = await fetchJson<{ user?: MeUserV1 }>('/me', token);
        const u = me.user;
        if (!u) return;
        const name = displayName(u);
        nameEl.textContent = name;
        roleEl.textContent = isExpertRole(u.platformRole) ? 'Эксперт' : 'Ученик';
        avatarEl.textContent = initialsFromName(name);
      } catch {
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
      (screen.querySelector('[data-ep-course-preview-desc]') as HTMLElement | null)!.textContent =
        (course.description ?? '').trim() || 'Описание курса появится здесь.';
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

      // Download assignment file
      const fileEl = t?.closest('[data-ep-assignment-file-id]') as HTMLElement | null;
      const fileId = fileEl?.dataset.epAssignmentFileId;
      const fileLessonId = fileEl?.dataset.epLessonId;
      if (fileId && fileLessonId) {
        ev.preventDefault();
        void (async () => {
          try {
            const token = getAccessToken() ?? undefined;
            const urlRes = await fetchJson<{ url: string }>(
              `/lessons/${encodeURIComponent(fileLessonId)}/assignment/files/${encodeURIComponent(fileId)}/signed`,
              token,
            );
            if (urlRes.url) window.open(urlRes.url, '_blank', 'noopener,noreferrer');
          } catch {
            window.alert('Не удалось скачать файл');
          }
        })();
      }

      // Go to homework submit screen
      const goHw = t?.closest('[data-ep-go-homework]') as HTMLElement | null;
      if (goHw) {
        ev.preventDefault();
        shell.showScreen('s-homework');
        const root = shell.shadowRoot as any;
        const hw = root.__epHomework as { lessonId: string; prompt: string } | undefined;
        if (hw) {
          (shell.shadowRoot.querySelector('[data-ep-homework-sub]') as HTMLElement | null)!.textContent =
            'Задание к текущему уроку';
          (shell.shadowRoot.querySelector('[data-ep-homework-title]') as HTMLElement | null)!.textContent =
            'Домашнее задание';
          (shell.shadowRoot.querySelector('[data-ep-homework-meta]') as HTMLElement | null)!.textContent = '';
          (shell.shadowRoot.querySelector('[data-ep-homework-q]') as HTMLElement | null)!.textContent =
            hw.prompt || '—';
        }
      }
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

