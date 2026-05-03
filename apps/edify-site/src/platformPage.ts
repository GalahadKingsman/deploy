import './edify.css';
import { ACCESS_TOKEN_KEY, getAccessToken } from './authSession.js';
import { getApiBaseUrl, getReferralAppBaseUrl, getTelegramBotUsername, getTelegramSupportUrl } from './env.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';
import { mountPlatformShell } from './platform/mountPlatformShell.js';
import { hydrateLandingExpertDashboard } from './platform/marketingExpertDashboardPreview.js';
import { hydrateLandingExpertCourses } from './platform/marketingExpertCoursesPreview.js';
import { hydrateLandingStudentScreens } from './platform/marketingStudentScreensPreview.js';
import { normalizeRutubeEmbedUrl } from './util/rutubeEmbed.js';
import { downloadAuthenticatedFile, previewAuthenticatedFile } from './downloadAuthenticatedFile.js';
import { setRichTextWithLinks } from './renderTextWithLinksDom.js';
import { applyUserAvatarToElement } from './userAvatarEl.js';

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

function resolvePublicUrl(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (!raw.startsWith('/')) return raw;
  const api = getApiBaseUrl();
  return api ? `${api}${raw}` : raw;
}

function extractFileKey(raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  if (v.startsWith('submissions/') || v.startsWith('avatars/')) return v;
  if (v.startsWith('/public/avatar?')) {
    try {
      const u = new URL(v, 'https://x.local');
      return (u.searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  // legacy: "/files?key=..."
  if (v.startsWith('/files?')) {
    try {
      const u = new URL(v, 'https://x.local');
      return (u.searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  return '';
}

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
    // Standalone preview page (/platform): show template UI without auth.
    if (document.body.classList.contains('platform-standalone')) {
      const shell = mountPlatformShell(platformMount, { initialRole: 'expert', initialScreenId: 'e-dashboard' });
      // Demo-fill dashboard + courses list for marketing preview.
      hydrateLandingExpertDashboard(shell.shadowRoot);
      hydrateLandingExpertCourses(shell.shadowRoot);
      hydrateLandingStudentScreens(shell.shadowRoot);
    } else {
      renderAuthGate();
    }
  } else {
    type CourseV1 = {
      id: string;
      title: string;
      description?: string | null;
      coverUrl?: string | null;
      authorName?: string | null;
      enrollmentContactUrl?: string | null;
      estimatedCompletionHours?: number | null;
      difficultyLevel?: 'easy' | 'medium' | 'hard' | null;
      modulesCount?: number;
      lessonsCount?: number;
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

    type ExpertDashboardActivityKindV1 = 'homework_submitted' | 'enrollment' | 'lesson_completed';
    type ExpertDashboardActivityItemV1 = {
      kind: ExpertDashboardActivityKindV1;
      occurredAt: string;
      actorDisplayName: string;
      actorInitials: string;
      actorAvatarUrl: string | null;
      description: string;
      badgeText: string;
      badgeVariant: 'new' | 'live' | 'draft' | 'muted';
    };
    type ExpertDashboardHomeworkPreviewItemV1 = {
      submissionId: string;
      lessonId: string;
      assignmentId: string;
      studentId: string;
      createdAt: string;
      studentFirstName: string | null;
      studentLastName: string | null;
      studentUsername: string | null;
      studentEmail: string | null;
      studentAvatarUrl: string | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
      answerPreview: string;
      submissionStatus: string;
      isOpened: boolean;
      uiStatus: 'new' | 'unchecked' | 'checked';
    };
    type ExpertDashboardResponseV1 = {
      period: { year: number; month: number; startIso: string; endExclusiveIso: string };
      students: { totalUnique: number; newEnrollmentsInMonth: number };
      courses: { publishedCount: number; draftCount: number };
      referral: { totalRubInMonth: number; deltaRubVsPreviousMonth: number };
      homework: {
        pendingInMonth: number;
        newTodayUtc: number;
        previewItems: ExpertDashboardHomeworkPreviewItemV1[];
      };
      activity: { items: ExpertDashboardActivityItemV1[] };
    };

    type ExpertTeamMemberRowV1 = {
      userId: string;
      role: string;
      createdAt: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      email: string | null;
      coursesLabel: string;
      lastActivityAt: string | null;
      isWorkspaceCreator?: boolean;
      avatarUrl?: string | null;
      courseIds?: string[];
    };
    type ListExpertTeamResponseV1 = { items: ExpertTeamMemberRowV1[]; createdByUserId: string };

    const myCourseIds = new Set<string>();
    /** Ссылка для кнопки «Записаться» на экране превью курса (из GET /courses/:id). */
    let studentCoursePreviewEnrollmentUrl: string | null = null;
    /** Полная реферальная ссылка для копирования / шаринга (эксперт, раздел «Реферальная программа»). */
    let expertReferralShareLink = '';

    const ENROLLMENT_CONTACT_URL_MAX_LEN = 2048;
    function isStudentEnrollmentContactUrl(raw: string): boolean {
      const s = raw.trim();
      if (!s || s.length > ENROLLMENT_CONTACT_URL_MAX_LEN) return false;
      try {
        const u = new URL(s);
        const p = u.protocol.toLowerCase();
        return p === 'http:' || p === 'https:' || p === 'tg:' || p === 'mailto:';
      } catch {
        return false;
      }
    }

    function parseEstimatedCompletionHoursInput(
      raw: string,
    ): { ok: true; value: number | null } | { ok: false; message: string } {
      const s = raw.trim();
      if (!s) return { ok: true, value: null };
      if (!/^\d+$/.test(s)) {
        return { ok: false, message: 'Время прохождения: только целые цифры, без пробелов и букв.' };
      }
      if (s.length > 1 && s.startsWith('0')) {
        return { ok: false, message: 'Время прохождения: число не должно начинаться с 0.' };
      }
      const n = parseInt(s, 10);
      if (!Number.isFinite(n) || n < 1 || n > 8760) {
        return { ok: false, message: 'Время прохождения: укажите от 1 до 8760 часов.' };
      }
      return { ok: true, value: n };
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
        const img = document.createElement('img');
        img.alt = '';
        img.src = cover;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => setPlaceholder(), { once: true });
        thumb.style.background = 'var(--surface2)';
        thumb.appendChild(img);
      } else {
        setPlaceholder();
      }

      const scrim = document.createElement('div');
      scrim.className = 'cc-scrim';

      const body = document.createElement('div');
      body.className = 'cc-body';

      const title = document.createElement('div');
      title.className = 'cc-title';
      title.textContent = course.title;

      const author = document.createElement('div');
      author.className = 'cc-author';
      author.textContent = course.authorName ? course.authorName : 'EDIFY';

      body.append(title, author);
      card.append(thumb, scrim, body);
      return card;
    }

    function renderMyCourseCard(item: { course: CourseV1; progressPercent: number }): HTMLElement {
      const card = renderCourseCard(item.course);
      const body = card.querySelector('.cc-body') as HTMLElement;

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
      meta.className = 'cc-mycourse-meta';
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

    async function patchJson<T>(path: string, body: unknown, token?: string): Promise<T> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail ? `HTTP ${res.status}: ${detail.slice(0, 200)}` : `HTTP ${res.status} ${path}`);
      }
      return (await res.json()) as T;
    }

    async function putJson<T>(path: string, body: unknown, token?: string): Promise<T> {
      const api = getApiBaseUrl();
      if (!api) throw new Error('API base url is empty');
      const res = await fetch(`${api}${path}`, {
        method: 'PUT',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
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
    /** Роль текущего пользователя в выбранном workspace эксперта (из /me/expert-memberships). */
    let expertWorkspaceMyRole: string | null = null;
    /** `experts.created_by_user_id` для текущего workspace; для кнопки «Добавить» и «Владелец» в таблице. */
    let expertTeamCreatedByUserId: string | null = null;
    /** true если текущий пользователь = experts.created_by_user_id (из /me/expert-memberships). */
    let expertWorkspaceIsCreator: boolean = false;
    /** В команде один участник — вы (создатель/админ в БД могли быть с неверным created_by). */
    let expertTeamSoleMemberIsMe: boolean = false;
    let expertTeamUserSearchTimer: ReturnType<typeof setTimeout> | null = null;
    let expertTeamDrawerSelectedUserId: string | null = null;
    let expertTeamLastRows: ExpertTeamMemberRowV1[] = [];
    let expertTeamDrawerEdit: ExpertTeamMemberRowV1 | null = null;
    /** expertId владельца курса в конструкторе — при нескольких командах эксперта не путать с «активным» из подписки. */
    let expertBuilderExpertId: string | null = null;

    async function resolveBuilderExpertId(): Promise<string | null> {
      if (expertBuilderExpertId) return expertBuilderExpertId;
      return resolveActiveExpertId();
    }
    let expertCoursesSearchTimer: ReturnType<typeof setTimeout> | undefined;
    /** Последний курс, открытый в конструкторе (для пункта меню «Конструктор»). */
    let expertBuilderCourseId: string | null = null;

    function utcDashboardNow(): { year: number; month: number } {
      const d = new Date();
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
    const _utcDashInit = utcDashboardNow();
    let expertDashboardYear = _utcDashInit.year;
    let expertDashboardMonth = _utcDashInit.month;
    let expertDashboardDraftYear = expertDashboardYear;
    let expertDashboardDraftMonth = expertDashboardMonth;

    type BuilderCourseDetailV1 = {
      id: string;
      expertId?: string;
      title: string;
      status: string;
      visibility?: string;
      description?: string | null;
      coverUrl?: string | null;
      lessonAccessMode?: 'sequential' | 'open';
      authorDisplayName?: string | null;
      enrollmentContactUrl?: string | null;
      estimatedCompletionHours?: number | null;
      difficultyLevel?: 'easy' | 'medium' | 'hard' | null;
      certificateUploaded?: boolean;
      certificateFilename?: string | null;
    };
    let builderCourseDetail: BuilderCourseDetailV1 | null = null;
    type BuilderTopicV1 = { id: string; title: string };
    let builderCourseSettingsAllTopics: BuilderTopicV1[] = [];
    let builderCourseSettingsExtraTopics: BuilderTopicV1[] = [];
    let builderCourseSettingsSelectedTopicIds = new Set<string>();
    let builderAccessGrantDaysByEnrollmentId: Record<string, string> = {};
    let builderAccessSelectedUserIdByField: { username?: string; name?: string } = {};
    let accessUserSearchTimer: ReturnType<typeof setTimeout> | null = null;
    let accessUserSearchLast: { q: string; target: 'username' | 'name' } | null = null;
    let currentMe: MeUserV1 | null = null;
    let currentPlatformRole: string | null = null;
    let adminUserSearchTimer: ReturnType<typeof setTimeout> | null = null;
    let adminUserSearchLast: { q: string; host: 'create-owner' | 'members-user' | 'platform-user' } | null = null;
    let adminSelectedUserIdByField: { createOwner?: string; membersUser?: string; platformUser?: string } = {};
    /** Не дублировать загрузку конструктора при navigate от showScreen после ручного открытия курса. */
    let suppressBuilderNavigateHydrate = false;
    let builderSelectedModuleId: string | null = null;
    let builderSelectedLessonId: string | null = null;
    let builderModuleActionsModuleId: string | null = null;
    let builderSliderDraft: { lessonId: string; images: { key: string }[] } | null = null;
    const builderSliderByLessonId = new Map<string, { images: { key: string }[] }>();
    const builderPresentationByLessonId = new Map<
      string,
      { pptxKey?: string | null; pdfKey: string; originalFilename: string } | null
    >();
    const builderMaterialsByLessonId = new Map<
      string,
      Array<{ id: string; lessonId: string; fileKey: string; filename: string; sizeBytes: number | null }> | null
    >();
    type BuilderModuleV1 = { id: string; courseId: string; title: string; position: number };
    type BuilderLessonV1 = {
      id: string;
      moduleId: string;
      courseId?: string;
      title: string;
      position: number;
      hiddenFromStudents?: boolean;
      contentMarkdown?: string | null;
      slider?: { images: { key: string }[] } | null;
      presentation?: { pptxKey?: string | null; pdfKey: string; originalFilename: string } | null;
      video?: { kind: string; url?: string } | null;
      createdAt: string;
      updatedAt: string;
    };
    const builderLessonsByModule = new Map<string, BuilderLessonV1[]>();
    let builderModulesCache: BuilderModuleV1[] = [];

    type BuilderAttestationOptionV1 = { id: string; position: number; label: string; isCorrect: boolean };
    type BuilderAttestationQuestionV1 = {
      id: string;
      position: number;
      prompt: string;
      options: BuilderAttestationOptionV1[];
    };
    type BuilderAttestationV1 = {
      id: string;
      courseId: string;
      moduleId: string | null;
      scope: 'module' | 'course';
      position: number;
      displayTitle: string;
      questions: BuilderAttestationQuestionV1[];
      createdAt: string;
      updatedAt: string;
    };
    let builderAttestationsCache: BuilderAttestationV1[] = [];
    /** Editor-mode draft for the currently-selected attestation (questions/options). */
    let builderAttestationDraft: BuilderAttestationV1 | null = null;
    let builderSelectedAttestationId: string | null = null;
    /** lesson | attestation — controls which workspace is shown in the right pane. */
    let builderEditorMode: 'lesson' | 'attestation' = 'lesson';

    const urlParams = (() => {
      try {
        return new URL(window.location.href).searchParams;
      } catch {
        return new URLSearchParams();
      }
    })();
    const initialScreen = (urlParams.get('screen') || '').trim();
    const initialRole = (urlParams.get('role') || '').trim();
    const shouldOpenAdminOnLoad = initialScreen === 'admin';
    const initialScreenId = shouldOpenAdminOnLoad ? 's-catalog' : initialScreen ? initialScreen : 's-catalog';

    type EpPlatformHistoryState = { __ep: 1; role: 'expert' | 'student'; screen: string };
    let epHistorySeeded = false;
    let epHistorySuppress = false;
    let epLastHistory: { role: 'expert' | 'student'; screen: string } | null = null;

    function epRoleFromRoot(root: ShadowRoot): 'expert' | 'student' {
      return root.getElementById('tab-expert')?.classList.contains('active') ? 'expert' : 'student';
    }
    function epBuildPlatformUrl(role: 'expert' | 'student', screen: string): string {
      const u = new URL(window.location.href);
      u.searchParams.set('role', role);
      u.searchParams.set('screen', screen);
      return u.pathname + u.search + u.hash;
    }
    function epStateFromUrl(href: string): EpPlatformHistoryState | null {
      try {
        const u = new URL(href, window.location.origin);
        const sc = (u.searchParams.get('screen') || '').trim();
        if (!sc) return null;
        const r = (u.searchParams.get('role') || '').trim();
        return { __ep: 1, role: r === 'expert' ? 'expert' : 'student', screen: sc };
      } catch {
        return null;
      }
    }
    function epSyncHistoryOnNavigate(root: ShadowRoot, screenId: string): void {
      if (epHistorySuppress) return;
      if (!epHistorySeeded) return;
      const role = epRoleFromRoot(root);
      if (epLastHistory && epLastHistory.role === role && epLastHistory.screen === screenId) return;
      const st: EpPlatformHistoryState = { __ep: 1, role, screen: screenId };
      window.history.pushState(st, '', epBuildPlatformUrl(role, screenId));
      epLastHistory = { role, screen: screenId };
    }
    function epReplaceHistoryWithCurrentShell(root: ShadowRoot): void {
      const role = epRoleFromRoot(root);
      const active = root.querySelector('.screen.active') as HTMLElement | null;
      const id =
        active?.id && active.id.startsWith('screen-')
          ? active.id.slice(7)
          : role === 'expert'
            ? 'e-dashboard'
            : 's-catalog';
      const st: EpPlatformHistoryState = { __ep: 1, role, screen: id };
      window.history.replaceState(st, '', epBuildPlatformUrl(role, id));
      epLastHistory = { role, screen: id };
      epHistorySeeded = true;
    }

    const shell = mountPlatformShell(platformMount, {
      initialRole: initialRole === 'expert' ? 'expert' : 'student',
      initialScreenId,
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
        if (action.type === 'navigate') {
          epSyncHistoryOnNavigate(action.shadowRoot, action.screenId);
        }
        if (action.type === 'navigate' && action.screenId === 's-homework') {
          void hydrateRecentSubmissionsTable(action.shadowRoot);
          void hydratePendingHomeworkHub(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 's-profile') {
          void hydrateProfileScreen(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 's-progress') {
          void hydrateProgressScreen(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 's-certificates') {
          void hydrateStudentCertificates(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-courses') {
          expertBuilderExpertId = null;
          void hydrateExpertCourses(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-team') {
          void hydrateExpertTeam(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-homework') {
          void hydrateExpertHomework(action.shadowRoot);
          void hydrateExpertHomeworkBadge(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-students') {
          void hydrateExpertStudents(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-referral') {
          void hydrateExpertReferralScreen(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-dashboard') {
          void hydrateExpertDashboard(action.shadowRoot);
        }
        if (action.type === 'navigate' && action.screenId === 'e-builder') {
          if (suppressBuilderNavigateHydrate) return;
          const src = action.sourceElement ?? null;
          if (src?.dataset.epBuilderLaunch === 'new') {
            void openExpertBuilderNew(action.shadowRoot);
          } else if (expertBuilderCourseId) {
            void openExpertBuilderEdit(action.shadowRoot, expertBuilderCourseId);
          } else {
            window.alert('Создайте курс кнопкой «+ Создать курс» в «Мои курсы» или откройте курс для редактирования.');
          }
        }
        if (
          action.type === 'navigate' &&
          action.screenId === 's-lesson' &&
          isShellStudentMode(action.shadowRoot) &&
          navigationToLessonIsFromDataEpScreen(action.sourceElement)
        ) {
          // Avoid showing design placeholder content while loading the real lesson
          const root = action.shadowRoot;
          primeStudentLessonLoadingState(root);
          void enterStudentCurrentLessonOrEmpty(action.shadowRoot);
        }
        if (action.type === 'builder_tab') {
          void switchExpertBuilderTab(action.shadowRoot, action.tabLabel);
        }
      },
    });

    epReplaceHistoryWithCurrentShell(shell.shadowRoot);
    window.addEventListener('popstate', (ev: PopStateEvent) => {
      const st: EpPlatformHistoryState | null =
        ev.state && (ev.state as EpPlatformHistoryState).__ep === 1
          ? (ev.state as EpPlatformHistoryState)
          : epStateFromUrl(window.location.href);
      if (!st) return;
      epHistorySuppress = true;
      try {
        shell.setRole(st.role, { screenId: st.screen });
        epLastHistory = { role: st.role, screen: st.screen };
      } finally {
        epHistorySuppress = false;
      }
    });

    if (initialScreenId === 's-lesson' && isShellStudentMode(shell.shadowRoot)) {
      primeStudentLessonLoadingState(shell.shadowRoot);
      void enterStudentCurrentLessonOrEmpty(shell.shadowRoot);
    }
    if (initialScreenId === 'e-team') {
      void hydrateExpertTeam(shell.shadowRoot);
    }
    if (initialScreenId === 'e-students' && initialRole === 'expert') {
      void hydrateExpertStudents(shell.shadowRoot);
    }
    if (initialScreenId === 'e-referral' && initialRole === 'expert') {
      void hydrateExpertReferralScreen(shell.shadowRoot);
    }

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

    type StudentAttestationTreeRowV1 = {
      id: string;
      scope: 'module' | 'course';
      moduleId: string | null;
      displayTitle: string;
      position: number;
      questionCount: number;
      latestAttempt: {
        attemptId: string;
        correctCount: number;
        questionCount: number;
        percent: number;
        submittedAt: string;
      } | null;
    };
    /** Аттестация, открытая в правой колонке экрана урока (не блокирует уроки). */
    let studentActiveAttestationId: string | null = null;
    /** true — показать разбор последней попытки; false — форма новой попытки. */
    let studentAttestationShowReview = false;

    let studentTreeSnapshot: {
      courseTitle: string;
      modules: Array<{
        id: string;
        title: string;
        lessons: LessonV1[];
        unlocked: Set<string>;
        completed: Set<string>;
        attestations: StudentAttestationTreeRowV1[];
      }>;
      courseLevelAttestations: StudentAttestationTreeRowV1[];
      activeLessonId: string | null;
    } | null = null;

    function rerenderStudentLessonTree(root: ShadowRoot): void {
      const s = studentTreeSnapshot;
      if (!s) return;
      renderLessonTree({
        root,
        courseTitle: s.courseTitle,
        modules: s.modules,
        courseLevelAttestations: s.courseLevelAttestations,
        activeLessonId: s.activeLessonId,
      });
    }

    function findStudentAttestationMeta(attestationId: string): StudentAttestationTreeRowV1 | null {
      const s = studentTreeSnapshot;
      if (!s) return null;
      for (const m of s.modules) {
        const row = m.attestations.find((x) => x.id === attestationId);
        if (row) return row;
      }
      return s.courseLevelAttestations.find((x) => x.id === attestationId) ?? null;
    }

    function profileDisplayName(u: { firstName?: string; lastName?: string; username?: string }): string {
      const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      if (n) return n;
      if (u.username) return u.username;
      return 'Пользователь';
    }

    function initialsFromNameLocal(name: string): string {
      const t = (name || '').trim();
      if (!t) return 'ED';
      const parts = t.split(/\s+/).filter(Boolean);
      const a = (parts[0]?.[0] ?? '').toUpperCase();
      const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
      return (a + b).slice(0, 2) || 'ED';
    }

    async function hydrateProfileScreen(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const screen = root.getElementById('screen-s-profile') as HTMLElement | null;
      if (!screen) return;
      try {
        const me = await fetchJson<{ user?: any }>('/me', token);
        const u = me.user;
        if (!u) return;

        (screen.querySelector('[data-ep-profile-first-name]') as HTMLInputElement | null)?.setAttribute('value', '');
        const fn = screen.querySelector('[data-ep-profile-first-name]') as HTMLInputElement | null;
        const ln = screen.querySelector('[data-ep-profile-last-name]') as HTMLInputElement | null;
        const em = screen.querySelector('[data-ep-profile-email]') as HTMLInputElement | null;
        if (fn) fn.value = (u.firstName ?? '').trim();
        if (ln) ln.value = (u.lastName ?? '').trim();
        if (em) em.value = (u.email ?? '').trim();

        const title = screen.querySelector('[data-ep-profile-title]') as HTMLElement | null;
        const sub = screen.querySelector('[data-ep-profile-sub]') as HTMLElement | null;
        const disp = profileDisplayName(u);
        if (title) title.textContent = disp;
        if (sub) sub.textContent = `${u.username ? '@' + u.username : '—'} · ${u.platformRole === 'owner' || u.platformRole === 'admin' ? 'Эксперт' : 'Пользователь'}`;

        const av = screen.querySelector('[data-ep-profile-avatar]') as HTMLElement | null;
        if (av) {
          const initialsP = initialsFromNameLocal(disp);
          applyUserAvatarToElement(av, u.avatarUrl, initialsP);
        }

        const tgBtn = screen.querySelector('[data-ep-profile-connect-telegram]') as HTMLButtonElement | null;
        const tgStatus = screen.querySelector('[data-ep-profile-telegram-status]') as HTMLElement | null;
        const tgId = typeof u.telegramUserId === 'string' && u.telegramUserId.trim() ? u.telegramUserId.trim() : '';
        if (tgId) {
          const handle =
            typeof u.username === 'string' && u.username.trim() ? `@${u.username.trim()}` : `ID ${tgId}`;
          if (tgStatus) {
            tgStatus.style.display = '';
            tgStatus.innerHTML = `Привязан Telegram аккаунт <strong>${handle}</strong>`;
          }
          if (tgBtn) tgBtn.style.display = 'none';
        } else {
          if (tgStatus) tgStatus.style.display = 'none';
          if (tgBtn) tgBtn.style.display = '';
        }
      } catch {
        // ignore
      }
    }

    function renderProgressCourseRow(params: {
      title: string;
      coverUrl?: string | null;
      done: number;
      total: number;
      percent: number;
      homeworkSubmittedCount?: number | null;
      color?: string;
    }): HTMLElement {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '14px';
      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.marginBottom = '6px';
      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';
      left.style.minWidth = '0';

      const avatar = document.createElement('div');
      avatar.style.width = '34px';
      avatar.style.height = '34px';
      avatar.style.borderRadius = '10px';
      avatar.style.border = '1px solid var(--line)';
      avatar.style.background = 'var(--bg2)';
      avatar.style.flexShrink = '0';
      avatar.style.overflow = 'hidden';

      const cover = normalizeAssetUrl(params.coverUrl ?? null);
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
            avatar.replaceChildren();
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
            avatar.style.fontFamily = 'var(--fd)';
            avatar.style.fontWeight = '900';
            avatar.style.color = 'rgba(10,168,200,.6)';
            avatar.style.background = 'rgba(10,168,200,.08)';
            avatar.textContent = initialsFromTitle(params.title);
          },
          { once: true },
        );
        avatar.appendChild(img);
      } else {
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.fontFamily = 'var(--fd)';
        avatar.style.fontWeight = '900';
        avatar.style.color = 'rgba(10,168,200,.6)';
        avatar.style.background = 'rgba(10,168,200,.08)';
        avatar.textContent = initialsFromTitle(params.title);
      }

      const title = document.createElement('span');
      title.style.fontSize = '13px';
      title.style.fontWeight = '600';
      title.style.color = 'var(--t1)';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      title.style.whiteSpace = 'nowrap';
      title.textContent = params.title;

      const titleWrap = document.createElement('div');
      titleWrap.style.minWidth = '0';
      titleWrap.style.flex = '1';
      titleWrap.style.display = 'flex';
      titleWrap.style.flexDirection = 'column';
      titleWrap.style.gap = '6px';
      titleWrap.appendChild(title);

      const badgesRow = document.createElement('div');
      badgesRow.style.display = 'flex';
      badgesRow.style.flexWrap = 'wrap';
      badgesRow.style.alignItems = 'center';
      badgesRow.style.gap = '6px';
      badgesRow.style.minHeight = '16px';

      const hwN = Math.max(0, Number(params.homeworkSubmittedCount ?? 0) || 0);
      const hw = document.createElement('span');
      hw.className = 'tag';
      hw.style.display = 'inline-flex';
      hw.style.alignItems = 'center';
      hw.style.gap = '6px';
      hw.style.fontSize = '10px';
      hw.style.padding = '3px 8px';
      hw.style.borderRadius = '999px';
      hw.style.background = 'var(--surface)';
      hw.style.border = '1px solid var(--line)';
      hw.style.color = 'var(--t2)';
      hw.style.fontFamily = 'var(--fm)';
      hw.innerHTML = `<span aria-hidden="true" style="width:8px;height:8px;border-radius:99px;background:var(--a);opacity:.65;display:inline-block"></span><span>${hwN} ДЗ сдано</span>`;
      badgesRow.appendChild(hw);
      titleWrap.appendChild(badgesRow);

      left.append(avatar, titleWrap);
      const right = document.createElement('span');
      right.style.fontFamily = 'var(--fm)';
      right.style.fontSize = '11px';
      right.style.color = 'var(--t3)';
      right.textContent = `${params.done}/${params.total}`;
      top.append(left, right);

      const barWrap = document.createElement('div');
      barWrap.className = 'prog-wrap';
      barWrap.innerHTML =
        '<div class="prog-bar" style="height:8px;border-radius:4px"><div class="prog-fill" style="height:100%;border-radius:4px"></div></div>';
      const fill = barWrap.querySelector('.prog-fill') as HTMLElement | null;
      if (fill) {
        fill.style.width = `${Math.max(0, Math.min(100, Math.round(params.percent)))}%`;
        if (params.color) fill.style.background = params.color;
      }

      wrap.append(top, barWrap);
      return wrap;
    }

    async function hydrateProgressScreen(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const screen = root.getElementById('screen-s-progress') as HTMLElement | null;
      if (!screen) return;

      // /me -> streak + avgScore
      try {
        const me = await fetchJson<{ user?: any }>('/me', token);
        const u = me.user ?? null;
        const streakEl = screen.querySelector('[data-ep-progress-streak]') as HTMLElement | null;
        if (streakEl) {
          const n = Math.max(0, Number(u?.streakDays ?? 0) || 0);
          streakEl.textContent = n >= 7 ? `🔥 ${n}` : String(n);
        }
        const avgHost = screen.querySelector('[data-ep-homework-avg-stars]') as HTMLElement | null;
        if (avgHost) {
          const raw = u?.homeworkAvgScore;
          const avg = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : null;
          renderStarsInto(avgHost, avg);
        }
      } catch {
        /* ignore */
      }

      // /me/courses -> per course progress + sum done lessons
      const coursesHost = screen.querySelector('[data-ep-progress-courses]') as HTMLElement | null;
      if (!coursesHost) return;
      coursesHost.replaceChildren();
      try {
        const data = await fetchJson<MyCoursesResponseV1>('/me/courses', token);
        const items = Array.isArray(data.items) ? data.items : [];
        let doneTotal = 0;
        items.forEach((it, idx) => {
          const done = Math.max(0, Number((it as any).doneLessons ?? 0) || 0);
          const total = Math.max(0, Number((it as any).totalLessons ?? 0) || 0);
          const hw = Math.max(0, Number((it as any).homeworkSubmittedCount ?? 0) || 0);
          doneTotal += done;
          const pct = total > 0 ? Math.round((done / total) * 100) : Math.round(Number(it.progressPercent ?? 0) || 0);
          const color = idx % 3 === 1 ? 'var(--purple)' : idx % 3 === 2 ? 'var(--ok)' : undefined;
          coursesHost.appendChild(
            renderProgressCourseRow({
              title: (it.course?.title ?? '').trim() || 'Курс',
              coverUrl: (it.course as any)?.coverUrl ?? null,
              done,
              total,
              percent: pct,
              homeworkSubmittedCount: hw,
              color,
            }),
          );
        });
        const doneEl = screen.querySelector('[data-ep-progress-lessons-done]') as HTMLElement | null;
        if (doneEl) doneEl.textContent = String(doneTotal);
        if (items.length === 0) {
          coursesHost.appendChild(
            Object.assign(document.createElement('div'), {
              style: 'font-size:12px;color:var(--t3);line-height:1.55',
              textContent: 'Пока нет курсов. Зачислитесь на курс, чтобы видеть прогресс.',
            }),
          );
        }
      } catch {
        coursesHost.appendChild(
          Object.assign(document.createElement('div'), {
            style: 'font-size:12px;color:var(--t3);line-height:1.55',
            textContent: 'Не удалось загрузить прогресс. Попробуйте обновить страницу.',
          }),
        );
      }
    }

    type StudentCertificateV1 = {
      courseId: string;
      courseTitle: string;
      coverUrl?: string | null;
      authorDisplayName?: string | null;
      pdfKey: string;
      pdfFilename?: string | null;
      uploadedAt?: string | null;
      completedAt?: string | null;
    };

    function escapeCertText(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function buildCertCardCaption(item: StudentCertificateV1): string {
      const titleSafe = escapeCertText((item.courseTitle ?? '').trim() || 'курса');
      const authorRaw = (item.authorDisplayName ?? '').trim();
      const authorSafe = escapeCertText(authorRaw || 'автора курса');
      return `Сертификат за прохождение курса <b>${titleSafe}</b> от <b>${authorSafe}</b>`;
    }

    function renderStudentCertificateCard(item: StudentCertificateV1): HTMLElement {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ep-cert-card';
      card.dataset.epCertCard = '1';
      card.dataset.epCertCourseId = item.courseId;
      card.dataset.epCertKey = item.pdfKey;
      card.dataset.epCertCourseTitle = item.courseTitle ?? '';
      if (item.pdfFilename) card.dataset.epCertFilename = item.pdfFilename;

      const media = document.createElement('div');
      media.className = 'ep-cert-card__media';
      const cover = (item.coverUrl ?? '').trim();
      if (cover) {
        const img = document.createElement('img');
        img.className = 'ep-cert-card__cover';
        img.src = resolvePublicUrl(cover);
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        media.appendChild(img);
      }
      const overlay = document.createElement('div');
      overlay.className = 'ep-cert-card__overlay';
      media.appendChild(overlay);
      const caption = document.createElement('div');
      caption.className = 'ep-cert-card__caption';
      caption.innerHTML = buildCertCardCaption(item);
      media.appendChild(caption);
      card.appendChild(media);

      const foot = document.createElement('div');
      foot.className = 'ep-cert-card__foot';
      const left = document.createElement('div');
      left.innerHTML = '<strong>PDF</strong> · одной кнопкой';
      const right = document.createElement('div');
      const completedAt = item.completedAt ? new Date(item.completedAt) : null;
      if (completedAt && Number.isFinite(completedAt.getTime())) {
        right.textContent = completedAt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
      } else {
        right.textContent = '';
      }
      foot.appendChild(left);
      foot.appendChild(right);
      card.appendChild(foot);

      return card;
    }

    async function hydrateStudentCertificates(root: ShadowRoot): Promise<void> {
      const screen = root.getElementById('screen-s-certificates') as HTMLElement | null;
      if (!screen) return;
      const loadingEl = screen.querySelector('[data-ep-certificates-loading]') as HTMLElement | null;
      const emptyEl = screen.querySelector('[data-ep-certificates-empty]') as HTMLElement | null;
      const grid = screen.querySelector('[data-ep-certificates-grid]') as HTMLElement | null;
      if (!grid || !emptyEl) return;
      const token = getAccessToken();
      if (!token) {
        if (loadingEl) loadingEl.style.display = 'none';
        emptyEl.style.display = '';
        grid.style.display = 'none';
        return;
      }
      if (loadingEl) loadingEl.style.display = '';
      emptyEl.style.display = 'none';
      grid.style.display = 'none';
      grid.replaceChildren();
      try {
        const data = await fetchJson<{ items: StudentCertificateV1[] }>('/me/certificates', token);
        const items = Array.isArray(data?.items) ? data.items : [];
        if (loadingEl) loadingEl.style.display = 'none';
        if (items.length === 0) {
          emptyEl.style.display = '';
          grid.style.display = 'none';
          return;
        }
        for (const it of items) {
          grid.appendChild(renderStudentCertificateCard(it));
        }
        grid.style.display = '';
      } catch {
        if (loadingEl) loadingEl.style.display = 'none';
        emptyEl.style.display = '';
        grid.style.display = 'none';
      }
    }

    async function openStudentCertificatePreview(
      root: ShadowRoot,
      params: { courseId: string; key: string; courseTitle: string; pdfFilename?: string | null },
    ): Promise<void> {
      const bd = root.querySelector('[data-ep-cert-preview-backdrop]') as HTMLElement | null;
      const pr = root.querySelector('[data-ep-cert-preview]') as HTMLElement | null;
      const titleEl = root.querySelector('[data-ep-cert-preview-title]') as HTMLElement | null;
      const frame = root.querySelector('[data-ep-cert-preview-frame]') as HTMLIFrameElement | null;
      const dlBtn = root.querySelector('[data-ep-cert-preview-download]') as HTMLButtonElement | null;
      if (!bd || !pr || !frame) return;
      const titleText = (params.courseTitle ?? '').trim() || 'Сертификат';
      if (titleEl) titleEl.textContent = `Сертификат курса «${titleText}»`;
      bd.style.display = '';
      pr.style.display = '';
      frame.src = 'about:blank';
      if (dlBtn) {
        dlBtn.dataset.epCertKey = params.key;
        dlBtn.dataset.epCertFilename = params.pdfFilename ?? '';
        dlBtn.dataset.epCertCourseTitle = titleText;
      }
      try {
        const url = await getSignedFileUrl(params.key);
        if (!url) throw new Error('no url');
        frame.src = url;
      } catch {
        window.alert('Не удалось открыть сертификат. Попробуйте позже.');
        closeStudentCertificatePreview(root);
      }
    }

    function closeStudentCertificatePreview(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-cert-preview-backdrop]') as HTMLElement | null;
      const pr = root.querySelector('[data-ep-cert-preview]') as HTMLElement | null;
      const frame = root.querySelector('[data-ep-cert-preview-frame]') as HTMLIFrameElement | null;
      if (frame) frame.src = 'about:blank';
      if (bd) bd.style.display = 'none';
      if (pr) pr.style.display = 'none';
    }

    async function downloadStudentCertificate(
      key: string,
      filename: string | null,
      courseTitle: string,
    ): Promise<void> {
      try {
        const url = await getSignedFileUrl(key);
        if (!url) throw new Error('no url');
        const dlUrl = url + (url.includes('?') ? '&' : '?') + 'dl=1';
        const fallbackBase = (filename ?? '').trim() || `Сертификат — ${courseTitle || 'курс'}.pdf`;
        const fallbackFilename = /\.pdf$/i.test(fallbackBase) ? fallbackBase : `${fallbackBase}.pdf`;
        await downloadAuthenticatedFile({ url: dlUrl, fallbackFilename });
      } catch {
        window.alert('Не удалось скачать сертификат.');
      }
    }

    async function hydrateExpertReferralScreen(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const codeEl = root.querySelector('[data-ep-referral-code]') as HTMLElement | null;
      const linkEl = root.querySelector('[data-ep-referral-link-text]') as HTMLElement | null;
      const invitedEl = root.querySelector('[data-ep-referral-stat-invited]') as HTMLElement | null;
      const paidEl = root.querySelector('[data-ep-referral-stat-paid]') as HTMLElement | null;
      const accruedEl = root.querySelector('[data-ep-referral-stat-accrued]') as HTMLElement | null;
      expertReferralShareLink = '';
      const setErr = (msg: string) => {
        if (codeEl) codeEl.textContent = '—';
        if (linkEl) {
          linkEl.textContent = msg;
          linkEl.removeAttribute('title');
        }
        if (invitedEl) invitedEl.textContent = '—';
        if (paidEl) paidEl.textContent = '—';
        if (accruedEl) accruedEl.textContent = '—';
      };
      if (!token) {
        setErr('Войдите, чтобы увидеть реферальную ссылку');
        return;
      }
      try {
        const stats = await fetchJson<{
          code: string;
          enrollmentsCount: number;
          ordersCount: number;
          paidOrdersCount: number;
          commissionTotalCents: number;
        }>('/me/referral/stats', token);
        const base = getReferralAppBaseUrl();
        const link = `${base}/?ref=${encodeURIComponent(stats.code)}`;
        expertReferralShareLink = link;
        if (codeEl) codeEl.textContent = (stats.code ?? '').trim() || '—';
        if (linkEl) {
          linkEl.textContent = link;
          linkEl.setAttribute('title', link);
        }
        const inv = Math.max(0, Math.trunc(Number(stats.enrollmentsCount ?? 0)) || 0);
        const paid = Math.max(0, Math.trunc(Number(stats.paidOrdersCount ?? 0)) || 0);
        const cents = Math.max(0, Math.trunc(Number(stats.commissionTotalCents ?? 0)) || 0);
        if (invitedEl) invitedEl.textContent = String(inv);
        if (paidEl) paidEl.textContent = String(paid);
        if (accruedEl) {
          accruedEl.textContent = `${Math.round(cents / 100).toLocaleString('ru-RU')}\u00a0₽`;
        }
      } catch {
        setErr('Не удалось загрузить данные. Обновите страницу.');
      }
    }

    async function saveProfileFromScreen(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const screen = root.getElementById('screen-s-profile') as HTMLElement | null;
      if (!screen) return;
      const firstName = (screen.querySelector('[data-ep-profile-first-name]') as HTMLInputElement | null)?.value ?? '';
      const lastName = (screen.querySelector('[data-ep-profile-last-name]') as HTMLInputElement | null)?.value ?? '';
      const email = (screen.querySelector('[data-ep-profile-email]') as HTMLInputElement | null)?.value ?? '';
      try {
        await patchJson(
          '/me/profile',
          { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() },
          token,
        );
        await hydrateProfileScreen(root);
        window.alert('Сохранено');
      } catch {
        window.alert('Не удалось сохранить профиль');
      }
    }

    async function uploadProfileAvatar(root: ShadowRoot, file: File): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const form = new FormData();
      form.append('file', file, file.name || 'avatar');
      try {
        await fetchMultipartJson('/me/avatar', form, token);
        await hydrateProfileScreen(root);
        try {
          const me = await fetchJson<{ user?: any }>('/me', token);
          if (me?.user) shell.setUser(me.user);
        } catch {
          // ignore
        }
      } catch {
        window.alert('Не удалось загрузить фото');
      }
    }

    async function startTelegramConnect(): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const bot = getTelegramBotUsername();
      if (!bot) {
        window.alert('Telegram бот не настроен (meta[name="edify-telegram-bot"]).');
        return;
      }
      try {
        const issued = await postJson<{ code: string }>('/auth/site-bridge/issue', {}, token);
        const code = (issued?.code ?? '').trim();
        if (!code) throw new Error('no code');
        const url = `https://t.me/${bot}?start=link_${encodeURIComponent(code)}`;
        // Browsers may block popups. Prefer opening a new tab, fallback to redirect.
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          // If blocked — redirect in the same tab.
          window.location.href = url;
          return;
        }
        // Extra: provide a copyable link for strict popup blockers.
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* ignore */
        }
        window.alert('Откройте Telegram и подтвердите привязку в мини‑приложении. Ссылка скопирована в буфер обмена.');
      } catch {
        window.alert('Не удалось начать привязку Telegram');
      }
    }

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
      attestations?: StudentAttestationTreeRowV1[];
    }> {
      const token = getAccessToken() ?? undefined;
      return await fetchJson(
        `/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons`,
        token,
      );
    }

    async function fetchCourseLevelAttestations(courseId: string): Promise<StudentAttestationTreeRowV1[]> {
      const token = getAccessToken() ?? undefined;
      try {
        const res = await fetchJson<{ items?: StudentAttestationTreeRowV1[] }>(
          `/courses/${encodeURIComponent(courseId)}/attestations/course-level`,
          token,
        );
        return (res.items ?? []).slice().sort((a, b) => a.position - b.position);
      } catch {
        return [];
      }
    }

    function attestationScoreClass(percent: number): string {
      if (percent <= 30) return 'attestation-score--low';
      if (percent <= 60) return 'attestation-score--mid';
      if (percent <= 80) return 'attestation-score--good';
      return 'attestation-score--best';
    }

    function showStudentLessonWorkspace(root: ShadowRoot): void {
      const lessonWs = root.querySelector('[data-ep-student-lesson-workspace]') as HTMLElement | null;
      const attWs = root.querySelector('[data-ep-student-attestation-workspace]') as HTMLElement | null;
      if (lessonWs) lessonWs.style.display = '';
      if (attWs) attWs.style.display = 'none';
    }

    function showStudentAttestationWorkspace(root: ShadowRoot): void {
      const lessonWs = root.querySelector('[data-ep-student-lesson-workspace]') as HTMLElement | null;
      const attWs = root.querySelector('[data-ep-student-attestation-workspace]') as HTMLElement | null;
      if (lessonWs) lessonWs.style.display = 'none';
      if (attWs) attWs.style.display = '';
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
        attestations?: StudentAttestationTreeRowV1[];
      }>;
      courseLevelAttestations?: StudentAttestationTreeRowV1[];
      activeLessonId: string | null;
    }): void {
      const screen = params.root.getElementById('screen-s-lesson');
      if (!screen) return;

      const treeHost = screen.querySelector('.mod-tree') as HTMLElement | null;
      if (!treeHost) return;
      treeHost.replaceChildren();

      const titleEl = screen.querySelector('[data-ep-course-title]') as HTMLElement | null;
      if (titleEl) titleEl.textContent = params.courseTitle;

      const effectiveLessonActive = studentActiveAttestationId ? null : params.activeLessonId;

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
          const isActive = effectiveLessonActive === l.id;

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

        for (const a of m.attestations ?? []) {
          const row = document.createElement('div');
          row.className = 'attestation-row';
          row.dataset.epAttestationId = a.id;
          if (studentActiveAttestationId === a.id) row.classList.add('active');
          const ico = document.createElement('span');
          ico.className = 'lesson-ico';
          ico.textContent = '📝';
          const lname = document.createElement('span');
          lname.className = 'lesson-name';
          lname.textContent = a.displayTitle;
          row.append(ico, lname);
          const att = a.latestAttempt;
          if (att && att.questionCount > 0) {
            const sc = document.createElement('span');
            sc.className = `attestation-row__score ${attestationScoreClass(att.percent)}`;
            sc.textContent = `${att.correctCount}/${att.questionCount}`;
            row.appendChild(sc);
          }
          lessonsWrap.appendChild(row);
        }

        modItem.append(head, lessonsWrap);
        treeHost.appendChild(modItem);
      }

      for (const a of params.courseLevelAttestations ?? []) {
        const row = document.createElement('div');
        row.className = 'attestation-row attestation-row--course';
        row.dataset.epAttestationId = a.id;
        if (studentActiveAttestationId === a.id) row.classList.add('active');
        const ico = document.createElement('span');
        ico.className = 'lesson-ico';
        ico.textContent = '🏁';
        const lname = document.createElement('span');
        lname.className = 'lesson-name';
        lname.textContent = a.displayTitle;
        row.append(ico, lname);
        const att = a.latestAttempt;
        if (att && att.questionCount > 0) {
          const sc = document.createElement('span');
          sc.className = `attestation-row__score ${attestationScoreClass(att.percent)}`;
          sc.textContent = `${att.correctCount}/${att.questionCount}`;
          row.appendChild(sc);
        }
        treeHost.appendChild(row);
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
      root.querySelectorAll('#screen-s-lesson .attestation-row, #screen-s-lesson .attestation-row--course').forEach((el) => {
        el.classList.remove('active');
      });
      studentActiveAttestationId = null;
      studentAttestationShowReview = false;
      if (studentTreeSnapshot) studentTreeSnapshot.activeLessonId = lessonId;
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
      showStudentLessonWorkspace(root);
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
      const presHost = root.querySelector('#screen-s-lesson [data-ep-lesson-presentation]') as HTMLElement | null;
      const sliderHost = root.querySelector('#screen-s-lesson [data-ep-lesson-slider]') as HTMLElement | null;
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

      // Slider (after video, before text)
      if (sliderHost) {
        const keys = Array.isArray((lesson as any)?.slider?.images)
          ? ((lesson as any).slider.images as Array<{ key?: string }>).map((x) => String(x?.key ?? '').trim()).filter(Boolean)
          : [];
        renderInlineLessonSlider(root, sliderHost, keys);
      }

      // Presentation (after slider, before text)
      if (presHost) {
        const p = (lesson as any)?.presentation ?? null;
        const pres =
          p && typeof p.pdfKey === 'string' && typeof p.originalFilename === 'string'
            ? { pptxKey: typeof p.pptxKey === 'string' ? p.pptxKey : null, pdfKey: p.pdfKey, originalFilename: p.originalFilename }
            : null;
        if (!pres) {
          presHost.style.display = 'none';
          presHost.replaceChildren();
        } else {
          presHost.style.display = '';
          void renderPresentationViewer(root, presHost, pres);
        }
      }

      // Homework + materials
      const hwPrompt = root.querySelector('#screen-s-lesson [data-ep-homework-prompt]') as HTMLElement | null;
      const hwAssignmentFiles = root.querySelector(
        '#screen-s-lesson [data-ep-homework-assignment-files]',
      ) as HTMLElement | null;
      const hwWrap = root.querySelector('#screen-s-lesson [data-ep-homework]') as HTMLElement | null;
      const goHwBtn = root.querySelector('#screen-s-lesson [data-ep-go-homework]') as HTMLElement | null;
      const completeBtn = root.querySelector('#screen-s-lesson [data-ep-lesson-complete]') as HTMLElement | null;
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();
      if (matsTitle) matsTitle.style.display = 'none';

      // Lesson materials (expert uploads visible before homework)
      try {
        const matsRes = await fetchJson<{ items?: any[] }>(`/lessons/${encodeURIComponent(lessonId)}/materials`, token);
        const items = Array.isArray(matsRes.items) ? matsRes.items : [];
        const norm = items
          .map((x) => ({
            fileKey: String(x?.fileKey ?? '').trim(),
            filename: String(x?.filename ?? '').trim(),
            sizeBytes: typeof x?.sizeBytes === 'number' ? x.sizeBytes : x?.sizeBytes == null ? null : Number(x.sizeBytes),
          }))
          .filter((x) => x.fileKey && x.filename);
        if (matsTitle) matsTitle.style.display = norm.length ? '' : 'none';
        if (mats) {
          mats.replaceChildren();
          if (norm.length) {
            norm.forEach((f) => {
              const row = document.createElement('div');
              row.className = 'material-row';
              row.style.cursor = 'pointer';
              row.dataset.epLessonMaterialOpen = '1';
              row.dataset.epLessonMaterialKey = f.fileKey;
              row.dataset.epLessonMaterialName = encodeURIComponent(f.filename);

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
              btn.dataset.epLessonMaterialDownload = '1';
              btn.dataset.epLessonMaterialKey = f.fileKey;
              btn.dataset.epLessonMaterialName = encodeURIComponent(f.filename);

              row.append(ico, body, btn);
              mats.appendChild(row);
            });
          }
        }
      } catch {
        if (matsTitle) matsTitle.style.display = 'none';
        if (mats) mats.replaceChildren();
      }

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
      // "Complete lesson" is available only for lessons without homework
      if (completeBtn) {
        completeBtn.style.display = !hasExpertHomework ? '' : 'none';
      }

      updatePrevLessonUi(root, lessonId);
    }

    function renderInlineLessonSlider(root: ShadowRoot, host: HTMLElement, keys: string[]): void {
      host.replaceChildren();
      if (!keys.length) {
        host.style.display = 'none';
        return;
      }
      host.style.display = '';
      let idx = 0;

      const wrap = document.createElement('div');
      wrap.className = 'ep-lesson-slider';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'ep-lesson-slider__img';
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.loading = 'lazy';
      img.dataset.epLessonSliderFs = '1';
      img.setAttribute('title', 'На весь экран');
      imgWrap.appendChild(img);

      const controls = document.createElement('div');
      controls.className = 'ep-lesson-slider__controls';

      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'btn btn-ghost btn-sm';
      prev.textContent = '←';
      prev.dataset.epLessonSliderPrev = '1';

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-ghost btn-sm';
      next.textContent = '→';
      next.dataset.epLessonSliderNext = '1';

      const count = document.createElement('div');
      count.className = 'ep-lesson-slider__count';

      const fs = document.createElement('button');
      fs.type = 'button';
      fs.className = 'btn btn-outline btn-sm';
      fs.textContent = '⛶';
      fs.dataset.epLessonSliderFs = '1';

      controls.append(prev, count, next, fs);
      wrap.append(imgWrap, controls);
      host.appendChild(wrap);

      const setIdx = (n: number): void => {
        idx = ((n % keys.length) + keys.length) % keys.length;
        const src = sliderImageSrc(keys[idx]!);
        img.src = src;
        count.textContent = `${idx + 1}/${keys.length}`;
        prev.toggleAttribute('disabled', keys.length <= 1);
        next.toggleAttribute('disabled', keys.length <= 1);
      };

      (host as any).__epSliderKeys = keys;
      (host as any).__epSliderIndex = () => idx;
      (host as any).__epSliderSet = setIdx;
      setIdx(0);
    }

    function isShellStudentMode(root: ShadowRoot): boolean {
      return root.getElementById('tab-student')?.classList.contains('active') ?? false;
    }

    function setStudentLessonEnrolledUI(root: ShadowRoot, enrolled: boolean): void {
      const notEnrolled = root.querySelector('[data-ep-s-lesson-not-enrolled]') as HTMLElement | null;
      const app = root.querySelector('[data-ep-s-lesson-app]') as HTMLElement | null;
      if (notEnrolled) notEnrolled.style.display = enrolled ? 'none' : 'block';
      if (app) app.style.display = enrolled ? 'flex' : 'none';
    }

    function resetStudentLessonEmptySession(root: ShadowRoot): void {
      currentCourseId = null;
      lessonMetaById.clear();
      unlockedLessonIds.clear();
      modulesOrderedLessonIds = [];
      delete (root as any).__epHomework;
    }

    function navigationToLessonIsFromDataEpScreen(
      source: HTMLElement | null | undefined,
    ): boolean {
      const el = source?.closest?.('[data-ep-screen]') as HTMLElement | null;
      return el?.dataset?.epScreen === 's-lesson';
    }

    /**
     * Текущий урок: без зачислений показываем сообщение, иначе открываем курс (как «Мои курсы»).
     * Только по явной навигации (есть [data-ep-screen] → s-lesson) или deep-link ?screen=s-lesson.
     * Не вызывать при shell.showScreen('s-lesson') из кода (openCourse / ДЗ) — там source пустой.
     */
    async function enterStudentCurrentLessonOrEmpty(root: ShadowRoot): Promise<void> {
      const token = getAccessToken() ?? undefined;
      let data: MyCoursesResponseV1;
      try {
        data = await fetchJson<MyCoursesResponseV1>('/me/courses', token);
      } catch {
        setStudentLessonEnrolledUI(root, true);
        return;
      }
      const items = data.items ?? [];
      if (items.length === 0) {
        resetStudentLessonEmptySession(root);
        setStudentLessonEnrolledUI(root, false);
        return;
      }
      setStudentLessonEnrolledUI(root, true);
      const ids = new Set(items.map((x) => x.course.id));
      const pick = currentCourseId && ids.has(currentCourseId) ? currentCourseId : items[0]!.course.id;
      await openCourse(pick);
    }

    async function openStudentAttestation(root: ShadowRoot, attestationId: string, opts?: { reviewOnly?: boolean }): Promise<void> {
      if (!currentCourseId) return;
      const token = getAccessToken() ?? undefined;
      studentActiveAttestationId = attestationId;
      studentAttestationShowReview = Boolean(opts?.reviewOnly);
      rerenderStudentLessonTree(root);
      showStudentAttestationWorkspace(root);

      const titleEl = root.querySelector('[data-ep-student-attestation-title]') as HTMLElement | null;
      const bodyEl = root.querySelector('[data-ep-student-attestation-body]') as HTMLElement | null;
      const submitBtn = root.querySelector('[data-ep-student-attestation-submit]') as HTMLButtonElement | null;
      const retakeBtn = root.querySelector('[data-ep-student-attestation-retake]') as HTMLButtonElement | null;
      if (!bodyEl) return;
      bodyEl.replaceChildren();
      if (submitBtn) {
        submitBtn.style.display = 'none';
        submitBtn.disabled = true;
      }
      if (retakeBtn) retakeBtn.style.display = 'none';

      if (studentAttestationShowReview) {
        try {
          const rev = await fetchJson<{
            displayTitle: string;
            attempt: {
              attemptId: string;
              correctCount: number;
              questionCount: number;
              percent: number;
              submittedAt: string;
            } | null;
            questions: Array<{
              questionId: string;
              prompt: string;
              chosenOptionId: string | null;
              correctOptionId: string;
              options: { id: string; position?: number; label: string }[];
            }>;
          }>(
            `/courses/${encodeURIComponent(currentCourseId)}/attestations/${encodeURIComponent(attestationId)}/review`,
            token,
          );
          if (titleEl) titleEl.textContent = rev.displayTitle;
          if (rev.attempt && rev.attempt.questionCount > 0) {
            const sum = document.createElement('div');
            sum.className = 's-att-summary';
            const left = document.createElement('div');
            const k = document.createElement('div');
            k.style.fontSize = '12px';
            k.style.color = 'var(--t3)';
            k.textContent = 'Результат последней попытки';
            left.appendChild(k);
            const sc = document.createElement('div');
            sc.className = 's-att-summary__score';
            sc.textContent = `${rev.attempt.correctCount} / ${rev.attempt.questionCount}`;
            sum.append(left, sc);
            bodyEl.appendChild(sum);
          }
          for (const q of rev.questions) {
            const wrap = document.createElement('div');
            wrap.className = 's-att-q';
            const pr = document.createElement('div');
            pr.className = 's-att-q__prompt';
            pr.textContent = q.prompt;
            const opts = document.createElement('div');
            opts.className = 's-att-q__opts';
            const sorted = [...q.options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            for (const o of sorted) {
              const row = document.createElement('div');
              row.className = 's-att-opt';
              if (o.id === q.correctOptionId) row.classList.add('s-att-opt--correct');
              else if (q.chosenOptionId && o.id === q.chosenOptionId) row.classList.add('s-att-opt--wrong');
              row.textContent = o.label;
              opts.appendChild(row);
            }
            wrap.append(pr, opts);
            bodyEl.appendChild(wrap);
          }
          if (retakeBtn && rev.attempt) {
            retakeBtn.style.display = '';
            retakeBtn.onclick = () => {
              void openStudentAttestation(root, attestationId, { reviewOnly: false });
            };
          }
        } catch {
          if (titleEl) titleEl.textContent = 'Аттестация';
          bodyEl.textContent = 'Не удалось загрузить результат.';
        }
        return;
      }

      try {
        const data = await fetchJson<{
          displayTitle: string;
          questions: Array<{ id: string; prompt: string; options: { id: string; label: string }[] }>;
        }>(
          `/courses/${encodeURIComponent(currentCourseId)}/attestations/${encodeURIComponent(attestationId)}/for-attempt`,
          token,
        );
        if (titleEl) titleEl.textContent = data.displayTitle;
        const answers: Record<string, string> = {};
        const questions = data.questions ?? [];
        if (questions.length === 0) {
          bodyEl.textContent = 'В этой аттестации пока нет вопросов.';
          return;
        }
        const syncSubmit = (): void => {
          if (!submitBtn) return;
          const ok = questions.every((q) => typeof answers[q.id] === 'string' && answers[q.id].length > 0);
          submitBtn.disabled = !ok;
        };
        for (const q of questions) {
          const wrap = document.createElement('div');
          wrap.className = 's-att-q';
          const pr = document.createElement('div');
          pr.className = 's-att-q__prompt';
          pr.textContent = q.prompt;
          const opts = document.createElement('div');
          opts.className = 's-att-q__opts';
          const gname = `att-${attestationId}-${q.id}`;
          for (const o of q.options) {
            const lab = document.createElement('label');
            lab.className = 's-att-opt';
            const inp = document.createElement('input');
            inp.type = 'radio';
            inp.name = gname;
            inp.value = o.id;
            inp.addEventListener('change', () => {
              answers[q.id] = o.id;
              syncSubmit();
            });
            const span = document.createElement('span');
            span.textContent = o.label;
            lab.append(inp, span);
            opts.appendChild(lab);
          }
          wrap.append(pr, opts);
          bodyEl.appendChild(wrap);
        }
        if (submitBtn) {
          submitBtn.style.display = '';
          submitBtn.textContent = 'Отправить';
          submitBtn.disabled = true;
          submitBtn.onclick = () => {
            void (async () => {
              submitBtn.disabled = true;
              submitBtn.textContent = 'Отправка…';
              try {
                const res = await postJson<{
                  attempt: {
                    attemptId: string;
                    correctCount: number;
                    questionCount: number;
                    percent: number;
                    submittedAt: string;
                  };
                }>(
                  `/courses/${encodeURIComponent(currentCourseId)}/attestations/${encodeURIComponent(attestationId)}/attempts`,
                  { answers },
                  token,
                );
                const att = res.attempt;
                if (studentTreeSnapshot) {
                  const bump = (rows: StudentAttestationTreeRowV1[]) => {
                    const row = rows.find((x) => x.id === attestationId);
                    if (row && att) {
                      row.latestAttempt = {
                        attemptId: att.attemptId,
                        correctCount: att.correctCount,
                        questionCount: att.questionCount,
                        percent: att.percent,
                        submittedAt: att.submittedAt,
                      };
                    }
                  };
                  for (const m of studentTreeSnapshot.modules) bump(m.attestations);
                  bump(studentTreeSnapshot.courseLevelAttestations);
                }
                studentAttestationShowReview = true;
                rerenderStudentLessonTree(root);
                await openStudentAttestation(root, attestationId, { reviewOnly: true });
                window.alert(`Результат: ${att.correctCount} из ${att.questionCount} верно.`);
              } catch (e) {
                window.alert(e instanceof Error ? e.message : 'Не удалось отправить ответы.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Отправить';
              }
            })();
          };
        }
        syncSubmit();
      } catch {
        if (titleEl) titleEl.textContent = 'Аттестация';
        bodyEl.textContent = 'Не удалось загрузить аттестацию. Войдите в аккаунт и убедитесь, что у вас есть доступ к курсу.';
      }
    }

    async function openCourse(courseId: string): Promise<void> {
      shell.setRole('student', { screenId: 's-lesson' });

      const root = shell.shadowRoot;
      setStudentLessonEnrolledUI(root, true);
      currentCourseId = courseId;
      lessonMetaById.clear();
      unlockedLessonIds.clear();
      modulesOrderedLessonIds = [];
      studentActiveAttestationId = null;
      studentAttestationShowReview = false;
      studentTreeSnapshot = null;
      showStudentLessonWorkspace(root);

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
      const [moduleLessons, courseLevelAttestations] = await Promise.all([
        Promise.all(
          modules.map(async (m) => {
            const res = await fetchModuleLessons(courseId, m.id);
            return { module: m, res };
          }),
        ),
        fetchCourseLevelAttestations(courseId),
      ]);

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

      studentTreeSnapshot = {
        courseTitle: knownTitle,
        modules: moduleLessons.map(({ module, res }) => ({
          id: module.id,
          title: module.title,
          lessons: res.items ?? [],
          unlocked: new Set(res.unlockedLessonIds ?? []),
          completed: new Set(res.completedLessonIds ?? []),
          attestations: (res.attestations ?? []).slice().sort((a, b) => a.position - b.position),
        })),
        courseLevelAttestations: courseLevelAttestations.slice().sort((a, b) => a.position - b.position),
        activeLessonId,
      };
      renderLessonTree({
        root,
        courseTitle: knownTitle,
        modules: studentTreeSnapshot.modules,
        courseLevelAttestations: studentTreeSnapshot.courseLevelAttestations,
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

    /** Как в веб-приложении (ExpertHomePage): при активной подписке — expertId из /me/expert-subscription, иначе первое членство. */
    type ExpertSubscriptionPickV1 = {
      expertId: string;
      status: string;
      currentPeriodEnd: string | null;
    };

    function expertSubscriptionIsActive(sub: ExpertSubscriptionPickV1): boolean {
      const now = Date.now();
      const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
      return sub.status === 'active' && (end === null || end > now);
    }

    function pickWorkspaceExpertId(
      memberships: { expertId: string }[],
      subscription: ExpertSubscriptionPickV1 | null,
    ): string | null {
      if (!memberships.length) return null;
      const allowed = new Set(memberships.map((m) => m.expertId));
      if (subscription && expertSubscriptionIsActive(subscription) && allowed.has(subscription.expertId)) {
        return subscription.expertId;
      }
      return memberships[0]?.expertId ?? null;
    }

    async function fetchExpertWorkspaceId(token: string, userId: string): Promise<string | null> {
      expertWorkspaceMyRole = null;
      // Не сбрасывать expertTeamCreatedByUserId / expertTeamSoleMemberIsMe здесь: эти поля
      // приходят из GET /team/members, а fetch вызывается при каждом hydrateTopbarUser.
      // Ранний сброс оставлял canManage ложным до следующей подгрузки команды (пропадали
      // кнопка «Добавить» и шестерёнки).
      expertWorkspaceIsCreator = false;
      let memberships: { expertId: string; userId: string; role: string; isWorkspaceCreator?: boolean }[] = [];
      try {
        const mem = await fetchJson<{
          items?: { expertId: string; userId: string; role: string; isWorkspaceCreator?: boolean }[];
        }>('/me/expert-memberships', token);
        memberships = mem.items ?? [];
      } catch {
        expertTeamCreatedByUserId = null;
        expertTeamSoleMemberIsMe = false;
        return null;
      }
      if (memberships.length === 0) {
        expertTeamCreatedByUserId = null;
        expertTeamSoleMemberIsMe = false;
        return null;
      }

      let subscription: ExpertSubscriptionPickV1 | null = null;
      try {
        const raw = await fetchJson<ExpertSubscriptionPickV1 | null>('/me/expert-subscription', token);
        if (raw && typeof raw.expertId === 'string') subscription = raw;
      } catch {
        subscription = null;
      }
      const eid = pickWorkspaceExpertId(memberships, subscription);
      if (eid && userId) {
        const row = memberships.find((m) => m.expertId === eid && m.userId === userId);
        expertWorkspaceMyRole = row?.role ?? null;
        expertWorkspaceIsCreator = row?.isWorkspaceCreator === true;
      }
      return eid;
    }

    function canManageExpertTeam(): boolean {
      if (expertWorkspaceMyRole === 'owner' || expertWorkspaceMyRole === 'manager') return true;
      if (expertWorkspaceIsCreator) return true;
      if (expertTeamSoleMemberIsMe) return true;
      const meId = (currentMe?.id ?? '').trim();
      const byId = (expertTeamCreatedByUserId ?? '').trim();
      if (meId && byId && meId === byId) return true;
      if (meId && expertTeamLastRows.length > 0) {
        const my = expertTeamLastRows.find((m) => m.userId === meId);
        if (my) {
          const createdBy = expertTeamCreatedByUserId ?? '';
          const soleThis =
            expertTeamLastRows.length === 1 && expertTeamLastRows[0]!.userId === meId;
          if (expertTeamMemberIsOwnerLikeRow(my, createdBy, soleThis)) return true;
        }
      }
      return false;
    }

    function syncExpertTeamOwnerButton(root: ShadowRoot | null): void {
      if (!root) return;
      const btn = root.querySelector('[data-ep-team-add-open]') as HTMLButtonElement | null;
      if (!btn) return;
      const show = canManageExpertTeam();
      btn.style.display = show ? 'inline-flex' : 'none';
    }

    function canSeeReferralProgram(): boolean {
      return expertWorkspaceMyRole === 'owner' || expertWorkspaceMyRole === 'manager';
    }

    function syncExpertReferralVisibility(root: ShadowRoot | null): void {
      if (!root) return;
      const referralBtn = root.querySelector('[data-ep-screen="e-referral"]') as HTMLElement | null;
      const referralScreen = root.getElementById('screen-e-referral') as HTMLElement | null;
      // Section header "Монетизация" (only contains referral right now)
      const monetSection = Array.from(root.querySelectorAll('.sb-section')).find(
        (el) => (el.textContent ?? '').trim() === 'Монетизация',
      ) as HTMLElement | undefined;

      const show = canSeeReferralProgram();
      if (referralBtn) referralBtn.style.display = show ? '' : 'none';
      if (monetSection) monetSection.style.display = show ? '' : 'none';
      if (referralScreen) referralScreen.style.display = show ? '' : 'none';

      if (!show) {
        // If user somehow landed on referral screen, bounce to dashboard.
        const active = root.querySelector('.screen.active') as HTMLElement | null;
        if (active?.id === 'screen-e-referral') {
          shell.showScreen('e-dashboard');
        }
      }
    }

    async function hydrateTopbarUser(): Promise<void> {
      const token = getAccessToken();
      if (!token) {
        expertShellAccess.allowed = false;
        activeExpertId = null;
        expertWorkspaceMyRole = null;
        expertTeamCreatedByUserId = null;
        expertWorkspaceIsCreator = false;
        expertTeamSoleMemberIsMe = false;
        currentMe = null;
        currentPlatformRole = null;
        syncExpertTeamOwnerButton(shell.shadowRoot);
        void hydrateExpertHomeworkBadge(shell.shadowRoot);
        return;
      }

      const root = shell.shadowRoot;
      const nameEl = root.querySelector('.topbar-user .user-name') as HTMLElement | null;
      const roleEl = root.querySelector('.topbar-user .user-role') as HTMLElement | null;
      const avatarEl =
        (root.querySelector('.topbar-user .user-avatar') as HTMLElement | null) ??
        (root.querySelector('.topbar-user .avatar') as HTMLElement | null);
      if (!nameEl || !roleEl || !avatarEl) return;

      try {
        const me = await fetchJson<{ user?: MeUserV1 }>('/me', token);
        const u = me.user;
        if (!u) {
          expertShellAccess.allowed = false;
          activeExpertId = null;
          expertWorkspaceMyRole = null;
          expertTeamCreatedByUserId = null;
          expertWorkspaceIsCreator = false;
          expertTeamSoleMemberIsMe = false;
          currentMe = null;
          currentPlatformRole = null;
          syncExpertTeamOwnerButton(root);
          void hydrateExpertHomeworkBadge(root);
          return;
        }
        currentMe = u;
        currentPlatformRole = u.platformRole ?? null;
        // Student sidebar badges (best-effort)
        void hydrateStudentMenuBadges(shell.shadowRoot, token);
        // Update streak UI (student sidebar; best-effort)
        const streakEl = root.querySelector('[data-ep-streak-days]') as HTMLElement | null;
        if (streakEl) {
          const n = Math.max(0, Number((u as any).streakDays ?? 0) || 0);
          streakEl.textContent = String(n);
        }
        // Update homework avg score stars (student sidebar; best-effort)
        const avgHost = root.querySelector('[data-ep-homework-avg-stars]') as HTMLElement | null;
        if (avgHost) {
          const raw = (u as any).homeworkAvgScore;
          const avg = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : null;
          renderStarsInto(avgHost, avg);
        }
        let inExpertTeam = false;
        activeExpertId = null;
        try {
          activeExpertId = await fetchExpertWorkspaceId(token, u.id);
          inExpertTeam = !!activeExpertId;
          syncExpertTeamOwnerButton(shell.shadowRoot);
          syncExpertReferralVisibility(shell.shadowRoot);
        } catch {
          inExpertTeam = false;
          activeExpertId = null;
          expertWorkspaceMyRole = null;
          expertTeamCreatedByUserId = null;
          expertWorkspaceIsCreator = false;
          expertTeamSoleMemberIsMe = false;
        }
        expertShellAccess.allowed = inExpertTeam;
        syncExpertTeamOwnerButton(root);
        syncExpertReferralVisibility(root);
        void hydrateExpertHomeworkBadge(root);
        const name = displayName(u);
        nameEl.textContent = name;
        roleEl.textContent = inExpertTeam ? 'Эксперт' : 'Ученик';
        const initialsT = initialsFromName(name);
        applyUserAvatarToElement(avatarEl, u.avatarUrl, initialsT);
      } catch {
        expertShellAccess.allowed = false;
        activeExpertId = null;
        expertWorkspaceMyRole = null;
        expertTeamCreatedByUserId = null;
        expertWorkspaceIsCreator = false;
        expertTeamSoleMemberIsMe = false;
        currentMe = null;
        currentPlatformRole = null;
        syncExpertTeamOwnerButton(root);
        void hydrateExpertHomeworkBadge(root);
        // не ломаем интерфейс, если /me недоступен
      }
    }

    async function hydrateStudentMenuBadges(root: ShadowRoot, token: string): Promise<void> {
      const myCoursesBadge = root.querySelector('[data-ep-student-badge-mycourses]') as HTMLElement | null;
      const hwBadge = root.querySelector('[data-ep-student-badge-homework]') as HTMLElement | null;

      const setActiveCoursesCount = (count: number): void => {
        const profileNum = root.querySelector('[data-ep-profile-active-courses]') as HTMLElement | null;
        if (profileNum) profileNum.textContent = String(count);
      };

      try {
        const data = await fetchJson<MyCoursesResponseV1>('/me/courses', token);
        const n = (data.items ?? []).length;
        if (myCoursesBadge) {
          if (n > 0) {
            myCoursesBadge.textContent = String(n);
            myCoursesBadge.style.display = '';
          } else {
            myCoursesBadge.textContent = '';
            myCoursesBadge.style.display = 'none';
          }
        }
        setActiveCoursesCount(n);
      } catch {
        /* ignore */
      }

      try {
        const next = await fetchJson<{ homework: any | null }>('/me/homework/next-pending', token);
        const show = !!next?.homework;
        if (hwBadge) {
          if (show) {
            hwBadge.textContent = '1';
            hwBadge.style.display = '';
          } else {
            hwBadge.textContent = '';
            hwBadge.style.display = 'none';
          }
        }
      } catch {
        /* ignore */
      }
    }

    async function openCatalogCategoryDropdown(): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const root = shell.shadowRoot;
      const bd = root.querySelector('[data-ep-catalog-dd-backdrop]') as HTMLElement | null;
      const dd = root.querySelector('[data-ep-catalog-dd]') as HTMLElement | null;
      const body = root.querySelector('[data-ep-catalog-dd-body]') as HTMLElement | null;
      if (!bd || !dd || !body) return;

      body.replaceChildren();
      bd.style.display = '';
      dd.style.display = '';

      try {
        const topics = await ensureCatalogTopics(token);
        if (!topics.length) {
          body.appendChild(
            Object.assign(document.createElement('div'), {
              style: 'font-size:12px;color:var(--t3);padding:8px 4px',
              textContent: 'Тем пока нет.',
            }),
          );
          return;
        }
        topics.forEach((t) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ep-cat-dd__item';
          btn.dataset.epCatalogDdItem = t.slug;
          btn.textContent = t.title;
          body.appendChild(btn);
        });
      } catch {
        body.appendChild(
          Object.assign(document.createElement('div'), {
            style: 'font-size:12px;color:var(--t3);padding:8px 4px',
            textContent: 'Не удалось загрузить темы.',
          }),
        );
      }
    }

    function closeCatalogCategoryDropdown(): void {
      const root = shell.shadowRoot;
      const bd = root.querySelector('[data-ep-catalog-dd-backdrop]') as HTMLElement | null;
      const dd = root.querySelector('[data-ep-catalog-dd]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (dd) dd.style.display = 'none';
    }

    function renderStarsInto(host: HTMLElement, avgScore: number | null): void {
      if (avgScore == null) {
        host.textContent = '—';
        return;
      }
      const v = Math.max(0, Math.min(5, avgScore));
      const fillPct = `${(v / 5) * 100}%`;
      host.innerHTML =
        `<span class="ep-stars" style="--fill:${fillPct}" aria-label="Рейтинг ${v.toFixed(2)} из 5">` +
        `<span class="ep-stars__bg">★★★★★</span>` +
        `<span class="ep-stars__fg">★★★★★</span>` +
        `</span>`;
    }

    let catalogTopic: string = 'all';
    let catalogSearchQ: string = '';
    let catalogSearchTimer: ReturnType<typeof setTimeout> | null = null;

    let catalogTopicsCache: Array<{ id: string; slug: string; title: string }> | null = null;
    async function ensureCatalogTopics(token: string): Promise<Array<{ id: string; slug: string; title: string }>> {
      if (catalogTopicsCache) return catalogTopicsCache;
      const res = await fetchJson<{ items?: Array<{ id: string; slug: string; title: string }> }>('/topics', token);
      catalogTopicsCache = res.items ?? [];
      return catalogTopicsCache;
    }
    function pickTopicIdOrSlugByKeyword(
      topics: Array<{ id?: string; slug: string; title: string }>,
      keywordRuLower: string,
    ): { id: string; slug: string } | null {
      const kw = keywordRuLower.trim().toLowerCase();
      if (!kw) return null;
      const norm = (v: string): string =>
        v
          .toLowerCase()
          .replace(/ё/g, 'е')
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const found = topics.find((t) => {
        const title = norm(String(t.title ?? ''));
        const slug = norm(String(t.slug ?? ''));
        return title.includes(kw) || slug.includes(kw);
      });
      const id = String((found as any)?.id ?? '').trim();
      const slug = String((found as any)?.slug ?? '').trim();
      if (!slug) return null;
      return { id, slug };
    }
    async function catalogStaticTopicToTopicParam(token: string, v: string): Promise<string | null> {
      const s = (v || '').trim();
      if (s === 'all') return null;
      const topics = await ensureCatalogTopics(token);
      const picked =
        s === 'marketing'
          ? pickTopicIdOrSlugByKeyword(topics, 'маркет')
          : s === 'sales'
            ? pickTopicIdOrSlugByKeyword(topics, 'продаж')
            : s === 'finance'
              ? pickTopicIdOrSlugByKeyword(topics, 'финанс')
              : null;
      // Prefer UUID param (more robust than slug); fallback to slug
      return picked?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(picked.id)
        ? picked.id
        : picked?.slug ?? null;
      return null;
    }

    function syncCatalogTopicActive(root: ShadowRoot): void {
      root.querySelectorAll<HTMLElement>('#screen-s-catalog [data-ep-catalog-topic]').forEach((el) => {
        const key = (el.dataset.epCatalogTopic ?? '').trim();
        el.classList.toggle('active', key === catalogTopic);
      });
    }

    function appendStudentCoursesGridPlaceholder(grid: HTMLElement, message: string): void {
      grid.replaceChildren();
      const el = document.createElement('div');
      el.className = 'card';
      el.style.padding = '18px';
      el.style.color = 'var(--t3)';
      el.style.fontSize = '13px';
      el.style.lineHeight = '1.55';
      el.textContent = message;
      grid.appendChild(el);
    }

    function primeStudentCatalogLoading(root: ShadowRoot): void {
      const screen = root.getElementById('screen-s-catalog');
      const grid = screen?.querySelector('[data-ep-student-catalog-grid]') as HTMLElement | null;
      if (!grid) return;
      appendStudentCoursesGridPlaceholder(grid, 'Загрузка каталога…');
    }

    function primeStudentMyCoursesLoading(root: ShadowRoot): void {
      const screen = root.getElementById('screen-s-mycourses');
      const grid = screen?.querySelector('[data-ep-student-mycourses-grid]') as HTMLElement | null;
      if (!grid) return;
      appendStudentCoursesGridPlaceholder(grid, 'Загрузка ваших курсов…');
      const sub = screen?.querySelector('[data-ep-student-mycourses-sub]');
      if (sub) sub.textContent = 'Загрузка…';
    }

    async function hydrateStudentCatalog(params?: { q?: string; topic?: string | null }): Promise<void> {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-catalog');
      const grid = screen?.querySelector('[data-ep-student-catalog-grid]') as HTMLElement | null;
      if (!grid) return;

      const q = (params?.q ?? '').trim();
      const topic = (params?.topic ?? null) || null;
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (topic) qs.set('topic', topic);
      const path = qs.toString() ? `/library?${qs.toString()}` : '/library';
      let data: LibraryResponseV1;
      try {
        data = await fetchJson<LibraryResponseV1>(path);
      } catch {
        grid.replaceChildren();
        const err = document.createElement('div');
        err.className = 'card';
        err.style.padding = '18px';
        err.style.color = 'var(--t3)';
        err.style.fontSize = '13px';
        err.style.lineHeight = '1.55';
        err.textContent = 'Не удалось загрузить каталог. Обновите страницу или попробуйте позже.';
        grid.appendChild(err);
        return;
      }

      const courses = (data.courses ?? []).slice(0, 12);
      grid.replaceChildren();
      if (courses.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.style.padding = '18px';
        empty.style.color = 'var(--t3)';
        empty.style.fontSize = '13px';
        empty.style.lineHeight = '1.55';
        empty.textContent = topic
          ? 'В этой категории пока нет курсов.'
          : q
            ? 'Ничего не найдено по вашему запросу.'
            : 'Пока нет курсов.';
        grid.appendChild(empty);
        return;
      }
      courses.forEach((c) => grid.appendChild(renderCourseCard(c)));
    }

    async function hydrateMyCourses(): Promise<void> {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-mycourses');
      const grid = screen?.querySelector('[data-ep-student-mycourses-grid]') as HTMLElement | null;
      if (!grid) return;

      const token = getAccessToken();
      let data: MyCoursesResponseV1;
      try {
        data = await fetchJson<MyCoursesResponseV1>('/me/courses', token ?? undefined);
      } catch {
        grid.replaceChildren();
        const err = document.createElement('div');
        err.className = 'card';
        err.style.padding = '18px';
        err.style.color = 'var(--t3)';
        err.style.fontSize = '13px';
        err.style.lineHeight = '1.55';
        err.textContent = 'Не удалось загрузить «Мои курсы». Обновите страницу или попробуйте позже.';
        grid.appendChild(err);
        return;
      }

      const items = (data.items ?? []).slice(0, 12);
      myCourseIds.clear();
      (data.items ?? []).forEach((it) => myCourseIds.add(it.course.id));
      grid.replaceChildren();
      items.forEach((it) => grid.appendChild(renderMyCourseCard(it)));

      const sub = screen?.querySelector('[data-ep-student-mycourses-sub]');
      if (sub) sub.textContent = `${pluralRu(items.length, ['активный курс', 'активных курса', 'активных курсов'])}`;

      const profileNum = root.querySelector('[data-ep-profile-active-courses]') as HTMLElement | null;
      if (profileNum) profileNum.textContent = String((data.items ?? []).length);
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
      activeExpertId = await fetchExpertWorkspaceId(token, currentMe?.id ?? '');
      return activeExpertId;
    }

    function renderExpertCourseDashboardCard(item: ExpertCourseDashboardItemV1, index: number): HTMLElement {
      const gradients = [
        ['linear-gradient(135deg,#0e2c38,#1a4a58)', 'rgba(10,168,200,.5)'],
        ['linear-gradient(135deg,#1c1428,#2e1f4a)', 'rgba(124,58,237,.5)'],
        ['linear-gradient(135deg,#1c1409,#2e2010)', 'rgba(245,158,11,.4)'],
      ] as const;
      const [gradBg, accent] = gradients[index % gradients.length]!;

      const card = document.createElement('div');
      card.className = 'card ep-expert-course-card';
      card.dataset.epExpertCourseCard = '1';
      card.dataset.epExpertEditorCourseId = item.id;
      card.dataset.epExpertEditorExpertId = item.expertId;
      card.style.cursor = 'pointer';
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

      const cover = normalizeAssetUrl(item.coverUrl ?? null);
      if (cover) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = cover;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener(
          'error',
          () => {
            img.remove();
            bg.appendChild(initials);
          },
          { once: true },
        );
        bg.appendChild(img);
      } else {
        bg.appendChild(initials);
      }

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
      } else if (item.status === 'archived') {
        tag.classList.add('tag-purple');
        tag.textContent = 'Архив';
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
      card.append(bg, scrim, body);
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

    const DASH_RU_MONTHS = [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ] as const;
    const DASH_RU_MONTHS_SHORT = [
      'Янв',
      'Фев',
      'Мар',
      'Апр',
      'Май',
      'Июн',
      'Июл',
      'Авг',
      'Сен',
      'Окт',
      'Ноя',
      'Дек',
    ] as const;
    const DASH_RU_MONTHS_GEN = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ] as const;

    function formatDashMonthTitle(y: number, m: number): string {
      const mo = Math.max(1, Math.min(12, m));
      return `${DASH_RU_MONTHS[mo - 1] ?? '—'} ${y}`;
    }

    function formatDashReferralLbl(y: number, m: number): string {
      const mo = Math.max(1, Math.min(12, m));
      return `Реферальные выплаты (${DASH_RU_MONTHS_GEN[mo - 1] ?? '—'} ${y})`;
    }

    function formatRubDash(n: number): string {
      return new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(n)));
    }

    function dashboardActivityBadgeClass(variant: ExpertDashboardActivityItemV1['badgeVariant']): string {
      if (variant === 'new') return 'tag tag-new';
      if (variant === 'live') return 'tag tag-live';
      if (variant === 'draft') return 'tag tag-draft';
      return 'tag';
    }

    function closeExpertDashboardMonthPop(root: ShadowRoot): void {
      const pop = root.querySelector('[data-ep-e-dashboard-month-pop]') as HTMLElement | null;
      if (pop) {
        pop.classList.remove('ep-dash-month-pop--open');
        pop.setAttribute('aria-hidden', 'true');
      }
    }

    function renderExpertDashboardMonthPop(root: ShadowRoot): void {
      const yearEl = root.querySelector('[data-ep-e-dashboard-month-pop-year]') as HTMLElement | null;
      const grid = root.querySelector('[data-ep-e-dashboard-month-grid]') as HTMLElement | null;
      if (yearEl) yearEl.textContent = String(expertDashboardDraftYear);
      if (!grid) return;
      grid.replaceChildren();
      for (let mo = 1; mo <= 12; mo++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
          mo === expertDashboardDraftMonth ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        b.style.minHeight = '36px';
        b.textContent = DASH_RU_MONTHS_SHORT[mo - 1] ?? String(mo);
        b.dataset.epEDashboardMonthPick = String(mo);
        grid.appendChild(b);
      }
    }

    function openExpertDashboardMonthPop(root: ShadowRoot): void {
      expertDashboardDraftYear = expertDashboardYear;
      expertDashboardDraftMonth = expertDashboardMonth;
      renderExpertDashboardMonthPop(root);
      const pop = root.querySelector('[data-ep-e-dashboard-month-pop]') as HTMLElement | null;
      if (pop) {
        pop.classList.add('ep-dash-month-pop--open');
        pop.setAttribute('aria-hidden', 'false');
      }
    }

    function expertDashboardCourseStatusUi(
      status: ExpertCourseStatusV1,
    ): { label: string; cls: string } {
      if (status === 'published') return { label: 'Опубликован', cls: 'tag tag-live' };
      if (status === 'draft') return { label: 'Черновик', cls: 'tag tag-draft' };
      return { label: 'Архив', cls: 'tag' };
    }

    async function hydrateExpertDashboard(root: ShadowRoot | null | undefined): Promise<void> {
      if (!root) return;
      const screen = root.getElementById('screen-e-dashboard');
      if (!screen) return;

      const sub = screen.querySelector('[data-ep-e-dashboard-sub]') as HTMLElement | null;
      const monthBtn = screen.querySelector('[data-ep-e-dashboard-month-btn]') as HTMLButtonElement | null;
      const stStudents = screen.querySelector('[data-ep-e-dashboard-stat-students]') as HTMLElement | null;
      const stStudentsDelta = screen.querySelector(
        '[data-ep-e-dashboard-stat-students-delta]',
      ) as HTMLElement | null;
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
      const hwCard = screen.querySelector('[data-ep-e-dashboard-hw-card]') as HTMLElement | null;

      if (monthBtn) monthBtn.textContent = formatDashMonthTitle(expertDashboardYear, expertDashboardMonth);

      const token = getAccessToken();
      if (!token) {
        if (sub) sub.textContent = 'Войдите, чтобы видеть дашборд.';
        if (tbody) tbody.replaceChildren();
        if (hwHost) hwHost.replaceChildren();
        if (actHost) actHost.replaceChildren();
        return;
      }
      if (!expertShellAccess.allowed) {
        if (sub) sub.textContent = 'Нет доступа к команде эксперта.';
        if (tbody) tbody.replaceChildren();
        if (hwHost) hwHost.replaceChildren();
        if (actHost) actHost.replaceChildren();
        return;
      }

      const eid = await resolveActiveExpertId();
      if (!eid) {
        if (sub) sub.textContent = 'Нет доступа к команде эксперта.';
        if (tbody) tbody.replaceChildren();
        if (hwHost) hwHost.replaceChildren();
        if (actHost) actHost.replaceChildren();
        return;
      }

      let firstName = (currentMe?.firstName ?? '').trim();
      if (!firstName) {
        try {
          const me = await fetchJson<{ user?: MeUserV1 }>('/me', token);
          firstName = (me.user?.firstName ?? '').trim();
        } catch {
          /* ignore */
        }
      }
      const greet = firstName || 'эксперт';

      if (tbody) {
        tbody.replaceChildren();
        const trLoad = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.style.color = 'var(--t3)';
        td.style.fontSize = '13px';
        td.textContent = 'Загрузка курсов…';
        trLoad.appendChild(td);
        tbody.appendChild(trLoad);
      }
      if (hwHost) {
        hwHost.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Загрузка…';
        hwHost.appendChild(p);
      }
      if (actHost) {
        actHost.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Загрузка…';
        actHost.appendChild(p);
      }

      const y = expertDashboardYear;
      const m = expertDashboardMonth;
      const q = `year=${encodeURIComponent(String(y))}&month=${encodeURIComponent(String(m))}`;
      const monthTitle = formatDashMonthTitle(y, m);

      let dash: ExpertDashboardResponseV1 | null = null;
      let dashLoadErr: string | null = null;
      try {
        dash = await fetchJson<ExpertDashboardResponseV1>(
          `/experts/${encodeURIComponent(eid)}/dashboard?${q}&limit=5`,
          token,
        );
      } catch (e) {
        dashLoadErr = e instanceof Error ? e.message : String(e);
      }

      let coursesRes: ListExpertCoursesDashboardResponseV1 = { items: [] };
      let coursesLoadErr: string | null = null;
      try {
        coursesRes = await fetchJson<ListExpertCoursesDashboardResponseV1>(
          `/experts/${encodeURIComponent(eid)}/courses/dashboard?limit=100`,
          token,
        );
      } catch (e) {
        coursesLoadErr = e instanceof Error ? e.message : String(e);
      }

      if (sub) {
        const base = `Добро пожаловать, ${greet} · ${monthTitle}`;
        if (dashLoadErr && coursesLoadErr) {
          sub.textContent = `${base} — курсы: ${coursesLoadErr}; сводка: ${dashLoadErr}`;
        } else if (dashLoadErr) {
          sub.textContent = `${base} — сводка за месяц: ${dashLoadErr}`;
        } else {
          sub.textContent = base;
        }
      }

      const canHw = canReviewHomework();

      if (dash) {
        if (stStudents) stStudents.textContent = formatRubDash(dash.students.totalUnique);
        if (stStudentsDelta) {
          const n = dash.students.newEnrollmentsInMonth ?? 0;
          stStudentsDelta.textContent = `↑ +${n} за месяц`;
          stStudentsDelta.className = 'delta delta-up';
        }

        if (stRefLbl) stRefLbl.textContent = formatDashReferralLbl(y, m);
        if (stRefRub) stRefRub.textContent = `${formatRubDash(dash.referral.totalRubInMonth)}\u00a0₽`;
        if (stRefDelta) {
          const dRub = dash.referral.deltaRubVsPreviousMonth ?? 0;
          const abs = Math.abs(Math.round(dRub));
          const fmt = formatRubDash(abs);
          if (dRub > 0) {
            stRefDelta.textContent = `↑ +${fmt}\u00a0₽`;
            stRefDelta.className = 'delta delta-up';
            stRefDelta.style.color = '';
          } else if (dRub < 0) {
            stRefDelta.textContent = `↓ −${fmt}\u00a0₽`;
            stRefDelta.className = 'delta delta-dn';
            stRefDelta.style.color = '';
          } else {
            stRefDelta.textContent = `0\u00a0₽`;
            stRefDelta.className = 'delta';
            stRefDelta.style.color = 'var(--t3)';
          }
        }

        if (stPub) stPub.textContent = formatRubDash(dash.courses.publishedCount);
        if (stDrafts) {
          const dr = dash.courses.draftCount ?? 0;
          stDrafts.textContent = `${dr} ${pluralRu(dr, ['черновик', 'черновика', 'черновиков'])}`;
          stDrafts.style.color = 'var(--t3)';
        }

        if (stHwPend) {
          if (canHw) {
            stHwPend.textContent = formatRubDash(dash.homework.pendingInMonth);
          } else {
            stHwPend.textContent = '—';
          }
        }
        if (stHwNew) {
          if (!canHw) {
            stHwNew.textContent = 'Нужна роль «Куратор» или выше';
            stHwNew.className = 'delta';
            stHwNew.style.color = 'var(--t3)';
          } else {
            stHwNew.style.color = '';
            const nt = dash.homework.newTodayUtc ?? 0;
            if (nt > 0) {
              stHwNew.textContent = `↑ ${nt} ${pluralRu(nt, ['новое', 'новых', 'новых'])} сегодня (UTC)`;
              stHwNew.className = 'delta delta-up';
            } else {
              stHwNew.textContent = 'Нет новых сегодня (UTC)';
              stHwNew.className = 'delta';
              stHwNew.style.color = 'var(--t3)';
            }
          }
        }

        if (hwCard) hwCard.style.display = '';
      } else {
        const itemsFB = coursesRes.items ?? [];
        const pubN = itemsFB.filter((it) => it.status === 'published').length;
        const drN = itemsFB.filter((it) => it.status === 'draft').length;
        if (stStudents) stStudents.textContent = '—';
        if (stStudentsDelta) {
          stStudentsDelta.textContent = '—';
          stStudentsDelta.className = 'delta';
          stStudentsDelta.style.color = 'var(--t3)';
        }
        if (stRefLbl) stRefLbl.textContent = formatDashReferralLbl(y, m);
        if (stRefRub) stRefRub.textContent = '—';
        if (stRefDelta) {
          stRefDelta.textContent = '—';
          stRefDelta.className = 'delta';
          stRefDelta.style.color = 'var(--t3)';
        }
        if (stPub) stPub.textContent = String(pubN);
        if (stDrafts) {
          stDrafts.textContent = `${drN} ${pluralRu(drN, ['черновик', 'черновика', 'черновиков'])}`;
          stDrafts.style.color = 'var(--t3)';
        }
        if (stHwPend) stHwPend.textContent = '—';
        if (stHwNew) {
          if (!canHw) {
            stHwNew.textContent = 'Нужна роль «Куратор» или выше';
            stHwNew.className = 'delta';
            stHwNew.style.color = 'var(--t3)';
          } else {
            stHwNew.textContent = 'Сводка за месяц недоступна';
            stHwNew.className = 'delta';
            stHwNew.style.color = 'var(--t3)';
          }
        }
        if (hwCard) hwCard.style.display = '';
      }

      if (tbody) {
        tbody.replaceChildren();
        if (coursesLoadErr) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 4;
          td.style.color = 'var(--err)';
          td.style.fontSize = '13px';
          td.textContent = `Не удалось загрузить курсы (${coursesLoadErr}).`;
          tr.appendChild(td);
          tbody.appendChild(tr);
        } else {
          const items = coursesRes.items ?? [];
          if (items.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.style.color = 'var(--t3)';
            td.style.fontSize = '13px';
            td.textContent = 'У вас пока нет курсов.';
            tr.appendChild(td);
            tbody.appendChild(tr);
          } else {
            for (const it of items) {
              const tr = document.createElement('tr');
              const tdTitle = document.createElement('td');
              tdTitle.textContent = (it.title || '—').trim() || '—';
              const tdStud = document.createElement('td');
              tdStud.textContent = String(it.activeStudentsCount ?? 0);
              const tdSt = document.createElement('td');
              const st = expertDashboardCourseStatusUi(it.status);
              const tag = document.createElement('span');
              tag.className = st.cls;
              tag.textContent = st.label;
              tdSt.appendChild(tag);
              const tdAct = document.createElement('td');
              tdAct.className = 'tbl-col-center';
              const wrap = document.createElement('div');
              wrap.style.display = 'inline-flex';
              wrap.style.gap = '4px';
              const bEdit = document.createElement('button');
              bEdit.type = 'button';
              bEdit.className = 'btn btn-ghost btn-sm btn-icon';
              bEdit.textContent = '✏️';
              bEdit.setAttribute('aria-label', 'Редактировать');
              bEdit.dataset.epEDashboardCourseEdit = '1';
              bEdit.dataset.epExpertEditorCourseId = it.id;
              bEdit.dataset.epExpertEditorExpertId = it.expertId;
              wrap.appendChild(bEdit);
              if (it.status === 'published') {
                const bEye = document.createElement('button');
                bEye.type = 'button';
                bEye.className = 'btn btn-ghost btn-sm btn-icon';
                bEye.textContent = '👁';
                bEye.setAttribute('aria-label', 'Предпросмотр');
                bEye.dataset.epEDashboardCoursePreview = '1';
                bEye.dataset.epExpertEditorCourseId = it.id;
                wrap.appendChild(bEye);
              }
              tdAct.appendChild(wrap);
              tr.append(tdTitle, tdStud, tdSt, tdAct);
              tbody.appendChild(tr);
            }
          }
        }
      }

      if (dash) {
        if (hwHost) {
          hwHost.replaceChildren();
          if (!canHw) {
            const p = document.createElement('div');
            p.style.color = 'var(--t3)';
            p.style.fontSize = '12px';
            p.textContent = 'Блок доступен ролям «Куратор», «Менеджер» и «Владелец».';
            hwHost.appendChild(p);
          } else {
            const previews = dash.homework.previewItems ?? [];
            if (previews.length === 0) {
              const p = document.createElement('div');
              p.style.color = 'var(--t3)';
              p.style.fontSize = '12px';
              p.textContent = 'Нет заданий за выбранный месяц.';
              hwHost.appendChild(p);
            } else {
              for (const it of previews) {
                const card = document.createElement('div');
                card.className = 'hw-card';
                card.style.cursor = 'pointer';
                card.dataset.epEDashboardHwPick = it.submissionId;

                const av = document.createElement('div');
                av.className = 'avatar av-sm';
                av.style.overflow = 'hidden';
                const disp = homeworkDisplayName({
                  firstName: it.studentFirstName,
                  lastName: it.studentLastName,
                  username: it.studentUsername,
                });
                applyUserAvatarToElement(av, it.studentAvatarUrl, initialsFromName(disp));

                const body = document.createElement('div');
                body.className = 'hw-card-body';
                const top = document.createElement('div');
                top.className = 'hw-card-top';
                const nm = document.createElement('span');
                nm.className = 'hw-card-name';
                nm.textContent = disp;
                const tg = document.createElement('span');
                const tu = homeworkUiTag(it.uiStatus);
                tg.className = tu.cls;
                tg.textContent = tu.label;
                const time = document.createElement('span');
                time.className = 'hw-card-time';
                time.textContent = formatRelativeTime(it.createdAt);
                top.append(nm, tg, time);
                const lesson = document.createElement('div');
                lesson.className = 'hw-card-lesson';
                lesson.textContent = `${(it.courseTitle || '—').trim() || '—'} · ${(it.moduleTitle || '—').trim() || '—'} · ${(it.lessonTitle || '—').trim() || '—'}`;
                const prev = document.createElement('div');
                prev.className = 'hw-card-preview';
                prev.textContent = (it.answerPreview ?? '').trim() || '—';
                body.append(top, lesson, prev);
                card.append(av, body);
                hwHost.appendChild(card);
              }
            }
          }
        }

        if (actHost) {
          actHost.replaceChildren();
          const items = dash.activity.items ?? [];
          if (items.length === 0) {
            const p = document.createElement('div');
            p.style.color = 'var(--t3)';
            p.style.fontSize = '12px';
            p.textContent = 'Нет событий за выбранный месяц.';
            actHost.appendChild(p);
          } else {
            for (const it of items) {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.gap = '10px';
              row.style.padding = '10px 0';
              row.style.borderBottom = '1px solid var(--line)';
              const av = document.createElement('div');
              av.className = 'avatar av-sm';
              av.style.overflow = 'hidden';
              applyUserAvatarToElement(av, it.actorAvatarUrl, (it.actorInitials || '—').slice(0, 2));
              const body = document.createElement('div');
              body.style.flex = '1';
              body.style.minWidth = '0';
              const top = document.createElement('div');
              top.style.display = 'flex';
              top.style.alignItems = 'center';
              top.style.gap = '6px';
              top.style.flexWrap = 'wrap';
              const name = document.createElement('span');
              name.style.fontSize = '12px';
              name.style.fontWeight = '600';
              name.style.color = 'var(--t1)';
              name.textContent = it.actorDisplayName;
              const badge = document.createElement('span');
              badge.className = dashboardActivityBadgeClass(it.badgeVariant);
              badge.textContent = it.badgeText;
              const tm = document.createElement('span');
              tm.style.fontFamily = 'var(--fm)';
              tm.style.fontSize = '9px';
              tm.style.color = 'var(--t3)';
              tm.style.marginLeft = 'auto';
              tm.textContent = formatRelativeTime(it.occurredAt);
              top.append(name, badge, tm);
              const desc = document.createElement('div');
              desc.style.fontSize = '12px';
              desc.style.color = 'var(--t2)';
              desc.style.marginTop = '2px';
              desc.textContent = it.description;
              body.append(top, desc);
              row.append(av, body);
              actHost.appendChild(row);
            }
          }
        }
      } else {
        const msg = dashLoadErr ?? 'нет ответа';
        if (hwHost) {
          hwHost.replaceChildren();
          if (!canHw) {
            const p = document.createElement('div');
            p.style.color = 'var(--t3)';
            p.style.fontSize = '12px';
            p.textContent = 'Блок доступен ролям «Куратор», «Менеджер» и «Владелец».';
            hwHost.appendChild(p);
          } else {
            const p = document.createElement('div');
            p.style.color = 'var(--err)';
            p.style.fontSize = '12px';
            p.textContent = `Превью за месяц недоступно (${msg}).`;
            hwHost.appendChild(p);
          }
        }
        if (actHost) {
          actHost.replaceChildren();
          const p = document.createElement('div');
          p.style.color = 'var(--err)';
          p.style.fontSize = '12px';
          p.textContent = `Лента за месяц недоступна (${msg}).`;
          actHost.appendChild(p);
        }
      }
    }

    function expertMemberDisplayName(m: ExpertTeamMemberRowV1): string {
      const n = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
      if (n) return n;
      if (m.username) return `@${m.username}`;
      return 'Участник';
    }

    function expertMemberRoleUi(role: string): { label: string; cls: string } {
      if (role === 'owner') return { label: 'Владелец', cls: 'tag tag-new' };
      if (role === 'manager') return { label: 'Менеджер', cls: 'tag tag-draft' };
      if (role === 'reviewer') return { label: 'Куратор', cls: 'tag tag-live' };
      return { label: 'Поддержка', cls: 'tag' };
    }

    /** Строка «как владелец» — без шестерёнки и без редактирования как обычного участника. */
    function expertTeamMemberIsOwnerLikeRow(
      m: ExpertTeamMemberRowV1,
      createdByUserId: string,
      soleMemberIsThisRow: boolean,
    ): boolean {
      return (
        m.role === 'owner' ||
        m.isWorkspaceCreator === true ||
        (Boolean(createdByUserId) && m.userId === createdByUserId) ||
        soleMemberIsThisRow
      );
    }

    /** «Владелец» — owner, isWorkspaceCreator, created_by, или вы единственный в команде. */
    function expertMemberRoleForRow(
      m: ExpertTeamMemberRowV1,
      createdByUserId: string,
      soleMemberIsThisRow: boolean,
    ): { label: string; cls: string } {
      if (expertTeamMemberIsOwnerLikeRow(m, createdByUserId, soleMemberIsThisRow)) {
        return { label: 'Владелец', cls: 'tag tag-new' };
      }
      return expertMemberRoleUi(m.role);
    }

    function formatExpertLastActivity(iso: string | null | undefined): string {
      if (!iso) return '—';
      try {
        return new Date(iso).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return '—';
      }
    }

    type ExpertStudentsRowV1 = {
      userId: string;
      courseId: string;
      courseTitle: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      username: string | null;
      avatarUrl: string | null;
      streakDays: number;
      lastPlatformVisitAt: string | null;
      progressPercent: number;
      homeworkSubmittedCount: number;
      homeworkAvgScore: number | null;
    };
    type ExpertStudentsResponseV1 = {
      items: ExpertStudentsRowV1[];
      totalUniqueStudents: number;
      activeLast7DaysUnique: number;
      avgCompletionPercent: number | null;
      globalAvgHomeworkScore: number | null;
    };
    let expertStudentsData: ExpertStudentsResponseV1 | null = null;
    let expertStudentsView: 'table' | 'activity' = 'table';
    let expertStudentsActivityLoading = false;
    let expertStudentsSearchTimer: ReturnType<typeof setTimeout> | null = null;
    function expertStudentsDisplayName(s: {
      firstName: string | null;
      lastName: string | null;
      username: string | null;
    }): string {
      const n = [s.lastName, s.firstName].filter(Boolean).join(' ').trim();
      if (n) return n;
      if (s.username) return `@${s.username}`;
      return 'Студент';
    }
    function formatStudentLastActivityRu(iso: string | null): { text: string; useErr: boolean } {
      if (!iso) return { text: '—', useErr: false };
      const ts = Date.parse(iso);
      if (!Number.isFinite(ts)) return { text: '—', useErr: false };
      const diff = Math.max(0, Date.now() - ts);
      const dayMs = 86400000;
      const dFull = Math.floor(diff / dayMs);
      if (dFull >= 1) {
        return {
          text: `${dFull} ${pluralRu(dFull, ['день', 'дня', 'дней'])} назад`,
          useErr: dFull >= 7,
        };
      }
      const totalMin = Math.floor(diff / 60000);
      if (totalMin < 1) return { text: 'только что', useErr: false };
      if (totalMin < 60) {
        return {
          text: `${totalMin} ${pluralRu(totalMin, ['минуту', 'минуты', 'минут'])} назад`,
          useErr: false,
        };
      }
      const h = Math.floor(totalMin / 60);
      const mRem = totalMin - h * 60;
      if (mRem > 0) {
        return {
          text: `${h} ${pluralRu(h, ['час', 'часа', 'часов'])} ${mRem} ${pluralRu(mRem, ['минуту', 'минуты', 'минут'])} назад`,
          useErr: false,
        };
      }
      return { text: `${h} ${pluralRu(h, ['час', 'часа', 'часов'])} назад`, useErr: false };
    }
    function renderEStudentsTbodyFromCache(root: ShadowRoot | null): void {
      const tbody = root?.querySelector('[data-ep-e-students-tbody]') as HTMLElement | null;
      if (!tbody || !expertStudentsData) return;
      const q = (
        (root?.querySelector('[data-ep-e-students-search]') as HTMLInputElement | null)?.value ?? ''
      )
        .trim()
        .toLowerCase();
      let items = expertStudentsData.items ?? [];
      if (q) {
        items = items.filter((it) => {
          const name = expertStudentsDisplayName(it).toLowerCase();
          const em = (it.email ?? '').toLowerCase();
          const ct = (it.courseTitle ?? '').toLowerCase();
          return name.includes(q) || em.includes(q) || ct.includes(q);
        });
      }
      tbody.replaceChildren();
      if (items.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.style.textAlign = 'center';
        td.style.color = 'var(--t3)';
        td.style.fontSize = '12px';
        td.style.padding = '20px 12px';
        td.textContent = expertStudentsData.items.length === 0 ? 'Пока нет зачисленных студентов.' : 'Никого не найдено.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      for (const it of items) {
        const tr = document.createElement('tr');
        const nameStr = expertStudentsDisplayName(it);
        const tdSt = document.createElement('td');
        const rowWrap = document.createElement('div');
        rowWrap.style.display = 'flex';
        rowWrap.style.alignItems = 'center';
        rowWrap.style.gap = '8px';
        const av = document.createElement('div');
        av.className = 'avatar av-sm';
        av.style.overflow = 'hidden';
        applyUserAvatarToElement(av, it.avatarUrl, initialsFromName(nameStr));
        const nameCol = document.createElement('div');
        const h4 = document.createElement('div');
        h4.className = 'td-name';
        h4.textContent = nameStr;
        const em = document.createElement('div');
        em.style.fontSize = '10px';
        em.style.color = 'var(--t3)';
        em.textContent = (it.email ?? '').trim() || '—';
        nameCol.append(h4, em);
        rowWrap.append(av, nameCol);
        tdSt.appendChild(rowWrap);
        const tdCr = document.createElement('td');
        tdCr.textContent = (it.courseTitle ?? '').trim() || '—';
        const tdProg = document.createElement('td');
        const pw = document.createElement('div');
        pw.className = 'prog-wrap';
        pw.style.width = '120px';
        const bar = document.createElement('div');
        bar.className = 'prog-bar';
        const fill = document.createElement('div');
        fill.className = 'prog-fill';
        const pct = Math.max(0, Math.min(100, Math.round(it.progressPercent || 0)));
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);
        const pv = document.createElement('div');
        pv.className = 'prog-val';
        pv.textContent = `${pct}%`;
        pw.append(bar, pv);
        tdProg.appendChild(pw);
        const tdStreak = document.createElement('td');
        if (it.streakDays > 0) {
          if (it.streakDays >= 7) {
            tdStreak.innerHTML = `<span style="color:var(--warn)">🔥</span> ${it.streakDays} дн.`;
          } else {
            tdStreak.textContent = `${it.streakDays} дн.`;
          }
        } else {
          tdStreak.textContent = '—';
        }
        const tdScore = document.createElement('td');
        const sh = document.createElement('div');
        renderStarsInto(sh, it.homeworkAvgScore);
        tdScore.appendChild(sh);
        const tdHw = document.createElement('td');
        const c = it.homeworkSubmittedCount ?? 0;
        if (c > 0) {
          const tag = document.createElement('span');
          tag.className = 'tag tag-new';
          tag.textContent = `${c} сдано`;
          tdHw.appendChild(tag);
        } else {
          tdHw.innerHTML = '<span style="color:var(--t3)">0 сдано</span>';
        }
        const tdAct = document.createElement('td');
        tdAct.style.fontSize = '11px';
        const when = formatStudentLastActivityRu(it.lastPlatformVisitAt);
        tdAct.textContent = when.text;
        tdAct.style.color = when.useErr ? 'var(--err)' : 'var(--t3)';
        tr.append(tdSt, tdCr, tdProg, tdStreak, tdScore, tdHw, tdAct);
        tbody.appendChild(tr);
      }
    }

    function setExpertStudentsView(root: ShadowRoot, view: 'table' | 'activity'): void {
      expertStudentsView = view;
      const tblCard = root.querySelector('[data-ep-e-students-table-card]') as HTMLElement | null;
      const actCard = root.querySelector('[data-ep-e-students-activity-card]') as HTMLElement | null;
      const btn = root.querySelector('[data-ep-e-students-activity-toggle]') as HTMLButtonElement | null;
      if (tblCard) tblCard.style.display = view === 'table' ? '' : 'none';
      if (actCard) actCard.style.display = view === 'activity' ? '' : 'none';
      if (btn) btn.textContent = view === 'activity' ? 'Таблица студентов' : 'Активность студентов';
    }

    function renderExpertStudentsActivity(root: ShadowRoot, items: ExpertDashboardActivityItemV1[]): void {
      const host = root.querySelector('[data-ep-e-students-activity-host]') as HTMLElement | null;
      if (!host) return;
      host.replaceChildren();
      if (items.length === 0) {
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Нет событий за выбранный месяц.';
        host.appendChild(p);
        return;
      }
      for (const it of items) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.padding = '10px 0';
        row.style.borderBottom = '1px solid var(--line)';
        const av = document.createElement('div');
        av.className = 'avatar av-sm';
        av.style.overflow = 'hidden';
        applyUserAvatarToElement(av, it.actorAvatarUrl, (it.actorInitials || '—').slice(0, 2));
        const body = document.createElement('div');
        body.style.flex = '1';
        body.style.minWidth = '0';
        const top = document.createElement('div');
        top.style.display = 'flex';
        top.style.alignItems = 'center';
        top.style.gap = '6px';
        top.style.flexWrap = 'wrap';
        const name = document.createElement('span');
        name.style.fontSize = '12px';
        name.style.fontWeight = '600';
        name.style.color = 'var(--t1)';
        name.textContent = it.actorDisplayName;
        const badge = document.createElement('span');
        badge.className = dashboardActivityBadgeClass(it.badgeVariant);
        badge.textContent = it.badgeText;
        const tm = document.createElement('span');
        tm.style.fontFamily = 'var(--fm)';
        tm.style.fontSize = '9px';
        tm.style.color = 'var(--t3)';
        tm.style.marginLeft = 'auto';
        tm.textContent = formatRelativeTime(it.occurredAt);
        top.append(name, badge, tm);
        const desc = document.createElement('div');
        desc.style.fontSize = '12px';
        desc.style.color = 'var(--t2)';
        desc.style.marginTop = '2px';
        desc.textContent = it.description;
        body.append(top, desc);
        row.append(av, body);
        host.appendChild(row);
      }
    }

    async function hydrateExpertStudentsActivity(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      const host = root.querySelector('[data-ep-e-students-activity-host]') as HTMLElement | null;
      const token = getAccessToken();
      if (!host) return;
      if (!token) {
        host.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Войдите, чтобы видеть активность.';
        host.appendChild(p);
        return;
      }
      if (expertStudentsActivityLoading) return;
      expertStudentsActivityLoading = true;
      try {
        host.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Загрузка…';
        host.appendChild(p);

        const eid = await resolveActiveExpertId();
        if (!eid) throw new Error('нет доступа');
        const y = expertDashboardYear;
        const m = expertDashboardMonth;
        const q = `year=${encodeURIComponent(String(y))}&month=${encodeURIComponent(String(m))}&limit=200`;
        const dash = await fetchJson<ExpertDashboardResponseV1>(
          `/experts/${encodeURIComponent(eid)}/dashboard?${q}`,
          token,
        );
        renderExpertStudentsActivity(root, dash.activity.items ?? []);
      } catch (e) {
        host.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--err)';
        p.style.fontSize = '12px';
        p.textContent = `Не удалось загрузить активность (${e instanceof Error ? e.message : String(e)}).`;
        host.appendChild(p);
      } finally {
        expertStudentsActivityLoading = false;
      }
    }
    async function hydrateExpertStudents(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      setExpertStudentsView(root, expertStudentsView);
      const sub = root.querySelector('[data-ep-e-students-sub]') as HTMLElement | null;
      const stTotal = root.querySelector('[data-ep-e-students-stat-total]') as HTMLElement | null;
      const stAct = root.querySelector('[data-ep-e-students-stat-active]') as HTMLElement | null;
      const stAvg = root.querySelector('[data-ep-e-students-stat-avg]') as HTMLElement | null;
      const stHw = root.querySelector('[data-ep-e-students-stat-hw]') as HTMLElement | null;
      const sideBadge = root.querySelector('[data-ep-e-students-count]') as HTMLElement | null;
      const token = getAccessToken();
      if (!token) {
        expertStudentsData = null;
        if (sub) sub.textContent = 'Войдите, чтобы видеть студентов.';
        if (stTotal) stTotal.textContent = '—';
        if (stAct) stAct.textContent = '—';
        if (stAvg) stAvg.textContent = '—';
        if (stHw) renderStarsInto(stHw, null);
        if (sideBadge) {
          sideBadge.textContent = '';
          sideBadge.style.display = 'none';
        }
        const tbody = root.querySelector('[data-ep-e-students-tbody]') as HTMLElement | null;
        if (tbody) {
          tbody.replaceChildren();
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 7;
          td.style.textAlign = 'center';
          td.style.color = 'var(--t3)';
          td.style.padding = '20px 12px';
          td.textContent = 'Войдите, чтобы видеть список.';
          tr.appendChild(td);
          tbody.appendChild(tr);
        }
        return;
      }
      if (stTotal) stTotal.textContent = '…';
      if (stAct) stAct.textContent = '…';
      if (stAvg) stAvg.textContent = '…';
      if (stHw) stHw.textContent = '…';
      const eid = await resolveActiveExpertId();
      if (!eid) {
        expertStudentsData = null;
        if (sub) sub.textContent = 'Нет доступа к курсу эксперта.';
        if (stTotal) stTotal.textContent = '—';
        if (stAct) stAct.textContent = '—';
        if (stAvg) stAvg.textContent = '—';
        if (stHw) renderStarsInto(stHw, null);
        if (sideBadge) {
          sideBadge.textContent = '';
          sideBadge.style.display = 'none';
        }
        return;
      }
      try {
        const data = await fetchJson<ExpertStudentsResponseV1>(
          `/experts/${encodeURIComponent(eid)}/students`,
          token,
        );
        expertStudentsData = data;
        const total = data.totalUniqueStudents ?? 0;
        if (sub) {
          sub.textContent = `${total} ${pluralRu(total, ['студент', 'студента', 'студентов'])} во всех курсах`;
        }
        if (stTotal) stTotal.textContent = String(total);
        if (stAct) stAct.textContent = String(data.activeLast7DaysUnique ?? 0);
        if (stAvg) {
          const a = data.avgCompletionPercent;
          stAvg.textContent =
            a == null || !Number.isFinite(a) ? '—' : Math.abs(a - Math.round(a)) < 1e-6 ? `${Math.round(a)}%` : `${a.toFixed(1)}%`;
        }
        if (stHw) {
          const g = data.globalAvgHomeworkScore;
          renderStarsInto(stHw, g == null || !Number.isFinite(g) ? null : g);
        }
        if (sideBadge) {
          if (total > 0) {
            sideBadge.textContent = String(total);
            sideBadge.style.display = '';
          } else {
            sideBadge.textContent = '';
            sideBadge.style.display = 'none';
          }
        }
        renderEStudentsTbodyFromCache(root);
        if (expertStudentsView === 'activity') void hydrateExpertStudentsActivity(root);
      } catch {
        expertStudentsData = null;
        if (sub) sub.textContent = 'Не удалось загрузить список.';
        if (stTotal) stTotal.textContent = '—';
        if (stAct) stAct.textContent = '—';
        if (stAvg) stAvg.textContent = '—';
        if (stHw) renderStarsInto(stHw, null);
        if (sideBadge) {
          sideBadge.textContent = '';
          sideBadge.style.display = 'none';
        }
        const tbody = root.querySelector('[data-ep-e-students-tbody]') as HTMLElement | null;
        if (tbody) {
          tbody.replaceChildren();
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 7;
          td.style.textAlign = 'center';
          td.style.color = 'var(--err)';
          td.style.fontSize = '12px';
          td.style.padding = '20px 12px';
          td.textContent = 'Ошибка загрузки. Обновите страницу.';
          tr.appendChild(td);
          tbody.appendChild(tr);
        }
      }
    }

    shell.shadowRoot.addEventListener('input', (ev) => {
      const inp = ev.target as HTMLInputElement | null;
      if (inp?.matches?.('[data-ep-e-students-search]')) {
        if (expertStudentsSearchTimer) clearTimeout(expertStudentsSearchTimer);
        expertStudentsSearchTimer = setTimeout(() => {
          renderEStudentsTbodyFromCache(shell.shadowRoot);
        }, 200);
      }
    });

    async function hydrateExpertTeam(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      const tbody = root.querySelector('[data-ep-expert-team-tbody]') as HTMLElement | null;
      if (!tbody) return;
      const token = getAccessToken();
      if (!token) {
        expertTeamLastRows = [];
        expertTeamCreatedByUserId = null;
        expertTeamSoleMemberIsMe = false;
        syncExpertTeamOwnerButton(root);
        tbody.replaceChildren();
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.textAlign = 'center';
        td.style.color = 'var(--t3)';
        td.style.padding = '20px';
        td.textContent = 'Войдите, чтобы видеть команду.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      const eid = await resolveActiveExpertId();
      if (!eid) {
        expertTeamLastRows = [];
        expertTeamCreatedByUserId = null;
        expertTeamSoleMemberIsMe = false;
        syncExpertTeamOwnerButton(root);
        tbody.replaceChildren();
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.textAlign = 'center';
        td.style.color = 'var(--t3)';
        td.style.padding = '20px';
        td.textContent = 'Нет доступа к команде эксперта.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      tbody.replaceChildren();
      const loading = document.createElement('tr');
      const ltd = document.createElement('td');
      ltd.colSpan = 5;
      ltd.style.textAlign = 'center';
      ltd.style.color = 'var(--t3)';
      ltd.style.padding = '20px';
      ltd.textContent = 'Загрузка…';
      loading.appendChild(ltd);
      tbody.appendChild(loading);
      try {
        const data = await fetchJson<ListExpertTeamResponseV1>(
          `/experts/${encodeURIComponent(eid)}/team/members`,
          token,
        );
        expertTeamCreatedByUserId = data.createdByUserId ?? null;
        const items = data.items ?? [];
        let selfId = currentMe?.id ?? '';
        if (!selfId) {
          try {
            const meRes = await fetchJson<{ user?: MeUserV1 }>('/me', token);
            if (meRes.user) {
              currentMe = meRes.user;
              selfId = meRes.user.id;
            }
          } catch {
            // остаёмся без selfId — без «это вы» в колонке роли
          }
        }
        const meFromTeam = selfId ? items.find((x) => x.userId === selfId) : undefined;
        expertWorkspaceIsCreator = meFromTeam?.isWorkspaceCreator === true;
        expertTeamSoleMemberIsMe =
          items.length === 1 && Boolean(selfId) && items[0]!.userId === selfId;
        expertTeamLastRows = items;
        syncExpertTeamOwnerButton(root);
        tbody.replaceChildren();
        const createdBy = data.createdByUserId ?? '';
        if (items.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 5;
          td.style.textAlign = 'center';
          td.style.color = 'var(--t3)';
          td.style.padding = '18px';
          td.textContent = 'В команде пока нет участников.';
          tr.appendChild(td);
          tbody.appendChild(tr);
          syncExpertTeamOwnerButton(root);
          return;
        }
        for (const m of items) {
          const tr = document.createElement('tr');
          const name = expertMemberDisplayName(m);
          const nameInitials = initialsFromName(name);
          const isSelf = Boolean(selfId && m.userId === selfId);
          const soleThis =
            items.length === 1 && Boolean(selfId) && m.userId === selfId;
          const roleUi = expertMemberRoleForRow(m, createdBy, soleThis);
          const email = (m.email ?? '').trim();

          const td1 = document.createElement('td');
          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.gap = '8px';
          const av = document.createElement('div');
          av.className = 'avatar av-sm';
          av.style.overflow = 'hidden';
          const rawAv = (m as { avatarUrl?: string | null; avatar_url?: string | null }).avatarUrl;
          const rawSnake = (m as { avatar_url?: string | null }).avatar_url;
          applyUserAvatarToElement(av, rawAv ?? rawSnake ?? null, nameInitials);
          const nameCol = document.createElement('div');
          nameCol.style.minWidth = '0';
          nameCol.style.flex = '1';
          const nameRow = document.createElement('div');
          nameRow.style.display = 'flex';
          nameRow.style.alignItems = 'center';
          nameRow.style.justifyContent = 'space-between';
          nameRow.style.gap = '6px';
          nameRow.style.minWidth = '0';
          const nm = document.createElement('div');
          nm.className = 'td-name';
          nm.style.flex = '1';
          nm.style.minWidth = '0';
          nm.textContent = name;
          nameRow.appendChild(nm);
          const em = document.createElement('div');
          em.style.fontSize = '10px';
          em.style.color = 'var(--t3)';
          em.textContent = email || '—';
          nameCol.append(nameRow, em);
          wrap.append(av, nameCol);
          td1.appendChild(wrap);

          const td2 = document.createElement('td');
          if (isSelf) {
            const you = document.createElement('span');
            you.className = 'ep-team-role-you';
            you.textContent = 'это вы';
            td2.appendChild(you);
          } else {
            const tag = document.createElement('span');
            tag.className = roleUi.cls;
            tag.textContent = roleUi.label;
            td2.appendChild(tag);
          }

          const td3 = document.createElement('td');
          td3.style.color = 'var(--t2)';
          td3.textContent = m.coursesLabel ?? '—';

          const td4 = document.createElement('td');
          td4.style.color = 'var(--t3)';
          td4.style.fontSize = '11px';
          td4.textContent = formatExpertLastActivity(m.lastActivityAt);

          const td5 = document.createElement('td');
          td5.style.textAlign = 'right';
          if (
            canManageExpertTeam() &&
            !expertTeamMemberIsOwnerLikeRow(m, createdBy, soleThis)
          ) {
            const gear = document.createElement('button');
            gear.type = 'button';
            gear.className = 'btn btn-ghost ep-team-member-gear';
            gear.setAttribute('data-ep-team-member-edit', '');
            gear.dataset.epTeamMemberUserId = m.userId;
            gear.setAttribute('aria-label', 'Настройки участника');
            gear.textContent = '⚙';
            td5.appendChild(gear);
          }
          tr.append(td1, td2, td3, td4, td5);
          tbody.appendChild(tr);
        }
      } catch {
        tbody.replaceChildren();
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.textAlign = 'center';
        td.style.color = 'var(--err)';
        td.style.padding = '18px';
        td.textContent = 'Не удалось загрузить команду.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        expertTeamLastRows = [];
        expertTeamCreatedByUserId = null;
        expertTeamSoleMemberIsMe = false;
        syncExpertTeamOwnerButton(root);
      }
    }

    type ExpertHomeworkInboxItem = {
      submissionId: string;
      lessonId: string;
      assignmentId: string;
      studentId: string;
      createdAt: string;
      studentFirstName: string | null;
      studentLastName: string | null;
      studentUsername: string | null;
      studentEmail: string | null;
      studentAvatarUrl: string | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
      answerPreview: string;
      submissionStatus: 'submitted' | 'rework' | 'accepted';
      isOpened: boolean;
      uiStatus: 'new' | 'unchecked' | 'checked';
    };

    type ExpertHomeworkDetail = {
      submission: {
        id: string;
        lessonId: string;
        studentId: string;
        createdAt: string;
        text?: string | null;
        fileKey?: string | null;
        status: 'submitted' | 'rework' | 'accepted';
        score?: number | null;
        reviewerComment?: string | null;
      };
      assignmentPromptMarkdown: string | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
      student: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        username: string | null;
        email: string | null;
        avatarUrl: string | null;
      };
    };

    let expertHomeworkFilter: 'all' | 'new' | 'unchecked' | 'checked' = 'all';
    let expertHomeworkInboxCache: ExpertHomeworkInboxItem[] = [];
    let expertHomeworkSelectedSubmissionId: string | null = null;
    let expertHomeworkSelectedLessonId: string | null = null;
    let expertHomeworkStars: number = 5;

    function canReviewHomework(): boolean {
      return (
        expertWorkspaceMyRole === 'reviewer' ||
        expertWorkspaceMyRole === 'manager' ||
        expertWorkspaceMyRole === 'owner'
      );
    }

    async function hydrateExpertHomeworkBadge(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      const el = root.querySelector('[data-ep-e-homework-badge]') as HTMLElement | null;
      if (!el) return;
      const clear = () => {
        el.textContent = '';
        el.style.display = 'none';
      };
      if (!getAccessToken() || !expertShellAccess.allowed) {
        clear();
        return;
      }
      if (!canReviewHomework()) {
        clear();
        return;
      }
      const eid = await resolveActiveExpertId();
      if (!eid) {
        clear();
        return;
      }
      try {
        const tok = getAccessToken();
        if (!tok) {
          clear();
          return;
        }
        const r = await fetchJson<{ count?: number }>(
          `/experts/${encodeURIComponent(eid)}/homework/pending-count`,
          tok,
        );
        const n = Math.max(0, Math.floor(Number(r.count ?? 0) || 0));
        if (n > 0) {
          el.textContent = String(n);
          el.style.display = '';
        } else {
          clear();
        }
      } catch {
        clear();
      }
    }

    function formatRelativeTime(iso: string): string {
      const ts = Date.parse(iso);
      if (!Number.isFinite(ts)) return '—';
      const diff = Math.max(0, Date.now() - ts);
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'только что';
      if (m < 60) return `${m} мин`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h} ч`;
      const d = Math.floor(h / 24);
      return `${d} дн`;
    }

    function homeworkUiTag(ui: 'new' | 'unchecked' | 'checked'): { label: string; cls: string } {
      if (ui === 'checked') return { label: 'Проверено', cls: 'tag tag-live' };
      if (ui === 'unchecked') return { label: 'Не проверено', cls: 'tag tag-draft' };
      return { label: 'Новое', cls: 'tag tag-new' };
    }

    function homeworkDisplayName(u: { firstName: string | null; lastName: string | null; username: string | null }): string {
      const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      if (n) return n;
      if (u.username) return `@${u.username}`;
      return 'Студент';
    }

    function setHomeworkDetailEmpty(root: ShadowRoot, text: string): void {
      const host = root.querySelector('[data-ep-e-homework-detail]') as HTMLElement | null;
      const nameEl = root.querySelector('[data-ep-e-homework-detail-name]') as HTMLElement | null;
      const metaEl = root.querySelector('[data-ep-e-homework-detail-meta]') as HTMLElement | null;
      const promptEl = root.querySelector('[data-ep-e-homework-detail-prompt]') as HTMLElement | null;
      const ansEl = root.querySelector('[data-ep-e-homework-detail-answer]') as HTMLElement | null;
      const st = root.querySelector('[data-ep-e-homework-detail-status]') as HTMLElement | null;
      const fileRow = root.querySelector('[data-ep-e-homework-detail-file]') as HTMLElement | null;
      const ta = root.querySelector('[data-ep-e-homework-comment]') as HTMLTextAreaElement | null;
      if (nameEl) nameEl.textContent = '—';
      if (metaEl) metaEl.textContent = '—';
      if (promptEl) promptEl.textContent = text;
      if (ansEl) ansEl.textContent = '';
      if (st) {
        st.className = 'tag';
        st.textContent = '—';
      }
      if (fileRow) fileRow.style.display = 'none';
      if (ta) ta.value = '';
      if (host) host.scrollTop = 0;
    }

    function syncHomeworkFilterButtons(root: ShadowRoot): void {
      root.querySelectorAll<HTMLButtonElement>('[data-ep-e-homework-filter]').forEach((b) => {
        const v = (b.dataset.epEHomeworkFilter ?? '').trim() as any;
        const on = v === expertHomeworkFilter;
        b.classList.toggle('btn-primary', on);
        b.classList.toggle('btn-outline', !on);
      });
    }

    function renderHomeworkInbox(root: ShadowRoot): void {
      const host = root.querySelector('[data-ep-e-homework-list]') as HTMLElement | null;
      if (!host) return;
      host.replaceChildren();
      const items = expertHomeworkInboxCache ?? [];
      if (items.length === 0) {
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.style.padding = '12px';
        p.textContent = 'Нет домашних заданий.';
        host.appendChild(p);
        return;
      }

      for (const it of items) {
        const card = document.createElement('div');
        card.className = 'hw-card';
        if (it.submissionId === expertHomeworkSelectedSubmissionId) card.classList.add('active');
        card.dataset.epEHomeworkSubmissionId = it.submissionId;
        card.dataset.epEHomeworkLessonId = it.lessonId;

        const av = document.createElement('div');
        av.className = 'avatar av-sm';
        av.style.overflow = 'hidden';
        const disp = homeworkDisplayName({
          firstName: it.studentFirstName,
          lastName: it.studentLastName,
          username: it.studentUsername,
        });
        const uRow = it as { studentAvatarUrl?: string | null; student_avatar_url?: string | null };
        const rawStuAv =
          typeof uRow.studentAvatarUrl === 'string' && uRow.studentAvatarUrl.trim()
            ? uRow.studentAvatarUrl
            : typeof uRow.student_avatar_url === 'string' && uRow.student_avatar_url.trim()
              ? uRow.student_avatar_url
              : null;
        applyUserAvatarToElement(av, rawStuAv, initialsFromName(disp));

        const body = document.createElement('div');
        body.className = 'hw-card-body';

        const top = document.createElement('div');
        top.className = 'hw-card-top';
        const nm = document.createElement('span');
        nm.className = 'hw-card-name';
        nm.textContent = disp;
        const tag = document.createElement('span');
        const t = homeworkUiTag(it.uiStatus);
        tag.className = t.cls;
        tag.textContent = t.label;
        const time = document.createElement('span');
        time.className = 'hw-card-time';
        time.textContent = formatRelativeTime(it.createdAt);
        top.append(nm, tag, time);

        const lesson = document.createElement('div');
        lesson.className = 'hw-card-lesson';
        lesson.textContent = `${(it.courseTitle || '—').trim() || '—'} · ${(it.moduleTitle || '—').trim() || '—'} · ${(it.lessonTitle || '—').trim() || '—'}`;

        const prev = document.createElement('div');
        prev.className = 'hw-card-preview';
        prev.textContent = (it.answerPreview ?? '').trim() || '—';

        body.append(top, lesson, prev);
        card.append(av, body);
        host.appendChild(card);
      }
    }

    function syncHomeworkStars(root: ShadowRoot): void {
      root.querySelectorAll<HTMLElement>('[data-ep-e-homework-star]').forEach((b) => {
        const n = Number((b as HTMLElement).dataset.epEHomeworkStar ?? '0') || 0;
        b.classList.toggle('sel', n === expertHomeworkStars);
      });
    }

    async function hydrateExpertHomework(root: ShadowRoot | null): Promise<void> {
      if (!root) return;
      if (!canReviewHomework()) {
        const list = root.querySelector('[data-ep-e-homework-list]') as HTMLElement | null;
        if (list) {
          list.replaceChildren();
          const p = document.createElement('div');
          p.style.color = 'var(--t3)';
          p.style.fontSize = '12px';
          p.style.padding = '12px';
          p.textContent = 'Доступно только ролям «Куратор» или «Менеджер».';
          list.appendChild(p);
        }
        setHomeworkDetailEmpty(root, 'Выберите домашнее задание слева.');
        return;
      }
      const token = getAccessToken();
      const eid = await resolveActiveExpertId();
      if (!token || !eid) return;
      syncHomeworkFilterButtons(root);
      const host = root.querySelector('[data-ep-e-homework-list]') as HTMLElement | null;
      if (host) {
        host.replaceChildren();
        const p = document.createElement('div');
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.style.padding = '12px';
        p.textContent = 'Загрузка…';
        host.appendChild(p);
      }
      try {
        const res = await fetchJson<{ items: ExpertHomeworkInboxItem[] }>(
          `/experts/${encodeURIComponent(eid)}/homework/inbox?filter=${encodeURIComponent(expertHomeworkFilter)}`,
          token,
        );
        const rawItems = (res.items ?? []) as Array<ExpertHomeworkInboxItem & { student_avatar_url?: string | null }>;
        expertHomeworkInboxCache = rawItems.map((row) => ({
          ...row,
          studentAvatarUrl: row.studentAvatarUrl ?? row.student_avatar_url ?? null,
        }));
        // If selected submission no longer in filtered list — reset selection
        if (
          expertHomeworkSelectedSubmissionId &&
          !expertHomeworkInboxCache.some((x) => x.submissionId === expertHomeworkSelectedSubmissionId)
        ) {
          expertHomeworkSelectedSubmissionId = null;
          expertHomeworkSelectedLessonId = null;
        }
        renderHomeworkInbox(root);
        if (!expertHomeworkSelectedSubmissionId && expertHomeworkInboxCache.length > 0) {
          void openExpertHomeworkDetail(root, expertHomeworkInboxCache[0]!.submissionId);
        } else if (!expertHomeworkSelectedSubmissionId) {
          setHomeworkDetailEmpty(root, 'Выберите домашнее задание слева.');
        }
      } catch {
        expertHomeworkInboxCache = [];
        renderHomeworkInbox(root);
        setHomeworkDetailEmpty(root, 'Не удалось загрузить домашние задания.');
      }
      syncHomeworkStars(root);
    }

    async function openExpertHomeworkDetail(root: ShadowRoot, submissionId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveActiveExpertId();
      if (!token || !eid) return;
      expertHomeworkSelectedSubmissionId = submissionId;
      renderHomeworkInbox(root);
      setHomeworkDetailEmpty(root, 'Загрузка…');
      try {
        const d = await fetchJson<ExpertHomeworkDetail>(
          `/experts/${encodeURIComponent(eid)}/homework/submissions/${encodeURIComponent(submissionId)}`,
          token,
        );
        expertHomeworkSelectedLessonId = d.submission.lessonId;

        const av = root.querySelector('[data-ep-e-homework-detail-avatar]') as HTMLElement | null;
        const nameEl = root.querySelector('[data-ep-e-homework-detail-name]') as HTMLElement | null;
        const metaEl = root.querySelector('[data-ep-e-homework-detail-meta]') as HTMLElement | null;
        const statusEl = root.querySelector('[data-ep-e-homework-detail-status]') as HTMLElement | null;
        const promptEl = root.querySelector('[data-ep-e-homework-detail-prompt]') as HTMLElement | null;
        const ansEl = root.querySelector('[data-ep-e-homework-detail-answer]') as HTMLElement | null;
        const fileRow = root.querySelector('[data-ep-e-homework-detail-file]') as HTMLElement | null;
        const fileName = root.querySelector('[data-ep-e-homework-detail-file-name]') as HTMLElement | null;
        const commentTa = root.querySelector('[data-ep-e-homework-comment]') as HTMLTextAreaElement | null;

        const disp = homeworkDisplayName(d.student);
        if (nameEl) nameEl.textContent = disp;
        if (metaEl) metaEl.textContent = `${d.courseTitle} · ${d.moduleTitle} · ${d.lessonTitle}`;
        if (statusEl) {
          const ui = d.submission.status === 'accepted' ? 'checked' : 'unchecked';
          const t = homeworkUiTag(ui);
          statusEl.className = t.cls;
          statusEl.textContent = ui === 'checked' ? 'Проверено' : 'Ожидает проверки';
        }
        if (promptEl) {
          const p = (d.assignmentPromptMarkdown ?? '').trim();
          promptEl.textContent = p || 'Формулировка задания не указана.';
        }
        if (ansEl) {
          ansEl.innerHTML = '';
          const txt = (d.submission.text ?? '').trim();
          ansEl.textContent = txt || '—';
        }

        if (av) {
          const stu = d.student as { avatarUrl?: string | null; avatar_url?: string | null };
          applyUserAvatarToElement(av, stu.avatarUrl ?? stu.avatar_url ?? null, initialsFromName(disp));
        }

        if (fileRow) {
          const k = (d.submission.fileKey ?? '').trim();
          if (!k) {
            fileRow.style.display = 'none';
          } else {
            fileRow.style.display = 'flex';
            if (fileName) fileName.textContent = labelFromSubmissionFileKey(k);
            (fileRow as any).dataset.epEHomeworkFileKey = k;
            (fileRow as any).dataset.epEHomeworkSubmissionId = d.submission.id;
            (fileRow as any).dataset.epEHomeworkLessonId = d.submission.lessonId;
          }
        }

        // Pre-fill comment/stars if already decided with a score
        if (typeof d.submission.score === 'number' && d.submission.score >= 1 && d.submission.score <= 5) {
          expertHomeworkStars = d.submission.score;
        } else {
          expertHomeworkStars = 5;
        }
        if (commentTa) commentTa.value = (d.submission.reviewerComment ?? '').trim();
        syncHomeworkStars(root);

        // Список: после открытия на сервере — «Новое» → «Не проверено» без лишнего refetch
        expertHomeworkInboxCache = expertHomeworkInboxCache.map((x) => {
          if (x.submissionId !== submissionId) return x;
          if (x.submissionStatus === 'accepted') {
            return { ...x, isOpened: true, uiStatus: 'checked' as const };
          }
          return { ...x, isOpened: true, uiStatus: 'unchecked' as const };
        });
        renderHomeworkInbox(root);
      } catch {
        setHomeworkDetailEmpty(root, 'Не удалось загрузить домашнее задание.');
      }
    }

    function closeExpertTeamDrawer(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-team-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-team-drawer]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (dr) dr.style.display = 'none';
      const sg = root.querySelector('[data-ep-team-user-suggest]') as HTMLElement | null;
      if (sg) sg.style.display = 'none';
      expertTeamDrawerEdit = null;
      const search = root.querySelector('[data-ep-team-user-search]') as HTMLInputElement | null;
      if (search) {
        search.readOnly = false;
        search.removeAttribute('readonly');
      }
      const title = root.querySelector('[data-ep-team-drawer-title]') as HTMLElement | null;
      const submitBtn = root.querySelector('[data-ep-team-submit]') as HTMLButtonElement | null;
      const delBtn = root.querySelector('[data-ep-team-drawer-delete]') as HTMLButtonElement | null;
      if (title) title.textContent = 'Добавить участника';
      if (submitBtn) submitBtn.textContent = 'Добавить';
      if (delBtn) delBtn.style.display = 'none';
    }

    function renderExpertTeamUserSuggest(
      root: ShadowRoot,
      items: Array<{ id: string; telegramUserId?: string; username?: string; firstName?: string; lastName?: string }>,
    ): void {
      const hostEl = root.querySelector('[data-ep-team-user-suggest]') as HTMLElement | null;
      if (!hostEl) return;
      hostEl.replaceChildren();
      if (!items.length) {
        hostEl.style.display = 'none';
        return;
      }
      hostEl.style.display = '';
      const card = document.createElement('div');
      card.style.border = '1px solid var(--line)';
      card.style.borderRadius = '12px';
      card.style.background = 'var(--surface)';
      card.style.boxShadow = 'var(--sh2)';
      card.style.overflow = 'hidden';
      items.slice(0, 10).forEach((u) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.width = '100%';
        row.style.padding = '10px 12px';
        row.style.border = 'none';
        row.style.background = 'transparent';
        row.style.cursor = 'pointer';
        row.addEventListener('mouseenter', () => (row.style.background = 'var(--bg2)'));
        row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));
        row.textContent = formatUserTitle(u);
        row.addEventListener('click', () => {
          const inp = root.querySelector('[data-ep-team-user-search]') as HTMLInputElement | null;
          const hid = root.querySelector('[data-ep-team-user-id]') as HTMLInputElement | null;
          if (inp) inp.value = formatUserTitle(u);
          if (hid) hid.value = u.id;
          expertTeamDrawerSelectedUserId = u.id;
          hostEl.style.display = 'none';
        });
        card.appendChild(row);
      });
      hostEl.appendChild(card);
    }

    async function expertTeamSearchUsers(root: ShadowRoot, q: string): Promise<void> {
      if (!canManageExpertTeam()) {
        renderExpertTeamUserSuggest(root, []);
        return;
      }
      const teamSearchInp = root.querySelector('[data-ep-team-user-search]') as HTMLInputElement | null;
      if (teamSearchInp?.readOnly) {
        renderExpertTeamUserSuggest(root, []);
        return;
      }
      const token = getAccessToken();
      if (!token) return;
      const eid = await resolveActiveExpertId();
      if (!eid) return;
      const qq = q.trim();
      if (!qq) {
        renderExpertTeamUserSuggest(root, []);
        return;
      }
      try {
        const res = await fetchJson<{
          items: Array<{ id: string; telegramUserId?: string; username?: string; firstName?: string; lastName?: string }>;
        }>(`/experts/${encodeURIComponent(eid)}/team/users/search?q=${encodeURIComponent(qq)}`, token);
        renderExpertTeamUserSuggest(root, res.items ?? []);
      } catch {
        renderExpertTeamUserSuggest(root, []);
      }
    }

    type ExpertTeamCourseCheckboxSelection = null | 'all' | Set<string>;

    function syncExpertTeamCoursesSelectAllCheckbox(root: ShadowRoot): void {
      const allChk = root.querySelector('[data-ep-team-courses-select-all]') as HTMLInputElement | null;
      const boxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-ep-team-course-id]');
      if (!allChk || boxes.length === 0) {
        if (allChk) allChk.checked = false;
        return;
      }
      let every = true;
      boxes.forEach((cb) => {
        if (!cb.checked) every = false;
      });
      allChk.checked = every;
    }

    async function fillExpertTeamCourseCheckboxes(
      root: ShadowRoot,
      selection: ExpertTeamCourseCheckboxSelection = null,
    ): Promise<void> {
      const host = root.querySelector('[data-ep-team-courses-list]') as HTMLElement | null;
      const allChk = root.querySelector('[data-ep-team-courses-select-all]') as HTMLInputElement | null;
      if (!host) return;
      host.replaceChildren();
      if (allChk) allChk.checked = false;
      const token = getAccessToken();
      if (!token) return;
      const eid = await resolveActiveExpertId();
      if (!eid) return;
      try {
        const data = await fetchJson<ListExpertCoursesDashboardResponseV1>(
          `/experts/${encodeURIComponent(eid)}/courses/dashboard?limit=200`,
          token,
        );
        const items = data.items ?? [];
        if (items.length === 0) {
          const p = document.createElement('div');
          p.style.color = 'var(--t3)';
          p.style.fontSize = '12px';
          p.textContent = 'Нет курсов — сначала создайте курс.';
          host.appendChild(p);
          return;
        }
        for (const c of items) {
          const lab = document.createElement('label');
          lab.style.display = 'flex';
          lab.style.alignItems = 'center';
          lab.style.gap = '8px';
          lab.style.cursor = 'pointer';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.epTeamCourseId = c.id;
          if (selection === 'all') {
            cb.checked = true;
          } else if (selection instanceof Set) {
            cb.checked = selection.has(c.id);
          } else {
            cb.checked = false;
          }
          const span = document.createElement('span');
          span.style.color = 'var(--t2)';
          span.textContent = c.title;
          lab.append(cb, span);
          host.appendChild(lab);
        }
        syncExpertTeamCoursesSelectAllCheckbox(root);
      } catch {
        const p = document.createElement('div');
        p.style.color = 'var(--err)';
        p.style.fontSize = '12px';
        p.textContent = 'Не удалось загрузить список курсов.';
        host.appendChild(p);
      }
    }

    async function openExpertTeamDrawer(root: ShadowRoot): Promise<void> {
      if (!canManageExpertTeam()) return;
      expertTeamDrawerEdit = null;
      const bd = root.querySelector('[data-ep-team-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-team-drawer]') as HTMLElement | null;
      if (!bd || !dr) return;
      bd.style.display = '';
      dr.style.display = '';
      const title = root.querySelector('[data-ep-team-drawer-title]') as HTMLElement | null;
      const submitBtn = root.querySelector('[data-ep-team-submit]') as HTMLButtonElement | null;
      const delBtn = root.querySelector('[data-ep-team-drawer-delete]') as HTMLButtonElement | null;
      if (title) title.textContent = 'Добавить участника';
      if (submitBtn) submitBtn.textContent = 'Добавить';
      if (delBtn) delBtn.style.display = 'none';
      const search = root.querySelector('[data-ep-team-user-search]') as HTMLInputElement | null;
      const hid = root.querySelector('[data-ep-team-user-id]') as HTMLInputElement | null;
      const role = root.querySelector('[data-ep-team-role]') as HTMLSelectElement | null;
      if (search) {
        search.value = '';
        search.readOnly = false;
        search.removeAttribute('readonly');
      }
      if (hid) hid.value = '';
      if (role) role.value = 'reviewer';
      expertTeamDrawerSelectedUserId = null;
      renderExpertTeamUserSuggest(root, []);
      await fillExpertTeamCourseCheckboxes(root, null);
    }

    async function openExpertTeamDrawerEdit(root: ShadowRoot, member: ExpertTeamMemberRowV1): Promise<void> {
      if (!canManageExpertTeam()) return;
      const createdBy = expertTeamCreatedByUserId ?? '';
      const selfId = currentMe?.id ?? '';
      const soleThis =
        expertTeamLastRows.length === 1 && Boolean(selfId) && member.userId === selfId;
      if (expertTeamMemberIsOwnerLikeRow(member, createdBy, soleThis)) return;

      const bd = root.querySelector('[data-ep-team-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-team-drawer]') as HTMLElement | null;
      if (!bd || !dr) return;
      expertTeamDrawerEdit = member;
      bd.style.display = '';
      dr.style.display = '';
      const title = root.querySelector('[data-ep-team-drawer-title]') as HTMLElement | null;
      const submitBtn = root.querySelector('[data-ep-team-submit]') as HTMLButtonElement | null;
      const delBtn = root.querySelector('[data-ep-team-drawer-delete]') as HTMLButtonElement | null;
      if (title) title.textContent = 'Участник команды';
      if (submitBtn) submitBtn.textContent = 'Сохранить';
      if (delBtn) delBtn.style.display = '';

      const search = root.querySelector('[data-ep-team-user-search]') as HTMLInputElement | null;
      const hid = root.querySelector('[data-ep-team-user-id]') as HTMLInputElement | null;
      const role = root.querySelector('[data-ep-team-role]') as HTMLSelectElement | null;
      if (search) {
        search.value = expertMemberDisplayName(member);
        search.readOnly = true;
      }
      if (hid) hid.value = member.userId;
      expertTeamDrawerSelectedUserId = member.userId;
      const r = member.role;
      if (role) {
        if (r === 'reviewer' || r === 'support') role.value = r;
        else role.value = 'reviewer';
      }
      renderExpertTeamUserSuggest(root, []);

      let selection: ExpertTeamCourseCheckboxSelection = new Set();
      if (Array.isArray(member.courseIds) && member.courseIds.length > 0) {
        selection = new Set(member.courseIds);
      }

      await fillExpertTeamCourseCheckboxes(root, selection);
    }

    function builderScreen(root: ShadowRoot): HTMLElement | null {
      return root.getElementById('screen-e-builder');
    }

    async function builderFetchModules(eid: string, cid: string, token: string): Promise<BuilderModuleV1[]> {
      const res = await fetchJson<{ items?: BuilderModuleV1[] }>(
        `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/modules`,
        token,
      );
      return (res.items ?? []).slice().sort((a, b) => a.position - b.position);
    }

    async function builderFetchLessons(eid: string, mid: string, token: string): Promise<BuilderLessonV1[]> {
      const res = await fetchJson<{ items?: BuilderLessonV1[] }>(
        `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons`,
        token,
      );
      return (res.items ?? []).slice().sort((a, b) => a.position - b.position);
    }

    async function builderFetchAttestations(eid: string, cid: string, token: string): Promise<BuilderAttestationV1[]> {
      try {
        const res = await fetchJson<{ items?: BuilderAttestationV1[] }>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/attestations`,
          token,
        );
        return (res.items ?? []).slice().sort((a, b) => {
          if (a.scope !== b.scope) return a.scope === 'module' ? -1 : 1;
          if (a.moduleId !== b.moduleId) return (a.moduleId ?? '') < (b.moduleId ?? '') ? -1 : 1;
          return a.position - b.position;
        });
      } catch {
        return [];
      }
    }

    async function builderLoadCourseData(root: ShadowRoot, eid: string, cid: string, token: string): Promise<void> {
      builderLessonsByModule.clear();
      builderModulesCache = await builderFetchModules(eid, cid, token);
      let totalLessons = 0;
      for (const m of builderModulesCache) {
        const ls = await builderFetchLessons(eid, m.id, token);
        builderLessonsByModule.set(m.id, ls);
        totalLessons += ls.length;
      }
      builderAttestationsCache = await builderFetchAttestations(eid, cid, token);

      const course = await fetchJson<BuilderCourseDetailV1>(
        `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}`,
        token,
      );
      builderCourseDetail = { ...course, id: cid };
      if (course.expertId) expertBuilderExpertId = course.expertId;
      const titleHost = root.querySelector('[data-ep-builder-course-title]');
      const metaHost = root.querySelector('[data-ep-builder-course-meta]');
      const statusHost = root.querySelector('[data-ep-builder-course-status]');
      if (titleHost) titleHost.textContent = course.title;
      if (metaHost) {
        metaHost.textContent = `${builderModulesCache.length} ${pluralRu(builderModulesCache.length, ['модуль', 'модуля', 'модулей'])} · ${totalLessons} ${pluralRu(totalLessons, ['урок', 'урока', 'уроков'])}`;
      }
      if (statusHost) {
        const vis = (course.visibility ?? 'private').trim() || 'private';
        statusHost.textContent = `${course.status} · ${vis}`;
      }
      renderBuilderCertificateButton(root);

      let best: { mid: string; lid: string; t: number } | null = null;
      for (const m of builderModulesCache) {
        for (const l of builderLessonsByModule.get(m.id) ?? []) {
          const ts = Date.parse(l.createdAt);
          if (!Number.isFinite(ts)) continue;
          if (!best || ts >= best.t) best = { mid: m.id, lid: l.id, t: ts };
        }
      }
      if (best) {
        builderSelectedModuleId = best.mid;
        builderSelectedLessonId = best.lid;
      } else if (builderModulesCache[0]) {
        builderSelectedModuleId = builderModulesCache[0].id;
        builderSelectedLessonId = null;
      } else {
        builderSelectedModuleId = null;
        builderSelectedLessonId = null;
      }

      renderBuilderModTree(root);
      const aid = builderSelectedAttestationId;
      if (aid && builderAttestationsCache.some((x) => x.id === aid)) {
        await selectBuilderAttestation(root, aid);
      } else {
        if (aid) {
          builderSelectedAttestationId = null;
          builderAttestationDraft = null;
        }
        setBuilderEditorMode(root, 'lesson');
        await applyBuilderLessonToForm(root, eid, token);
      }
    }

    function openBuilderCertificateActionMenu(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-builder-cert-menu-backdrop]') as HTMLElement | null;
      const box = root.querySelector('[data-ep-builder-cert-menu]') as HTMLElement | null;
      if (bd) {
        bd.style.display = 'block';
        bd.setAttribute('aria-hidden', 'false');
      }
      if (box) box.style.display = 'flex';
    }

    function closeBuilderCertificateActionMenu(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-builder-cert-menu-backdrop]') as HTMLElement | null;
      const box = root.querySelector('[data-ep-builder-cert-menu]') as HTMLElement | null;
      if (bd) {
        bd.style.display = 'none';
        bd.setAttribute('aria-hidden', 'true');
      }
      if (box) box.style.display = 'none';
    }

    function renderBuilderCertificateButton(root: ShadowRoot): void {
      const btn = root.querySelector('[data-ep-builder-course-certificate]') as HTMLButtonElement | null;
      const status = root.querySelector('[data-ep-builder-course-certificate-status]') as HTMLElement | null;
      if (!btn) return;
      const uploaded = builderCourseDetail?.certificateUploaded === true;
      btn.textContent = uploaded ? 'Сертификат загружен' : 'Загрузить сертификат';
      btn.classList.toggle('btn-outline', !uploaded);
      btn.classList.toggle('ep-builder-cert-btn--uploaded', uploaded);
      btn.title = uploaded
        ? 'Нажмите, чтобы заменить или удалить PDF сертификата'
        : 'Загрузить PDF сертификата для этого курса';
      if (status) {
        const fname = (builderCourseDetail?.certificateFilename ?? '').trim();
        if (uploaded && fname) {
          status.style.display = '';
          status.textContent = fname;
        } else {
          status.style.display = 'none';
          status.textContent = '';
        }
      }
    }

    async function uploadBuilderCertificate(root: ShadowRoot, file: File): Promise<void> {
      const btn = root.querySelector('[data-ep-builder-course-certificate]') as HTMLButtonElement | null;
      const status = root.querySelector('[data-ep-builder-course-certificate-status]') as HTMLElement | null;
      const tok = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!tok || !eid || !cid) {
        window.alert('Сначала откройте курс в конструкторе.');
        return;
      }
      const isPdfMime = (file.type || '').toLowerCase() === 'application/pdf';
      const isPdfExt = /\.pdf$/i.test(file.name || '');
      if (!isPdfMime && !isPdfExt) {
        window.alert('Можно загрузить только PDF.');
        return;
      }
      const maxBytes = 50 * 1024 * 1024;
      if (file.size > maxBytes) {
        window.alert('PDF слишком большой (максимум 50 МБ).');
        return;
      }
      if (btn) {
        btn.disabled = true;
      }
      if (status) {
        status.style.display = '';
        status.textContent = 'Загружаем…';
      }
      try {
        const form = new FormData();
        form.append('file', file, file.name || 'certificate.pdf');
        const updated = await fetchMultipartJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/certificate/upload`,
          form,
          tok,
        );
        builderCourseDetail = { ...updated, id: cid };
        renderBuilderCertificateButton(root);
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : 'Не удалось загрузить сертификат.';
        window.alert(msg);
        renderBuilderCertificateButton(root);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function deleteBuilderCertificate(root: ShadowRoot): Promise<void> {
      const tok = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!tok || !eid || !cid) return;
      const btn = root.querySelector('[data-ep-builder-course-certificate]') as HTMLButtonElement | null;
      if (btn) btn.disabled = true;
      try {
        const updated = await postJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/certificate/delete`,
          {},
          tok,
        );
        builderCourseDetail = { ...updated, id: cid };
        renderBuilderCertificateButton(root);
      } catch {
        window.alert('Не удалось удалить сертификат.');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    function renderBuilderModTree(root: ShadowRoot): void {
      const host = root.querySelector('[data-ep-builder-mod-tree]') as HTMLElement | null;
      if (!host) return;
      host.replaceChildren();
      for (const m of builderModulesCache) {
        const lessons = builderLessonsByModule.get(m.id) ?? [];
        const item = document.createElement('div');
        item.className = 'mod-item';

        const head = document.createElement('div');
        head.className = 'mod-head';
        head.dataset.epModToggle = '1';
        head.dataset.epBuilderModuleId = m.id;
        const isOpen = builderSelectedModuleId === m.id;
        if (isOpen) head.classList.add('active');
        const arrow = document.createElement('span');
        arrow.className = `mod-arrow${isOpen ? ' open' : ''}`;
        arrow.textContent = '▶';
        const name = document.createElement('span');
        name.className = 'mod-name';
        name.textContent = m.title;
        const cnt = document.createElement('span');
        cnt.className = 'mod-cnt';
        cnt.textContent = String(lessons.length);
        const gear = document.createElement('button');
        gear.type = 'button';
        gear.className = 'btn btn-ghost btn-sm';
        gear.textContent = '⋯';
        gear.style.padding = '4px 8px';
        gear.style.minWidth = '32px';
        gear.style.minHeight = '28px';
        gear.style.lineHeight = '1';
        gear.style.color = 'var(--t3)';
        gear.dataset.epBuilderModuleMenu = '1';
        gear.dataset.epBuilderModuleId = m.id;
        gear.setAttribute('aria-label', 'Действия модуля');
        gear.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openBuilderModuleActions(root, m.id);
        });
        head.append(arrow, name, cnt);
        head.appendChild(gear);

        const box = document.createElement('div');
        box.className = `mod-lessons${isOpen ? ' open' : ''}`;
        for (let li = 0; li < lessons.length; li++) {
          const l = lessons[li]!;
          const row = document.createElement('div');
          row.className = 'lesson-row';
          if (builderSelectedLessonId === l.id && builderEditorMode === 'lesson') row.classList.add('active');
          row.dataset.epBuilderLessonId = l.id;
          row.dataset.epBuilderModuleId = m.id;
          row.draggable = false;
          const dragHandle = document.createElement('span');
          dragHandle.className = 'lesson-row__handle';
          dragHandle.draggable = true;
          dragHandle.title = 'Удерживайте и перетащите — сменить порядок';
          dragHandle.setAttribute('aria-label', 'Перетащить урок');
          dragHandle.textContent = '☰';
          attachBuilderLessonDnd(root, row, m.id, dragHandle);
          const reorderWrap = document.createElement('div');
          reorderWrap.className = 'lesson-row__reorder';
          const upBtn = document.createElement('button');
          upBtn.type = 'button';
          upBtn.textContent = '▲';
          upBtn.title = 'Выше';
          upBtn.dataset.epBuilderLessonMoveUp = '1';
          upBtn.dataset.epBuilderModuleId = m.id;
          upBtn.dataset.epBuilderLessonId = l.id;
          if (li === 0) upBtn.disabled = true;
          const downBtn = document.createElement('button');
          downBtn.type = 'button';
          downBtn.textContent = '▼';
          downBtn.title = 'Ниже';
          downBtn.dataset.epBuilderLessonMoveDown = '1';
          downBtn.dataset.epBuilderModuleId = m.id;
          downBtn.dataset.epBuilderLessonId = l.id;
          if (li >= lessons.length - 1) downBtn.disabled = true;
          reorderWrap.append(upBtn, downBtn);
          const ico = document.createElement('span');
          ico.className = 'lesson-ico';
          ico.textContent = '▶';
          const nm = document.createElement('span');
          nm.className = 'lesson-name';
          nm.textContent = l.hiddenFromStudents ? `${l.title} · скрыт` : l.title;
          const dots = document.createElement('button');
          dots.type = 'button';
          dots.className = 'btn btn-ghost btn-sm';
          dots.textContent = '✕';
          dots.style.padding = '4px 8px';
          dots.style.minWidth = '32px';
          dots.style.minHeight = '28px';
          dots.style.lineHeight = '1';
          dots.style.color = 'var(--err)';
          dots.style.borderColor = 'rgba(220,38,38,0.22)';
          dots.style.background = 'rgba(220,38,38,0.06)';
          dots.dataset.epBuilderLessonDelete = '1';
          dots.dataset.epBuilderLessonId = l.id;
          dots.dataset.epBuilderModuleId = m.id;
          dots.setAttribute('aria-label', 'Удалить урок');
          dots.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            void builderDeleteLesson(root, m.id, l.id);
          });
          row.append(dragHandle, reorderWrap, ico, nm, dots);
          box.appendChild(row);
        }
        for (const a of builderAttestationsCache.filter((x) => x.moduleId === m.id)) {
          box.appendChild(buildBuilderAttestationRow(root, a, 'module'));
        }
        item.append(head, box);
        host.appendChild(item);
      }
      const courseLevel = builderAttestationsCache.filter((x) => x.scope === 'course');
      for (const a of courseLevel) {
        host.appendChild(buildBuilderAttestationRow(root, a, 'course'));
      }
    }

    function buildBuilderAttestationRow(
      root: ShadowRoot,
      a: BuilderAttestationV1,
      level: 'module' | 'course',
    ): HTMLElement {
      const row = document.createElement('div');
      row.className = level === 'course' ? 'attestation-row attestation-row--course' : 'attestation-row';
      row.dataset.epBuilderAttestationId = a.id;
      if (builderSelectedAttestationId === a.id && builderEditorMode === 'attestation') {
        row.classList.add('active');
      }
      const ico = document.createElement('span');
      ico.className = 'lesson-ico';
      ico.textContent = level === 'course' ? '🏁' : '📝';
      const nm = document.createElement('span');
      nm.className = 'lesson-name';
      nm.textContent = a.displayTitle;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm';
      del.textContent = '✕';
      del.style.padding = '4px 8px';
      del.style.minWidth = '32px';
      del.style.minHeight = '28px';
      del.style.lineHeight = '1';
      del.style.color = 'var(--err)';
      del.style.borderColor = 'rgba(220,38,38,0.22)';
      del.style.background = 'rgba(220,38,38,0.06)';
      del.setAttribute('aria-label', 'Удалить аттестацию');
      del.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void builderDeleteAttestation(root, a.id);
      });
      row.append(ico, nm, del);
      row.addEventListener('click', (ev) => {
        ev.preventDefault();
        void selectBuilderAttestation(root, a.id);
      });
      return row;
    }

    async function builderMoveLessonStep(
      root: ShadowRoot,
      moduleId: string,
      lessonId: string,
      delta: -1 | 1,
    ): Promise<void> {
      const list = builderLessonsByModule.get(moduleId) ?? [];
      const idx = list.findIndex((x) => x.id === lessonId);
      if (idx < 0) return;
      const ni = idx + delta;
      if (ni < 0 || ni >= list.length) return;
      const dstLid = list[ni]!.id;
      await builderReorderLessons(root, moduleId, lessonId, dstLid);
    }

    /** Drag-and-drop reorder for lessons inside the same module (HTML5 DnD). */
    function attachBuilderLessonDnd(
      root: ShadowRoot,
      row: HTMLElement,
      moduleId: string,
      dragHandle: HTMLElement,
    ): void {
      dragHandle.addEventListener('dragstart', (ev) => {
        const lessonId = row.dataset.epBuilderLessonId ?? '';
        if (!lessonId) return;
        row.classList.add('lesson-row--dragging');
        try {
          ev.dataTransfer?.setData('application/x-ep-lesson', `${moduleId}:${lessonId}`);
          if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
        } catch {
          /* ignore */
        }
      });
      dragHandle.addEventListener('dragend', () => {
        row.classList.remove('lesson-row--dragging');
        row.classList.remove('lesson-row--drop-target');
      });
      const allowDrop = (ev: DragEvent): boolean => {
        const dt = ev.dataTransfer;
        if (!dt) return false;
        const types = dt.types ? Array.from(dt.types as unknown as string[]) : [];
        return types.includes('application/x-ep-lesson');
      };
      row.addEventListener('dragenter', (ev) => {
        if (!allowDrop(ev)) return;
        ev.preventDefault();
      });
      row.addEventListener('dragover', (ev) => {
        if (!allowDrop(ev)) return;
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        row.classList.add('lesson-row--drop-target');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('lesson-row--drop-target');
      });
      row.addEventListener('drop', (ev) => {
        ev.preventDefault();
        row.classList.remove('lesson-row--drop-target');
        const raw = ev.dataTransfer?.getData('application/x-ep-lesson') ?? '';
        if (!raw) return;
        const [srcMid, srcLid] = raw.split(':');
        if (!srcMid || !srcLid) return;
        if (srcMid !== moduleId) return;
        const dstLid = row.dataset.epBuilderLessonId ?? '';
        if (!dstLid || dstLid === srcLid) return;
        void builderReorderLessons(root, moduleId, srcLid, dstLid);
      });
    }

    async function builderReorderLessons(
      root: ShadowRoot,
      moduleId: string,
      srcLid: string,
      dstLid: string,
    ): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      const lessons = (builderLessonsByModule.get(moduleId) ?? []).slice();
      const srcIdx = lessons.findIndex((x) => x.id === srcLid);
      const dstIdx = lessons.findIndex((x) => x.id === dstLid);
      if (srcIdx < 0 || dstIdx < 0) return;
      const [moved] = lessons.splice(srcIdx, 1);
      lessons.splice(dstIdx, 0, moved);
      builderLessonsByModule.set(moduleId, lessons);
      renderBuilderModTree(root);
      try {
        await postJson(
          `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(moduleId)}/lessons/reorder`,
          { items: lessons.map((l, i) => ({ id: l.id, position: i })) },
          token,
        );
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось изменить порядок уроков (нужна роль менеджера+).');
        await builderLoadCourseData(root, eid, cid, token);
      }
    }

    function openBuilderModuleActions(root: ShadowRoot, moduleId: string): void {
      const bd = root.querySelector('[data-ep-module-actions-backdrop]') as HTMLElement | null;
      const md = root.querySelector('[data-ep-module-actions-modal]') as HTMLElement | null;
      const inp = root.querySelector('[data-ep-module-actions-title]') as HTMLInputElement | null;
      if (!bd || !md || !inp) return;
      builderModuleActionsModuleId = moduleId;
      const cur = builderModulesCache.find((x) => x.id === moduleId)?.title ?? '';
      inp.value = cur;
      bd.style.display = '';
      md.style.display = '';
      try {
        inp.focus();
        inp.select();
      } catch {
        /* ignore */
      }
    }

    function closeBuilderModuleActions(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-module-actions-backdrop]') as HTMLElement | null;
      const md = root.querySelector('[data-ep-module-actions-modal]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (md) md.style.display = 'none';
      builderModuleActionsModuleId = null;
    }

    async function builderRenameModule(root: ShadowRoot, moduleId: string, nextTitle?: string | null): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      const current = builderModulesCache.find((x) => x.id === moduleId)?.title ?? 'Модуль';
      const next =
        typeof nextTitle === 'string'
          ? nextTitle
          : window.prompt('Название модуля', current);
      if (!next || !next.trim() || next.trim() === current) return;
      try {
        await patchJson(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/modules/${encodeURIComponent(moduleId)}`,
          { title: next.trim() },
          token,
        );
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось переименовать модуль (нужна роль менеджера+).');
      }
    }

    async function builderDeleteModule(root: ShadowRoot, moduleId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      const title = builderModulesCache.find((x) => x.id === moduleId)?.title ?? 'модуль';
      if (!window.confirm(`Удалить модуль «${title}»? Уроки внутри будут скрыты.`)) return;
      try {
        await deleteJson(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/modules/${encodeURIComponent(moduleId)}`,
          token,
        );
        if (builderSelectedModuleId === moduleId) {
          builderSelectedModuleId = null;
          builderSelectedLessonId = null;
        }
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось удалить модуль (нужна роль менеджера+).');
      }
    }

    async function builderDeleteLesson(root: ShadowRoot, moduleId: string, lessonId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      const title =
        (builderLessonsByModule.get(moduleId) ?? []).find((x) => x.id === lessonId)?.title ?? 'урок';
      if (!window.confirm(`Удалить урок «${title}»? Он будет скрыт у студентов.`)) return;
      try {
        await deleteJson(
          `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
          token,
        );
        if (builderSelectedLessonId === lessonId) {
          builderSelectedLessonId = null;
        }
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось удалить урок (нужна роль менеджера+).');
      }
    }

    function syncBuilderHomeworkLessonGate(root: ShadowRoot, hasLesson: boolean): void {
      const noLessonEl = root.querySelector('[data-ep-builder-hw-no-lesson]') as HTMLElement | null;
      const workspaceEl = root.querySelector('[data-ep-builder-hw-workspace]') as HTMLElement | null;
      if (noLessonEl) noLessonEl.style.display = hasLesson ? 'none' : '';
      if (workspaceEl) workspaceEl.style.display = hasLesson ? '' : 'none';
    }

    async function applyBuilderLessonToForm(root: ShadowRoot, eid: string, token: string): Promise<void> {
      const titleInp = root.querySelector('[data-ep-builder-lesson-title]') as HTMLInputElement | null;
      const rutubeInp = root.querySelector('[data-ep-builder-rutube]') as HTMLInputElement | null;
      const bodyTa = root.querySelector('[data-ep-builder-lesson-body]') as HTMLTextAreaElement | null;
      const hiddenCb = root.querySelector('[data-ep-builder-lesson-hidden]') as HTMLInputElement | null;
      const presStatus = root.querySelector('[data-ep-builder-presentation-status]') as HTMLElement | null;
      const presPreview = root.querySelector('[data-ep-builder-presentation-preview]') as HTMLElement | null;
      const presRemove = root.querySelector('[data-ep-builder-presentation-remove]') as HTMLElement | null;
      const hwTa = root.querySelector('[data-ep-builder-hw-body]') as HTMLTextAreaElement | null;
      const filesHost = root.querySelector('[data-ep-builder-hw-files]') as HTMLElement | null;
      const forbiddenEl = root.querySelector('[data-ep-builder-hw-forbidden]') as HTMLElement | null;
      const filesEmptyEl = root.querySelector('[data-ep-builder-hw-files-empty]') as HTMLElement | null;
      const hwActions = root.querySelector('[data-ep-builder-hw-actions]') as HTMLElement | null;
      const matsStatus = root.querySelector('[data-ep-builder-materials-status]') as HTMLElement | null;
      const matsEmpty = root.querySelector('[data-ep-builder-materials-empty]') as HTMLElement | null;
      const matsList = root.querySelector('[data-ep-builder-materials-list]') as HTMLElement | null;

      const resetHwEditorState = (): void => {
        if (forbiddenEl) forbiddenEl.style.display = 'none';
        if (hwTa) {
          hwTa.value = '';
          hwTa.disabled = false;
        }
        if (hwActions) {
          hwActions.style.opacity = '';
          hwActions.style.pointerEvents = '';
        }
        if (filesHost) filesHost.replaceChildren();
        if (filesEmptyEl) filesEmptyEl.style.display = '';
      };

      if (!builderSelectedLessonId || !builderSelectedModuleId) {
        if (titleInp) titleInp.value = '';
        if (rutubeInp) rutubeInp.value = '';
        if (bodyTa) bodyTa.value = '';
        if (hiddenCb) hiddenCb.checked = false;
        if (presStatus) {
          presStatus.style.display = 'none';
          presStatus.textContent = '';
        }
        if (presPreview) {
          presPreview.style.display = 'none';
          presPreview.replaceChildren();
        }
        if (presRemove) presRemove.style.display = 'none';
        if (matsStatus) {
          matsStatus.style.display = 'none';
          matsStatus.textContent = '';
        }
        if (matsList) matsList.replaceChildren();
        if (matsEmpty) matsEmpty.style.display = 'none';
        syncBuilderHomeworkLessonGate(root, false);
        resetHwEditorState();
        return;
      }
      const list = builderLessonsByModule.get(builderSelectedModuleId) ?? [];
      const lesson = list.find((x) => x.id === builderSelectedLessonId) ?? null;
      if (!lesson) {
        if (titleInp) titleInp.value = '';
        if (rutubeInp) rutubeInp.value = '';
        if (bodyTa) bodyTa.value = '';
        if (hiddenCb) hiddenCb.checked = false;
        if (presStatus) {
          presStatus.style.display = 'none';
          presStatus.textContent = '';
        }
        if (presPreview) {
          presPreview.style.display = 'none';
          presPreview.replaceChildren();
        }
        if (presRemove) presRemove.style.display = 'none';
        if (matsStatus) {
          matsStatus.style.display = 'none';
          matsStatus.textContent = '';
        }
        if (matsList) matsList.replaceChildren();
        if (matsEmpty) matsEmpty.style.display = 'none';
        syncBuilderHomeworkLessonGate(root, false);
        resetHwEditorState();
        return;
      }

      syncBuilderHomeworkLessonGate(root, true);
      if (titleInp) titleInp.value = lesson.title;
      if (bodyTa) bodyTa.value = lesson.contentMarkdown ?? '';
      if (hiddenCb) hiddenCb.checked = Boolean(lesson.hiddenFromStudents);
      const v = lesson.video;
      if (rutubeInp) rutubeInp.value = v && v.kind === 'rutube' && v.url ? v.url : '';

      // Slider draft cache (for editor modal)
      const slider = (lesson.slider ?? null) as { images?: { key: string }[] } | null;
      if (builderSelectedLessonId) {
        builderSliderByLessonId.set(builderSelectedLessonId, {
          images: Array.isArray(slider?.images) ? slider!.images.filter((x) => x && typeof x.key === 'string') : [],
        });
      }

      // Presentation cache (for preview + quick render)
      if (builderSelectedLessonId) {
        const pres = (lesson.presentation ?? null) as { pptxKey?: string; pdfKey?: string; originalFilename?: string } | null;
        const valid = pres && pres.pptxKey && pres.pdfKey && pres.originalFilename ? {
          pptxKey: String(pres.pptxKey),
          pdfKey: String(pres.pdfKey),
          originalFilename: String(pres.originalFilename),
        } : pres && pres.pdfKey && pres.originalFilename ? {
          pptxKey: pres.pptxKey ? String(pres.pptxKey) : null,
          pdfKey: String(pres.pdfKey),
          originalFilename: String(pres.originalFilename),
        } : null;
        builderPresentationByLessonId.set(builderSelectedLessonId, valid);
        if (presRemove) presRemove.style.display = valid ? '' : 'none';
        if (presPreview) {
          presPreview.replaceChildren();
          if (!valid) {
            presPreview.style.display = 'none';
          } else {
            presPreview.style.display = '';
            void renderPresentationViewer(root, presPreview, valid);
          }
        }
        if (presStatus) {
          presStatus.style.display = 'none';
          presStatus.textContent = '';
        }
      }

      // Lesson materials (files visible to student before homework)
      if (matsList) matsList.replaceChildren();
      if (matsEmpty) matsEmpty.style.display = 'none';
      if (matsStatus) {
        matsStatus.style.display = 'none';
        matsStatus.textContent = '';
      }
      try {
        const m = await fetchJson<{ items?: any[] }>(
          `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lesson.id)}/materials`,
          token,
        );
        const items = Array.isArray(m.items) ? m.items : [];
        const norm = items
          .map((x) => ({
            id: String(x?.id ?? ''),
            lessonId: String(x?.lessonId ?? ''),
            fileKey: String(x?.fileKey ?? ''),
            filename: String(x?.filename ?? ''),
            sizeBytes: typeof x?.sizeBytes === 'number' ? x.sizeBytes : x?.sizeBytes == null ? null : Number(x.sizeBytes),
          }))
          .filter((x) => x.id && x.lessonId && x.fileKey && x.filename);
        builderMaterialsByLessonId.set(lesson.id, norm);
        if (matsEmpty) matsEmpty.style.display = norm.length ? 'none' : '';
        if (matsList && norm.length) {
          for (const f of norm) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.padding = '8px 10px';
            row.style.border = '1px solid var(--line)';
            row.style.borderRadius = '8px';
            row.style.background = 'var(--surface2)';
            const lab = document.createElement('span');
            lab.textContent = f.filename;
            lab.style.overflow = 'hidden';
            lab.style.textOverflow = 'ellipsis';
            lab.style.fontSize = '12px';
            lab.style.color = 'var(--t2)';
            const meta = document.createElement('span');
            meta.textContent = f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} КБ` : 'Файл';
            meta.style.fontFamily = 'var(--fm)';
            meta.style.fontSize = '10px';
            meta.style.color = 'var(--t3)';
            meta.style.marginLeft = '8px';
            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.alignItems = 'center';
            right.style.gap = '6px';
            const dl = document.createElement('button');
            dl.type = 'button';
            dl.className = 'btn btn-outline btn-sm';
            dl.textContent = '⬇';
            dl.dataset.epBuilderMaterialsDlKey = f.fileKey;
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn btn-ghost btn-sm';
            del.textContent = 'Удалить';
            del.dataset.epBuilderMaterialsDelFile = f.id;
            right.append(dl, del);
            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'baseline';
            left.style.flex = '1';
            left.style.minWidth = '0';
            left.append(lab, meta);
            row.append(left, right);
            matsList.appendChild(row);
          }
        }
      } catch {
        if (matsEmpty) matsEmpty.style.display = '';
      }

      resetHwEditorState();
      try {
        const a = await fetchJson<{
          assignment?: { promptMarkdown?: string | null } | null;
          files?: { id: string; filename: string }[];
        }>(`/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lesson.id)}/assignment`, token);
        if (hwTa) hwTa.value = a.assignment?.promptMarkdown ?? '';
        const fileItems = Array.isArray(a.files) ? a.files : [];
        if (filesEmptyEl) filesEmptyEl.style.display = fileItems.length ? 'none' : '';
        if (filesHost && fileItems.length) {
          for (const f of fileItems) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.padding = '8px 10px';
            row.style.border = '1px solid var(--line)';
            row.style.borderRadius = '8px';
            row.style.background = 'var(--surface2)';
            const lab = document.createElement('span');
            lab.textContent = f.filename;
            lab.style.overflow = 'hidden';
            lab.style.textOverflow = 'ellipsis';
            lab.style.fontSize = '12px';
            lab.style.color = 'var(--t2)';
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn btn-ghost btn-sm';
            del.textContent = 'Удалить';
            del.dataset.epBuilderHwDelFile = f.id;
            row.append(lab, del);
            filesHost.appendChild(row);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('403')) {
          if (forbiddenEl) forbiddenEl.style.display = '';
          if (hwTa) {
            hwTa.value = '';
            hwTa.disabled = true;
          }
          if (hwActions) {
            hwActions.style.opacity = '0.5';
            hwActions.style.pointerEvents = 'none';
          }
          if (filesEmptyEl) filesEmptyEl.style.display = 'none';
        } else {
          if (hwTa) hwTa.value = '';
          if (filesEmptyEl) filesEmptyEl.style.display = '';
        }
      }
    }

    async function selectBuilderLesson(root: ShadowRoot, moduleId: string, lessonId: string): Promise<void> {
      builderSelectedModuleId = moduleId;
      builderSelectedLessonId = lessonId;
      builderSelectedAttestationId = null;
      setBuilderEditorMode(root, 'lesson');
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid) return;
      renderBuilderModTree(root);
      await applyBuilderLessonToForm(root, eid, token);
    }

    /** Выбор модуля в конструкторе (в т.ч. пустого — чтобы «+ Урок» создавался в нём). */
    async function selectBuilderModule(root: ShadowRoot, moduleId: string): Promise<void> {
      if (!builderModulesCache.some((m) => m.id === moduleId)) return;
      builderSelectedModuleId = moduleId;
      builderSelectedAttestationId = null;
      const lessons = builderLessonsByModule.get(moduleId) ?? [];
      builderSelectedLessonId = lessons[0]?.id ?? null;
      setBuilderEditorMode(root, 'lesson');
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid) return;
      renderBuilderModTree(root);
      await applyBuilderLessonToForm(root, eid, token);
    }

    async function openExpertBuilderNew(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveActiveExpertId();
      if (!token || !eid) {
        window.alert('Войдите в аккаунт с доступом эксперта.');
        return;
      }
      expertBuilderExpertId = eid;
      let created: { id: string; title: string };
      try {
        created = await postJson<{ id: string; title: string }>(
          `/experts/${encodeURIComponent(eid)}/courses`,
          { title: 'Новый курс' },
          token,
        );
      } catch {
        window.alert('Не удалось создать курс. Нужна роль менеджера или выше.');
        return;
      }
      expertBuilderCourseId = created.id;
      await builderLoadCourseData(root, eid, created.id, token);
      void hydrateExpertCourses(root);
    }

    async function openExpertBuilderEdit(root: ShadowRoot, courseId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid) {
        window.alert('Войдите в аккаунт с доступом эксперта.');
        return;
      }
      expertBuilderCourseId = courseId;
      try {
        await builderLoadCourseData(root, eid, courseId, token);
      } catch {
        window.alert('Не удалось загрузить курс.');
      }
    }

    async function saveBuilderLesson(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      const mid = builderSelectedModuleId;
      const lid = builderSelectedLessonId;
      if (!token || !eid || !cid || !mid || !lid) {
        window.alert('Выберите урок в дереве слева.');
        return;
      }
      const titleInp = root.querySelector('[data-ep-builder-lesson-title]') as HTMLInputElement | null;
      const rutubeInp = root.querySelector('[data-ep-builder-rutube]') as HTMLInputElement | null;
      const bodyTa = root.querySelector('[data-ep-builder-lesson-body]') as HTMLTextAreaElement | null;
      const hiddenCb = root.querySelector('[data-ep-builder-lesson-hidden]') as HTMLInputElement | null;
      const title = (titleInp?.value ?? '').trim();
      if (!title) {
        window.alert('Укажите название урока.');
        return;
      }
      const rawRu = (rutubeInp?.value ?? '').trim();
      let video: { kind: string; url?: string } = { kind: 'none' };
      if (rawRu) {
        const embed = normalizeRutubeEmbedUrl(rawRu);
        if (!embed) {
          window.alert('Некорректная ссылка Rutube.');
          return;
        }
        video = { kind: 'rutube', url: embed };
      }
      try {
        const slider = lid ? (builderSliderByLessonId.get(lid) ?? null) : null;
        const updated = await patchJson<BuilderLessonV1>(
          `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons/${encodeURIComponent(lid)}`,
          {
            title,
            contentMarkdown: bodyTa?.value ?? '',
            slider,
            video,
            hiddenFromStudents: hiddenCb?.checked ?? false,
          },
          token,
        );
        const list = builderLessonsByModule.get(mid) ?? [];
        const idx = list.findIndex((x) => x.id === lid);
        if (idx >= 0) list[idx] = updated;
        else list.push(updated);
        builderLessonsByModule.set(mid, list);
        renderBuilderModTree(root);
        window.alert('Урок сохранён.');
      } catch {
        window.alert('Не удалось сохранить урок.');
      }
    }

    async function saveBuilderHomework(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const lid = builderSelectedLessonId;
      if (!token || !eid || !lid) {
        window.alert('Выберите урок.');
        return;
      }
      const hwTa = root.querySelector('[data-ep-builder-hw-body]') as HTMLTextAreaElement | null;
      if (hwTa?.disabled) {
        window.alert('Недостаточно прав для сохранения задания.');
        return;
      }
      const text = (hwTa?.value ?? '').trim();
      try {
        await patchJson(
          `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lid)}/assignment`,
          { promptMarkdown: text ? (hwTa?.value ?? '') : null },
          token,
        );
        window.alert('Домашнее задание сохранено.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('403')) {
          window.alert(
            'Сервер отклонил сохранение (нет прав). Текст и файлы ДЗ можно менять с роли менеджера в команде эксперта и выше — как в мини-приложении.',
          );
        } else {
          window.alert('Не удалось сохранить ДЗ. Проверьте сеть и что выбран урок этого курса.');
        }
      }
    }

    async function builderAddModule(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) {
        window.alert('Сначала создайте или откройте курс.');
        return;
      }
      const title = window.prompt('Название модуля', 'Новый модуль');
      if (!title?.trim()) return;
      try {
        await postJson(`/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/modules`, { title: title.trim() }, token);
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось создать модуль (нужна роль менеджера+).');
      }
    }

    async function builderAddLesson(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) {
        window.alert('Сначала создайте или откройте курс.');
        return;
      }
      const mid = builderSelectedModuleId ?? builderModulesCache[0]?.id ?? null;
      if (!mid) {
        window.alert('Сначала добавьте модуль.');
        return;
      }
      const title = window.prompt('Название урока', 'Новый урок');
      if (!title?.trim()) return;
      try {
        const created = await postJson<BuilderLessonV1>(
          `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons`,
          { title: title.trim(), contentMarkdown: '' },
          token,
        );
        builderEditorMode = 'lesson';
        builderSelectedAttestationId = null;
        builderSelectedModuleId = mid;
        builderSelectedLessonId = created.id;
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось создать урок (нужна роль менеджера+).');
      }
    }

    /** Build a list of options for the «scope» picker shown to the expert when adding an attestation. */
    function builderPickAttestationModuleId(): string | null | undefined {
      if (builderModulesCache.length === 0) {
        if (window.confirm('Создать итоговую аттестацию к курсу? Модулей пока нет.')) {
          return null;
        }
        return undefined;
      }
      const lines: string[] = ['Введите номер варианта:', '0. Итоговая аттестация к курсу'];
      builderModulesCache.forEach((m, i) => {
        lines.push(`${i + 1}. Промежуточная к модулю «${m.title}»`);
      });
      const raw = window.prompt(lines.join('\n'), '0');
      if (raw == null) return undefined;
      const n = parseInt(raw.trim(), 10);
      if (!Number.isFinite(n)) return undefined;
      if (n === 0) return null;
      const idx = n - 1;
      if (idx < 0 || idx >= builderModulesCache.length) return undefined;
      return builderModulesCache[idx].id;
    }

    async function builderCreateAttestation(root: ShadowRoot, moduleId: string | null): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) {
        window.alert('Сначала создайте или откройте курс.');
        return;
      }
      try {
        const created = await postJson<BuilderAttestationV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/attestations`,
          { moduleId },
          token,
        );
        builderEditorMode = 'attestation';
        builderSelectedLessonId = null;
        builderSelectedAttestationId = created.id;
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось создать аттестацию (нужна роль менеджера+).');
      }
    }

    async function builderAddAttestation(root: ShadowRoot): Promise<void> {
      const moduleId = builderPickAttestationModuleId();
      if (moduleId === undefined) return;
      await builderCreateAttestation(root, moduleId);
    }

    async function builderDeleteAttestation(root: ShadowRoot, attestationId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      const a = builderAttestationsCache.find((x) => x.id === attestationId);
      const label = a?.displayTitle ?? 'аттестация';
      if (!window.confirm(`Удалить «${label}»? Попытки студентов сохранятся в истории, но аттестация будет скрыта.`)) {
        return;
      }
      try {
        await deleteJson(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/attestations/${encodeURIComponent(attestationId)}`,
          token,
        );
        if (builderSelectedAttestationId === attestationId) {
          builderSelectedAttestationId = null;
          builderEditorMode = 'lesson';
          builderAttestationDraft = null;
        }
        await builderLoadCourseData(root, eid, cid, token);
      } catch {
        window.alert('Не удалось удалить аттестацию (нужна роль менеджера+).');
      }
    }

    function setBuilderEditorMode(root: ShadowRoot, mode: 'lesson' | 'attestation'): void {
      builderEditorMode = mode;
      const screen = builderScreen(root);
      if (!screen) return;
      const hosts = screen.querySelectorAll<HTMLElement>('[data-ep-builder-mode-host]');
      hosts.forEach((el) => {
        const target = el.dataset.epBuilderModeHost as 'lesson' | 'attestation';
        if (target !== mode) {
          el.style.display = 'none';
          return;
        }
        const layout = (el.dataset.epBuilderModeLayout ?? 'block').trim();
        el.style.display = layout === 'flex' ? 'flex' : 'block';
      });
    }

    async function selectBuilderAttestation(root: ShadowRoot, attestationId: string): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      if (!token || !eid || !cid) return;
      let a = builderAttestationsCache.find((x) => x.id === attestationId) ?? null;
      try {
        const fresh = await fetchJson<BuilderAttestationV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/attestations/${encodeURIComponent(attestationId)}`,
          token,
        );
        a = fresh;
        const idx = builderAttestationsCache.findIndex((x) => x.id === attestationId);
        if (idx >= 0) builderAttestationsCache[idx] = fresh;
      } catch {
        /* fall back to cached */
      }
      if (!a) return;
      builderSelectedAttestationId = attestationId;
      builderSelectedLessonId = null;
      builderAttestationDraft = JSON.parse(JSON.stringify(a)) as BuilderAttestationV1;
      setBuilderEditorMode(root, 'attestation');
      renderBuilderModTree(root);
      renderBuilderAttestationEditor(root);
    }

    function renderBuilderAttestationEditor(root: ShadowRoot): void {
      const titleHost = root.querySelector('[data-ep-builder-attestation-title]') as HTMLElement | null;
      const list = root.querySelector('[data-ep-builder-attestation-questions]') as HTMLElement | null;
      const empty = root.querySelector('[data-ep-builder-attestation-empty]') as HTMLElement | null;
      if (!titleHost || !list || !empty) return;
      list.replaceChildren();
      if (!builderAttestationDraft) {
        titleHost.textContent = 'Аттестация';
        empty.style.display = '';
        return;
      }
      titleHost.textContent = builderAttestationDraft.displayTitle;
      const questions = builderAttestationDraft.questions;
      empty.style.display = questions.length === 0 ? '' : 'none';
      questions.forEach((q, qIdx) => {
        list.appendChild(buildBuilderAttestationQuestionCard(root, q, qIdx));
      });
    }

    function buildBuilderAttestationQuestionCard(
      root: ShadowRoot,
      q: BuilderAttestationQuestionV1,
      qIdx: number,
    ): HTMLElement {
      const card = document.createElement('div');
      card.className = 'att-q-card';

      const head = document.createElement('div');
      head.className = 'att-q-head';
      const num = document.createElement('span');
      num.className = 'att-q-num';
      num.textContent = `Q${qIdx + 1}`;
      const promptInp = document.createElement('input');
      promptInp.type = 'text';
      promptInp.className = 'form-input';
      promptInp.placeholder = 'Текст вопроса';
      promptInp.value = q.prompt;
      promptInp.addEventListener('input', () => {
        q.prompt = promptInp.value;
      });
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-ghost btn-sm';
      removeBtn.textContent = '✕';
      removeBtn.style.color = 'var(--err)';
      removeBtn.setAttribute('aria-label', 'Удалить вопрос');
      removeBtn.addEventListener('click', () => {
        if (!builderAttestationDraft) return;
        builderAttestationDraft.questions = builderAttestationDraft.questions.filter((x) => x !== q);
        renderBuilderAttestationEditor(root);
      });
      head.append(num, promptInp, removeBtn);

      const opts = document.createElement('div');
      opts.className = 'att-q-options';
      const radioName = `att-q-${q.id || qIdx}-correct`;
      q.options.forEach((o) => {
        opts.appendChild(buildBuilderAttestationOptionRow(root, q, o, radioName));
      });

      const actions = document.createElement('div');
      actions.className = 'att-q-actions';
      const addOpt = document.createElement('button');
      addOpt.type = 'button';
      addOpt.className = 'btn btn-outline btn-sm';
      addOpt.textContent = '+ Вариант';
      addOpt.addEventListener('click', () => {
        q.options.push({
          id: cryptoRandomUuid(),
          position: q.options.length,
          label: '',
          isCorrect: q.options.length === 0,
        });
        renderBuilderAttestationEditor(root);
      });
      actions.appendChild(addOpt);

      card.append(head, opts, actions);
      return card;
    }

    function buildBuilderAttestationOptionRow(
      root: ShadowRoot,
      q: BuilderAttestationQuestionV1,
      o: BuilderAttestationOptionV1,
      radioName: string,
    ): HTMLElement {
      const row = document.createElement('div');
      row.className = 'att-q-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = radioName;
      radio.checked = Boolean(o.isCorrect);
      radio.addEventListener('change', () => {
        for (const x of q.options) x.isCorrect = false;
        o.isCorrect = true;
      });
      const label = document.createElement('input');
      label.type = 'text';
      label.placeholder = 'Текст варианта';
      label.value = o.label;
      label.addEventListener('input', () => {
        o.label = label.value;
      });
      const correctHint = document.createElement('span');
      correctHint.className = 'att-q-option-correct';
      correctHint.textContent = 'верный';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm';
      del.textContent = '✕';
      del.style.color = 'var(--err)';
      del.setAttribute('aria-label', 'Удалить вариант');
      del.addEventListener('click', () => {
        q.options = q.options.filter((x) => x !== o);
        if (q.options.length > 0 && !q.options.some((x) => x.isCorrect)) {
          q.options[0].isCorrect = true;
        }
        renderBuilderAttestationEditor(root);
      });
      row.append(radio, correctHint, label, del);
      return row;
    }

    function cryptoRandomUuid(): string {
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
      } catch {
        /* ignore */
      }
      return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function builderAddAttestationQuestion(root: ShadowRoot): void {
      if (!builderAttestationDraft) {
        window.alert('Сначала выберите аттестацию в дереве слева.');
        return;
      }
      const n = builderAttestationDraft.questions.length;
      builderAttestationDraft.questions.push({
        id: cryptoRandomUuid(),
        position: n,
        prompt: '',
        options: [
          { id: cryptoRandomUuid(), position: 0, label: '', isCorrect: true },
          { id: cryptoRandomUuid(), position: 1, label: '', isCorrect: false },
        ],
      });
      renderBuilderAttestationEditor(root);
    }

    async function builderSaveAttestation(root: ShadowRoot): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const cid = expertBuilderCourseId;
      const aid = builderSelectedAttestationId;
      if (!token || !eid || !cid || !aid || !builderAttestationDraft) return;
      const questions = builderAttestationDraft.questions.map((q) => ({
        id: q.id && /^[0-9a-f-]{36}$/i.test(q.id) ? q.id : undefined,
        prompt: (q.prompt ?? '').trim(),
        options: q.options.map((o) => ({
          id: o.id && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : undefined,
          label: (o.label ?? '').trim(),
          isCorrect: Boolean(o.isCorrect),
        })),
      }));
      for (const q of questions) {
        if (!q.prompt) {
          window.alert('Каждый вопрос должен иметь текст.');
          return;
        }
        if (q.options.length < 2) {
          window.alert('У вопроса должно быть минимум 2 варианта.');
          return;
        }
        if (q.options.some((o) => !o.label)) {
          window.alert('Каждый вариант должен иметь текст.');
          return;
        }
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          window.alert('У каждого вопроса должен быть ровно один верный вариант.');
          return;
        }
      }
      try {
        const updated = await patchJson<BuilderAttestationV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/attestations/${encodeURIComponent(aid)}`,
          { questions },
          token,
        );
        builderAttestationDraft = JSON.parse(JSON.stringify(updated)) as BuilderAttestationV1;
        const idx = builderAttestationsCache.findIndex((x) => x.id === aid);
        if (idx >= 0) builderAttestationsCache[idx] = updated;
        renderBuilderAttestationEditor(root);
        renderBuilderModTree(root);
        window.alert('Аттестация сохранена.');
      } catch {
        window.alert('Не удалось сохранить аттестацию.');
      }
    }

    async function switchExpertBuilderTab(root: ShadowRoot, tabLabel: string): Promise<void> {
      if (builderEditorMode === 'attestation') return;
      const screen = builderScreen(root);
      if (!screen) return;
      const tabs = screen.querySelectorAll('[data-ep-builder-tabs] .tab');
      tabs.forEach((t) => t.classList.remove('active'));
      let panel: 'content' | 'homework' | 'settings' = 'content';
      if (tabLabel.includes('Домашнее')) panel = 'homework';
      else if (tabLabel.includes('Настройки')) panel = 'settings';
      tabs.forEach((t) => {
        if (t.textContent?.trim() === tabLabel) t.classList.add('active');
      });
      screen.querySelectorAll('[data-ep-builder-panel]').forEach((p) => {
        const k = (p as HTMLElement).dataset.epBuilderPanel;
        (p as HTMLElement).style.display = k === panel ? '' : 'none';
      });
      if (panel === 'homework') {
        const token = getAccessToken();
        const eid = await resolveBuilderExpertId();
        if (token && eid) await applyBuilderLessonToForm(root, eid, token);
      }
    }

    async function builderDeleteHwFile(root: ShadowRoot, fileId: string): Promise<void> {
      const hwTa = root.querySelector('[data-ep-builder-hw-body]') as HTMLTextAreaElement | null;
      if (hwTa?.disabled) {
        window.alert('Недостаточно прав для изменения материалов задания.');
        return;
      }
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const lid = builderSelectedLessonId;
      if (!token || !eid || !lid) return;
      try {
        await postJson(
          `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lid)}/assignment/files/${encodeURIComponent(fileId)}/delete`,
          {},
          token,
        );
        const ee = await resolveBuilderExpertId();
        if (ee) await applyBuilderLessonToForm(root, ee, token);
      } catch {
        window.alert('Не удалось удалить файл.');
      }
    }

    async function builderUploadHwFiles(root: ShadowRoot, files: FileList | null): Promise<void> {
      if (!files?.length) return;
      const hwTa = root.querySelector('[data-ep-builder-hw-body]') as HTMLTextAreaElement | null;
      if (hwTa?.disabled) {
        window.alert('Недостаточно прав для загрузки файлов к заданию.');
        return;
      }
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      const lid = builderSelectedLessonId;
      if (!token || !eid || !lid) return;
      try {
        for (const f of Array.from(files)) {
          const form = new FormData();
          form.append('file', f, f.name);
          await fetchMultipartJson(
            `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lid)}/assignment/files/upload`,
            form,
            token,
          );
        }
        await applyBuilderLessonToForm(root, eid, token);
      } catch {
        window.alert('Не удалось загрузить файлы.');
      }
    }

    function setBuilderCourseAsideFromDetail(root: ShadowRoot): void {
      const statusHost = root.querySelector('[data-ep-builder-course-status]') as HTMLElement | null;
      const titleHost = root.querySelector('[data-ep-builder-course-title]') as HTMLElement | null;
      if (!builderCourseDetail) return;
      if (titleHost) titleHost.textContent = builderCourseDetail.title;
      if (statusHost) {
        const vis = (builderCourseDetail.visibility ?? 'private').trim() || 'private';
        statusHost.textContent = `${builderCourseDetail.status} · ${vis}`;
      }
    }

    function syncCourseDrawerPublishButton(root: ShadowRoot): void {
      const btn = root.querySelector('[data-ep-course-publish]') as HTMLButtonElement | null;
      if (!btn) return;
      if (builderCourseDetail?.status === 'published') btn.textContent = 'Снять с публикации';
      else btn.textContent = 'Опубликовать';
    }

    function renderBuilderCourseTopicsCheckboxes(root: ShadowRoot): void {
      const host = root.querySelector('[data-ep-course-topics-list]') as HTMLElement | null;
      if (!host) return;
      host.replaceChildren();
      const seen = new Set<string>();
      const merged = [...builderCourseSettingsAllTopics, ...builderCourseSettingsExtraTopics];
      for (const t of merged) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        const lab = document.createElement('label');
        lab.style.cssText =
          'display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--t2);cursor:pointer;padding:4px 0';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = builderCourseSettingsSelectedTopicIds.has(t.id);
        cb.addEventListener('change', () => {
          if (cb.checked) builderCourseSettingsSelectedTopicIds.add(t.id);
          else builderCourseSettingsSelectedTopicIds.delete(t.id);
        });
        const span = document.createElement('span');
        span.textContent = t.title;
        span.style.lineHeight = '1.35';
        lab.append(cb, span);
        host.appendChild(lab);
      }
      if (merged.length === 0) {
        const empty = document.createElement('div');
        empty.style.fontSize = '12px';
        empty.style.color = 'var(--t3)';
        empty.textContent = 'Справочник тем пуст или не загрузился.';
        host.appendChild(empty);
      }
    }

    function closeBuilderCourseSettingsDrawer(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-course-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-course-drawer]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (dr) dr.style.display = 'none';
    }

    function closeBuilderLessonPreview(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-lesson-preview-backdrop]') as HTMLElement | null;
      const pr = root.querySelector('[data-ep-lesson-preview]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (pr) pr.style.display = 'none';
      const iframe = root.querySelector('[data-ep-lesson-preview-video-iframe]') as HTMLIFrameElement | null;
      if (iframe) iframe.src = 'about:blank';
      const matsCard = root.querySelector('[data-ep-lesson-preview-materials]') as HTMLElement | null;
      const matsList = root.querySelector('[data-ep-lesson-preview-materials-list]') as HTMLElement | null;
      if (matsCard) matsCard.style.display = 'none';
      if (matsList) matsList.replaceChildren();
    }

    async function hydratePreviewLessonMaterials(root: ShadowRoot, lessonId: string): Promise<void> {
      const card = root.querySelector('[data-ep-lesson-preview-materials]') as HTMLElement | null;
      const list = root.querySelector('[data-ep-lesson-preview-materials-list]') as HTMLElement | null;
      if (!card || !list) return;
      list.replaceChildren();
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid) {
        card.style.display = 'none';
        return;
      }
      try {
        const m = await fetchJson<{ items?: any[] }>(
          `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lessonId)}/materials`,
          token,
        );
        const items = (Array.isArray(m.items) ? m.items : [])
          .map((x) => ({
            fileKey: String(x?.fileKey ?? '').trim(),
            filename: String(x?.filename ?? '').trim(),
            sizeBytes: typeof x?.sizeBytes === 'number' ? x.sizeBytes : x?.sizeBytes == null ? null : Number(x.sizeBytes),
          }))
          .filter((x) => x.fileKey && x.filename);
        if (!items.length) {
          card.style.display = 'none';
          return;
        }
        card.style.display = '';
        for (const f of items) {
          const row = document.createElement('div');
          row.className = 'material-row';
          row.style.cursor = 'pointer';
          row.dataset.epLessonMaterialOpen = '1';
          row.dataset.epLessonMaterialKey = f.fileKey;
          row.dataset.epLessonMaterialName = encodeURIComponent(f.filename);

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
          btn.dataset.epLessonMaterialDownload = '1';
          btn.dataset.epLessonMaterialKey = f.fileKey;
          btn.dataset.epLessonMaterialName = encodeURIComponent(f.filename);

          row.append(ico, body, btn);
          list.appendChild(row);
        }
      } catch {
        card.style.display = 'none';
      }
    }

    function setPreviewFiles(root: ShadowRoot, files: { filename: string }[]): void {
      const wrap = root.querySelector('[data-ep-lesson-preview-hw-files]') as HTMLElement | null;
      const host = root.querySelector('[data-ep-lesson-preview-hw-files-list]') as HTMLElement | null;
      if (!wrap || !host) return;
      host.replaceChildren();
      if (!files.length) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = '';
      for (const f of files) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        row.style.padding = '10px 12px';
        row.style.border = '1px solid var(--line)';
        row.style.borderRadius = '10px';
        row.style.background = 'var(--surface2)';

        const name = document.createElement('div');
        name.style.flex = '1';
        name.style.minWidth = '0';
        name.style.fontSize = '12px';
        name.style.color = 'var(--t2)';
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        name.style.whiteSpace = 'nowrap';
        name.textContent = f.filename;

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '6px';

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'btn btn-ghost btn-sm';
        open.textContent = 'Открыть';
        open.disabled = true;

        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn btn-ghost btn-sm';
        dl.textContent = 'Скачать';
        dl.disabled = true;

        btns.append(open, dl);
        row.append(name, btns);
        host.appendChild(row);
      }
    }

    async function openBuilderLessonPreview(root: ShadowRoot): Promise<void> {
      const bd = root.querySelector('[data-ep-lesson-preview-backdrop]') as HTMLElement | null;
      const pr = root.querySelector('[data-ep-lesson-preview]') as HTMLElement | null;
      if (!bd || !pr) return;
      bd.style.display = 'block';
      pr.style.display = 'flex';

      const empty = root.querySelector('[data-ep-lesson-preview-empty]') as HTMLElement | null;
      const titleEl = root.querySelector('[data-ep-lesson-preview-title]') as HTMLElement | null;
      const bodyEl = root.querySelector('[data-ep-lesson-preview-body]') as HTMLElement | null;
      const videoCard = root.querySelector('[data-ep-lesson-preview-video]') as HTMLElement | null;
      const iframe = root.querySelector('[data-ep-lesson-preview-video-iframe]') as HTMLIFrameElement | null;
      const sliderCard = root.querySelector('[data-ep-lesson-preview-slider]') as HTMLElement | null;
      const sliderHost = root.querySelector('[data-ep-lesson-preview-slider-host]') as HTMLElement | null;
      const hwBody = root.querySelector('[data-ep-lesson-preview-hw-body]') as HTMLElement | null;
      const hwEmpty = root.querySelector('[data-ep-lesson-preview-hw-empty]') as HTMLElement | null;
      const hwTag = root.querySelector('[data-ep-lesson-preview-hw-tag]') as HTMLElement | null;
      const matsPrevCard = root.querySelector('[data-ep-lesson-preview-materials]') as HTMLElement | null;
      const matsPrevList = root.querySelector('[data-ep-lesson-preview-materials-list]') as HTMLElement | null;

      const titleInp = root.querySelector('[data-ep-builder-lesson-title]') as HTMLInputElement | null;
      const rutubeInp = root.querySelector('[data-ep-builder-rutube]') as HTMLInputElement | null;
      const lessonBodyTa = root.querySelector('[data-ep-builder-lesson-body]') as HTMLTextAreaElement | null;
      const hwTa = root.querySelector('[data-ep-builder-hw-body]') as HTMLTextAreaElement | null;

      if (!builderSelectedLessonId) {
        if (empty) empty.style.display = '';
        if (titleEl) titleEl.textContent = 'Урок';
        if (bodyEl) bodyEl.textContent = '';
        if (videoCard) videoCard.style.display = 'none';
        if (sliderCard) sliderCard.style.display = 'none';
        if (sliderHost) sliderHost.replaceChildren();
        if (hwBody) hwBody.textContent = '';
        if (hwEmpty) hwEmpty.style.display = '';
        if (hwTag) hwTag.textContent = 'не заполнено';
        setPreviewFiles(root, []);
        if (matsPrevCard) matsPrevCard.style.display = 'none';
        if (matsPrevList) matsPrevList.replaceChildren();
        return;
      }
      if (empty) empty.style.display = 'none';

      const title = (titleInp?.value ?? '').trim() || 'Урок';
      if (titleEl) titleEl.textContent = title;
      if (bodyEl) bodyEl.textContent = (lessonBodyTa?.value ?? '').trim() || '—';

      const ru = (rutubeInp?.value ?? '').trim();
      const embed = ru ? normalizeRutubeEmbedUrl(ru) : null;
      if (videoCard && iframe) {
        if (embed) {
          videoCard.style.display = '';
          iframe.src = embed;
          iframe.allow = 'autoplay; fullscreen; picture-in-picture';
          (iframe as any).allowFullscreen = true;
        } else {
          videoCard.style.display = 'none';
          iframe.src = 'about:blank';
        }
      }

      // Slider preview: use saved draft (from modal) if present, else from lesson cache
      if (sliderCard && sliderHost) {
        const lid = builderSelectedLessonId;
        const slider = lid ? builderSliderByLessonId.get(lid) ?? null : null;
        const keys = Array.isArray(slider?.images) ? slider!.images.map((x) => String(x.key ?? '').trim()).filter(Boolean) : [];
        sliderHost.replaceChildren();
        if (!keys.length) {
          sliderCard.style.display = 'none';
        } else {
          sliderCard.style.display = '';
          renderInlineLessonSlider(root, sliderHost, keys);
        }
      }

      const presCard = root.querySelector('[data-ep-lesson-preview-presentation]') as HTMLElement | null;
      const presHost = root.querySelector('[data-ep-lesson-preview-presentation-host]') as HTMLElement | null;
      const presOpen = root.querySelector('[data-ep-lesson-preview-presentation-open]') as HTMLElement | null;
      const presDlPdf = root.querySelector('[data-ep-lesson-preview-presentation-dl-pdf]') as HTMLElement | null;
      const presDlPptx = root.querySelector('[data-ep-lesson-preview-presentation-dl-pptx]') as HTMLElement | null;
      if (presCard && presHost) {
        const lid = builderSelectedLessonId;
        const pres = lid ? builderPresentationByLessonId.get(lid) ?? null : null;
        presHost.replaceChildren();
        if (!pres) {
          presCard.style.display = 'none';
          if (presOpen) presOpen.setAttribute('disabled', '');
          if (presDlPdf) presDlPdf.setAttribute('disabled', '');
          if (presDlPptx) presDlPptx.setAttribute('disabled', '');
        } else {
          presCard.style.display = '';
          if (presOpen) presOpen.removeAttribute('disabled');
          if (presDlPdf) presDlPdf.removeAttribute('disabled');
          if (presDlPptx) presDlPptx.removeAttribute('disabled');
          void (async () => {
            const pdfUrl = pres.pdfKey ? await getSignedFileUrl(pres.pdfKey) : null;
            const pptxUrl = pres.pptxKey ? await getSignedFileUrl(pres.pptxKey) : null;
            if (!pdfUrl) return;
            const iframe = document.createElement('iframe');
            iframe.className = 'ep-lesson-pres__frame';
            iframe.style.height = '520px';
            iframe.src = pdfUrl;
            iframe.title = 'Презентация (PDF)';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            const wrap = document.createElement('div');
            wrap.className = 'ep-lesson-pres';
            wrap.appendChild(iframe);
            presHost.appendChild(wrap);
            if (presOpen) (presOpen as any).dataset.epPresPdfUrl = pdfUrl;
            if (presDlPdf) (presDlPdf as any).dataset.epPresUrl = pdfUrl;
            if (presDlPdf) (presDlPdf as any).dataset.epPresName = encodeURIComponent(pres.originalFilename.replace(/\.pptx$/i, '.pdf'));
            if (presDlPptx) (presDlPptx as any).dataset.epPresUrl = pptxUrl ?? '';
            if (presDlPptx) (presDlPptx as any).dataset.epPresName = encodeURIComponent(pres.originalFilename);
            if (presDlPptx) (presDlPptx as HTMLButtonElement).disabled = !pptxUrl;
          })();
        }
      }

      const hwText = (hwTa?.value ?? '').trim();
      if (!hwText) {
        if (hwEmpty) hwEmpty.style.display = '';
        if (hwBody) hwBody.textContent = '';
        if (hwTag) hwTag.textContent = 'не заполнено';
      } else {
        if (hwEmpty) hwEmpty.style.display = 'none';
        if (hwBody) hwBody.textContent = hwText;
        if (hwTag) hwTag.textContent = 'заполнено';
      }

      // Files: try to reuse already-loaded list in editor; if empty but user has permission, try fetching.
      const filesFromUi: { filename: string }[] = [];
      root.querySelectorAll('[data-ep-builder-hw-files] > div').forEach((row) => {
        const lab = row.querySelector('span');
        const txt = (lab?.textContent ?? '').trim();
        if (txt) filesFromUi.push({ filename: txt });
      });
      if (filesFromUi.length) {
        setPreviewFiles(root, filesFromUi);
      } else {
        // if user hasn't opened homework tab yet — attempt fetch (reviewer+), ignore failures
        const token = getAccessToken();
        const eid = await resolveBuilderExpertId();
        if (token && eid) {
          try {
            const a = await fetchJson<{ files?: { filename: string }[] }>(
              `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(builderSelectedLessonId)}/assignment`,
              token,
            );
            setPreviewFiles(root, (a.files ?? []).map((f) => ({ filename: f.filename })));
          } catch {
            setPreviewFiles(root, []);
          }
        } else {
          setPreviewFiles(root, []);
        }
      }

      await hydratePreviewLessonMaterials(root, builderSelectedLessonId);
    }

    function sliderImageSrc(key: string): string {
      const api = getApiBaseUrl();
      if (!api) return '';
      return `${api}/public/lesson-media?key=${encodeURIComponent(key)}`;
    }

    async function getSignedFileUrl(key: string): Promise<string | null> {
      const tok = getAccessToken();
      if (!tok) return null;
      try {
        const res = await fetchJson<{ url: string }>(`/files/signed?key=${encodeURIComponent(key)}`, tok);
        const u = (res?.url ?? '').trim();
        return u ? resolvePublicUrl(u) : null;
      } catch {
        return null;
      }
    }

    async function renderPresentationViewer(
      root: ShadowRoot,
      host: HTMLElement,
      pres: { pptxKey?: string | null; pdfKey: string; originalFilename: string },
    ): Promise<void> {
      host.replaceChildren();
      const pdfUrl = await getSignedFileUrl(pres.pdfKey);
      const pptxUrl = pres.pptxKey ? await getSignedFileUrl(pres.pptxKey) : null;
      if (!pdfUrl) {
        host.style.display = 'none';
        return;
      }
      host.style.display = '';

      const wrap = document.createElement('div');
      wrap.className = 'ep-lesson-pres';

      const head = document.createElement('div');
      head.className = 'ep-lesson-pres__head';

      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.gap = '10px';

      const title = document.createElement('div');
      title.className = 'ep-lesson-pres__title';
      title.textContent = 'Презентация';

      const srcTag = document.createElement('span');
      srcTag.className = 'tag';
      srcTag.style.fontSize = '10px';
      srcTag.style.padding = '4px 8px';
      srcTag.style.borderRadius = '999px';
      srcTag.style.border = '1px solid rgba(255,255,255,0.12)';
      srcTag.style.background = 'rgba(255,255,255,0.06)';
      srcTag.style.color = 'var(--t2)';
      srcTag.textContent = pres.pptxKey ? 'Источник: PPTX' : 'Источник: PDF';

      titleWrap.append(title, srcTag);

      const actions = document.createElement('div');
      actions.className = 'ep-lesson-pres__actions';

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn btn-outline btn-sm';
      open.textContent = 'Открыть';
      open.dataset.epPresOpen = '1';
      open.dataset.epPresPdfUrl = pdfUrl;

      const fs = document.createElement('button');
      fs.type = 'button';
      fs.className = 'btn btn-outline btn-sm';
      fs.textContent = '⛶';
      fs.title = 'На весь экран';
      fs.dataset.epPresFs = '1';

      const dlPdf = document.createElement('button');
      dlPdf.type = 'button';
      dlPdf.className = 'btn btn-ghost btn-sm';
      dlPdf.textContent = 'PDF';
      dlPdf.dataset.epPresDl = '1';
      dlPdf.dataset.epPresUrl = pdfUrl;
      dlPdf.dataset.epPresName = encodeURIComponent(pres.originalFilename.replace(/\.pptx$/i, '.pdf'));

      const dlPptx = document.createElement('button');
      dlPptx.type = 'button';
      dlPptx.className = 'btn btn-ghost btn-sm';
      dlPptx.textContent = 'PPTX';
      dlPptx.disabled = !pptxUrl;
      if (pptxUrl) {
        dlPptx.dataset.epPresDl = '1';
        dlPptx.dataset.epPresUrl = pptxUrl;
        dlPptx.dataset.epPresName = encodeURIComponent(pres.originalFilename);
      }

      actions.append(open, fs, dlPdf, dlPptx);
      head.append(titleWrap, actions);

      const iframe = document.createElement('iframe');
      iframe.className = 'ep-lesson-pres__frame';
      iframe.src = pdfUrl;
      iframe.title = 'Презентация (PDF)';
      iframe.referrerPolicy = 'no-referrer';
      iframe.loading = 'lazy';

      wrap.append(head, iframe);
      host.appendChild(wrap);
    }

    function closeBuilderSliderModal(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-slider-backdrop]') as HTMLElement | null;
      const md = root.querySelector('[data-ep-slider-modal]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (md) md.style.display = 'none';
      builderSliderDraft = null;
    }

    function renderBuilderSliderGrid(root: ShadowRoot): void {
      const host = root.querySelector('[data-ep-slider-grid]') as HTMLElement | null;
      if (!host || !builderSliderDraft) return;
      host.replaceChildren();
      const items = builderSliderDraft.images;
      if (!items.length) {
        const p = document.createElement('div');
        p.style.padding = '14px';
        p.style.border = '1px dashed var(--line)';
        p.style.borderRadius = '12px';
        p.style.background = 'var(--surface2)';
        p.style.color = 'var(--t3)';
        p.style.fontSize = '12px';
        p.textContent = 'Добавьте фото для слайдера.';
        host.appendChild(p);
        return;
      }

      items.forEach((it, idx) => {
        const card = document.createElement('div');
        card.className = 'ep-slider-item';
        card.draggable = true;
        card.dataset.epSliderIdx = String(idx);

        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        const src = sliderImageSrc(it.key);
        if (src) img.src = src;
        card.appendChild(img);

        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'ep-slider-item__x';
        x.textContent = '✕';
        x.dataset.epSliderDelIdx = String(idx);
        card.appendChild(x);

        card.addEventListener('dragstart', (ev) => {
          card.classList.add('dragging');
          ev.dataTransfer?.setData('text/plain', String(idx));
          ev.dataTransfer?.setDragImage(card, 10, 10);
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });
        card.addEventListener('dragover', (ev) => {
          ev.preventDefault();
        });
        card.addEventListener('drop', (ev) => {
          ev.preventDefault();
          const from = Number(ev.dataTransfer?.getData('text/plain') ?? 'NaN');
          const to = idx;
          if (!builderSliderDraft) return;
          if (!Number.isFinite(from) || from < 0 || from >= builderSliderDraft.images.length) return;
          if (from === to) return;
          const next = builderSliderDraft.images.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved!);
          builderSliderDraft.images = next;
          renderBuilderSliderGrid(root);
        });

        host.appendChild(card);
      });
    }

    function openKeyViewer(root: ShadowRoot, keys: string[], startIdx: number): void {
      const bd = root.querySelector('[data-ep-slider-viewer-backdrop]') as HTMLElement | null;
      const vw = root.querySelector('[data-ep-slider-viewer]') as HTMLElement | null;
      const img = root.querySelector('[data-ep-slider-viewer-img]') as HTMLImageElement | null;
      const cnt = root.querySelector('[data-ep-slider-viewer-count]') as HTMLElement | null;
      if (!bd || !vw || !img || !cnt) return;
      if (!Array.isArray(keys) || keys.length === 0) return;

      let idx = Math.max(0, Math.min(keys.length - 1, startIdx));
      const sync = (): void => {
        const k = keys[idx] ?? '';
        img.src = k ? sliderImageSrc(k) : '';
        cnt.textContent = `${idx + 1}/${keys.length}`;
      };

      (vw as any).__epSliderGetIndex = () => idx;
      (vw as any).__epSliderSetIndex = (n: number) => {
        idx = ((n % keys.length) + keys.length) % keys.length;
        sync();
      };

      bd.style.display = '';
      vw.style.display = '';
      sync();
    }

    function openBuilderSliderViewer(root: ShadowRoot, startIdx: number): void {
      if (!builderSliderDraft) return;
      openKeyViewer(root, builderSliderDraft.images.map((x) => x.key), startIdx);
    }

    function closeBuilderSliderViewer(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-slider-viewer-backdrop]') as HTMLElement | null;
      const vw = root.querySelector('[data-ep-slider-viewer]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (vw) vw.style.display = 'none';
    }

    function closeBuilderCourseAccessDrawer(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-access-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-access-drawer]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (dr) dr.style.display = 'none';
    }

    function closeAdminDrawer(root: ShadowRoot): void {
      const bd = root.querySelector('[data-ep-admin-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-admin-drawer]') as HTMLElement | null;
      if (bd) bd.style.display = 'none';
      if (dr) dr.style.display = 'none';
      root.querySelectorAll<HTMLElement>('[data-ep-admin-suggest]').forEach((el) => (el.style.display = 'none'));
    }

    function applyAdminExpertIdFields(root: ShadowRoot, activeExpertId: string | null | undefined): void {
      const v = typeof activeExpertId === 'string' ? activeExpertId.trim() : '';
      if (!v) return;
      const memEx = root.querySelector('[data-ep-admin-members-expert-id]') as HTMLInputElement | null;
      const subEx = root.querySelector('[data-ep-admin-sub-expert-id]') as HTMLInputElement | null;
      if (memEx) memEx.value = v;
      if (subEx) subEx.value = v;
    }

    function adminSearchInputQ(
      root: ShadowRoot,
      host: 'create-owner' | 'members-user' | 'platform-user',
    ): string {
      const sel: Record<typeof host, string> = {
        'create-owner': '[data-ep-admin-create-expert-owner-search]',
        'members-user': '[data-ep-admin-members-user-search]',
        'platform-user': '[data-ep-admin-platform-user-search]',
      };
      return (root.querySelector(sel[host]) as HTMLInputElement | null)?.value?.trim() ?? '';
    }

    function renderAdminSuggest(
      root: ShadowRoot,
      items: Array<{
        id: string;
        telegramUserId?: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        platformRole: string;
        activeExpertId?: string | null;
      }>,
      host: 'create-owner' | 'members-user' | 'platform-user',
    ): void {
      const hostEl = root.querySelector(`[data-ep-admin-suggest="${host}"]`) as HTMLElement | null;
      if (!hostEl) return;
      hostEl.replaceChildren();
      if (!items.length) {
        hostEl.style.display = 'none';
        return;
      }
      hostEl.style.display = '';

      const card = document.createElement('div');
      card.style.border = '1px solid var(--line)';
      card.style.borderRadius = '12px';
      card.style.background = 'var(--surface)';
      card.style.boxShadow = 'var(--sh2)';
      card.style.overflow = 'hidden';

      items.slice(0, 10).forEach((u) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        row.style.width = '100%';
        row.style.padding = '10px 12px';
        row.style.border = 'none';
        row.style.background = 'transparent';
        row.style.cursor = 'pointer';
        row.addEventListener('mouseenter', () => (row.style.background = 'var(--bg2)'));
        row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));

        const title = document.createElement('div');
        title.style.flex = '1';
        title.style.minWidth = '0';
        title.style.textAlign = 'left';
        title.style.fontSize = '12px';
        title.style.color = 'var(--t2)';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.whiteSpace = 'nowrap';
        title.textContent = formatUserTitle(u);

        const pick = document.createElement('span');
        pick.style.fontFamily = 'var(--fm)';
        pick.style.fontSize = '9px';
        pick.style.color = 'var(--t3)';
        pick.textContent = u.platformRole ? String(u.platformRole) : 'выбрать';

        row.append(title, pick);
        row.addEventListener('click', () => {
          void (async () => {
            if (host === 'create-owner') {
              const inp = root.querySelector('[data-ep-admin-create-expert-owner-search]') as HTMLInputElement | null;
              if (inp) inp.value = formatUserTitle(u);
              const idInp = root.querySelector('[data-ep-admin-create-expert-owner-id]') as HTMLInputElement | null;
              if (idInp) idInp.value = u.id;
              adminSelectedUserIdByField = { ...adminSelectedUserIdByField, createOwner: u.id };
            } else if (host === 'members-user') {
              const inp = root.querySelector('[data-ep-admin-members-user-search]') as HTMLInputElement | null;
              if (inp) inp.value = formatUserTitle(u);
              const idInp = root.querySelector('[data-ep-admin-members-user-id]') as HTMLInputElement | null;
              if (idInp) idInp.value = u.id;
              adminSelectedUserIdByField = { ...adminSelectedUserIdByField, membersUser: u.id };
            } else {
              const inp = root.querySelector('[data-ep-admin-platform-user-search]') as HTMLInputElement | null;
              if (inp) inp.value = formatUserTitle(u);
              const idInp = root.querySelector('[data-ep-admin-platform-user-id]') as HTMLInputElement | null;
              if (idInp) idInp.value = u.id;
              adminSelectedUserIdByField = { ...adminSelectedUserIdByField, platformUser: u.id };
            }

            const token = getAccessToken();
            let aid = u.activeExpertId ?? null;
            const looksEmpty = aid == null || !String(aid).trim();
            if (token && looksEmpty) {
              try {
                aid = (
                  await fetchJson<{ activeExpertId: string | null }>(
                    `/admin/users/${encodeURIComponent(u.id)}/active-expert-id`,
                    token,
                  )
                ).activeExpertId;
              } catch {
                aid = null;
              }
            }
            applyAdminExpertIdFields(root, aid);
            hostEl.style.display = 'none';
          })();
        });
        card.appendChild(row);
      });

      hostEl.appendChild(card);
    }

    async function adminSearchUsers(
      root: ShadowRoot,
      q: string,
      host: 'create-owner' | 'members-user' | 'platform-user',
    ): Promise<void> {
      const token = getAccessToken();
      if (!token) return;
      const qq = q.trim();
      if (!qq) {
        renderAdminSuggest(root, [], host);
        return;
      }
      try {
        const res = await fetchJson<{
          items: Array<{
            id: string;
            telegramUserId?: string;
            username?: string;
            firstName?: string;
            lastName?: string;
            platformRole: string;
            activeExpertId?: string | null;
          }>;
        }>(`/admin/users?q=${encodeURIComponent(qq)}`, token);
        renderAdminSuggest(root, res.items ?? [], host);
      } catch {
        renderAdminSuggest(root, [], host);
      }
    }

    async function openAdminDrawer(root: ShadowRoot): Promise<void> {
      const bd = root.querySelector('[data-ep-admin-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-admin-drawer]') as HTMLElement | null;
      if (bd) bd.style.display = '';
      if (dr) dr.style.display = '';

      const loading = root.querySelector('[data-ep-admin-loading]') as HTMLElement | null;
      const locked = root.querySelector('[data-ep-admin-locked]') as HTMLElement | null;
      const form = root.querySelector('[data-ep-admin-form]') as HTMLElement | null;
      if (loading) loading.style.display = '';
      if (locked) locked.style.display = 'none';
      if (form) form.style.display = 'none';

      if (!currentMe || !currentPlatformRole) {
        await hydrateTopbarUser();
      }

      const role = (currentPlatformRole ?? '').trim();
      const isAdmin = role === 'admin' || role === 'owner';
      const isOwner = role === 'owner';

      if (loading) loading.style.display = 'none';
      if (!isAdmin) {
        if (locked) locked.style.display = '';
        if (form) form.style.display = 'none';
        return;
      }

      if (locked) locked.style.display = 'none';
      if (form) form.style.display = '';

      const ownerOnly = root.querySelector('[data-ep-admin-owner-only]') as HTMLElement | null;
      if (ownerOnly) ownerOnly.style.display = isOwner ? 'none' : '';

      const grant = root.querySelector('[data-ep-admin-sub-grant]') as HTMLButtonElement | null;
      const expire = root.querySelector('[data-ep-admin-sub-expire]') as HTMLButtonElement | null;
      if (grant) grant.disabled = !isOwner;
      if (expire) expire.disabled = !isOwner;

      const platformCard = root.querySelector('[data-ep-admin-platform-set]')?.closest('.card') as HTMLElement | null;
      if (platformCard) platformCard.style.display = isOwner ? '' : 'none';
    }

    function buildInviteDeepLink(code: string): string | null {
      try {
        const meta = document.querySelector('meta[name="edify-telegram-bot"]') as HTMLMetaElement | null;
        const unameRaw = (meta?.content ?? '').trim().replace(/^@/, '');
        if (!unameRaw) return null;
        return `https://t.me/${encodeURIComponent(unameRaw)}?start=${encodeURIComponent(`inv_${code}`)}`;
      } catch {
        return null;
      }
    }

    function formatUserTitle(u: { username?: string | null; firstName?: string | null; lastName?: string | null; telegramUserId?: string | null }): string {
      const un = (u.username ?? '').trim();
      const fn = (u.firstName ?? '').trim();
      const ln = (u.lastName ?? '').trim();
      const name = `${fn} ${ln}`.trim();
      const right = un ? `@${un}` : u.telegramUserId ? `id:${u.telegramUserId}` : '';
      if (name && right) return `${name} · ${right}`;
      return name || (un ? `@${un}` : right || 'пользователь');
    }

    function renderAccessSuggest(
      root: ShadowRoot,
      items: Array<{ id: string; telegramUserId: string; username?: string; firstName?: string; lastName?: string }>,
      target: 'username' | 'name',
    ): void {
      const host = root.querySelector('[data-ep-access-suggest]') as HTMLElement | null;
      if (!host) return;
      host.replaceChildren();
      if (!items.length) {
        host.style.display = 'none';
        return;
      }
      host.style.display = '';
      const card = document.createElement('div');
      card.style.border = '1px solid var(--line)';
      card.style.borderRadius = '12px';
      card.style.background = 'var(--surface)';
      card.style.boxShadow = 'var(--sh2)';
      card.style.overflow = 'hidden';

      items.slice(0, 10).forEach((u) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        row.style.width = '100%';
        row.style.padding = '10px 12px';
        row.style.border = 'none';
        row.style.background = 'transparent';
        row.style.cursor = 'pointer';
        row.addEventListener('mouseenter', () => (row.style.background = 'var(--bg2)'));
        row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));

        const title = document.createElement('div');
        title.style.flex = '1';
        title.style.minWidth = '0';
        title.style.textAlign = 'left';
        title.style.fontSize = '12px';
        title.style.color = 'var(--t2)';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.whiteSpace = 'nowrap';
        title.textContent = formatUserTitle(u);

        const pick = document.createElement('span');
        pick.style.fontFamily = 'var(--fm)';
        pick.style.fontSize = '9px';
        pick.style.color = 'var(--t3)';
        pick.textContent = 'выбрать';

        row.append(title, pick);
        row.addEventListener('click', () => {
          if (target === 'username') {
            const inp = root.querySelector('[data-ep-access-enroll-username]') as HTMLInputElement | null;
            if (inp) inp.value = u.username ? `@${u.username}` : '';
            builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, username: u.id };
          } else {
            const inp = root.querySelector('[data-ep-access-enroll-name]') as HTMLInputElement | null;
            const fn = (u.firstName ?? '').trim();
            const ln = (u.lastName ?? '').trim();
            const nm = `${fn} ${ln}`.trim();
            if (inp) inp.value = nm || (u.username ? `@${u.username}` : '');
            builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, name: u.id };
          }
          host.style.display = 'none';
        });
        card.appendChild(row);
      });

      host.appendChild(card);
    }

    async function accessSearchUsers(root: ShadowRoot, q: string, target: 'username' | 'name'): Promise<void> {
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid) return;
      const qq = q.trim();
      if (!qq) {
        renderAccessSuggest(root, [], target);
        return;
      }
      try {
        const res = await fetchJson<{
          items: Array<{ id: string; telegramUserId: string; username?: string; firstName?: string; lastName?: string }>;
        }>(`/experts/${encodeURIComponent(eid)}/users/search?q=${encodeURIComponent(qq)}`, token);
        renderAccessSuggest(root, res.items ?? [], target);
      } catch {
        renderAccessSuggest(root, [], target);
      }
    }

    async function copyText(text: string): Promise<boolean> {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    }

    function renderAccessEnrollments(root: ShadowRoot, items: Array<{ enrollment: any; studentTelegramUserId: string; studentUsername: string | null }>): void {
      const host = root.querySelector('[data-ep-access-enrollments]') as HTMLElement | null;
      const empty = root.querySelector('[data-ep-access-enrollments-empty]') as HTMLElement | null;
      if (!host || !empty) return;
      host.replaceChildren();
      const rows = items ?? [];
      empty.style.display = rows.length ? 'none' : '';
      for (const r of rows) {
        const e = r.enrollment;
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexWrap = 'wrap';
        row.style.gap = '10px';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '10px 12px';
        row.style.border = '1px solid var(--line)';
        row.style.borderRadius = '12px';
        row.style.background = 'var(--surface2)';

        const left = document.createElement('div');
        left.style.flex = '1';
        left.style.minWidth = '220px';
        const title = document.createElement('div');
        title.style.fontSize = '12px';
        title.style.fontWeight = '700';
        title.style.color = 'var(--t1)';
        title.textContent = r.studentUsername ? `@${r.studentUsername}` : `Telegram ID: ${r.studentTelegramUserId}`;
        const meta = document.createElement('div');
        meta.style.fontSize = '10px';
        meta.style.color = 'var(--t3)';
        meta.style.fontFamily = 'var(--fm)';
        const end = e?.accessEnd ? new Date(e.accessEnd).toLocaleDateString('ru-RU') : '∞';
        const revoked = e?.revokedAt ? 'отозван' : 'активен';
        meta.textContent = `доступ до: ${end} · ${revoked}`;
        left.append(title, meta);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.alignItems = 'center';
        controls.style.flexWrap = 'wrap';

        const inp = document.createElement('input');
        inp.className = 'form-input';
        inp.style.width = '110px';
        inp.placeholder = 'дней';
        inp.value = builderAccessGrantDaysByEnrollmentId[e.id] ?? '';
        inp.addEventListener('input', () => {
          builderAccessGrantDaysByEnrollmentId = { ...builderAccessGrantDaysByEnrollmentId, [e.id]: inp.value };
        });

        const extendBtn = document.createElement('button');
        extendBtn.type = 'button';
        extendBtn.className = 'btn btn-outline btn-sm';
        extendBtn.textContent = 'Продлить';
        extendBtn.dataset.epAccessExtend = e.id;

        const revokeBtn = document.createElement('button');
        revokeBtn.type = 'button';
        revokeBtn.className = 'btn btn-ghost btn-sm';
        revokeBtn.textContent = 'Отозвать';
        revokeBtn.dataset.epAccessRevoke = e.id;

        controls.append(inp, extendBtn, revokeBtn);
        row.append(left, controls);
        host.appendChild(row);
      }
    }

    function renderAccessInvites(root: ShadowRoot, items: Array<any>): void {
      const host = root.querySelector('[data-ep-access-invites]') as HTMLElement | null;
      const empty = root.querySelector('[data-ep-access-invites-empty]') as HTMLElement | null;
      if (!host || !empty) return;
      host.replaceChildren();
      const rows = items ?? [];
      empty.style.display = rows.length ? 'none' : '';
      for (const i of rows) {
        const card = document.createElement('div');
        card.style.padding = '10px 12px';
        card.style.border = '1px solid var(--line)';
        card.style.borderRadius = '12px';
        card.style.background = 'var(--surface2)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';

        const top = document.createElement('div');
        top.style.display = 'flex';
        top.style.gap = '8px';
        top.style.flexWrap = 'wrap';
        top.style.alignItems = 'center';
        const strong = document.createElement('strong');
        strong.textContent = i.code;
        const limit = i.maxUses == null ? '∞' : String(i.maxUses);
        const used = i.usesCount ?? 0;
        const meta = document.createElement('span');
        meta.style.fontSize = '10px';
        meta.style.color = 'var(--t3)';
        meta.style.fontFamily = 'var(--fm)';
        meta.textContent = `использований: ${used}/${limit}`;
        top.append(strong, meta);

        const link = buildInviteDeepLink(i.code);
        const linkEl = document.createElement('div');
        linkEl.style.fontSize = '12px';
        linkEl.style.color = 'var(--t2)';
        linkEl.style.wordBreak = 'break-all';
        linkEl.textContent = link ?? `Код: ${i.code}`;

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        actions.style.flexWrap = 'wrap';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-outline btn-sm';
        copyBtn.textContent = 'Скопировать';
        copyBtn.dataset.epAccessInviteCopy = i.code;
        copyBtn.disabled = !link;

        const revokeBtn = document.createElement('button');
        revokeBtn.type = 'button';
        revokeBtn.className = 'btn btn-ghost btn-sm';
        revokeBtn.textContent = 'Отозвать';
        revokeBtn.dataset.epAccessInviteRevoke = i.code;

        actions.append(copyBtn, revokeBtn);
        card.append(top, linkEl, actions);
        host.appendChild(card);
      }
    }

    async function openBuilderCourseAccessDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) {
        window.alert('Откройте курс в конструкторе.');
        return;
      }
      const bd = root.querySelector('[data-ep-access-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-access-drawer]') as HTMLElement | null;
      const loading = root.querySelector('[data-ep-access-loading]') as HTMLElement | null;
      const form = root.querySelector('[data-ep-access-form]') as HTMLElement | null;
      const locked = root.querySelector('[data-ep-access-locked]') as HTMLElement | null;
      if (!bd || !dr) return;
      bd.style.display = 'block';
      dr.style.display = 'flex';
      if (loading) {
        loading.style.display = '';
        loading.textContent = 'Загрузка…';
      }
      if (form) form.style.display = 'none';
      if (locked) locked.style.display = 'none';
      builderAccessSelectedUserIdByField = {};
      const suggestHost = root.querySelector('[data-ep-access-suggest]') as HTMLElement | null;
      if (suggestHost) {
        suggestHost.style.display = 'none';
        suggestHost.replaceChildren();
      }

      try {
        const [enrollments, invites] = await Promise.all([
          fetchJson<{ items: any[] }>(`/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments`, token),
          fetchJson<{ items: any[] }>(`/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/invites`, token),
        ]);
        renderAccessEnrollments(root, enrollments.items ?? []);
        renderAccessInvites(root, invites.items ?? []);
        if (loading) loading.style.display = 'none';
        if (form) form.style.display = '';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('403') || msg.includes('401')) {
          if (locked) locked.style.display = '';
          if (loading) loading.style.display = 'none';
          if (form) form.style.display = 'none';
          return;
        }
        closeBuilderCourseAccessDrawer(root);
        window.alert('Не удалось загрузить «Доступ к курсу».');
      }
    }

    async function openBuilderCourseSettingsDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) {
        window.alert('Откройте курс в конструкторе.');
        return;
      }
      const bd = root.querySelector('[data-ep-course-drawer-backdrop]') as HTMLElement | null;
      const dr = root.querySelector('[data-ep-course-drawer]') as HTMLElement | null;
      const loading = root.querySelector('[data-ep-course-settings-loading]') as HTMLElement | null;
      const form = root.querySelector('[data-ep-course-settings-form]') as HTMLElement | null;
      if (!bd || !dr) return;
      bd.style.display = 'block';
      dr.style.display = 'flex';
      if (loading) {
        loading.style.display = '';
        loading.textContent = 'Загрузка…';
      }
      if (form) form.style.display = 'none';

      try {
        const course = await fetchJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}`,
          token,
        );
        builderCourseDetail = { ...course, id: cid };
        setBuilderCourseAsideFromDetail(root);

        let allItems: BuilderTopicV1[] = [];
        try {
          allItems = (await fetchJson<{ items?: BuilderTopicV1[] }>('/topics', token)).items ?? [];
        } catch {
          allItems = [];
        }

        let courseItems: BuilderTopicV1[] = [];
        let topicsLocked = false;
        try {
          courseItems = (
            await fetchJson<{ items?: BuilderTopicV1[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/topics`,
              token,
            )
          ).items ?? [];
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('403')) topicsLocked = true;
        }

        const titleInp = root.querySelector('[data-ep-course-title]') as HTMLInputElement | null;
        const descTa = root.querySelector('[data-ep-course-desc]') as HTMLTextAreaElement | null;
        const visSel = root.querySelector('[data-ep-course-visibility]') as HTMLSelectElement | null;
        const coverInp = root.querySelector('[data-ep-course-cover-url]') as HTMLInputElement | null;
        const lessonAccSel = root.querySelector('[data-ep-course-lesson-access]') as HTMLSelectElement | null;
        const authorInp = root.querySelector('[data-ep-course-author-display]') as HTMLInputElement | null;
        const enrollUrlInp = root.querySelector('[data-ep-course-enrollment-url]') as HTMLInputElement | null;
        const completionHoursInp = root.querySelector('[data-ep-course-completion-hours]') as HTMLInputElement | null;
        const diffSel = root.querySelector('[data-ep-course-difficulty]') as HTMLSelectElement | null;
        if (titleInp) titleInp.value = course.title ?? '';
        if (descTa) descTa.value = (course.description ?? '').trim();
        if (authorInp) authorInp.value = (course.authorDisplayName ?? '').trim();
        if (enrollUrlInp) enrollUrlInp.value = (course.enrollmentContactUrl ?? '').trim();
        if (completionHoursInp) {
          const h = course.estimatedCompletionHours;
          completionHoursInp.value =
            typeof h === 'number' && Number.isFinite(h) && h >= 1 ? String(Math.trunc(h)) : '';
        }
        if (diffSel) {
          const d = (course.difficultyLevel ?? '').trim() as any;
          diffSel.value = d === 'easy' || d === 'medium' || d === 'hard' ? d : '';
        }
        if (visSel) visSel.value = (course.visibility ?? 'private') === 'public' ? 'public' : 'private';
        if (coverInp) coverInp.value = (course.coverUrl ?? '').trim();
        if (lessonAccSel) {
          const m = course.lessonAccessMode === 'open' ? 'open' : 'sequential';
          lessonAccSel.value = m;
        }

        builderCourseSettingsAllTopics = allItems;
        const baseIds = new Set(allItems.map((t) => t.id));
        builderCourseSettingsExtraTopics = courseItems.filter((t) => !baseIds.has(t.id));
        builderCourseSettingsSelectedTopicIds = new Set(courseItems.map((t) => t.id));

        const coverFile = root.querySelector('[data-ep-course-cover-file]') as HTMLInputElement | null;
        if (coverFile) coverFile.value = '';
        const customInp = root.querySelector('[data-ep-course-custom-topic]') as HTMLInputElement | null;
        if (customInp) {
          customInp.value = '';
          customInp.disabled = topicsLocked;
        }

        const lockedEl = root.querySelector('[data-ep-course-topics-locked]') as HTMLElement | null;
        if (lockedEl) lockedEl.style.display = topicsLocked ? '' : 'none';
        const saveTopicsBtn = root.querySelector('[data-ep-course-save-topics]') as HTMLButtonElement | null;
        const addCustomBtn = root.querySelector('[data-ep-course-add-custom-topic]') as HTMLButtonElement | null;
        if (saveTopicsBtn) saveTopicsBtn.disabled = topicsLocked;
        if (addCustomBtn) addCustomBtn.disabled = topicsLocked;

        renderBuilderCourseTopicsCheckboxes(root);
        const listHost = root.querySelector('[data-ep-course-topics-list]') as HTMLElement | null;
        if (listHost) {
          listHost.style.opacity = topicsLocked ? '0.55' : '';
          listHost.style.pointerEvents = topicsLocked ? 'none' : '';
        }

        syncCourseDrawerPublishButton(root);

        if (loading) loading.style.display = 'none';
        if (form) form.style.display = '';
      } catch {
        if (loading) loading.textContent = 'Не удалось загрузить настройки.';
        window.alert('Не удалось загрузить настройки курса.');
        closeBuilderCourseSettingsDrawer(root);
      }
    }

    async function saveBuilderCourseSettingsDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) return;
      const titleInp = root.querySelector('[data-ep-course-title]') as HTMLInputElement | null;
      const descTa = root.querySelector('[data-ep-course-desc]') as HTMLTextAreaElement | null;
      const visSel = root.querySelector('[data-ep-course-visibility]') as HTMLSelectElement | null;
      const coverInp = root.querySelector('[data-ep-course-cover-url]') as HTMLInputElement | null;
      const lessonAccSel = root.querySelector('[data-ep-course-lesson-access]') as HTMLSelectElement | null;
      const authorInp = root.querySelector('[data-ep-course-author-display]') as HTMLInputElement | null;
      const enrollUrlInp = root.querySelector('[data-ep-course-enrollment-url]') as HTMLInputElement | null;
      const completionHoursInp = root.querySelector('[data-ep-course-completion-hours]') as HTMLInputElement | null;
      const diffSel = root.querySelector('[data-ep-course-difficulty]') as HTMLSelectElement | null;
      const title = (titleInp?.value ?? '').trim();
      if (!title) {
        window.alert('Укажите название курса.');
        return;
      }
      const visibility = visSel?.value === 'public' ? 'public' : 'private';
      const description = (descTa?.value ?? '').trim();
      const coverUrl = (coverInp?.value ?? '').trim();
      const lessonAccessMode = lessonAccSel?.value === 'open' ? 'open' : 'sequential';
      const authorDisplayName = (authorInp?.value ?? '').trim();
      const enrollmentContactUrlRaw = (enrollUrlInp?.value ?? '').trim();
      if (enrollmentContactUrlRaw && !isStudentEnrollmentContactUrl(enrollmentContactUrlRaw)) {
        window.alert(
          'Проверьте ссылку для зачисления: нужен полный адрес (http://, https://, tg: или mailto:), не длиннее 2048 символов.',
        );
        return;
      }
      const enrollmentContactUrl = enrollmentContactUrlRaw ? enrollmentContactUrlRaw : null;
      const hoursParsed = parseEstimatedCompletionHoursInput(completionHoursInp?.value ?? '');
      if (!hoursParsed.ok) {
        window.alert(hoursParsed.message);
        return;
      }
      const diffRaw = (diffSel?.value ?? '').trim();
      const difficultyLevel =
        diffRaw === '' ? null : diffRaw === 'easy' || diffRaw === 'medium' || diffRaw === 'hard' ? diffRaw : null;
      try {
        const updated = await patchJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}`,
          {
            title,
            description: description ? description : null,
            visibility,
            coverUrl: coverUrl ? coverUrl : null,
            lessonAccessMode,
            authorDisplayName: authorDisplayName ? authorDisplayName : null,
            enrollmentContactUrl,
            estimatedCompletionHours: hoursParsed.value,
            difficultyLevel,
          },
          token,
        );
        builderCourseDetail = { ...updated, id: cid };
        setBuilderCourseAsideFromDetail(root);
        syncCourseDrawerPublishButton(root);
        window.alert('Курс сохранён.');
      } catch {
        window.alert('Не удалось сохранить курс.');
      }
    }

    async function toggleBuilderCoursePublishFromDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) return;
      const pub = builderCourseDetail?.status !== 'published';
      try {
        const updated = await postJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/${pub ? 'publish' : 'unpublish'}`,
          {},
          token,
        );
        builderCourseDetail = { ...updated, id: cid };
        setBuilderCourseAsideFromDetail(root);
        syncCourseDrawerPublishButton(root);
        window.alert(pub ? 'Курс опубликован.' : 'Курс снят с публикации.');
      } catch {
        window.alert(pub ? 'Не удалось опубликовать.' : 'Не удалось снять с публикации.');
      }
    }

    async function uploadBuilderCourseCoverFromDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) return;
      const fileInp = root.querySelector('[data-ep-course-cover-file]') as HTMLInputElement | null;
      const coverUrlInp = root.querySelector('[data-ep-course-cover-url]') as HTMLInputElement | null;
      const f = fileInp?.files?.[0] ?? null;
      if (!f) {
        window.alert('Выберите файл изображения.');
        return;
      }
      try {
        const form = new FormData();
        form.append('file', f, f.name);
        const updated = await fetchMultipartJson<BuilderCourseDetailV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/cover`,
          form,
          token,
        );
        builderCourseDetail = { ...updated, id: cid };
        if (coverUrlInp) coverUrlInp.value = (updated.coverUrl ?? '').trim();
        if (fileInp) fileInp.value = '';
        window.alert('Обложка загружена.');
      } catch {
        window.alert('Не удалось загрузить обложку.');
      }
    }

    async function addBuilderCourseCustomTopic(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) return;
      const customInp = root.querySelector('[data-ep-course-custom-topic]') as HTMLInputElement | null;
      const title = (customInp?.value ?? '').trim();
      if (!title) {
        window.alert('Введите название темы.');
        return;
      }
      try {
        const topic = await postJson<BuilderTopicV1>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/topics/custom`,
          { title },
          token,
        );
        if (customInp) customInp.value = '';
        if (!builderCourseSettingsExtraTopics.some((x) => x.id === topic.id)) {
          builderCourseSettingsExtraTopics = [...builderCourseSettingsExtraTopics, topic];
        }
        builderCourseSettingsSelectedTopicIds.add(topic.id);
        renderBuilderCourseTopicsCheckboxes(root);
        window.alert('Тема добавлена. Не забудьте нажать «Сохранить темы».');
      } catch {
        window.alert('Не удалось добавить тему.');
      }
    }

    async function saveBuilderCourseTopicsFromDrawer(root: ShadowRoot): Promise<void> {
      const cid = expertBuilderCourseId;
      const token = getAccessToken();
      const eid = await resolveBuilderExpertId();
      if (!token || !eid || !cid) return;
      try {
        await putJson<{ items?: BuilderTopicV1[] }>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/topics`,
          { topicIds: [...builderCourseSettingsSelectedTopicIds] },
          token,
        );
        const refreshed = await fetchJson<{ items?: BuilderTopicV1[] }>(
          `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/topics`,
          token,
        );
        const courseItems = refreshed.items ?? [];
        const baseIds = new Set(builderCourseSettingsAllTopics.map((t) => t.id));
        builderCourseSettingsExtraTopics = courseItems.filter((t) => !baseIds.has(t.id));
        builderCourseSettingsSelectedTopicIds = new Set(courseItems.map((t) => t.id));
        renderBuilderCourseTopicsCheckboxes(root);
        window.alert('Темы сохранены.');
      } catch {
        window.alert('Не удалось сохранить темы.');
      }
    }

    // Подгружаем данные на старте
    void hydrateTopbarUser().then(() => {
      if (shouldOpenAdminOnLoad) void openAdminDrawer(shell.shadowRoot);
      const r = shell.shadowRoot;
      const isExpertTab = r.getElementById('tab-expert')?.classList.contains('active');
      const dash = r.getElementById('screen-e-dashboard');
      if (expertShellAccess.allowed && isExpertTab && dash?.classList.contains('active')) {
        void hydrateExpertDashboard(r);
      }
    });
    if (isShellStudentMode(shell.shadowRoot)) {
      primeStudentCatalogLoading(shell.shadowRoot);
      primeStudentMyCoursesLoading(shell.shadowRoot);
    }
    void hydrateStudentCatalog();
    void hydrateMyCourses();

    function fillCoursePreview(course: CourseV1): void {
      const root = shell.shadowRoot;
      const screen = root.getElementById('screen-s-course');
      if (!screen) return;

      const modulesCount = Math.max(0, Math.trunc(Number(course.modulesCount ?? 0)));
      const lessonsCount = Math.max(0, Math.trunc(Number(course.lessonsCount ?? 0)));

      (screen.querySelector('[data-ep-course-preview-title]') as HTMLElement | null)?.replaceChildren(
        document.createTextNode('Курс'),
      );
      (screen.querySelector('[data-ep-course-preview-h1]') as HTMLElement | null)!.textContent = course.title;
      const authorLine = screen.querySelector('[data-ep-course-preview-author-line]') as HTMLElement | null;
      const authorName = (course.authorName ?? '').trim();
      if (authorLine) {
        if (authorName) {
          authorLine.style.display = '';
          authorLine.removeAttribute('hidden');
          authorLine.textContent = `Автор курса — ${authorName}`;
        } else {
          authorLine.style.display = 'none';
          authorLine.setAttribute('hidden', '');
          authorLine.textContent = '';
        }
      }
      setRichTextWithLinks(
        screen.querySelector('[data-ep-course-preview-desc]') as HTMLElement | null,
        (course.description ?? '').trim() || 'Описание курса появится здесь.',
      );
      const subEl = screen.querySelector('[data-ep-course-preview-sub]') as HTMLElement | null;
      if (subEl) {
        if (modulesCount === 0 && lessonsCount === 0) {
          subEl.textContent = 'Пока нет опубликованных модулей и уроков';
        } else {
          const parts: string[] = [];
          if (modulesCount > 0) {
            parts.push(`${modulesCount} ${pluralRu(modulesCount, ['модуль', 'модуля', 'модулей'])}`);
          }
          if (lessonsCount > 0) {
            parts.push(`${lessonsCount} ${pluralRu(lessonsCount, ['урок', 'урока', 'уроков'])}`);
          }
          subEl.textContent = parts.length > 0 ? parts.join(' · ') : 'Структура курса уточняется';
        }
      }
      const lesStat = screen.querySelector('[data-ep-course-preview-stat-lessons]') as HTMLElement | null;
      if (lesStat) lesStat.textContent = String(lessonsCount);
      const modStat = screen.querySelector('[data-ep-course-preview-stat-modules]') as HTMLElement | null;
      if (modStat) modStat.textContent = String(modulesCount);
      const hrsRaw = course.estimatedCompletionHours;
      const hNum =
        typeof hrsRaw === 'number' && Number.isFinite(hrsRaw) && hrsRaw >= 1 ? Math.min(8760, Math.trunc(hrsRaw)) : null;
      const hrsEl = screen.querySelector('[data-ep-course-preview-stat-hours]') as HTMLElement | null;
      if (hrsEl) hrsEl.textContent = hNum != null ? `${hNum}\u00a0ч` : '—';

      const diffEl = screen.querySelector('[data-ep-course-preview-stat-difficulty]') as HTMLElement | null;
      if (diffEl) {
        const d = (course.difficultyLevel ?? null) as any;
        diffEl.classList.remove(
          'ep-course-preview-difficulty--easy',
          'ep-course-preview-difficulty--medium',
          'ep-course-preview-difficulty--hard',
        );
        diffEl.textContent = d === 'easy' ? 'Легкий' : d === 'medium' ? 'Средний' : d === 'hard' ? 'Сложный' : '—';
        if (d === 'easy') diffEl.classList.add('ep-course-preview-difficulty--easy');
        else if (d === 'medium') diffEl.classList.add('ep-course-preview-difficulty--medium');
        else if (d === 'hard') diffEl.classList.add('ep-course-preview-difficulty--hard');
      }

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

      const enrollRaw = (course.enrollmentContactUrl ?? '').trim();
      studentCoursePreviewEnrollmentUrl = enrollRaw && isStudentEnrollmentContactUrl(enrollRaw) ? enrollRaw : null;
    }

    async function openCoursePreview(courseId: string): Promise<void> {
      shell.setRole('student', { screenId: 's-course' });
      const token = getAccessToken() ?? undefined;
      const res = await fetchJson<CourseDetailResponseV1>(`/courses/${encodeURIComponent(courseId)}`, token);
      fillCoursePreview(res.course);
    }

    // Reactions to UI actions (course / lesson)
    const prevOnAction = (shell as any).__onAction as ((action: any, ev: Event) => void) | undefined;
    // (we cannot modify mountPlatformShell to store handler; instead we listen to emitted actions by wrapping at mount time)
    // Since we already have `onAction` above, we handle actions via ShadowRoot click hooks:
    shell.shadowRoot.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement | null;

      const supportTg = t?.closest('[data-ep-support-tg]') as HTMLElement | null;
      if (supportTg) {
        ev.preventDefault();
        ev.stopPropagation();
        const url = getTelegramSupportUrl();
        if (!url) {
          window.alert('Поддержка через Telegram пока не настроена. Напишите на hello@edify.su.');
          return;
        }
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.href = url;
        return;
      }

      const refCopy = t?.closest('[data-ep-referral-copy]') as HTMLElement | null;
      if (refCopy) {
        ev.preventDefault();
        ev.stopPropagation();
        const link = expertReferralShareLink.trim();
        if (!link) {
          window.alert('Ссылка ещё не загружена. Откройте раздел «Реферальная программа» снова.');
          return;
        }
        void (async () => {
          const ok = await copyText(link);
          window.alert(ok ? 'Ссылка скопирована.' : 'Не удалось скопировать.');
        })();
        return;
      }
      const refShare = t?.closest('[data-ep-referral-share]') as HTMLElement | null;
      if (refShare) {
        ev.preventDefault();
        ev.stopPropagation();
        const link = expertReferralShareLink.trim();
        if (!link) {
          window.alert('Ссылка ещё не загружена.');
          return;
        }
        const title = 'Реферальная программа EDIFY';
        const text = 'Регистрируйтесь по моей ссылке';
        if (typeof navigator.share === 'function') {
          void navigator
            .share({ title, text, url: link })
            .catch(async () => {
              const ok = await copyText(link);
              window.alert(ok ? 'Ссылка скопирована.' : 'Не удалось поделиться или скопировать.');
            });
        } else {
          void (async () => {
            const ok = await copyText(link);
            window.alert(ok ? 'Ссылка скопирована — вставьте в мессенджер или почту.' : 'Не удалось скопировать.');
          })();
        }
        return;
      }
      const refQr = t?.closest('[data-ep-referral-qr]') as HTMLElement | null;
      if (refQr) {
        ev.preventDefault();
        ev.stopPropagation();
        const link = expertReferralShareLink.trim();
        if (!link) {
          window.alert('Ссылка ещё не загружена.');
          return;
        }
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`;
        window.open(qrImg, '_blank', 'noopener,noreferrer');
        return;
      }

      const dashActAll = t?.closest('[data-ep-e-dashboard-activity-all]') as HTMLElement | null;
      if (dashActAll) {
        ev.preventDefault();
        expertStudentsView = 'activity';
        shell.showScreen('e-students');
        void hydrateExpertStudents(shell.shadowRoot);
        void hydrateExpertStudentsActivity(shell.shadowRoot);
        return;
      }

      const eStudActToggle = t?.closest('[data-ep-e-students-activity-toggle]') as HTMLElement | null;
      if (eStudActToggle) {
        ev.preventDefault();
        const next = expertStudentsView === 'activity' ? 'table' : 'activity';
        setExpertStudentsView(shell.shadowRoot, next);
        if (next === 'activity') void hydrateExpertStudentsActivity(shell.shadowRoot);
        return;
      }
      const eStudActBack = t?.closest('[data-ep-e-students-activity-back]') as HTMLElement | null;
      if (eStudActBack) {
        ev.preventDefault();
        setExpertStudentsView(shell.shadowRoot, 'table');
        return;
      }

      const dashMonthBtn = t?.closest('[data-ep-e-dashboard-month-btn]') as HTMLElement | null;
      if (dashMonthBtn) {
        ev.preventDefault();
        openExpertDashboardMonthPop(shell.shadowRoot);
        return;
      }
      const dashMonthBackdrop = t?.closest('[data-ep-e-dashboard-month-backdrop]') as HTMLElement | null;
      const dashMonthCancel = t?.closest('[data-ep-e-dashboard-month-cancel]') as HTMLElement | null;
      if (dashMonthBackdrop || dashMonthCancel) {
        ev.preventDefault();
        closeExpertDashboardMonthPop(shell.shadowRoot);
        return;
      }
      const dashMonthApply = t?.closest('[data-ep-e-dashboard-month-apply]') as HTMLElement | null;
      if (dashMonthApply) {
        ev.preventDefault();
        expertDashboardYear = expertDashboardDraftYear;
        expertDashboardMonth = expertDashboardDraftMonth;
        closeExpertDashboardMonthPop(shell.shadowRoot);
        void hydrateExpertDashboard(shell.shadowRoot);
        return;
      }
      const dashPrevYear = t?.closest('[data-ep-e-dashboard-month-prev-year]') as HTMLElement | null;
      if (dashPrevYear) {
        ev.preventDefault();
        expertDashboardDraftYear -= 1;
        renderExpertDashboardMonthPop(shell.shadowRoot);
        return;
      }
      const dashNextYear = t?.closest('[data-ep-e-dashboard-month-next-year]') as HTMLElement | null;
      if (dashNextYear) {
        ev.preventDefault();
        expertDashboardDraftYear += 1;
        renderExpertDashboardMonthPop(shell.shadowRoot);
        return;
      }
      const dashMonthPick = t?.closest('[data-ep-e-dashboard-month-pick]') as HTMLElement | null;
      if (dashMonthPick) {
        ev.preventDefault();
        const mo = parseInt((dashMonthPick as HTMLElement).dataset.epEDashboardMonthPick ?? '0', 10);
        if (mo >= 1 && mo <= 12) {
          expertDashboardDraftMonth = mo;
          renderExpertDashboardMonthPop(shell.shadowRoot);
        }
        return;
      }

      const dashHwPick = t?.closest('[data-ep-e-dashboard-hw-pick]') as HTMLElement | null;
      if (dashHwPick && canReviewHomework()) {
        ev.preventDefault();
        const sid = (dashHwPick as HTMLElement).dataset.epEDashboardHwPick?.trim();
        if (sid) {
          expertHomeworkSelectedSubmissionId = sid;
          shell.showScreen('e-homework');
          void hydrateExpertHomework(shell.shadowRoot);
          void hydrateExpertHomeworkBadge(shell.shadowRoot);
          void openExpertHomeworkDetail(shell.shadowRoot, sid);
        }
        return;
      }

      const dashCourseEdit = t?.closest('[data-ep-e-dashboard-course-edit]') as HTMLElement | null;
      if (dashCourseEdit) {
        ev.preventDefault();
        ev.stopPropagation();
        const cid = dashCourseEdit.dataset.epExpertEditorCourseId?.trim();
        const xe = dashCourseEdit.dataset.epExpertEditorExpertId?.trim();
        if (cid) {
          expertBuilderExpertId = xe && xe.length > 0 ? xe : null;
          expertBuilderCourseId = cid;
          suppressBuilderNavigateHydrate = true;
          shell.showScreen('e-builder');
          suppressBuilderNavigateHydrate = false;
          void openExpertBuilderEdit(shell.shadowRoot, cid);
        }
        return;
      }
      const dashCoursePreview = t?.closest('[data-ep-e-dashboard-course-preview]') as HTMLElement | null;
      if (dashCoursePreview) {
        ev.preventDefault();
        ev.stopPropagation();
        const cid = dashCoursePreview.dataset.epExpertEditorCourseId?.trim();
        if (cid) void openCoursePreview(cid);
        return;
      }

      const eStF = t?.closest?.('[data-ep-e-students-filter]') as HTMLElement | null;
      const eStI = t?.closest?.('[data-ep-e-students-invite]') as HTMLElement | null;
      if (eStF || eStI) {
        ev.preventDefault();
        window.alert('Скоро.');
        return;
      }

      const enrollCta = t?.closest('[data-ep-course-preview-cta]') as HTMLElement | null;
      if (enrollCta) {
        ev.preventDefault();
        ev.stopPropagation();
        const u = (studentCoursePreviewEnrollmentUrl ?? '').trim();
        if (u) {
          window.open(u, '_blank', 'noopener,noreferrer');
        } else {
          window.alert('Автор курса ещё не указал ссылку для записи. Напишите ему другим способом или дождитесь обновления страницы курса.');
        }
        return;
      }

      // When clicking sidebar item, show "Loading…" immediately (before shell swaps screens)
      const navBtn = t?.closest?.('[data-ep-screen]') as HTMLElement | null;
      if (navBtn?.dataset?.epScreen === 's-lesson' && isShellStudentMode(shell.shadowRoot)) {
        primeStudentLessonLoadingState(shell.shadowRoot);
      }

      // Close access suggestions when clicking outside input/list
      const suggestHost = shell.shadowRoot.querySelector('[data-ep-access-suggest]') as HTMLElement | null;
      if (
        suggestHost &&
        suggestHost.style.display !== 'none' &&
        !t?.closest('[data-ep-access-suggest]') &&
        !t?.closest('[data-ep-access-enroll-username]') &&
        !t?.closest('[data-ep-access-enroll-name]')
      ) {
        suggestHost.style.display = 'none';
      }

      // Close admin suggestions when clicking outside input/list
      const anyAdminOpen = Array.from(shell.shadowRoot.querySelectorAll<HTMLElement>('[data-ep-admin-suggest]')).some(
        (el) => el.style.display !== 'none' && el.childElementCount > 0,
      );
      if (
        anyAdminOpen &&
        !t?.closest('[data-ep-admin-suggest]') &&
        !t?.closest('[data-ep-admin-name-pair]')
      ) {
        shell.shadowRoot.querySelectorAll<HTMLElement>('[data-ep-admin-suggest]').forEach((el) => (el.style.display = 'none'));
      }

      // Builder top tabs (robust fallback in case shell action hook isn't triggered)
      const builderTab = t?.closest('[data-ep-builder-tabs] .tab') as HTMLButtonElement | null;
      if (builderTab) {
        ev.preventDefault();
        void switchExpertBuilderTab(shell.shadowRoot, (builderTab.textContent ?? '').trim());
        return;
      }

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

      const assDl = t?.closest('[data-ep-assignment-download]') as HTMLElement | null;
      const assFileId = assDl?.dataset.epAssignmentFileId;
      const assLessonId = assDl?.dataset.epLessonId;
      const assFilename = assDl?.dataset.epAssignmentFilename;
      if (assFileId && assLessonId) {
        ev.preventDefault();
        void (async () => {
          try {
            const tok = getAccessToken() ?? undefined;
            if (!tok) throw new Error('no token');
            const api = getApiBaseUrl();
            if (!api) throw new Error('API base url is empty');
            const url = `${api}/lessons/${encodeURIComponent(assLessonId)}/assignment/files/${encodeURIComponent(assFileId)}/download`;
            const name = assFilename ? decodeURIComponent(assFilename) : 'file';
            await downloadAuthenticatedFile({ url, fallbackFilename: name || 'file' });
          } catch {
            window.alert('Не удалось скачать файл');
          }
        })();
        return;
      }

      const matDl = t?.closest('[data-ep-lesson-material-download]') as HTMLElement | null;
      const matKey = matDl?.dataset.epLessonMaterialKey;
      if (matKey) {
        ev.preventDefault();
        void (async () => {
          try {
            const url = await getSignedFileUrl(matKey);
            if (!url) throw new Error('no url');
            window.open(url + (url.includes('?') ? '&' : '?') + 'dl=1', '_blank', 'noopener');
          } catch {
            window.alert('Не удалось скачать файл');
          }
        })();
        return;
      }

      const matOpen = t?.closest('[data-ep-lesson-material-open]') as HTMLElement | null;
      const matOpenKey = matOpen?.dataset.epLessonMaterialKey;
      if (matOpenKey) {
        ev.preventDefault();
        void (async () => {
          try {
            const url = await getSignedFileUrl(matOpenKey);
            if (!url) throw new Error('no url');
            window.open(url, '_blank', 'noopener');
          } catch {
            window.alert('Не удалось открыть файл');
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
          const xe = exCard.dataset.epExpertEditorExpertId;
          expertBuilderExpertId = xe && xe.trim() ? xe.trim() : null;
          expertBuilderCourseId = exCid;
          suppressBuilderNavigateHydrate = true;
          shell.showScreen('e-builder');
          suppressBuilderNavigateHydrate = false;
          void openExpertBuilderEdit(shell.shadowRoot, exCid);
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
            const xe = exCard.dataset.epExpertEditorExpertId;
            const eid = xe && xe.trim() ? xe.trim() : await resolveActiveExpertId();
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
          const ec = exCard.dataset.epExpertEditorCourseId;
          if (ec) {
            const xe = exCard.dataset.epExpertEditorExpertId;
            expertBuilderExpertId = xe && xe.trim() ? xe.trim() : null;
            expertBuilderCourseId = ec;
            suppressBuilderNavigateHydrate = true;
            shell.showScreen('e-builder');
            suppressBuilderNavigateHydrate = false;
            void openExpertBuilderEdit(shell.shadowRoot, ec);
          }
        }
        return;
      }

      const bModHead = t?.closest('[data-ep-builder-mod-tree] [data-ep-mod-toggle]') as HTMLElement | null;
      const pickMid = bModHead?.dataset.epBuilderModuleId;
      if (bModHead && pickMid && !t?.closest('[data-ep-builder-module-menu]')) {
        ev.preventDefault();
        void selectBuilderModule(shell.shadowRoot, pickMid);
        return;
      }

      const mvUpEl = t?.closest('[data-ep-builder-lesson-move-up]') as HTMLElement | null;
      const mvDownEl = t?.closest('[data-ep-builder-lesson-move-down]') as HTMLElement | null;
      const mvEl = mvUpEl ?? mvDownEl;
      if (mvEl) {
        ev.preventDefault();
        ev.stopPropagation();
        const mid = mvEl.dataset.epBuilderModuleId;
        const lid = mvEl.dataset.epBuilderLessonId;
        if (mid && lid) {
          void builderMoveLessonStep(shell.shadowRoot, mid, lid, mvUpEl ? -1 : 1);
        }
        return;
      }

      const bLesson = t?.closest('[data-ep-builder-lesson-id]') as HTMLElement | null;
      const bLid = bLesson?.dataset.epBuilderLessonId;
      const bMid = bLesson?.dataset.epBuilderModuleId;
      if (bLesson && bLid && bMid) {
        ev.preventDefault();
        void selectBuilderLesson(shell.shadowRoot, bMid, bLid);
        return;
      }

      const lessonMenu = t?.closest('[data-ep-builder-lesson-menu]') as HTMLElement | null;
      const lmId = lessonMenu?.dataset.epBuilderLessonId;
      const lmMid = lessonMenu?.dataset.epBuilderModuleId;
      if (lessonMenu && lmId && lmMid) {
        ev.preventDefault();
        void builderDeleteLesson(shell.shadowRoot, lmMid, lmId);
        return;
      }

      const modMenu = t?.closest('[data-ep-builder-module-menu]') as HTMLElement | null;
      const mmId = modMenu?.dataset.epBuilderModuleId;
      if (modMenu && mmId) {
        ev.preventDefault();
        openBuilderModuleActions(shell.shadowRoot, mmId);
        return;
      }

      if (
        t?.closest('[data-ep-module-actions-backdrop]') ||
        t?.closest('[data-ep-module-actions-close]') ||
        t?.closest('[data-ep-module-actions-cancel]')
      ) {
        ev.preventDefault();
        closeBuilderModuleActions(shell.shadowRoot);
        return;
      }

      if (t?.closest('[data-ep-module-actions-add-attestation]')) {
        ev.preventDefault();
        const mid = builderModuleActionsModuleId;
        if (!mid) return;
        closeBuilderModuleActions(shell.shadowRoot);
        void builderCreateAttestation(shell.shadowRoot, mid);
        return;
      }

      if (t?.closest('[data-ep-module-actions-save]')) {
        ev.preventDefault();
        const mid = builderModuleActionsModuleId;
        const inp = shell.shadowRoot.querySelector('[data-ep-module-actions-title]') as HTMLInputElement | null;
        const next = (inp?.value ?? '').trim();
        if (!mid) return;
        if (!next) {
          window.alert('Введите название модуля.');
          return;
        }
        closeBuilderModuleActions(shell.shadowRoot);
        void builderRenameModule(shell.shadowRoot, mid, next);
        return;
      }

      if (t?.closest('[data-ep-module-actions-delete]')) {
        ev.preventDefault();
        const mid = builderModuleActionsModuleId;
        if (!mid) return;
        closeBuilderModuleActions(shell.shadowRoot);
        void builderDeleteModule(shell.shadowRoot, mid);
        return;
      }

      if (t?.closest('[data-ep-builder-add-module]')) {
        ev.preventDefault();
        void builderAddModule(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-add-lesson]')) {
        ev.preventDefault();
        void builderAddLesson(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-add-attestation]')) {
        ev.preventDefault();
        void builderAddAttestation(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-save-attestation]')) {
        ev.preventDefault();
        void builderSaveAttestation(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-attestation-add-question]')) {
        ev.preventDefault();
        builderAddAttestationQuestion(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-profile-save]')) {
        ev.preventDefault();
        void saveProfileFromScreen(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-profile-upload]')) {
        ev.preventDefault();
        const screen = shell.shadowRoot.getElementById('screen-s-profile') as HTMLElement | null;
        const inp = screen?.querySelector('[data-ep-profile-avatar-input]') as HTMLInputElement | null;
        inp?.click();
        return;
      }
      if (t?.closest('[data-ep-profile-connect-telegram]')) {
        ev.preventDefault();
        void startTelegramConnect();
        return;
      }
      if (t?.closest('[data-ep-builder-save-lesson]')) {
        ev.preventDefault();
        void saveBuilderLesson(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-slider-open]')) {
        ev.preventDefault();
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const mid = builderSelectedModuleId;
          const lid = builderSelectedLessonId;
          if (!tok || !eid || !mid || !lid) {
            window.alert('Выберите урок в дереве слева.');
            return;
          }
          const bd = shell.shadowRoot.querySelector('[data-ep-slider-backdrop]') as HTMLElement | null;
          const md = shell.shadowRoot.querySelector('[data-ep-slider-modal]') as HTMLElement | null;
          if (!bd || !md) return;
          const existing = builderSliderByLessonId.get(lid) ?? { images: [] as { key: string }[] };
          builderSliderDraft = { lessonId: lid, images: existing.images.slice() };
          bd.style.display = '';
          md.style.display = '';
          renderBuilderSliderGrid(shell.shadowRoot);
        })();
        return;
      }
      if (t?.closest('[data-ep-builder-presentation-add]')) {
        ev.preventDefault();
        if (!builderSelectedLessonId) {
          window.alert('Выберите урок в дереве слева.');
          return;
        }
        const inp = shell.shadowRoot.querySelector('input[data-ep-presentation-file-input]') as HTMLInputElement | null;
        inp?.click();
        return;
      }

      if (t?.closest('[data-ep-builder-materials-add]')) {
        ev.preventDefault();
        if (!builderSelectedLessonId) {
          window.alert('Выберите урок в дереве слева.');
          return;
        }
        const inp = shell.shadowRoot.querySelector('input[data-ep-builder-materials-file-input]') as HTMLInputElement | null;
        inp?.click();
        return;
      }

      const matsDel = t?.closest('[data-ep-builder-materials-del-file]') as HTMLElement | null;
      const matsFileId = matsDel?.dataset.epBuilderMaterialsDelFile;
      if (matsFileId) {
        ev.preventDefault();
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const lid = builderSelectedLessonId;
          if (!tok || !eid || !lid) return;
          if (!window.confirm('Удалить материал из урока?')) return;
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lid)}/materials/${encodeURIComponent(matsFileId)}/delete`,
              {},
              tok,
            );
            await applyBuilderLessonToForm(shell.shadowRoot, eid, tok);
          } catch {
            window.alert('Не удалось удалить файл (нужна роль менеджера+).');
          }
        })();
        return;
      }

      const matsDl = t?.closest('[data-ep-builder-materials-dl-key]') as HTMLElement | null;
      const matsKey = matsDl?.dataset.epBuilderMaterialsDlKey;
      if (matsKey) {
        ev.preventDefault();
        void (async () => {
          try {
            const url = await getSignedFileUrl(matsKey);
            if (!url) throw new Error('no url');
            window.open(url + (url.includes('?') ? '&' : '?') + 'dl=1', '_blank', 'noopener');
          } catch {
            window.alert('Не удалось скачать файл');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-builder-presentation-remove]')) {
        ev.preventDefault();
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const mid = builderSelectedModuleId;
          const lid = builderSelectedLessonId;
          if (!tok || !eid || !mid || !lid) return;
          if (!window.confirm('Удалить презентацию из урока?')) return;
          try {
            await patchJson(
              `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons/${encodeURIComponent(lid)}`,
              { presentation: null },
              tok,
            );
            builderPresentationByLessonId.set(lid, null);
            const preview = shell.shadowRoot.querySelector('[data-ep-builder-presentation-preview]') as HTMLElement | null;
            if (preview) {
              preview.style.display = 'none';
              preview.replaceChildren();
            }
            const removeBtn = shell.shadowRoot.querySelector('[data-ep-builder-presentation-remove]') as HTMLElement | null;
            if (removeBtn) removeBtn.style.display = 'none';
            window.alert('Презентация удалена.');
          } catch {
            window.alert('Не удалось удалить презентацию.');
          }
        })();
        return;
      }
      if (
        t?.closest('[data-ep-slider-backdrop]') ||
        t?.closest('[data-ep-slider-close]') ||
        t?.closest('[data-ep-slider-cancel]')
      ) {
        ev.preventDefault();
        closeBuilderSliderModal(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-slider-add]')) {
        ev.preventDefault();
        const inp = shell.shadowRoot.querySelector('[data-ep-slider-file-input]') as HTMLInputElement | null;
        inp?.click();
        return;
      }

      const presOpen = t?.closest('[data-ep-pres-open]') as HTMLElement | null;
      if (presOpen) {
        ev.preventDefault();
        const url = (presOpen.dataset.epPresPdfUrl ?? '').trim();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const presDl = t?.closest('[data-ep-pres-dl]') as HTMLElement | null;
      if (presDl) {
        ev.preventDefault();
        const url = (presDl.dataset.epPresUrl ?? '').trim();
        if (!url) return;
        const dlUrl = url.includes('?') ? `${url}&dl=1` : `${url}?dl=1`;
        window.open(dlUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const presFs = t?.closest('[data-ep-pres-fs]') as HTMLElement | null;
      if (presFs) {
        ev.preventDefault();
        const presWrap = (presFs.closest('.ep-lesson-pres') as HTMLElement | null) ?? null;
        const iframe = presWrap?.querySelector('iframe') as HTMLIFrameElement | null;
        const target = (iframe as any) ?? presWrap;
        const req = target && typeof (target as any).requestFullscreen === 'function' ? (target as any) : presWrap;
        if (!req || typeof (req as any).requestFullscreen !== 'function') {
          // Fallback: open in a new tab (browser PDF viewer has fullscreen)
          const url = (presWrap?.querySelector('[data-ep-pres-open]') as HTMLElement | null)?.dataset.epPresPdfUrl ?? '';
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        try {
          void (req as any).requestFullscreen();
        } catch {
          const url = (presWrap?.querySelector('[data-ep-pres-open]') as HTMLElement | null)?.dataset.epPresPdfUrl ?? '';
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      const del = t?.closest('[data-ep-slider-del-idx]') as HTMLElement | null;
      if (del && builderSliderDraft) {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = Number(del.dataset.epSliderDelIdx ?? 'NaN');
        if (Number.isFinite(idx) && idx >= 0 && idx < builderSliderDraft.images.length) {
          builderSliderDraft.images = builderSliderDraft.images.filter((_, i) => i !== idx);
          renderBuilderSliderGrid(shell.shadowRoot);
        }
        return;
      }
      const item = t?.closest('[data-ep-slider-idx]') as HTMLElement | null;
      if (item && builderSliderDraft) {
        const idx = Number(item.dataset.epSliderIdx ?? 'NaN');
        if (Number.isFinite(idx)) {
          ev.preventDefault();
          openBuilderSliderViewer(shell.shadowRoot, idx);
          return;
        }
      }
      if (t?.closest('[data-ep-slider-save]')) {
        ev.preventDefault();
        if (!builderSliderDraft) return;
        builderSliderByLessonId.set(builderSliderDraft.lessonId, { images: builderSliderDraft.images.slice() });
        closeBuilderSliderModal(shell.shadowRoot);
        window.alert('Слайдер сохранён. Не забудьте нажать «Сохранить» для урока.');
        return;
      }
      if (
        t?.closest('[data-ep-slider-viewer-backdrop]') ||
        t?.closest('[data-ep-slider-viewer-close]') ||
        t?.matches?.('[data-ep-slider-viewer]') ||
        t?.matches?.('.ep-slider-viewer__img-wrap')
      ) {
        ev.preventDefault();
        closeBuilderSliderViewer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-slider-viewer-prev]') || t?.closest('[data-ep-slider-viewer-next]')) {
        ev.preventDefault();
        const vw = shell.shadowRoot.querySelector('[data-ep-slider-viewer]') as any;
        if (!vw || typeof vw.__epSliderGetIndex !== 'function' || typeof vw.__epSliderSetIndex !== 'function') return;
        const cur = Number(vw.__epSliderGetIndex());
        const delta = t.closest('[data-ep-slider-viewer-prev]') ? -1 : 1;
        vw.__epSliderSetIndex(cur + delta);
        return;
      }

      const lessonSlider = t?.closest('[data-ep-lesson-slider]') as HTMLElement | null;
      if (lessonSlider) {
        const host = lessonSlider;
        const set = (host as any).__epSliderSet as ((n: number) => void) | undefined;
        const getIndex = (host as any).__epSliderIndex as (() => number) | undefined;
        const keys = (host as any).__epSliderKeys as string[] | undefined;
        if (!set || !getIndex || !Array.isArray(keys) || keys.length === 0) return;
        if (t?.closest('[data-ep-lesson-slider-prev]')) {
          ev.preventDefault();
          set(getIndex() - 1);
          return;
        }
        if (t?.closest('[data-ep-lesson-slider-next]')) {
          ev.preventDefault();
          set(getIndex() + 1);
          return;
        }
        if (t?.closest('[data-ep-lesson-slider-fs]')) {
          ev.preventDefault();
          openKeyViewer(shell.shadowRoot, keys, getIndex());
          return;
        }
      }
      if (t?.closest('[data-ep-builder-save-hw]')) {
        ev.preventDefault();
        void saveBuilderHomework(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-open-course-settings]')) {
        ev.preventDefault();
        void openBuilderCourseSettingsDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-open-course-access]')) {
        ev.preventDefault();
        void openBuilderCourseAccessDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-cert-menu-backdrop]') || t?.closest('[data-ep-builder-cert-menu-cancel]')) {
        ev.preventDefault();
        closeBuilderCertificateActionMenu(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-cert-menu-replace]')) {
        ev.preventDefault();
        closeBuilderCertificateActionMenu(shell.shadowRoot);
        const inp = shell.shadowRoot.querySelector('input[data-ep-builder-course-certificate-input]') as HTMLInputElement | null;
        if (inp) {
          inp.value = '';
          inp.click();
        }
        return;
      }
      if (t?.closest('[data-ep-builder-cert-menu-delete]')) {
        ev.preventDefault();
        closeBuilderCertificateActionMenu(shell.shadowRoot);
        if (window.confirm('Удалить загруженный сертификат курса?')) {
          void deleteBuilderCertificate(shell.shadowRoot);
        }
        return;
      }
      if (t?.closest('[data-ep-builder-course-certificate]')) {
        ev.preventDefault();
        const inp = shell.shadowRoot.querySelector('input[data-ep-builder-course-certificate-input]') as HTMLInputElement | null;
        if (!builderCourseDetail) return;
        const uploaded = builderCourseDetail.certificateUploaded === true;
        if (uploaded) {
          openBuilderCertificateActionMenu(shell.shadowRoot);
        } else if (inp) {
          inp.value = '';
          inp.click();
        }
        return;
      }
      if (t?.closest('[data-ep-admin-drawer-backdrop]') || t?.closest('[data-ep-admin-drawer-close]')) {
        ev.preventDefault();
        closeAdminDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-course-drawer-backdrop]') || t?.closest('[data-ep-course-drawer-close]')) {
        ev.preventDefault();
        closeBuilderCourseSettingsDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-access-drawer-backdrop]') || t?.closest('[data-ep-access-drawer-close]')) {
        ev.preventDefault();
        closeBuilderCourseAccessDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-team-drawer-backdrop]') || t?.closest('[data-ep-team-drawer-close]')) {
        ev.preventDefault();
        closeExpertTeamDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-team-add-open]')) {
        ev.preventDefault();
        void openExpertTeamDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-team-member-edit]')) {
        ev.preventDefault();
        const btn = t.closest('[data-ep-team-member-edit]') as HTMLElement | null;
        const uid = (btn?.dataset.epTeamMemberUserId ?? '').trim();
        if (!uid) return;
        const row = expertTeamLastRows.find((x) => x.userId === uid);
        if (!row) return;
        void openExpertTeamDrawerEdit(shell.shadowRoot, row);
        return;
      }
      if (t?.closest('[data-ep-team-drawer-delete]')) {
        ev.preventDefault();
        void (async () => {
          if (!canManageExpertTeam() || !expertTeamDrawerEdit) return;
          if (!window.confirm('Удалить участника из команды? Доступ к курсам будет отозван.')) return;
          const token = getAccessToken();
          const eid = await resolveActiveExpertId();
          const uid = expertTeamDrawerEdit.userId;
          if (!token || !eid || !uid) return;
          try {
            await deleteJson(`/experts/${encodeURIComponent(eid)}/team/members/${encodeURIComponent(uid)}`, token);
            closeExpertTeamDrawer(shell.shadowRoot);
            void hydrateExpertTeam(shell.shadowRoot);
            window.alert('Участник удалён из команды.');
          } catch {
            window.alert('Не удалось удалить участника.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-team-submit]')) {
        ev.preventDefault();
        void (async () => {
          if (!canManageExpertTeam()) return;
          const token = getAccessToken();
          const eid = await resolveActiveExpertId();
          if (!token || !eid) return;
          const hid = shell.shadowRoot.querySelector('[data-ep-team-user-id]') as HTMLInputElement | null;
          const roleSel = shell.shadowRoot.querySelector('[data-ep-team-role]') as HTMLSelectElement | null;
          const userId = (hid?.value ?? expertTeamDrawerSelectedUserId ?? '').trim();
          const role = (roleSel?.value ?? 'reviewer').trim() as 'reviewer' | 'support';
          const boxes = shell.shadowRoot.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"][data-ep-team-course-id]',
          );
          const courseIds: string[] = [];
          boxes.forEach((cb) => {
            if (cb.checked && cb.dataset.epTeamCourseId) courseIds.push(cb.dataset.epTeamCourseId);
          });

          if (expertTeamDrawerEdit) {
            if (!userId) {
              window.alert('Не удалось определить пользователя.');
              return;
            }
            if (courseIds.length === 0) {
              window.alert('Выберите хотя бы один курс.');
              return;
            }
            try {
              const body: { role: typeof role; courseIds: string[] } = { role, courseIds };
              await patchJson(
                `/experts/${encodeURIComponent(eid)}/team/members/${encodeURIComponent(userId)}`,
                body,
                token,
              );
              closeExpertTeamDrawer(shell.shadowRoot);
              void hydrateExpertTeam(shell.shadowRoot);
              window.alert('Изменения сохранены.');
            } catch {
              window.alert('Не удалось сохранить изменения.');
            }
            return;
          }

          if (!userId) {
            window.alert('Выберите пользователя из подсказки поиска.');
            return;
          }
          if (courseIds.length === 0) {
            window.alert('Выберите хотя бы один курс.');
            return;
          }
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/team/members`,
              { userId, role, courseIds },
              token,
            );
            closeExpertTeamDrawer(shell.shadowRoot);
            void hydrateExpertTeam(shell.shadowRoot);
            window.alert('Участник добавлен.');
          } catch {
            window.alert('Не удалось добавить участника. Нужны права владельца и корректные данные.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-e-homework-filter]')) {
        ev.preventDefault();
        const b = t.closest('[data-ep-e-homework-filter]') as HTMLElement | null;
        const v = (b?.dataset.epEHomeworkFilter ?? '').trim();
        if (v === 'all' || v === 'new' || v === 'unchecked' || v === 'checked') {
          expertHomeworkFilter = v;
          void hydrateExpertHomework(shell.shadowRoot);
        }
        return;
      }
      const hwCard = t?.closest('[data-ep-e-homework-submission-id]') as HTMLElement | null;
      if (hwCard) {
        ev.preventDefault();
        const sid = (hwCard.dataset.epEHomeworkSubmissionId ?? '').trim();
        if (sid) void openExpertHomeworkDetail(shell.shadowRoot, sid);
        return;
      }
      const starBtn = t?.closest('[data-ep-e-homework-star]') as HTMLElement | null;
      if (starBtn) {
        ev.preventDefault();
        const n = Number(starBtn.dataset.epEHomeworkStar ?? '0') || 0;
        if (n >= 1 && n <= 5) {
          expertHomeworkStars = n;
          syncHomeworkStars(shell.shadowRoot);
        }
        return;
      }
      if (t?.closest('[data-ep-e-homework-detail-file-download]')) {
        ev.preventDefault();
        void (async () => {
          const row = shell.shadowRoot.querySelector('[data-ep-e-homework-detail-file]') as HTMLElement | null;
          const submissionId = ((row as any)?.dataset?.epEHomeworkSubmissionId ?? '').trim();
          const lessonId = ((row as any)?.dataset?.epEHomeworkLessonId ?? '').trim();
          if (!submissionId || !lessonId) return;
          const token = getAccessToken();
          const eid = await resolveActiveExpertId();
          if (!token || !eid) return;
          try {
            const r = await fetchJson<{ url: string }>(
              `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lessonId)}/submissions/${encodeURIComponent(submissionId)}/file/signed`,
              token,
            );
            if (r?.url) window.open(r.url, '_blank', 'noopener');
          } catch {
            window.alert('Не удалось скачать файл.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-e-homework-send]')) {
        ev.preventDefault();
        void (async () => {
          if (!canReviewHomework()) return;
          const token = getAccessToken();
          const eid = await resolveActiveExpertId();
          if (!token || !eid) return;
          const submissionId = expertHomeworkSelectedSubmissionId;
          const lessonId = expertHomeworkSelectedLessonId;
          if (!submissionId || !lessonId) return;
          const ta = shell.shadowRoot.querySelector('[data-ep-e-homework-comment]') as HTMLTextAreaElement | null;
          const reviewerComment = (ta?.value ?? '').trim();
          const score = expertHomeworkStars;
          try {
            await patchJson(
              `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lessonId)}/submissions/${encodeURIComponent(submissionId)}`,
              { status: 'accepted', score, reviewerComment },
              token,
            );
            window.alert('Оценка отправлена.');
            void openExpertHomeworkDetail(shell.shadowRoot, submissionId);
            void hydrateExpertHomeworkBadge(shell.shadowRoot);
          } catch {
            window.alert('Не удалось отправить оценку.');
          }
        })();
        return;
      }
      // When focusing inputs, show suggestions for current value
      if (t?.closest('[data-ep-access-enroll-username]')) {
        const inp = t.closest('[data-ep-access-enroll-username]') as HTMLInputElement | null;
        if (inp) void accessSearchUsers(shell.shadowRoot, inp.value, 'username');
      } else if (t?.closest('[data-ep-access-enroll-name]')) {
        const inp = t.closest('[data-ep-access-enroll-name]') as HTMLInputElement | null;
        if (inp) void accessSearchUsers(shell.shadowRoot, inp.value, 'name');
      }
      const adminPair = t?.closest('[data-ep-admin-name-pair]') as HTMLElement | null;
      if (adminPair) {
        const h = (adminPair.dataset.epAdminNamePair ?? '').trim() as
          | 'create-owner'
          | 'members-user'
          | 'platform-user';
        if (h === 'create-owner' || h === 'members-user' || h === 'platform-user') {
          void adminSearchUsers(shell.shadowRoot, adminSearchInputQ(shell.shadowRoot, h), h);
        }
      }
      if (t?.closest('[data-ep-admin-create-expert]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const titleInp = shell.shadowRoot.querySelector('[data-ep-admin-create-expert-title]') as HTMLInputElement | null;
          const slugInp = shell.shadowRoot.querySelector('[data-ep-admin-create-expert-slug]') as HTMLInputElement | null;
          const title = (titleInp?.value ?? '').trim();
          const slug = (slugInp?.value ?? '').trim();
          const ownerUserId = adminSelectedUserIdByField.createOwner;
          if (!title) return window.alert('Введите название эксперта.');
          if (!ownerUserId) return window.alert('Выберите owner пользователя.');
          try {
            const res = await postJson<{ id: string }>('/admin/experts', { title, ownerUserId, slug: slug || undefined }, token);
            const newExpertId = res.id;
            window.alert(`Эксперт создан: ${newExpertId}`);
            if (titleInp) titleInp.value = '';
            if (slugInp) slugInp.value = '';
            const oSearch = shell.shadowRoot.querySelector('[data-ep-admin-create-expert-owner-search]') as HTMLInputElement | null;
            const oid = shell.shadowRoot.querySelector('[data-ep-admin-create-expert-owner-id]') as HTMLInputElement | null;
            if (oSearch) oSearch.value = '';
            if (oid) oid.value = '';
            adminSelectedUserIdByField = { ...adminSelectedUserIdByField, createOwner: undefined };
            const memEx = shell.shadowRoot.querySelector('[data-ep-admin-members-expert-id]') as HTMLInputElement | null;
            const subEx = shell.shadowRoot.querySelector('[data-ep-admin-sub-expert-id]') as HTMLInputElement | null;
            if (memEx) memEx.value = newExpertId;
            if (subEx) subEx.value = newExpertId;
          } catch {
            window.alert('Не удалось создать эксперта. Нужна роль admin или выше.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-members-add]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const expertInp = shell.shadowRoot.querySelector('[data-ep-admin-members-expert-id]') as HTMLInputElement | null;
          const userIdInp = shell.shadowRoot.querySelector('[data-ep-admin-members-user-id]') as HTMLInputElement | null;
          const roleSel = shell.shadowRoot.querySelector('[data-ep-admin-members-role]') as HTMLSelectElement | null;
          const expertId = (expertInp?.value ?? '').trim();
          const userId = (adminSelectedUserIdByField.membersUser ?? (userIdInp?.value ?? '')).trim();
          const role = (roleSel?.value ?? '').trim();
          if (!expertId) return window.alert('Введите Expert ID.');
          if (!userId) return window.alert('Выберите пользователя.');
          if (!role) return window.alert('Выберите роль.');
          try {
            await postJson(`/admin/experts/${encodeURIComponent(expertId)}/members`, { userId, role }, token);
            window.alert('Участник добавлен.');
          } catch {
            window.alert('Не удалось добавить участника. Проверьте права и входные данные.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-members-set-role]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const expertInp = shell.shadowRoot.querySelector('[data-ep-admin-members-expert-id]') as HTMLInputElement | null;
          const userIdInp = shell.shadowRoot.querySelector('[data-ep-admin-members-user-id]') as HTMLInputElement | null;
          const roleSel = shell.shadowRoot.querySelector('[data-ep-admin-members-role]') as HTMLSelectElement | null;
          const expertId = (expertInp?.value ?? '').trim();
          const userId = (userIdInp?.value ?? '').trim();
          const role = (roleSel?.value ?? '').trim();
          if (!expertId) return window.alert('Введите Expert ID.');
          if (!userId) return window.alert('Введите User ID.');
          if (!role) return window.alert('Выберите роль.');
          try {
            await patchJson(`/admin/experts/${encodeURIComponent(expertId)}/members/${encodeURIComponent(userId)}`, { role }, token);
            window.alert('Роль обновлена.');
          } catch {
            window.alert('Не удалось обновить роль.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-members-remove]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const expertInp = shell.shadowRoot.querySelector('[data-ep-admin-members-expert-id]') as HTMLInputElement | null;
          const userIdInp = shell.shadowRoot.querySelector('[data-ep-admin-members-user-id]') as HTMLInputElement | null;
          const expertId = (expertInp?.value ?? '').trim();
          const userId = (userIdInp?.value ?? '').trim();
          if (!expertId) return window.alert('Введите Expert ID.');
          if (!userId) return window.alert('Введите User ID.');
          if (!window.confirm('Удалить участника из команды эксперта?')) return;
          try {
            await deleteJson(`/admin/experts/${encodeURIComponent(expertId)}/members/${encodeURIComponent(userId)}`, token);
            window.alert('Участник удалён.');
          } catch {
            window.alert('Не удалось удалить участника.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-sub-grant]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const expertInp = shell.shadowRoot.querySelector('[data-ep-admin-sub-expert-id]') as HTMLInputElement | null;
          const daysInp = shell.shadowRoot.querySelector('[data-ep-admin-sub-days]') as HTMLInputElement | null;
          const expertId = (expertInp?.value ?? '').trim();
          const daysRaw = (daysInp?.value ?? '').trim();
          const days = Number(daysRaw);
          if (!expertId) return window.alert('Введите Expert ID.');
          if (!Number.isFinite(days) || !Number.isInteger(days) || days < 1) return window.alert('Введите корректное число дней.');
          try {
            await postJson(`/admin/experts/${encodeURIComponent(expertId)}/subscription/grant-days`, { days }, token);
            window.alert('Дни подписки выданы.');
          } catch {
            window.alert('Не удалось выдать дни. Доступно только owner.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-sub-expire]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const expertInp = shell.shadowRoot.querySelector('[data-ep-admin-sub-expert-id]') as HTMLInputElement | null;
          const expertId = (expertInp?.value ?? '').trim();
          if (!expertId) return window.alert('Введите Expert ID.');
          if (!window.confirm('Сделать подписку эксперта истёкшей прямо сейчас?')) return;
          try {
            await postJson(`/admin/experts/${encodeURIComponent(expertId)}/subscription/expire`, {}, token);
            window.alert('Подписка сделана истёкшей.');
          } catch {
            window.alert('Не удалось. Доступно только owner.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-platform-set]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const roleSel = shell.shadowRoot.querySelector('[data-ep-admin-platform-role]') as HTMLSelectElement | null;
          const role = (roleSel?.value ?? '').trim();
          const userId = (adminSelectedUserIdByField.platformUser ?? '').trim();
          if (!userId) return window.alert('Выберите пользователя.');
          if (!role) return window.alert('Выберите роль.');
          try {
            await postJson(`/admin/users/${encodeURIComponent(userId)}/platform-role`, { role }, token);
            window.alert('Роль платформы обновлена.');
          } catch {
            window.alert('Не удалось. Доступно только owner.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-admin-password-reset-create]')) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          if (!token) return;
          const userId = (
            adminSelectedUserIdByField.platformUser ??
            adminSelectedUserIdByField.membersUser ??
            adminSelectedUserIdByField.createOwner ??
            ''
          ).trim();
          if (!userId) return window.alert('Выберите пользователя в любом из блоков поиска (например, «Создать эксперта»).');
          const ttlInp = shell.shadowRoot.querySelector('[data-ep-admin-password-reset-ttl]') as HTMLInputElement | null;
          const linkInp = shell.shadowRoot.querySelector('[data-ep-admin-password-reset-link]') as HTMLInputElement | null;
          const ttlMinRaw = (ttlInp?.value ?? '15').trim();
          const ttlMin = Math.max(1, Math.min(24 * 60, Number(ttlMinRaw) || 15));
          try {
            const res = await postJson<{ token: string; expiresAt: string; resetPath: string }>(
              `/admin/users/${encodeURIComponent(userId)}/password-reset`,
              { ttlSeconds: ttlMin * 60 },
              token,
            );
            const full = `${window.location.origin}${res.resetPath}`;
            if (linkInp) linkInp.value = full;
            try {
              await navigator.clipboard.writeText(full);
              window.alert('Ссылка создана и скопирована в буфер обмена.');
            } catch {
              window.alert('Ссылка создана. Скопируйте её из поля.');
            }
          } catch {
            window.alert('Не удалось сгенерировать ссылку. Нужна роль admin или выше.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-course-save]')) {
        ev.preventDefault();
        void saveBuilderCourseSettingsDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-course-publish]')) {
        ev.preventDefault();
        void toggleBuilderCoursePublishFromDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-course-upload-cover]')) {
        ev.preventDefault();
        void uploadBuilderCourseCoverFromDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-course-add-custom-topic]')) {
        ev.preventDefault();
        void addBuilderCourseCustomTopic(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-course-save-topics]')) {
        ev.preventDefault();
        void saveBuilderCourseTopicsFromDrawer(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-builder-preview-lesson]')) {
        ev.preventDefault();
        void openBuilderLessonPreview(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-lesson-preview-backdrop]') || t?.closest('[data-ep-lesson-preview-close]')) {
        ev.preventDefault();
        closeBuilderLessonPreview(shell.shadowRoot);
        return;
      }
      const certCard = t?.closest('[data-ep-cert-card]') as HTMLElement | null;
      if (certCard) {
        ev.preventDefault();
        const courseId = certCard.dataset.epCertCourseId ?? '';
        const key = certCard.dataset.epCertKey ?? '';
        const courseTitle = certCard.dataset.epCertCourseTitle ?? '';
        const pdfFilename = certCard.dataset.epCertFilename ?? null;
        if (!courseId || !key) return;
        void openStudentCertificatePreview(shell.shadowRoot, { courseId, key, courseTitle, pdfFilename });
        return;
      }
      const certDl = t?.closest('[data-ep-cert-preview-download]') as HTMLElement | null;
      if (certDl) {
        ev.preventDefault();
        const key = certDl.dataset.epCertKey ?? '';
        const filename = certDl.dataset.epCertFilename ?? null;
        const courseTitle = certDl.dataset.epCertCourseTitle ?? '';
        if (!key) return;
        void downloadStudentCertificate(key, filename, courseTitle);
        return;
      }
      if (t?.closest('[data-ep-cert-preview-backdrop]') || t?.closest('[data-ep-cert-preview-close]')) {
        ev.preventDefault();
        closeStudentCertificatePreview(shell.shadowRoot);
        return;
      }
      if (t?.closest('[data-ep-access-enroll-by-username]')) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          const inp = shell.shadowRoot.querySelector('[data-ep-access-enroll-username]') as HTMLInputElement | null;
          const username = (inp?.value ?? '').trim();
          if (!username) {
            window.alert('Введите username.');
            return;
          }
          try {
            const selected = builderAccessSelectedUserIdByField.username;
            if (selected) {
              await postJson(
                `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enroll/by-user/${encodeURIComponent(selected)}`,
                {},
                token,
              );
            } else {
              await postJson(
                `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enroll/by-username/${encodeURIComponent(username.startsWith('@') ? username.slice(1) : username)}`,
                {},
                token,
              );
            }
            if (inp) inp.value = '';
            builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, username: undefined };
            const enrollments = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments`,
              token,
            );
            renderAccessEnrollments(shell.shadowRoot, enrollments.items ?? []);
            window.alert('Пользователь зачислен.');
          } catch {
            window.alert('Не удалось зачислить (проверьте роль manager+ и существование пользователя).');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-access-enroll-by-name]')) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          const inp = shell.shadowRoot.querySelector('[data-ep-access-enroll-name]') as HTMLInputElement | null;
          const name = (inp?.value ?? '').trim();
          const selected = builderAccessSelectedUserIdByField.name;
          if (!name || !selected) {
            window.alert('Выберите пользователя из списка по имени.');
            return;
          }
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enroll/by-user/${encodeURIComponent(selected)}`,
              {},
              token,
            );
            if (inp) inp.value = '';
            builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, name: undefined };
            const enrollments = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments`,
              token,
            );
            renderAccessEnrollments(shell.shadowRoot, enrollments.items ?? []);
            window.alert('Пользователь зачислен.');
          } catch {
            window.alert('Не удалось зачислить.');
          }
        })();
        return;
      }
      const extendBtn = t?.closest('[data-ep-access-extend]') as HTMLElement | null;
      const extendId = extendBtn?.dataset.epAccessExtend;
      if (extendId) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          const raw = (builderAccessGrantDaysByEnrollmentId[extendId] ?? '').trim();
          const n = parseInt(raw || '0', 10);
          if (!Number.isFinite(n) || n < 1 || n > 3650) {
            window.alert('Введите количество дней (1…3650).');
            return;
          }
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments/${encodeURIComponent(extendId)}/extend`,
              { grantDays: n },
              token,
            );
            builderAccessGrantDaysByEnrollmentId = { ...builderAccessGrantDaysByEnrollmentId, [extendId]: '' };
            const enrollments = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments`,
              token,
            );
            renderAccessEnrollments(shell.shadowRoot, enrollments.items ?? []);
            window.alert('Доступ продлён.');
          } catch {
            window.alert('Не удалось продлить доступ.');
          }
        })();
        return;
      }
      const revokeBtn = t?.closest('[data-ep-access-revoke]') as HTMLElement | null;
      const revokeId = revokeBtn?.dataset.epAccessRevoke;
      if (revokeId) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          if (!window.confirm('Отозвать доступ у ученика?')) return;
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments/${encodeURIComponent(revokeId)}/revoke`,
              {},
              token,
            );
            const enrollments = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/enrollments`,
              token,
            );
            renderAccessEnrollments(shell.shadowRoot, enrollments.items ?? []);
            window.alert('Доступ отозван.');
          } catch {
            window.alert('Не удалось отозвать доступ.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-access-invite-create]')) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          const inp = shell.shadowRoot.querySelector('[data-ep-access-invite-maxuses]') as HTMLInputElement | null;
          const raw = (inp?.value ?? '1').trim();
          const n = parseInt(raw || '1', 10);
          if (!Number.isFinite(n) || n < 1 || n > 10000) {
            window.alert('Лимит: 1…10000');
            return;
          }
          try {
            await postJson(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/invites`,
              { maxUses: n },
              token,
            );
            const invites = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/invites`,
              token,
            );
            renderAccessInvites(shell.shadowRoot, invites.items ?? []);
            window.alert('Инвайт создан.');
          } catch {
            window.alert('Не удалось создать инвайт.');
          }
        })();
        return;
      }
      const invCopyBtn = t?.closest('[data-ep-access-invite-copy]') as HTMLElement | null;
      const invCopyCode = invCopyBtn?.dataset.epAccessInviteCopy;
      if (invCopyCode) {
        ev.preventDefault();
        const link = buildInviteDeepLink(invCopyCode);
        if (!link) {
          window.alert('Не удалось сформировать ссылку: укажите meta[name="edify-telegram-bot"] на странице.');
          return;
        }
        void (async () => {
          const ok = await copyText(link);
          window.alert(ok ? 'Ссылка скопирована.' : `Ссылка: ${link}`);
        })();
        return;
      }
      const invRevokeBtn = t?.closest('[data-ep-access-invite-revoke]') as HTMLElement | null;
      const invRevokeCode = invRevokeBtn?.dataset.epAccessInviteRevoke;
      if (invRevokeCode) {
        ev.preventDefault();
        void (async () => {
          const cid = expertBuilderCourseId;
          const token = getAccessToken();
          const eid = await resolveBuilderExpertId();
          if (!token || !eid || !cid) return;
          if (!window.confirm('Отозвать инвайт?')) return;
          try {
            await postJson(`/experts/${encodeURIComponent(eid)}/invites/${encodeURIComponent(invRevokeCode)}/revoke`, {}, token);
            const invites = await fetchJson<{ items: any[] }>(
              `/experts/${encodeURIComponent(eid)}/courses/${encodeURIComponent(cid)}/invites`,
              token,
            );
            renderAccessInvites(shell.shadowRoot, invites.items ?? []);
            window.alert('Инвайт отозван.');
          } catch {
            window.alert('Не удалось отозвать инвайт.');
          }
        })();
        return;
      }
      if (t?.closest('[data-ep-builder-hw-add-files]')) {
        ev.preventDefault();
        shell.shadowRoot.querySelector<HTMLInputElement>('[data-ep-builder-hw-file-input]')?.click();
        return;
      }
      const hwDel = t?.closest('[data-ep-builder-hw-del-file]') as HTMLElement | null;
      const hwFid = hwDel?.dataset.epBuilderHwDelFile;
      if (hwDel && hwFid) {
        ev.preventDefault();
        void builderDeleteHwFile(shell.shadowRoot, hwFid);
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
        return;
      }

      if (t?.closest('[data-ep-student-attestation-back]')) {
        ev.preventDefault();
        const r = shell.shadowRoot;
        studentActiveAttestationId = null;
        studentAttestationShowReview = false;
        showStudentLessonWorkspace(r);
        rerenderStudentLessonTree(r);
        return;
      }

      if (isShellStudentMode(shell.shadowRoot)) {
        const attEl = t?.closest('[data-ep-attestation-id]') as HTMLElement | null;
        const attId = attEl?.dataset.epAttestationId;
        if (attEl && attId) {
          ev.preventDefault();
          const meta = findStudentAttestationMeta(attId);
          const reviewOnly = Boolean(meta?.latestAttempt && meta.latestAttempt.questionCount > 0);
          void openStudentAttestation(shell.shadowRoot, attId, { reviewOnly });
          return;
        }
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
        return;
      }

      const catTopic = t?.closest('[data-ep-catalog-topic]') as HTMLElement | null;
      const catTopicKey = (catTopic?.dataset.epCatalogTopic ?? '').trim();
      if (catTopic && catTopicKey) {
        ev.preventDefault();
        catalogSearchQ = '';
        const inp = shell.shadowRoot.querySelector('#screen-s-catalog [data-ep-catalog-search]') as HTMLInputElement | null;
        if (inp) inp.value = '';
        catalogTopic = catTopicKey;
        syncCatalogTopicActive(shell.shadowRoot);
        void (async () => {
          const tok = getAccessToken();
          if (!tok) return;
          const topic = await catalogStaticTopicToTopicParam(tok, catalogTopic);
          // If there is no matching topic in DB, show empty (not "all courses")
          if (catalogTopic !== 'all' && !topic) {
            void hydrateStudentCatalog({ topic: '__missing__' });
            return;
          }
          void hydrateStudentCatalog({ topic });
        })();
        return;
      }

      const catBtn = t?.closest('[data-ep-catalog-category]') as HTMLElement | null;
      if (catBtn) {
        ev.preventDefault();
        void openCatalogCategoryDropdown();
        return;
      }

      if (
        t?.closest('[data-ep-catalog-dd-backdrop]') ||
        t?.closest('[data-ep-catalog-dd-close]')
      ) {
        ev.preventDefault();
        closeCatalogCategoryDropdown();
        return;
      }

      const ddPick = t?.closest('[data-ep-catalog-dd-item]') as HTMLElement | null;
      const ddSlug = (ddPick?.dataset.epCatalogDdItem ?? '').trim();
      if (ddPick && ddSlug) {
        ev.preventDefault();
        catalogSearchQ = '';
        const inp = shell.shadowRoot.querySelector('#screen-s-catalog [data-ep-catalog-search]') as HTMLInputElement | null;
        if (inp) inp.value = '';
        catalogTopic = 'all';
        syncCatalogTopicActive(shell.shadowRoot);
        closeCatalogCategoryDropdown();
        void hydrateStudentCatalog({ topic: ddSlug });
        return;
      }

      const completeLesson = t?.closest('[data-ep-lesson-complete]') as HTMLElement | null;
      if (completeLesson) {
        ev.preventDefault();
        void (async () => {
          const token = getAccessToken();
          const lessonId = (shell.shadowRoot as any).__epHomework?.lessonId as string | undefined;
          const courseId = currentCourseId;
          if (!token || !lessonId || !courseId) return;
          try {
            await postJson(`/lessons/${encodeURIComponent(lessonId)}/complete`, {}, token);
            // Refresh course state (completed/unlocked/progress) and keep user on lesson screen
            await openCourse(courseId);
          } catch (e) {
            window.alert(e instanceof Error ? e.message : 'Не удалось завершить урок');
          }
        })();
        return;
      }
    });

    function primeStudentLessonLoadingState(root: ShadowRoot): void {
      setLessonContent(root, { moduleTitle: 'Загрузка…', lessonTitle: 'Текущий урок', bodyText: 'Загрузка урока…' });
      const videoHost = root.querySelector('#screen-s-lesson [data-ep-video]') as HTMLElement | null;
      if (videoHost) {
        videoHost.style.display = 'none';
        videoHost.querySelectorAll('iframe').forEach((x) => x.remove());
      }
      const presHost = root.querySelector('#screen-s-lesson [data-ep-lesson-presentation]') as HTMLElement | null;
      if (presHost) {
        presHost.style.display = 'none';
        presHost.replaceChildren();
      }
      const sliderHost = root.querySelector('#screen-s-lesson [data-ep-lesson-slider]') as HTMLElement | null;
      if (sliderHost) {
        sliderHost.style.display = 'none';
        sliderHost.replaceChildren();
      }
      const hwWrap = root.querySelector('#screen-s-lesson [data-ep-homework]') as HTMLElement | null;
      if (hwWrap) hwWrap.style.display = 'none';
      const matsTitle = root.querySelector('#screen-s-lesson [data-ep-materials-title]') as HTMLElement | null;
      if (matsTitle) matsTitle.style.display = 'none';
      const mats = root.querySelector('#screen-s-lesson [data-ep-materials]') as HTMLElement | null;
      if (mats) mats.replaceChildren();
      const subWrap = root.querySelector('#screen-s-lesson [data-ep-my-submission-wrap]') as HTMLElement | null;
      if (subWrap) subWrap.style.display = 'none';
    }

    shell.shadowRoot.addEventListener('change', (ev) => {
      const t = ev.target as HTMLElement | null;
      if (t?.matches('input[data-ep-profile-avatar-input]')) {
        const inp = t as HTMLInputElement;
        const f = inp.files?.[0] ?? null;
        const maxBytes = 10 * 1024 * 1024;
        if (!f) return;
        if (f.size > maxBytes) {
          window.alert('Фото больше 10 МБ.');
          inp.value = '';
          return;
        }
        void uploadProfileAvatar(shell.shadowRoot, f).finally(() => {
          inp.value = '';
        });
        return;
      }
      if (t?.matches('input[data-ep-builder-hw-file-input]')) {
        const inp = t as HTMLInputElement;
        void builderUploadHwFiles(shell.shadowRoot, inp.files).finally(() => {
          inp.value = '';
        });
        return;
      }
      if (t?.matches('input[data-ep-builder-course-certificate-input]')) {
        const inp = t as HTMLInputElement;
        const f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        void uploadBuilderCertificate(shell.shadowRoot, f);
        return;
      }
      if (t?.matches('input[data-ep-builder-materials-file-input]')) {
        const inp = t as HTMLInputElement;
        const files = Array.from(inp.files ?? []);
        inp.value = '';
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const lid = builderSelectedLessonId;
          const status = shell.shadowRoot.querySelector('[data-ep-builder-materials-status]') as HTMLElement | null;
          if (!tok || !eid || !lid) {
            window.alert('Выберите урок в дереве слева.');
            return;
          }
          if (status) {
            status.style.display = '';
            status.textContent = 'Загружаем…';
          }
          try {
            for (const f of files) {
              if (!f) continue;
              const form = new FormData();
              form.append('file', f, f.name || 'file');
              await fetchMultipartJson(
                `/experts/${encodeURIComponent(eid)}/lessons/${encodeURIComponent(lid)}/materials/upload`,
                form,
                tok,
              );
            }
            if (status) {
              status.style.display = '';
              status.textContent = 'Готово';
              window.setTimeout(() => {
                if (status) status.style.display = 'none';
              }, 1200);
            }
            await applyBuilderLessonToForm(shell.shadowRoot, eid, tok);
          } catch {
            if (status) {
              status.style.display = '';
              status.textContent = 'Не удалось загрузить файл';
            }
            window.alert('Не удалось загрузить файл.');
          }
        })();
        return;
      }
      if (t?.matches('input[data-ep-slider-file-input]')) {
        const inp = t as HTMLInputElement;
        const files = Array.from(inp.files ?? []);
        inp.value = '';
        if (!builderSliderDraft) return;
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const mid = builderSelectedModuleId;
          const lid = builderSliderDraft!.lessonId;
          if (!tok || !eid || !mid || !lid) return;

          const maxBytes = 15 * 1024 * 1024;
          for (const f of files) {
            if (!f) continue;
            if (f.size > maxBytes) {
              window.alert('Фото больше 15 МБ.');
              continue;
            }
            if (typeof f.type === 'string' && f.type && !f.type.startsWith('image/')) {
              window.alert('Можно загружать только фото.');
              continue;
            }
            try {
              const form = new FormData();
              form.append('file', f, f.name || 'image');
              const up = await fetchMultipartJson<{ key: string }>(
                `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons/${encodeURIComponent(lid)}/slider/upload`,
                form,
                tok,
              );
              const key = (up?.key ?? '').trim();
              if (key) {
                builderSliderDraft!.images = [...builderSliderDraft!.images, { key }];
                renderBuilderSliderGrid(shell.shadowRoot);
              }
            } catch {
              window.alert('Не удалось загрузить фото.');
            }
          }
        })();
        return;
      }
      if (t?.matches('input[data-ep-presentation-file-input]')) {
        const inp = t as HTMLInputElement;
        const f = inp.files?.[0] ?? null;
        inp.value = '';
        void (async () => {
          const tok = getAccessToken();
          const eid = await resolveBuilderExpertId();
          const mid = builderSelectedModuleId;
          const lid = builderSelectedLessonId;
          const status = shell.shadowRoot.querySelector('[data-ep-builder-presentation-status]') as HTMLElement | null;
          const preview = shell.shadowRoot.querySelector('[data-ep-builder-presentation-preview]') as HTMLElement | null;
          const removeBtn = shell.shadowRoot.querySelector('[data-ep-builder-presentation-remove]') as HTMLElement | null;
          if (!tok || !eid || !mid || !lid) {
            window.alert('Выберите урок в дереве слева.');
            return;
          }
          if (!f) return;
          const name = (f.name || '').trim() || 'presentation.pptx';
          const lower = name.toLowerCase();
          if (!lower.endsWith('.pptx') && !lower.endsWith('.pdf')) {
            window.alert('Можно загрузить только файл .pptx или .pdf');
            return;
          }
          if (status) {
            status.style.display = '';
            status.textContent = 'Загружаем…';
          }
          if (preview) {
            preview.style.display = 'none';
            preview.replaceChildren();
          }
          try {
            const form = new FormData();
            form.append('file', f, name);
            if (status) status.textContent = 'Конвертируем…';
            const up = await fetchMultipartJson<{ presentation: { pptxKey?: string | null; pdfKey: string; originalFilename: string } }>(
              `/experts/${encodeURIComponent(eid)}/modules/${encodeURIComponent(mid)}/lessons/${encodeURIComponent(lid)}/presentation/upload`,
              form,
              tok,
            );
            const pres = up?.presentation ?? null;
            if (!pres || !pres.pdfKey) {
              throw new Error('Invalid response');
            }
            builderPresentationByLessonId.set(lid, pres);
            if (removeBtn) removeBtn.style.display = '';
            if (status) {
              status.style.display = 'none';
              status.textContent = '';
            }
            if (preview) {
              preview.style.display = '';
              await renderPresentationViewer(shell.shadowRoot, preview, pres);
            }
          } catch {
            if (status) {
              status.style.display = '';
              status.textContent = 'Не удалось загрузить презентацию.';
            }
          }
        })();
        return;
      }
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
      if (!inp?.matches) return;

      if (inp.matches('#screen-s-catalog [data-ep-catalog-search]')) {
        const q = inp.value;
        catalogSearchQ = q;
        catalogTopic = 'all'; // search always across all courses
        syncCatalogTopicActive(shell.shadowRoot);
        if (catalogSearchTimer) window.clearTimeout(catalogSearchTimer);
        catalogSearchTimer = window.setTimeout(() => {
          void hydrateStudentCatalog({ q: catalogSearchQ });
        }, 250);
        return;
      }

      if (inp.matches('[data-ep-expert-courses-search]')) {
        window.clearTimeout(expertCoursesSearchTimer);
        expertCoursesSearchTimer = window.setTimeout(() => {
          void hydrateExpertCourses(shell.shadowRoot, { q: inp.value });
        }, 350);
        return;
      }

      if (inp.matches('[data-ep-access-enroll-username]')) {
        builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, username: undefined };
        const q = inp.value;
        if (accessUserSearchTimer) window.clearTimeout(accessUserSearchTimer);
        accessUserSearchLast = { q, target: 'username' };
        accessUserSearchTimer = window.setTimeout(() => {
          if (!accessUserSearchLast) return;
          void accessSearchUsers(shell.shadowRoot, accessUserSearchLast.q, accessUserSearchLast.target);
        }, 180);
        return;
      }

      if (inp.matches('[data-ep-access-enroll-name]')) {
        builderAccessSelectedUserIdByField = { ...builderAccessSelectedUserIdByField, name: undefined };
        const q = inp.value;
        if (accessUserSearchTimer) window.clearTimeout(accessUserSearchTimer);
        accessUserSearchLast = { q, target: 'name' };
        accessUserSearchTimer = window.setTimeout(() => {
          if (!accessUserSearchLast) return;
          void accessSearchUsers(shell.shadowRoot, accessUserSearchLast.q, accessUserSearchLast.target);
        }, 180);
        return;
      }

      if (inp.matches('[data-ep-admin-create-expert-owner-search]')) {
        adminSelectedUserIdByField = { ...adminSelectedUserIdByField, createOwner: undefined };
        const idInp = shell.shadowRoot.querySelector('[data-ep-admin-create-expert-owner-id]') as HTMLInputElement | null;
        if (idInp) idInp.value = '';
        const q = inp.value;
        if (adminUserSearchTimer) window.clearTimeout(adminUserSearchTimer);
        adminUserSearchLast = { q, host: 'create-owner' };
        adminUserSearchTimer = window.setTimeout(() => {
          if (!adminUserSearchLast) return;
          void adminSearchUsers(shell.shadowRoot, adminUserSearchLast.q, adminUserSearchLast.host);
        }, 220);
        return;
      }

      if (inp.matches('[data-ep-admin-members-user-search]')) {
        adminSelectedUserIdByField = { ...adminSelectedUserIdByField, membersUser: undefined };
        const idInp = shell.shadowRoot.querySelector('[data-ep-admin-members-user-id]') as HTMLInputElement | null;
        if (idInp) idInp.value = '';
        const q = inp.value;
        if (adminUserSearchTimer) window.clearTimeout(adminUserSearchTimer);
        adminUserSearchLast = { q, host: 'members-user' };
        adminUserSearchTimer = window.setTimeout(() => {
          if (!adminUserSearchLast) return;
          void adminSearchUsers(shell.shadowRoot, adminUserSearchLast.q, adminUserSearchLast.host);
        }, 220);
        return;
      }

      if (inp.matches('[data-ep-admin-platform-user-search]')) {
        adminSelectedUserIdByField = { ...adminSelectedUserIdByField, platformUser: undefined };
        const idInp = shell.shadowRoot.querySelector('[data-ep-admin-platform-user-id]') as HTMLInputElement | null;
        if (idInp) idInp.value = '';
        const q = inp.value;
        if (adminUserSearchTimer) window.clearTimeout(adminUserSearchTimer);
        adminUserSearchLast = { q, host: 'platform-user' };
        adminUserSearchTimer = window.setTimeout(() => {
          if (!adminUserSearchLast) return;
          void adminSearchUsers(shell.shadowRoot, adminUserSearchLast.q, adminUserSearchLast.host);
        }, 220);
        return;
      }

      if (inp.matches('[data-ep-team-user-search]')) {
        if (inp.readOnly) return;
        expertTeamDrawerSelectedUserId = null;
        const hid = shell.shadowRoot.querySelector('[data-ep-team-user-id]') as HTMLInputElement | null;
        if (hid) hid.value = '';
        const q = inp.value;
        if (expertTeamUserSearchTimer) window.clearTimeout(expertTeamUserSearchTimer);
        expertTeamUserSearchTimer = window.setTimeout(() => {
          void expertTeamSearchUsers(shell.shadowRoot, q);
        }, 220);
        return;
      }
    });

    shell.shadowRoot.addEventListener('change', (ev) => {
      const t = ev.target as HTMLInputElement | null;
      if (!t?.matches) return;
      if (t.matches('[data-ep-team-courses-select-all]')) {
        const on = t.checked;
        shell.shadowRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-ep-team-course-id]').forEach((cb) => {
          cb.checked = on;
        });
      }
    });

    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const monthPop = shell.shadowRoot.querySelector(
        '[data-ep-e-dashboard-month-pop].ep-dash-month-pop--open',
      ) as HTMLElement | null;
      if (monthPop) {
        ev.preventDefault();
        closeExpertDashboardMonthPop(shell.shadowRoot);
        return;
      }
      const vw = shell.shadowRoot.querySelector('[data-ep-slider-viewer]') as HTMLElement | null;
      if (!vw || vw.style.display === 'none') return;
      ev.preventDefault();
      closeBuilderSliderViewer(shell.shadowRoot);
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

