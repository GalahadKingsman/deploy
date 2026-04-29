import shellCss from './shell.css?inline';
import shellHtml from './shellBody.html?raw';

export type PlatformShellAction =
  | { type: 'role'; role: 'expert' | 'student' }
  | { type: 'navigate'; screenId: string; shadowRoot: ShadowRoot; sourceElement?: HTMLElement | null }
  | { type: 'open_course'; courseId: string }
  | { type: 'open_lesson'; lessonId: string }
  | { type: 'module_toggle' }
  | { type: 'builder_tab'; tabLabel: string }
  | { type: 'grade_select' };

export type PlatformShellHandlers = {
  /**
   * Срабатывает на действия внутри макета (роли, экраны, вкладки конструктора и т.д.).
   * Сюда можно подключить API, аналитику, роутинг реального приложения.
   */
  onAction?: (action: PlatformShellAction, ev: Event) => void | Promise<void>;
};

export type SetRoleOptions = {
  /**
   * Сразу открыть этот экран (например s-lesson после setRole('student')).
   * Иначе — первый экран кабинета (e-dashboard / s-catalog).
   */
  screenId?: string;
};

export type PlatformShellOptions = PlatformShellHandlers & {
  /** Стартовая роль при маунте. По умолчанию 'expert' (как в макете). */
  initialRole?: 'expert' | 'student';
  /** Стартовый экран. Если не задан — берётся дефолт по роли. */
  initialScreenId?: string;
  /** Вернуть false, чтобы отменить смену роли (например, нет прав на кабинет эксперта). */
  beforeSetRole?: (role: 'expert' | 'student') => boolean;
  /**
   * Лендинг (#platform без авторизации): не показывать конструктор курса в макете.
   * Полный кабинет на /platform/ использует те же разметку без этого флага.
   */
  marketingPreview?: boolean;
};

export type PlatformShellController = {
  shadowRoot: ShadowRoot;
  setRole: (role: 'expert' | 'student', options?: SetRoleOptions) => void;
  showScreen: (screenId: string) => void;
  destroy: () => void;
};

function emit(
  handlers: PlatformShellHandlers,
  action: PlatformShellAction,
  ev: Event,
): void {
  try {
    void handlers.onAction?.(action, ev);
  } catch (e) {
    console.error('[edify-platform-shell]', e);
  }
}

function setMobileNavOpen(root: ShadowRoot, open: boolean): void {
  const shell = root.querySelector('.ep-platform-root') as HTMLElement | null;
  const btn = root.querySelector('[data-ep-mobile-menu]') as HTMLButtonElement | null;
  if (shell) shell.classList.toggle('ep-platform-root--nav-open', open);
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
}

function showScreen(
  root: ShadowRoot,
  id: string,
  handlers: PlatformShellOptions,
  ev: Event,
  sourceElement?: HTMLElement | null,
): void {
  const sid = handlers.marketingPreview && id === 'e-builder' ? 'e-dashboard' : id;
  root.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  root.getElementById(`screen-${sid}`)?.classList.add('active');

  root.querySelectorAll('.sb-item').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.epScreen === sid);
  });

  root.getElementById('main-content')?.scrollTo(0, 0);
  setMobileNavOpen(root, false);
  emit(handlers, { type: 'navigate', screenId: sid, shadowRoot: root, sourceElement: sourceElement ?? null }, ev);
}

function setRole(
  root: ShadowRoot,
  role: 'expert' | 'student',
  options: PlatformShellOptions,
  ev: Event,
  setOptions?: SetRoleOptions,
): void {
  if (options.beforeSetRole && options.beforeSetRole(role) === false) {
    return;
  }
  root.getElementById('tab-expert')?.classList.toggle('active', role === 'expert');
  root.getElementById('tab-student')?.classList.toggle('active', role === 'student');
  const expert = root.getElementById('sidebar-expert') as HTMLElement | null;
  const student = root.getElementById('sidebar-student') as HTMLElement | null;
  if (expert) expert.style.display = role === 'expert' ? 'flex' : 'none';
  if (student) student.style.display = role === 'student' ? 'flex' : 'none';

  setMobileNavOpen(root, false);
  emit(options, { type: 'role', role }, ev);
  const def = role === 'expert' ? 'e-dashboard' : 's-catalog';
  const screenId = (setOptions?.screenId && setOptions.screenId.trim()) || def;
  showScreen(root, screenId, options, ev);
}

function onShadowClick(ev: MouseEvent, root: ShadowRoot, handlers: PlatformShellOptions): void {
  const target = ev.target as HTMLElement | null;
  if (!target) return;

  const mobileMenu = target.closest('[data-ep-mobile-menu]') as HTMLElement | null;
  if (mobileMenu) {
    ev.preventDefault();
    const shell = root.querySelector('.ep-platform-root');
    const open = !shell?.classList.contains('ep-platform-root--nav-open');
    setMobileNavOpen(root, open);
    return;
  }

  if (target.closest('[data-ep-nav-backdrop]')) {
    ev.preventDefault();
    setMobileNavOpen(root, false);
    return;
  }

  const topUser = target.closest('.topbar-user') as HTMLElement | null;
  if (topUser) {
    ev.preventDefault();
    setMobileNavOpen(root, false);
    showScreen(root, 's-profile', handlers, ev, topUser);
    return;
  }

  const courseEl = target.closest('[data-ep-course-id]') as HTMLElement | null;
  const courseId = courseEl?.dataset.epCourseId;
  if (courseEl && courseId) {
    emit(handlers, { type: 'open_course', courseId }, ev);
    return;
  }

  const lessonEl = target.closest('[data-ep-lesson-id]') as HTMLElement | null;
  const lessonId = lessonEl?.dataset.epLessonId;
  if (lessonEl && lessonId) {
    emit(handlers, { type: 'open_lesson', lessonId }, ev);
    return;
  }

  const modToggle = target.closest('[data-ep-mod-toggle]');
  if (modToggle) {
    // Дерево модулей конструктора: раскрытие и выбор модуля делает platformPage.ts
    if (!modToggle.closest('[data-ep-builder-mod-tree]')) {
      const arrow = modToggle.querySelector('.mod-arrow');
      const lessons = modToggle.nextElementSibling;
      arrow?.classList.toggle('open');
      lessons?.classList.toggle('open');
      emit(handlers, { type: 'module_toggle' }, ev);
      return;
    }
  }

  const gradeBtn = target.closest('.grade-btn');
  if (gradeBtn && target.closest('.grade-row')) {
    const row = gradeBtn.closest('.grade-row');
    row?.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('sel'));
    gradeBtn.classList.add('sel');
    emit(handlers, { type: 'grade_select' }, ev);
    return;
  }

  const tab = target.closest('.tab');
  if (tab && target.closest('.tabs')) {
    const tabs = tab.closest('.tabs');
    if (tabs) {
      tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      emit(handlers, { type: 'builder_tab', tabLabel: tab.textContent?.trim() ?? '' }, ev);
    }
    return;
  }

  const roleEl = target.closest('[data-ep-role]') as HTMLElement | null;
  if (roleEl?.dataset.epRole === 'expert' || roleEl?.dataset.epRole === 'student') {
    ev.preventDefault();
    setRole(root, roleEl.dataset.epRole as 'expert' | 'student', handlers, ev, undefined);
    return;
  }

  const screenEl = target.closest('[data-ep-screen]') as HTMLElement | null;
  const sid = screenEl?.dataset.epScreen;
  if (screenEl && sid) {
    if (screenEl.dataset.epStopProp === '1') ev.stopPropagation();
    showScreen(root, sid, handlers, ev, screenEl);
  }
}

/**
 * Встраивает макет кабинета в `host` через Shadow DOM (изоляция CSS от маркетинговой страницы).
 * Возвращает контроллер для управления (роутинг/данные/кнопки).
 */
export function mountPlatformShell(
  host: HTMLElement,
  options: PlatformShellOptions = {},
): PlatformShellController {
  if (host.shadowRoot) {
    console.warn('[edify-platform-shell] повторный mount: shadow уже есть');
    const existing = host.shadowRoot;
    return {
      shadowRoot: existing,
      setRole: () => {},
      showScreen: () => {},
      destroy: () => {},
    } as PlatformShellController;
  }

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = shellCss;
  const inner = document.createElement('div');
  inner.innerHTML = shellHtml;
  shadow.append(style, inner);
  if (options.marketingPreview) {
    inner.querySelector('.ep-platform-root')?.classList.add('ep-platform-root--marketing');
  }

  const listener = (ev: Event) => {
    if (ev instanceof MouseEvent) onShadowClick(ev, shadow, options);
  };
  shadow.addEventListener('click', listener);

  const closeNavOnWide = (): void => {
    try {
      if (window.matchMedia('(min-width: 901px)').matches) setMobileNavOpen(shadow, false);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('resize', closeNavOnWide);

  const controller: PlatformShellController = {
    shadowRoot: shadow,
    setRole: (role, setRoleOpts) => setRole(shadow, role, options, new Event('init'), setRoleOpts),
    showScreen: (screenId) => showScreen(shadow, screenId, options, new Event('init')),
    destroy: () => {
      shadow.removeEventListener('click', listener);
      window.removeEventListener('resize', closeNavOnWide);
    },
  };

  const role = options.initialRole ?? 'expert';
  const screen = options.initialScreenId ?? (role === 'expert' ? 'e-dashboard' : 's-catalog');
  // выставляем роль и экран без необходимости клика
  setRole(shadow, role, options, new Event('init'), { screenId: screen });

  return controller;
}
