# Audit & Project State: April 2026 / Аудит и состояние проекта: Апрель 2026

> **ИНСТРУКЦИЯ:** Данный файл является справочным пособием. Вносить изменения следует атомарно и только по мере необходимости при изменении архитектуры или статуса проекта.

## 1. Project Overview: "Mindra" / Обзор проекта: "Mindra"
Mindra is a multi-vertical platform serving three distinct markets: **Business**, **Wedding**, and **Party**.
Mindra — это многопрофильная платформа, обслуживающая три различных рынка: **Бизнес**, **Свадьбы** и **Вечеринки**.
The site acts as a dynamic CMS that transforms social media content (specifically Instagram) into polished, themed landing pages.
Сайт работает как динамическая CMS, которая преобразует контент из социальных сетей (в частности, Instagram) в отполированные тематические целевые страницы.

## 2. Technical Stack Audit / Аудит технологического стека

### Frontend (Next.js 15.5+ & React 19) / Фронтенд (Next.js 15.5+ и React 19)
- **Modernity:** Bleeding edge. Using React 19 and Next.js 15 with App Router.
- **Современность:** Передовые технологии. Использование React 19 и Next.js 15 с App Router.
- **Styling:** Tailwind CSS v4. Configured via CSS variables in `globals.css` with a strong focus on glassmorphism and cinematic effects.
- **Стилизация:** Tailwind CSS v4. Настроено через CSS-переменные в `globals.css` с упором на глассморфизм и кинематографические эффекты.
- **Design System:** Well-documented in `mindra-design/design_system.md`.
- **Дизайн-система:** Подробно описана в `mindra-design/design_system.md`.
    - **Hub:** Luxury Minimalist (Black/White, Syne/Inter).
    - **Hub (Центр):** Роскошный минимализм (Черный/Белый, шрифты Syne/Inter).
    - **Party:** Cyberpunk/Neon (Blue/Pink/Green, Clash Display/Space Mono).
    - **Party (Вечеринка):** Киберпанк/Неон (Синий/Розовый/Зеленый, шрифты Clash Display/Space Mono).
    - **Business:** Corporate Fintech (Navy/Slate, Helvetica/Inter).
    - **Business (Бизнес):** Корпоративный финтех (Темно-синий/Сланцевый, шрифты Helvetica/Inter).
    - **Wedding:** Editorial Romantic (Cream/Gold/Sage, Playfair Display/Lato).
    - **Wedding (Свадьба):** Редакционная романтика (Кремовый/Золотой/Шалфейный, шрифты Playfair Display/Lato).
- **Interactive Elements:** Custom cursors, magnetic buttons, and glass panels are standard across the platform.
- **Интерактивные элементы:** Кастомные курсоры, магнитные кнопки и стеклянные панели являются стандартом для всей платформы.

### Backend & Data (Prisma & Python) / Бэкенд и Данные (Prisma и Python)
- **Database:** SQLite via Prisma. Simple, effective for the current scale.
- **База данных:** SQLite через Prisma. Просто и эффективно для текущего масштаба.
- **Pipeline:** A sophisticated Python-based Instagram sync tool that handles cookies, media downloads, and mapping to the Prisma schema.
- **Пайплайн:** Сложный инструмент синхронизации с Instagram на базе Python, который управляет куки, загрузкой медиа и маппингом в схему Prisma.
- **Admin:** A custom-built dashboard for moderation.
- **Админка:** Кастомная панель управления для модерации.

## 3. Current Implementation Status / Текущий статус реализации
- **Core Architecture:** Ready. Multi-route structure established for all verticals.
- **Ядровая архитектура:** Готова. Установлена многомаршрутная структура для всех вертикалей.
- **Instagram Pipeline:** Functional, but currently being integrated into the Admin UI for better moderation.
- **Instagram пайплайн:** Функционален, но в данный момент интегрируется в админ-панель для лучшей модерации.
- **Admin Editor:** Supports block-based editing. Current focus is on "Drafts" management and quick categorization of synced posts.
- **Party Prompts Integration:** Completed & Functional. Integrated SPA into `/party-prompts` and `/party-prompts/dashboard` with full SQLite persistence via Server Actions and file upload API.
- **Интеграция Party Prompts:** Завершена и функциональна. Интегрировано SPA в `/party-prompts` и `/party-prompts/dashboard` с полной персистентностью в SQLite через Server Actions и API загрузки файлов.
- **Admin Editor:** Supports block-based editing. Current focus is on "Drafts" management and quick categorization of synced posts.
- **Админ-редактор:** Поддерживает блочное редактирование. Текущий фокус — управление «Черновиками» и быстрая категоризация синхронизированных постов.

## 4. Identified Gaps & Opportunities / Выявленные пробелы и возможности
- **Assets:** The project is "waiting for visual assets" in some areas, using placeholders and generated images.
- **Ассеты:** В некоторых областях проект «ожидает визуальные ассеты», используются плейсхолдеры и сгенерированные изображения.
- **SEO/Metadata:** Dynamic metadata implemented for `/party-prompts` & `/party-prompts/dashboard`. Dynamic event page SEO strategy in progress.
- **SEO/Метаданные:** Динамические метаданные реализованы для `/party-prompts` и `/party-prompts/dashboard`. Единая стратегия SEO для событий в процессе.
- **Performance:** React 19 compiler is enabled (`babel-plugin-react-compiler`), which is excellent for performance.
- **Производительность:** Включен компилятор React 19 (`babel-plugin-react-compiler`), что отлично сказывается на производительности.

## 5. Roadmap / Active Tasks / Дорожная карта / Активные задачи
- [x] Integrate `prompts-party-front` SPA into Next.js App Router (`/party-prompts` & `/party-prompts/dashboard`).
- [x] Интегрировать SPA `prompts-party-front` в Next.js App Router (`/party-prompts` и `/party-prompts/dashboard`).
- [x] Implement SQLite persistence for PromptList, PromptAttachment, PromptAttachmentHistory, PromptSettings.
- [x] Реализовать персистентность в SQLite для PromptList, PromptAttachment, PromptAttachmentHistory, PromptSettings.
- [ ] Implement "Quick Actions" in Admin Dashboard for Instagram drafts.
- [ ] Реализовать «Быстрые действия» в админ-панели для черновиков из Instagram.
- [ ] Extend `EventPage` model to support `isPublished` flag properly in UI.
- [ ] Расширить модель `EventPage` для корректной поддержки флага `isPublished` в UI.
- [ ] Finalize the "Uncategorized" flow for synced posts.
- [ ] Завершить поток «Без категории» для синхронизированных постов.
- [ ] Apply theme-specific CSS filters and noise overlays as per design system.
- [ ] Применить специфичные для тем CSS-фильтры и шумовые наложения согласно дизайн-системе.

## 6. System Architecture Diagram (Website) / Диаграмма архитектуры системы (Сайт)

```text
       [ ПОЛЬЗОВАТЕЛИ ]                      [ АДМИНИСТРАТОР ]
              |                                      |
              v                                      v
    +----------------------------------------------------------------+
    | СЛОЙ ПРЕДСТАВЛЕНИЯ (Next.js App Router)                        |
    |                                                                |
    |  /wedding  /business  /party      /admin (Дашборд)             |
    |  /party-prompts                   /party-prompts/dashboard       |
    |  /[slug] (Динамич. страницы)      /admin/id (Редактор блоков)  |
    +----------------------------------------------------------------+
              |                                      |
              |            HTTP API / Server Actions |
              v                                      v
    +----------------------------------------------------------------+
    | API СЛОЙ (Next.js API Routes & Server Actions)                 |
    |                                                                |
    |  /api/auth (Вход)                 /api/admin/pages (Управление)|
    |  /api/contact (Формы)             /party-prompts/api/upload    |
    |  /party-prompts/actions.ts        /api/sync (Входящие данные)  |
    +----------------------------------------------------------------+
              |                                      |
              |           ORM (Prisma Client)        |
              v                                      v
    +-------------------------+      +-------------------------------+
    | БАЗА ДАННЫХ (SQLite)    |      | ФАЙЛОВОЕ ХРАНИЛИЩЕ            |
    |                         |      |                               |
    |  Table: EventPage       |      |  /public/uploads (Картинки)   |
    |  Table: PromptList      |      |  /public/uploads/party-prompts|
    |  Table: PromptAttachment|      |  /public/media (Инста-контент)|
    |  Table: PromptSettings  |      |                               |
    +-------------------------+      +-------------------------------+
              ^
              |
      [ ТЕМАТИЗАЦИЯ / СТИЛИ ]
      (Tailwind v4 + globals.css)
```

---
*Last Audit Date: 2026-07-21 / Дата последнего аудита: 21.07.2026*
