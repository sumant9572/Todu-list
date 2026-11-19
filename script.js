/* ============================================================
   TaskFlow — Smart To-Do List
   script.js — all application logic (vanilla JS, no frameworks)
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Storage keys ---------- */
  const TASKS_KEY = 'taskflow_tasks';
  const THEME_KEY = 'taskflow_theme';

  /* ---------- App state ---------- */
  const state = {
    tasks: [],
    activeFilter: 'dashboard',   // current view/filter
    activeSort: 'newest',
    searchQuery: '',
    editingId: null,             // id of task being edited (null = adding)
    confirmCallback: null,       // generic confirm modal callback
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    selectedDate: null            // when a calendar date is clicked
  };

  /* ---------- DOM references ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const el = {
    loader: $('#pageLoader'),
    sidebar: $('#sidebar'),
    sidebarOverlay: $('#sidebarOverlay'),
    sidebarClose: $('#sidebarClose'),
    mobileMenuBtn: $('#mobileMenuBtn'),
    navItems: $$('.nav-item'),
    viewTitle: $('#viewTitle'),
    viewSubtitle: $('#viewSubtitle'),
    searchInput: $('#searchInput'),
    searchClear: $('#searchClear'),
    themeToggle: $('#themeToggle'),
    addTaskBtn: $('#addTaskBtn'),
    greeting: $('#greeting'),
    currentDate: $('#currentDate'),
    dateBadge: $('#dateBadge'),
    statTotal: $('#statTotal'),
    statCompleted: $('#statCompleted'),
    statPending: $('#statPending'),
    statOverdue: $('#statOverdue'),
    progressCaption: $('#progressCaption'),
    progressPercent: $('#progressPercent'),
    progressBar: $('#progressBar'),
    progressBarAria: $('#progressBarAria'),
    legendCompleted: $('#legendCompleted'),
    legendPending: $('#legendPending'),
    filterBtns: $$('.filter-btn'),
    sortSelect: $('#sortSelect'),
    taskList: $('#taskList'),
    tasksListTitle: $('#tasksListTitle'),
    tasksCount: $('#tasksCount'),
    emptyState: $('#emptyState'),
    emptyAddBtn: $('#emptyAddBtn'),
    calendarMonth: $('#calendarMonth'),
    calendarGrid: $('#calendarGrid'),
    prevMonth: $('#prevMonth'),
    nextMonth: $('#nextMonth'),
    upcomingDeadlines: $('#upcomingDeadlines'),
    prodCompletedToday: $('#prodCompletedToday'),
    prodPendingToday: $('#prodPendingToday'),
    productivityBars: $('#productivityBars'),
    sidebarProgressRing: $('#sidebarProgressRing'),
    sidebarProgressText: $('#sidebarProgressText'),
    sidebarProgressCaption: $('#sidebarProgressCaption'),
    // task modal
    taskModal: $('#taskModal'),
    modalTitle: $('#modalTitle'),
    taskForm: $('#taskForm'),
    taskTitle: $('#taskTitle'),
    taskTitleError: $('#taskTitleError'),
    taskDescription: $('#taskDescription'),
    taskDueDate: $('#taskDueDate'),
    taskDueTime: $('#taskDueTime'),
    taskPriority: $('#taskPriority'),
    taskCategory: $('#taskCategory'),
    taskTags: $('#taskTags'),
    taskImportant: $('#taskImportant'),
    saveTaskBtn: $('#saveTaskBtn'),
    cancelTaskBtn: $('#cancelTaskBtn'),
    modalClose: $('#modalClose'),
    modalBackdrop: $('#modalBackdrop'),
    // confirm modal
    deleteModal: $('#deleteModal'),
    deleteModalTitle: $('#deleteModalTitle'),
    deleteText: $('#deleteText'),
    confirmDelete: $('#confirmDelete'),
    cancelDelete: $('#cancelDelete'),
    deleteClose: $('#deleteClose'),
    deleteBackdrop: $('#deleteBackdrop'),
    // settings modal
    settingsModal: $('#settingsModal'),
    settingsThemeToggle: $('#settingsThemeToggle'),
    settingsClose: $('#settingsClose'),
    settingsBackdrop: $('#settingsBackdrop'),
    clearAllBtn: $('#clearAllBtn'),
    exportBtn: $('#exportBtn'),
    toastContainer: $('#toastContainer')
  };

  /* ============================================================
     Utility helpers
     ============================================================ */

  /** Generate a reasonably unique id. */
  function uid() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** Escape user-provided text before injecting into HTML. */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Today's date as YYYY-MM-DD (local time). */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Parse a YYYY-MM-DD string into a local Date (avoids UTC drift). */
  function parseDate(str) {
    if (!str) return null;
    const parts = str.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  /** Human friendly due date, e.g. "Oct 30" or "Oct 30, 2027". */
  function formatDue(str) {
    const dt = parseDate(str);
    if (!dt) return '';
    const opts = { month: 'short', day: 'numeric' };
    if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return dt.toLocaleDateString('en-US', opts);
  }

  /** Is a task overdue (pending, due date in the past, or due today but time passed)? */
  function isOverdue(task) {
    if (task.completed || !task.dueDate) return false;
    const today = todayStr();
    if (task.dueDate < today) return true;
    if (task.dueDate === today && task.dueTime) {
      const now = new Date();
      const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return task.dueTime < cur;
    }
    return false;
  }

  /** Refresh Lucide icons after injecting new markup. */
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ============================================================
     Storage
     ============================================================ */

  function loadTasks() {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Sanitize / normalize each record so bad data never breaks the app.
      return parsed.map(sanitizeTask).filter(Boolean);
    } catch (err) {
      console.warn('TaskFlow: could not parse stored tasks, starting fresh.', err);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
    } catch (err) {
      console.warn('TaskFlow: could not save tasks.', err);
      showToast('error', 'Save failed', 'Local storage is unavailable or full.');
    }
  }

  /** Ensure a stored record has all expected fields with valid types. */
  function sanitizeTask(t) {
    if (!t || typeof t !== 'object') return null;
    return {
      id: typeof t.id === 'string' ? t.id : uid(),
      title: typeof t.title === 'string' ? t.title : 'Untitled task',
      description: typeof t.description === 'string' ? t.description : '',
      dueDate: typeof t.dueDate === 'string' && parseDate(t.dueDate) ? t.dueDate : '',
      dueTime: typeof t.dueTime === 'string' && /^\d{2}:\d{2}$/.test(t.dueTime) ? t.dueTime : '',
      priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
      category: ['personal', 'work', 'study', 'shopping', 'other'].includes(t.category) ? t.category : 'other',
      tags: Array.isArray(t.tags) ? t.tags.map(String).filter(Boolean) : [],
      important: Boolean(t.important),
      completed: Boolean(t.completed),
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      completedAt: typeof t.completedAt === 'number' ? t.completedAt : null
    };
  }

  /* ============================================================
     Theme
     ============================================================ */

  function loadTheme() {
    let theme = localStorage.getItem(THEME_KEY);
    if (!theme) {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (el.settingsThemeToggle) el.settingsThemeToggle.checked = (theme === 'dark');
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ============================================================
     Filtering, searching & sorting
     ============================================================ */

  function filterTasks(filter) {
    const today = todayStr();
    switch (filter) {
      case 'dashboard':
      case 'all':
        return state.tasks.slice();
      case 'today':
        return state.tasks.filter(t => t.dueDate === today);
      case 'upcoming':
        return state.tasks.filter(t => !t.completed && t.dueDate && t.dueDate > today);
      case 'completed':
        return state.tasks.filter(t => t.completed);
      case 'important':
        return state.tasks.filter(t => t.important && !t.completed);
      case 'overdue':
        return state.tasks.filter(t => isOverdue(t));
      case 'date':
        return state.tasks.filter(t => t.dueDate === state.selectedDate);
      default:
        if (filter && filter.startsWith('category:')) {
          const cat = filter.slice('category:'.length);
          return state.tasks.filter(t => t.category === cat);
        }
        return state.tasks.slice();
    }
  }

  function matchSearch(task, q) {
    const hay = (task.title + ' ' + task.description + ' ' + task.tags.join(' ')).toLowerCase();
    return hay.includes(q);
  }

  const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

  function sortTasks(list, mode) {
    const sorted = list.slice();
    sorted.sort((a, b) => {
      // Always keep pending tasks above completed ones.
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      let cmp = 0;
      switch (mode) {
        case 'newest':
          cmp = b.createdAt - a.createdAt;
          break;
        case 'oldest':
          cmp = a.createdAt - b.createdAt;
          break;
        case 'priority':
          cmp = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
          if (cmp === 0) cmp = b.createdAt - a.createdAt;
          break;
        case 'dueDate':
          cmp = dueSortValue(a) - dueSortValue(b);
          if (cmp === 0) cmp = b.createdAt - a.createdAt;
          break;
        default:
          cmp = b.createdAt - a.createdAt;
      }
      return cmp;
    });
    return sorted;
  }

  /** Tasks with no due date sort to the very end within the due-date ordering. */
  function dueSortValue(task) {
    if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
    return Number(parseDate(task.dueDate).getTime()) + (task.dueTime ? Number(task.dueTime.replace(':', '')) / 100000 : 0);
  }

  function getVisibleTasks() {
    let list = filterTasks(state.activeFilter);
    if (state.searchQuery) list = list.filter(t => matchSearch(t, state.searchQuery));
    return sortTasks(list, state.activeSort);
  }

  /* ============================================================
     Rendering
     ============================================================ */

  const VIEW_META = {
    dashboard: ['Dashboard', 'Welcome back, let\u2019s get things done.'],
    all:        ['My Tasks', 'All your tasks in one place.'],
    today:      ['Today', 'Tasks due today.'],
    upcoming:   ['Upcoming', 'Tasks coming up soon.'],
    completed:  ['Completed', 'Great work \u2014 here\u2019s what you\u2019ve finished.'],
    important:  ['Important', 'Your starred, high-priority tasks.'],
    overdue:    ['Overdue', 'These tasks need your attention.'],
    date:        [null, 'Tasks due on this date.']
  };

  function setActiveFilter(filter) {
    if (!filter.startsWith('date')) state.selectedDate = null;
    state.activeFilter = filter;

    // Sync sidebar active states
    el.navItems.forEach(item => {
      if (item.dataset.view === 'settings') return;
      item.classList.toggle('active', navItemFilter(item) === filter);
    });

    // Sync filter bar active states
    el.filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));

    // Update headings
    let title, subtitle;
    if (filter.startsWith('category:')) {
      const cat = filter.slice('category:'.length);
      title = capitalize(cat);
      subtitle = `Tasks in your ${cat} category.`;
    } else if (filter === 'date') {
      title = state.selectedDate ? formatFullDate(state.selectedDate) : 'Selected date';
      subtitle = 'Tasks due on this date.';
    } else {
      [title, subtitle] = VIEW_META[filter] || ['My Tasks', ''];
    }
    el.viewTitle.textContent = title;
    el.viewSubtitle.textContent = subtitle;
    el.tasksListTitle.textContent = title;

    renderTasks();
    renderCalendar(); // refresh selected highlight
  }

  function navItemFilter(item) {
    if (item.dataset.view === 'category') return 'category:' + item.dataset.category;
    return item.dataset.view;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatFullDate(str) {
    const dt = parseDate(str);
    if (!dt) return str;
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  /* ---- Task cards ---- */
  function renderTasks() {
    const tasks = getVisibleTasks();
    el.taskList.innerHTML = '';

    if (tasks.length === 0) {
      el.emptyState.hidden = false;
      el.tasksCount.textContent = '0 tasks';
    } else {
      el.emptyState.hidden = true;
      const frag = document.createDocumentFragment();
      tasks.forEach((task, i) => frag.appendChild(buildTaskCard(task, i)));
      el.taskList.appendChild(frag);
      el.tasksCount.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
    }

    refreshIcons();
    renderStats();
    renderProgress();
    renderNavCounts();
    renderDeadlines();
    renderProductivity();
    renderSidebarProgress();
  }

  function buildTaskCard(task, index) {
    const li = document.createElement('li');
    li.className = 'task';
    li.dataset.id = task.id;
    li.dataset.priority = task.priority;
    li.dataset.completed = String(task.completed);
    li.style.animationDelay = Math.min(index * 0.03, 0.3) + 's';

    const overdue = isOverdue(task);
    const dueDateHtml = task.dueDate
      ? `<span class="task__date ${overdue ? 'overdue' : ''}"><i data-lucide="calendar"></i>${escapeHtml(formatDue(task.dueDate))}${overdue ? ' \u00b7 overdue' : ''}</span>`
      : '';
    const dueTimeHtml = task.dueTime
      ? `<span class="task__time"><i data-lucide="clock"></i>${escapeHtml(task.dueTime)}</span>`
      : '';
    const descHtml = task.description
      ? `<p class="task__desc">${escapeHtml(task.description)}</p>`
      : '';
    const tagsHtml = task.tags.length
      ? `<div class="task__tags">${task.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>`
      : '';
    const starHtml = task.important ? '<span class="task__star-mark"><i data-lucide="star"></i></span>' : '';

    li.innerHTML = `
      <button class="task__check" data-action="toggle" aria-label="${task.completed ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${task.completed}">
        <i data-lucide="check"></i>
      </button>
      <div class="task__main" data-action="edit">
        <div class="task__top">
          <h4 class="task__title">${escapeHtml(task.title)}</h4>
          ${starHtml}
        </div>
        <div class="task__meta">
          <span class="task__priority" data-priority="${task.priority}">${capitalize(task.priority)}</span>
          <span class="task__category"><span class="dot dot--${task.category}"></span>${capitalize(task.category)}</span>
          ${dueDateHtml}
          ${dueTimeHtml}
        </div>
        ${descHtml}
        ${tagsHtml}
      </div>
      <div class="task__actions">
        <button class="icon-btn icon-btn--sm task__star ${task.important ? 'active' : ''}" data-action="important" aria-label="${task.important ? 'Remove important' : 'Mark as important'}" aria-pressed="${task.important}">
          <i data-lucide="star"></i>
        </button>
        <button class="icon-btn icon-btn--sm task__edit" data-action="edit" aria-label="Edit task">
          <i data-lucide="pencil"></i>
        </button>
        <button class="icon-btn icon-btn--sm task__delete" data-action="delete" aria-label="Delete task">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;
    return li;
  }

  /* ---- Statistics ---- */
  function renderStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = state.tasks.filter(t => isOverdue(t)).length;
    animateCount(el.statTotal, total);
    animateCount(el.statCompleted, completed);
    animateCount(el.statPending, pending);
    animateCount(el.statOverdue, overdue);
  }

  /** Smoothly count a number up to its target. */
  function animateCount(node, target) {
    const start = parseInt(node.textContent, 10) || 0;
    if (start === target) { node.textContent = target; return; }
    const duration = 500;
    const startTime = performance.now();
    function step(now) {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = target;
    }
    requestAnimationFrame(step);
  }

  /* ---- Progress ---- */
  function renderProgress() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    el.progressBar.style.width = pct + '%';
    el.progressBarAria.setAttribute('aria-valuenow', String(pct));
    el.progressPercent.textContent = pct + '%';
    el.legendCompleted.textContent = `${completed} done`;
    el.legendPending.textContent = `${pending} pending`;

    if (total === 0) el.progressCaption.textContent = 'Add your first task to begin.';
    else if (pct === 100) el.progressCaption.textContent = 'All done! Amazing work.';
    else if (pct >= 75) el.progressCaption.textContent = 'Almost there, keep pushing!';
    else if (pct >= 50) el.progressCaption.textContent = 'Halfway through \u2014 nice momentum!';
    else el.progressCaption.textContent = 'Keep going, you\u2019re doing great!';
  }

  /* ---- Sidebar progress ring (today) ---- */
  function renderSidebarProgress() {
    const today = todayStr();
    const todays = state.tasks.filter(t => t.dueDate === today);
    const doneToday = todays.filter(t => t.completed).length;
    const totalToday = todays.length;
    const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
    const deg = Math.round((pct / 100) * 360);

    el.sidebarProgressRing.style.background =
      `conic-gradient(var(--primary) ${deg}deg, var(--border) ${deg}deg)`;
    el.sidebarProgressText.textContent = pct + '%';

    if (totalToday === 0) el.sidebarProgressCaption.textContent = 'No tasks today';
    else el.sidebarProgressCaption.textContent = `${doneToday}/${totalToday} completed`;
  }

  /* ---- Nav badge counts ---- */
  function renderNavCounts() {
    const today = todayStr();
    const counts = {
      all: state.tasks.filter(t => !t.completed).length,
      today: state.tasks.filter(t => t.dueDate === today && !t.completed).length,
      upcoming: state.tasks.filter(t => !t.completed && t.dueDate && t.dueDate > today).length,
      completed: state.tasks.filter(t => t.completed).length,
      important: state.tasks.filter(t => t.important && !t.completed).length,
      personal: state.tasks.filter(t => t.category === 'personal' && !t.completed).length,
      work: state.tasks.filter(t => t.category === 'work' && !t.completed).length,
      study: state.tasks.filter(t => t.category === 'study' && !t.completed).length,
      shopping: state.tasks.filter(t => t.category === 'shopping' && !t.completed).length,
      other: state.tasks.filter(t => t.category === 'other' && !t.completed).length
    };
    Object.keys(counts).forEach(key => {
      const badge = document.querySelector(`[data-count="${key}"]`);
      if (badge) {
        badge.textContent = counts[key];
        badge.style.display = counts[key] > 0 ? '' : 'none';
      }
    });
  }

  /* ---- Calendar ---- */
  function renderCalendar() {
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    el.calendarMonth.textContent = monthName;

    const firstDay = new Date(year, month, 1).getDay();          // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    // Build a quick lookup of dates that have tasks
    const datesWithTasks = new Set();
    state.tasks.forEach(t => { if (t.dueDate) datesWithTasks.add(t.dueDate); });

    const today = todayStr();
    const cells = [];

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const dateStr = formatDateStr(year, month - 1, d);
      cells.push(dayCell(d, dateStr, true, today, datesWithTasks));
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateStr(year, month, d);
      cells.push(dayCell(d, dateStr, false, today, datesWithTasks));
    }
    // Trailing days to complete the grid (6 rows x 7 = 42)
    const total = cells.length;
    const trailing = total <= 35 ? 35 - total : 42 - total;
    for (let d = 1; d <= trailing; d++) {
      const dateStr = formatDateStr(year, month + 1, d);
      cells.push(dayCell(d, dateStr, true, today, datesWithTasks));
    }

    el.calendarGrid.innerHTML = cells.join('');
    el.calendarGrid.querySelectorAll('.cal-day').forEach(node => {
      node.addEventListener('click', () => onCalendarDayClick(node.dataset.date));
    });
  }

  function formatDateStr(year, month, day) {
    // Normalize month overflow / underflow across year boundaries.
    const dt = new Date(year, month, day);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function dayCell(label, dateStr, outside, today, datesWithTasks) {
    const classes = ['cal-day'];
    if (outside) classes.push('outside');
    if (dateStr === today) classes.push('today');
    if (datesWithTasks.has(dateStr)) classes.push('has-tasks');
    if (state.selectedDate === dateStr) classes.push('selected');
    return `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}">${label}</button>`;
  }

  function onCalendarDayClick(dateStr) {
    state.selectedDate = dateStr;
    setActiveFilter('date');
  }

  /* ---- Upcoming deadlines ---- */
  function renderDeadlines() {
    const today = todayStr();
    const upcoming = state.tasks
      .filter(t => !t.completed && t.dueDate && t.dueDate >= today)
      .sort((a, b) => dueSortValue(a) - dueSortValue(b))
      .slice(0, 5);

    if (upcoming.length === 0) {
      el.upcomingDeadlines.innerHTML = '<li class="deadline-list__empty">No upcoming deadlines.</li>';
      return;
    }

    el.upcomingDeadlines.innerHTML = upcoming.map(t => {
      const overdueToday = t.dueDate === today && isOverdue(t);
      const dateLabel = t.dueDate === today
        ? (overdueToday ? 'Overdue \u00b7 today' : 'Today' + (t.dueTime ? ` \u00b7 ${escapeHtml(t.dueTime)}` : ''))
        : `${escapeHtml(formatDue(t.dueDate))}${t.dueTime ? ' \u00b7 ' + escapeHtml(t.dueTime) : ''}`;
      return `
        <li class="deadline-item">
          <span class="deadline-item__bar" data-priority="${t.priority}"></span>
          <div class="deadline-item__main">
            <p class="deadline-item__title">${escapeHtml(t.title)}</p>
            <p class="deadline-item__date ${overdueToday ? 'urgent' : ''}">${dateLabel}</p>
          </div>
        </li>`;
    }).join('');
  }

  /* ---- Productivity (last 7 days) ---- */
  function renderProductivity() {
    const today = todayStr();
    const todays = state.tasks.filter(t => t.dueDate === today);
    const completedToday = todays.filter(t => t.completed).length;
    const pendingToday = todays.filter(t => !t.completed).length;
    el.prodCompletedToday.textContent = completedToday;
    el.prodPendingToday.textContent = pendingToday;

    // Build last 7 days completion counts
    const labels = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const count = state.tasks.filter(t => t.completed && t.completedAt && sameDay(new Date(t.completedAt), d)).length;
      labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' }));
      counts.push(count);
    }
    const max = Math.max(1, ...counts);
    el.productivityBars.innerHTML = counts.map((c, i) => {
      const h = Math.max(6, Math.round((c / max) * 100));
      return `<div class="prod-bar ${c > 0 ? 'active' : ''}" style="height:${h}%" title="${labels[i]}: ${c} done"><span class="prod-bar__lbl">${labels[i]}</span></div>`;
    }).join('');
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ============================================================
     CRUD operations
     ============================================================ */

  function addTask(data) {
    const task = sanitizeTask({
      id: uid(),
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      priority: data.priority,
      category: data.category,
      tags: data.tags,
      important: data.important,
      completed: false,
      createdAt: Date.now(),
      completedAt: null
    });
    state.tasks.unshift(task);
    saveTasks();
    renderTasks();
    showToast('success', 'Task added', `"${truncate(task.title)}" was created.`);
  }

  function updateTask(id, data) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    Object.assign(task, {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      priority: data.priority,
      category: data.category,
      tags: data.tags,
      important: data.important
    });
    saveTasks();
    renderTasks();
    showToast('info', 'Task updated', `"${truncate(task.title)}" was saved.`);
  }

  function deleteTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const title = state.tasks[idx].title;
    state.tasks.splice(idx, 1);
    saveTasks();
    renderTasks();
    showToast('error', 'Task deleted', `"${truncate(title)}" was removed.`);
  }

  function toggleComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    saveTasks();
    renderTasks();
    if (task.completed) {
      showToast('success', 'Nice work!', `"${truncate(task.title)}" is complete.`);
    }
  }

  function toggleImportant(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.important = !task.important;
    saveTasks();
    renderTasks();
  }

  function clearAllTasks() {
    state.tasks = [];
    saveTasks();
    renderTasks();
    showToast('warning', 'All cleared', 'Every task has been removed.');
  }

  function truncate(s, n = 40) {
    return s.length > n ? s.slice(0, n) + '\u2026' : s;
  }

  /* ============================================================
     Modal handling
     ============================================================ */

  function openTaskModal(id) {
    state.editingId = id || null;
    resetFormErrors();

    if (id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      el.modalTitle.textContent = 'Edit Task';
      el.taskTitle.value = task.title;
      el.taskDescription.value = task.description;
      el.taskDueDate.value = task.dueDate;
      el.taskDueTime.value = task.dueTime;
      el.taskPriority.value = task.priority;
      el.taskCategory.value = task.category;
      el.taskTags.value = task.tags.join(', ');
      el.taskImportant.checked = task.important;
      el.saveTaskBtn.querySelector('span').textContent = 'Update Task';
    } else {
      el.modalTitle.textContent = 'Add New Task';
      el.taskForm.reset();
      el.taskPriority.value = 'medium';
      el.taskCategory.value = 'personal';
      el.saveTaskBtn.querySelector('span').textContent = 'Save Task';
    }

    openModal(el.taskModal);
    setTimeout(() => el.taskTitle.focus(), 50);
  }

  function handleTaskSubmit(e) {
    e.preventDefault();
    resetFormErrors();

    const title = el.taskTitle.value.trim();
    if (!title) {
      el.taskTitle.classList.add('invalid');
      el.taskTitleError.hidden = false;
      el.taskTitle.focus();
      return;
    }

    const data = {
      title,
      description: el.taskDescription.value.trim(),
      dueDate: el.taskDueDate.value,
      dueTime: el.taskDueTime.value,
      priority: el.taskPriority.value,
      category: el.taskCategory.value,
      tags: el.taskTags.value.split(',').map(s => s.trim()).filter(Boolean),
      important: el.taskImportant.checked
    };

    if (state.editingId) updateTask(state.editingId, data);
    else addTask(data);

    closeModal(el.taskModal);
  }

  function resetFormErrors() {
    el.taskTitle.classList.remove('invalid');
    el.taskTitleError.hidden = true;
  }

  /* Generic open/close with animation */
  function openModal(modal) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.add('is-closing');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      modal.classList.remove('is-open', 'is-closing');
      document.body.style.overflow = '';
    }, 240);
  }

  /* Generic confirm dialog */
  function openConfirm({ title, text, onConfirm, confirmLabel }) {
    el.deleteModalTitle.textContent = title;
    el.deleteText.textContent = text;
    if (confirmLabel) el.confirmDelete.querySelector('span').textContent = confirmLabel;
    state.confirmCallback = onConfirm;
    openModal(el.deleteModal);
  }

  function handleConfirm() {
    const cb = state.confirmCallback;
    state.confirmCallback = null;
    closeModal(el.deleteModal);
    if (typeof cb === 'function') cb();
  }

  /* ============================================================
     Toasts
     ============================================================ */
  let toastSeq = 0;
  function showToast(type, title, msg) {
    const id = 'toast-' + (++toastSeq);
    const icons = { success: 'check-circle-2', error: 'x-circle', info: 'info', warning: 'alert-triangle' };
    const node = document.createElement('div');
    node.className = 'toast toast--' + type;
    node.id = id;
    node.innerHTML = `
      <span class="toast__icon"><i data-lucide="${icons[type] || 'info'}"></i></span>
      <div class="toast__body">
        <p class="toast__title">${escapeHtml(title)}</p>
        ${msg ? `<p class="toast__msg">${escapeHtml(msg)}</p>` : ''}
      </div>
      <span class="toast__progress"></span>`;
    el.toastContainer.appendChild(node);
    refreshIcons();

    const ttl = 3400;
    setTimeout(() => removeToast(node), ttl);
  }

  function removeToast(node) {
    if (!node || !node.parentNode) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 300);
  }

  /* ============================================================
     Export
     ============================================================ */
  function exportTasks() {
    const blob = new Blob([JSON.stringify(state.tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('info', 'Exported', 'Your tasks were downloaded as JSON.');
  }

  /* ============================================================
     Greeting & date
     ============================================================ */
  function renderGreeting() {
    const h = new Date().getHours();
    let greet;
    if (h < 12) greet = 'Good morning';
    else if (h < 18) greet = 'Good afternoon';
    else greet = 'Good evening';
    el.greeting.textContent = greet + '!';

    const now = new Date();
    el.currentDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    el.dateBadge.textContent = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /* ============================================================
     Event wiring
     ============================================================ */
  function bindEvents() {
    // Add task buttons
    el.addTaskBtn.addEventListener('click', () => openTaskModal(null));
    el.emptyAddBtn.addEventListener('click', () => openTaskModal(null));

    // Sidebar navigation
    el.navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.view === 'settings') {
          openModal(el.settingsModal);
          return;
        }
        setActiveFilter(navItemFilter(item));
        closeSidebar();
      });
    });

    // Filter bar
    el.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter));
    });

    // Sorting
    el.sortSelect.addEventListener('change', () => {
      state.activeSort = el.sortSelect.value;
      renderTasks();
    });

    // Search
    el.searchInput.addEventListener('input', () => {
      state.searchQuery = el.searchInput.value.trim().toLowerCase();
      el.searchClear.hidden = !state.searchQuery;
      renderTasks();
    });
    el.searchClear.addEventListener('click', () => {
      el.searchInput.value = '';
      state.searchQuery = '';
      el.searchClear.hidden = true;
      el.searchInput.focus();
      renderTasks();
    });

    // Theme
    el.themeToggle.addEventListener('click', toggleTheme);
    el.settingsThemeToggle.addEventListener('click', toggleTheme);

    // Task list (event delegation)
    el.taskList.addEventListener('click', (e) => {
      const actionNode = e.target.closest('[data-action]');
      if (!actionNode) return;
      const li = e.target.closest('.task');
      if (!li) return;
      const id = li.dataset.id;
      const action = actionNode.dataset.action;

      switch (action) {
        case 'toggle': toggleComplete(id); break;
        case 'important': toggleImportant(id); break;
        case 'edit': openTaskModal(id); break;
        case 'delete':
          const task = state.tasks.find(t => t.id === id);
          openConfirm({
            title: 'Delete task?',
            text: `"${task ? truncate(task.title, 60) : 'This task'}" will be permanently removed. This action cannot be undone.`,
            confirmLabel: 'Delete',
            onConfirm: () => deleteTask(id)
          });
          break;
      }
    });

    // Task modal
    el.taskForm.addEventListener('submit', handleTaskSubmit);
    el.cancelTaskBtn.addEventListener('click', () => closeModal(el.taskModal));
    el.modalClose.addEventListener('click', () => closeModal(el.taskModal));
    el.modalBackdrop.addEventListener('click', () => closeModal(el.taskModal));

    // Confirm modal
    el.confirmDelete.addEventListener('click', handleConfirm);
    el.cancelDelete.addEventListener('click', () => closeModal(el.deleteModal));
    el.deleteClose.addEventListener('click', () => closeModal(el.deleteModal));
    el.deleteBackdrop.addEventListener('click', () => closeModal(el.deleteModal));

    // Settings modal
    el.settingsClose.addEventListener('click', () => closeModal(el.settingsModal));
    el.settingsBackdrop.addEventListener('click', () => closeModal(el.settingsModal));
    el.clearAllBtn.addEventListener('click', () => {
      closeModal(el.settingsModal);
      setTimeout(() => {
        openConfirm({
          title: 'Clear all data?',
          text: 'Every task will be permanently deleted. This cannot be undone.',
          confirmLabel: 'Clear all',
          onConfirm: clearAllTasks
        });
      }, 250);
    });
    el.exportBtn.addEventListener('click', exportTasks);

    // Calendar navigation
    el.prevMonth.addEventListener('click', () => shiftMonth(-1));
    el.nextMonth.addEventListener('click', () => shiftMonth(1));

    // Mobile sidebar
    el.mobileMenuBtn.addEventListener('click', openSidebar);
    el.sidebarClose.addEventListener('click', closeSidebar);
    el.sidebarOverlay.addEventListener('click', closeSidebar);

    // Escape closes any open modal / sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (el.taskModal.classList.contains('is-open')) closeModal(el.taskModal);
      else if (el.deleteModal.classList.contains('is-open')) closeModal(el.deleteModal);
      else if (el.settingsModal.classList.contains('is-open')) closeModal(el.settingsModal);
      else if (el.sidebar.classList.contains('is-open')) closeSidebar();
    });

    // Close sidebar when resizing up to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeSidebar();
    });
  }

  function shiftMonth(delta) {
    let m = state.calendarMonth + delta;
    let y = state.calendarYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.calendarMonth = m;
    state.calendarYear = y;
    renderCalendar();
  }

  function openSidebar() { el.sidebar.classList.add('is-open'); }
  function closeSidebar() { el.sidebar.classList.remove('is-open'); }

  /* ============================================================
     Seed sample data on first run
     ============================================================ */
  function seedIfEmpty() {
    if (state.tasks.length > 0) return;
    const today = todayStr();
    const tomorrow = addDays(today, 1);
    const inThree = addDays(today, 3);
    const yesterday = addDays(today, -1);

    state.tasks = [
      makeSeed('Finish quarterly report', 'Wrap up the Q4 numbers and share with the team.', tomorrow, '10:00', 'high', 'work', ['report', 'finance'], true),
      makeSeed('Buy groceries', 'Milk, eggs, vegetables, coffee beans.', today, '18:30', 'medium', 'shopping', ['errand'], false),
      makeSeed('Read chapter 5 \u2014 Designing Data-Intensive Apps', 'Take notes on replication & partitioning.', inThree, '', 'low', 'study', ['reading'], false),
      makeSeed('Reply to client emails', 'Follow up on the proposal sent last week.', yesterday, '09:00', 'high', 'work', ['email'], false),
      makeSeed('Morning workout', '30 min run + stretching.', today, '07:00', 'low', 'personal', ['health'], false)
    ];
    saveTasks();
  }

  function makeSeed(title, description, dueDate, dueTime, priority, category, tags, important) {
    return sanitizeTask({
      id: uid(), title, description, dueDate, dueTime, priority, category, tags,
      important, completed: false, createdAt: Date.now() - Math.random() * 1e8, completedAt: null
    });
  }

  function addDays(str, n) {
    const d = parseDate(str);
    if (!d) return str;
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    loadTheme();
    state.tasks = loadTasks();
    seedIfEmpty();

    renderGreeting();
    bindEvents();
    setActiveFilter('dashboard');
    renderCalendar();
    refreshIcons();

    // Hide the page loader once everything is ready
    hideLoader();
  }

  function hideLoader() {
    const remove = () => {
      el.loader.classList.add('is-hidden');
      setTimeout(() => { if (el.loader.parentNode) el.loader.remove(); }, 600);
    };
    if (document.readyState === 'complete') remove();
    else window.addEventListener('load', remove, { once: true });
    // Fallback in case 'load' is delayed
    setTimeout(remove, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
