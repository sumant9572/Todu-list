# Todu-list (TaskFlow)

A modern, responsive smart to-do list and productivity dashboard built with pure **HTML5, CSS3, and Vanilla JavaScript** — no frameworks, no build tools, no backend.

## Features

- **Dashboard layout** — sidebar navigation, statistics cards, progress overview, and a right panel with calendar, upcoming deadlines, and 7-day productivity bars.
- **Full task CRUD** — create, read, update, delete (with confirmation), complete, and restore tasks.
- **Rich task fields** — title, description, due date, due time, priority (Low / Medium / High), category, tags, and an important flag.
- **Filters** — All, Today, Upcoming, Completed, Important, Overdue, plus per-category views.
- **Sorting** — Newest, Oldest, Priority, Due Date.
- **Live search** across titles, descriptions, and tags.
- **Calendar** — monthly view with task-bearing dates highlighted; click a date to filter tasks.
- **Priority indicators** — red (high), orange (medium), green (low).
- **Dark mode** — full light/dark theme toggle, remembered across sessions.
- **LocalStorage persistence** — tasks and theme survive refreshes; safely handles empty or invalid data.
- **Toast notifications** for add / update / delete / complete actions.
- **Empty states**, smooth animations, and `prefers-reduced-motion` support.
- **Fully responsive** for desktop (1440), laptop (1024), tablet (768), and mobile (375).

## Tech

- HTML5 (semantic markup)
- CSS3 (custom properties, grid/flex, glassmorphism, animations)
- Vanilla JavaScript (ES6, event delegation)
- Google Fonts (Poppins / Inter) and Lucide Icons via CDN

## Run

Open `index.html` in any modern browser. No server required.

> Icons and fonts load from CDNs; the app still works offline, falling back to system fonts when the CDNs are unreachable.

## Project structure

```
Todu-list/
├── index.html   # semantic dashboard markup
├── style.css    # theming, layout, animations, responsiveness
└── script.js    # all app logic, CRUD, storage, calendar, toasts
```
