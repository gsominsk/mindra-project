# New Route & Deployment Plan / План нового роута и развертывания

> **ИНСТРУКЦИЯ:** Данный файл описывает задачу внедрения нового роута и деплоя проекта на сервер. По мере выполнения задачи следует отмечать статусы.

---

## 1. Аудит SPA-заготовки (`prompts-party-front`)

> Верифицировано: 2026-07-20 по файлам из `/Users/sominskijgeorgij/Downloads/prompts-party-front`

### 1.1. Технический стек заготовки
| Компонент            | Технология / Версия                    |
|----------------------|----------------------------------------|
| Runtime              | Vite 6.2 SPA + Express 4.21 сервер    |
| Framework            | React 19 + TypeScript 5.8              |
| Стейт-менеджер       | Zustand 5.0                            |
| Стилизация           | Tailwind CSS 4.1 (via `@tailwindcss/vite` plugin) |
| Анимации             | `motion` 12.23 (framer-motion fork)    |
| Карусель             | `embla-carousel-react` 8.6             |
| Drag-and-Drop        | `react-sortablejs` 6.1 + `sortablejs` 1.15 |
| Иконки               | `lucide-react` 0.546                   |
| AI интеграции        | OpenRouter API (grok-imagine), Gemini API (@google/genai) |
| Пакетный менеджер    | bun (bun.lock)                         |

### 1.2. Структура файлов заготовки
```
prompts-party-front/
├── src/
│   ├── App.tsx         ← 1741 строк, монолитный компонент (ВСЯ логика)
│   ├── store.ts        ← Zustand store, 212 строк, 30+ state-полей
│   ├── fixtures.ts     ← Типы: Attachment, DashboardItem, AttachmentHistoryItem
│   ├── main.tsx        ← точка входа React
│   ├── index.css       ← 23 байта (стили через Tailwind)
│   └── utils/
│       └── logger.ts   ← стилизованный console-логгер (namespace-based)
├── server.ts           ← Express сервер: POST /api/transcribe (Gemini STT)
├── assets/
│   └── test-img-1.png  ← тестовое изображение (mock для генерации)
├── index.html          ← SPA entry
├── vite.config.ts      ← Vite + React + Tailwind plugins
├── tsconfig.json       ← target ES2022, bundler resolution
└── package.json
```

### 1.3. Функциональность SPA (верифицировано по коду)

**Два экрана (views):** `main` | `dashboard` (переключение через боковое меню)

#### Экран "Main" (3-колоночный layout)
1. **Колонка 1 (Левая):** Превью карусели выбранного DashboardItem → кнопка выбора списка → генерация картинки
2. **Колонка 2 (Центр):** Таймер обратного отсчёта с анимированным SVG-кругом, запуск речевого ввода
3. **Колонка 3 (Правая):** Текстовый промпт + микрофон (SpeechRecognition API), генерация картинки → вывод результата

#### Экран "Dashboard"
- Сетка карточек `DashboardItem` с каруселями изображений
- Drag-and-drop файлов для создания новых списков или добавления в существующие
- Клик на карточку → модал "Вложения" с sortable-списком `Attachment`

#### Модальные окна (4 штуки)
1. **Settings** — таймер (сек), OpenRouter API Key, toggles (hide text prompt, auto-send)
2. **Attachments** — сетка карточек вложений с drag-and-drop, add item, sortable
3. **Choose List** — выбор DashboardItem для привязки к колонке 1
4. **Attachment Detail** — детальный просмотр: история загрузок, референсы (★ до 2 шт, хранятся в `selectedReferences` — локальный `useState`, не Zustand), генерация изображений с промптом. **⚠️ Генерация в Detail Modal — MOCK** (использует `testImg` ассет, не вызывает OpenRouter API. Нужна реализация реального API при интеграции).

#### API-интеграции
- **OpenRouter** (`openrouter.ai/api/v1/chat/completions`) → модель `x-ai/grok-imagine-image-quality` — генерация изображений по промпту (Column 1 и Column 2). Ключ хранится в `sessionStorage`.
- **Gemini STT** (серверный `POST /api/transcribe`) — транскрипция аудио через `@google/genai` модель `gemini-3-flash-preview`. **DEPRECATED** в коде, заменено на Web SpeechRecognition API.
- **Web SpeechRecognition API** — встроенный в браузер распознаватель речи (ru-RU), `continuous: true`, `interimResults: true`

#### Данные / Хранение
- **Все данные in-memory** (Zustand store) — при перезагрузке теряются
- `sessionStorage` — сохраняет только `openRouterKey` и `selectedDashboardListId`
- `selectedReferences` — массив до 2 референс-URL, хранится как **локальный `useState`** в `App` (не в Zustand)
- Изображения хранятся как Blob URLs (`URL.createObjectURL`) — **невалидны после закрытия вкладки**
- `convertBlobUrlToBase64` — утилита определена (L267-284), но **не вызывается** (dead code, может пригодиться для upload)
- `formatTimestamp` — утилита форматирования русской даты (L286-291), вынести в `_utils/`
- Нет никакого бэкенд-хранения, нет БД

---

## 2. Аудит целевого проекта (`mindra-website`)

> Верифицировано: 2026-07-20 по файлам из `/Users/sominskijgeorgij/sandbox/mindra-website`

### 2.1. Технический стек
| Компонент            | Технология / Версия                    |
|----------------------|----------------------------------------|
| Framework            | Next.js 15.5 (App Router, standalone output) |
| React                | 19.0                                   |
| Стилизация           | Tailwind CSS 4 (PostCSS, `@tailwindcss/postcss`) |
| Анимации             | `framer-motion` 11.11 (**не** `motion`!) |
| ORM / БД             | Prisma 5.22 + SQLite (`dev.db`)        |
| Деплой               | Docker (multi-stage) + docker-compose  |
| Шрифты               | Syne, Roboto, Inter, Playfair Display, Lato |

### 2.2. Существующая Prisma-схема (модели)
- `EventPage` — страницы мероприятий (slug, blocks, IG sync fields)
- `Block` — контент-блоки с order, layout, media
- `SyncJob` — задачи синхронизации Instagram
- `BookingRequest` — заявки на бронирование
- `RawInstagramPost` — очередь Instagram-постов

### 2.3. Существующие роуты (app/)
```
app/
├── page.tsx              ← главная страница
├── layout.tsx            ← корневой layout (шрифты, providers)
├── globals.css           ← глобальные стили
├── [slug]/               ← динамические страницы мероприятий
├── admin/                ← админ-панель
├── business/             ← бизнес-раздел
├── contact/              ← контактная форма
├── login/                ← авторизация
├── wedding/              ← свадьбы
├── api/admin/            ← API admin (защищён middleware)
├── api/auth/             ← API авторизации
├── api/contact/          ← API контактной формы
├── api/sync/             ← API синхронизации
├── api/upload/           ← API загрузки (защищён middleware)
├── components/           ← общие компоненты
├── context/              ← React-контексты
├── i18n/                 ← интернационализация
├── lib/                  ← утилиты (Prisma instance)
└── utils/                ← утилиты
```

### 2.4. Middleware
Защищает `/admin/*`, `/api/admin/*`, `/api/upload/*` через cookie `admin_session`.

### 2.5. Docker / Деплой
- `output: 'standalone'` в `next.config.ts`
- Multi-stage Dockerfile → node:20-alpine → `node server.js`
- docker-compose: порт 80:3000, volume `/root/media:/app/public/media:ro`
- Отдельный сервис `ig-sync` (Python)

---

## 3. Анализ совместимости и проблемы интеграции

### 3.1. Конфликты зависимостей
| Зависимость SPA       | Версия SPA        | Версия mindra            | Проблема                         |
|------------------------|--------------------|--------------------------|----------------------------------|
| `motion`               | 12.23             | `framer-motion` 11.11    | **Разные пакеты!** SPA использует `motion/react`, mindra — `framer-motion` |
| Tailwind CSS           | 4.1 (Vite plugin) | 4 (PostCSS plugin)       | Совместимы, но **разные плагины**. В Next.js используется `@tailwindcss/postcss` |
| React                  | 19.0.1            | 19.0.0                   | Совместимы (patch diff)          |
| `lucide-react`         | 0.546             | 0.460                    | Совместимы, взять новее          |
| `@google/genai`        | 2.4.0             | отсутствует              | **Новая зависимость** (нужна для серверного STT, но endpoint deprecated) |
| `embla-carousel-react` | 8.6.0             | отсутствует              | **Новая зависимость**            |
| `react-sortablejs`     | 6.1.4             | отсутствует              | **Новая зависимость**            |
| `sortablejs`           | 1.15.7            | отсутствует              | **Новая зависимость**            |
| `zustand`              | 5.0.14            | отсутствует              | **Новая зависимость**            |

### 3.2. Архитектурные проблемы
1. **Монолитный App.tsx (1741 строк)** — нужна декомпозиция на ~10-12 компонентов
2. **`sessionStorage`** — недоступен на сервере (SSR). Инициализация store вызовет ошибку при SSR → нужен lazy init или `"use client"` boundary
3. **Blob URLs** — не персистентны, невалидны после перезагрузки. Для сохранения в БД необходима загрузка файлов через `/api/upload` endpoint
4. **`framer-motion` vs `motion`** — импорты `from 'motion/react'` нужно заменить на `from 'framer-motion'` (или установить `motion` как доп. зависимость)
5. **Express server.ts** — **не нужен** в Next.js. `/api/transcribe` переедет в Next.js API Route или Server Action
6. **Vite-специфичные вещи** — `@tailwindcss/vite`, alias `@` через vite.config — **не переносятся**, в Next.js свой pipeline

### 3.3. Что НЕ переносится
- `server.ts` (Express) — заменяется на Next.js Server Actions / API Routes
- `vite.config.ts` — неприменим
- `index.html` — Next.js имеет свой layout
- `main.tsx` — заменяется на `page.tsx`
- `@tailwindcss/vite` — уже есть `@tailwindcss/postcss`
- Deprecated `/api/transcribe` — SPA уже использует Web SpeechRecognition API
- `dotenv` — Next.js имеет встроенную поддержку `.env` файлов
- Dev-зависимости SPA: `@vitejs/plugin-react`, `esbuild`, `tsx`, `autoprefixer` — не нужны в Next.js

---

## 4. Архитектурный план интеграции

### 4.1. Структура нового роута в Next.js
```
app/party-prompts/
├── page.tsx                     ← "use client", корневой компонент (entry)
├── _components/
│   ├── PartyPromptsApp.tsx      ← основной контейнер (main + dashboard switch)
│   ├── Header.tsx               ← шапка + меню-кнопка
│   ├── SideMenu.tsx             ← боковое меню-drawer
│   ├── SettingsModal.tsx        ← модал настроек (таймер, ключ, toggles)
│   ├── AttachmentsModal.tsx     ← модал вложений (grid + sortable)
│   ├── ChooseListModal.tsx      ← модал выбора списка
│   ├── AttachmentDetailModal.tsx ← детальный просмотр + генерация + история
│   ├── DashboardView.tsx        ← экран "Дашборд"
│   ├── MainView.tsx             ← экран "Main" (3 колонки)
│   ├── DashboardCarousel.tsx    ← карусель (embla)
│   ├── VoiceVisualizer.tsx      ← визуализатор аудио (Web Audio API)
│   └── TimerSection.tsx         ← SVG-таймер
├── _store/
│   └── store.ts                 ← Zustand store (адаптированный для SSR)
├── _hooks/
│   ├── useImageGeneration.ts    ← логика OpenRouter API
│   ├── useSpeechRecognition.ts  ← логика Web SpeechRecognition
│   └── useTimer.ts              ← логика таймера
├── _actions.ts                  ← Server Actions (CRUD для списков и вложений)
├── _lib/
│   └── types.ts                 ← Типы: Attachment, DashboardItem, AttachmentHistoryItem
└── _utils/
    ├── logger.ts                ← logger (перенос)
    └── formatters.ts            ← formatTimestamp и convertBlobUrlToBase64 (перенос из App.tsx)
```

### 4.2. Обновление Prisma-схемы

Новые модели для `schema.prisma`:

```prisma
model PromptList {
  id          String             @id @default(cuid())
  name        String
  order       Int                @default(0)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  attachments PromptAttachment[]
}

model PromptAttachment {
  id            String                    @id @default(cuid())
  name          String
  prompt        String                    @default("")
  imageUrl      String?                   // путь в /public/uploads/ или внешний URL
  isUploaded    Boolean                   @default(false)
  referenceUrl  String?                   // первый референс (для обратной совместимости)
  referenceUrls String?                   // JSON-массив URL (до 2 референсов, SQLite не поддерживает массивы)
  order         Int                       @default(0)
  listId        String
  list          PromptList                @relation(fields: [listId], references: [id], onDelete: Cascade)
  history       PromptAttachmentHistory[]
  createdAt     DateTime                  @default(now())
  updatedAt     DateTime                  @updatedAt
}

model PromptAttachmentHistory {
  id            String           @id @default(cuid())
  imageUrl      String
  prompt        String           @default("")
  isUploaded    Boolean          @default(false)
  referenceUrl  String?          // первый референс
  referenceUrls String?          // JSON-массив URL (до 2 референсов)
  attachmentId  String
  attachment    PromptAttachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)
  createdAt     DateTime         @default(now())
}
```

### 4.3. Server Actions (`_actions.ts`)

| Action                    | Описание                                    |
|---------------------------|---------------------------------------------|
| `getLists()`              | Получить все PromptList с attachments        |
| `createList(name)`        | Создать новый список                        |
| `deleteList(id)`          | Удалить список (cascade удалит attachments)  |
| `reorderLists(ids[])`     | Обновить порядок списков                    |
| `createAttachment(data)`  | Создать вложение в списке                   |
| `updateAttachment(data)`  | Обновить prompt, imageUrl вложения          |
| `deleteAttachment(id)`    | Удалить вложение                            |
| `reorderAttachments(ids[])` | Обновить порядок вложений                |
| `addHistoryEntry(data)`   | Добавить запись в историю вложения          |

### 4.4. Загрузка файлов
Существующий `/api/upload/route.ts` сохраняет в `public/uploads/<uuid>.<ext>` (flat directory).
**Нужна модификация:** добавить параметр `subdirectory` в FormData, чтобы сохранять в `public/uploads/party-prompts/<uuid>.<ext>`, либо создать отдельный endpoint `app/party-prompts/api/upload/route.ts`.
Blob URLs заменяются на реальные серверные пути после загрузки.
> ⚠️ Upload endpoint защищён middleware (`admin_session`) — нужно решить: требовать авторизацию или создать незащищённый endpoint для party-prompts.

### 4.5. Адаптация Zustand Store для SSR
```typescript
// Lazy initialization для избежания SSR-ошибок с sessionStorage
const useAppStore = create<AppState>()((set, get) => ({
  openRouterKey: '',  // ← инициализация пустой строкой
  // ... остальной store
}));

// Гидратация на клиенте
if (typeof window !== 'undefined') {
  useAppStore.setState({
    openRouterKey: sessionStorage.getItem('openRouterKey') || '',
    // ...
  });
}
```

### 4.6. Замена `motion` → `framer-motion`
Все импорты `from 'motion/react'` → `from 'framer-motion'`.
API идентичен (motion — это форк/ребренд framer-motion), замена механическая.

---

## 5. Зависимости для установки

```bash
npm install zustand embla-carousel embla-carousel-react react-sortablejs sortablejs
npm install -D @types/sortablejs
```

> `lucide-react` уже установлен (обновить до 0.546 при необходимости).
> `framer-motion` уже установлен — используем вместо `motion`.
> `@google/genai` — **не устанавливаем** (deprecated endpoint, заменён Web SpeechRecognition).

---

## 6. Roadmap / Active Tasks / Дорожная карта

> **Подход:** Принято решение о быстрой интеграции — SPA переносится as-is без декомпозиции на отдельные компоненты. Декомпозиция на 10-12 компонентов (секция 4.1) — отложена на будущий рефакторинг.

### Фаза 1: Подготовка инфраструктуры ✅
- [x] 1.1. Установить новые зависимости → `package.json` обновлён + `npm install` выполнен (9 пакетов: zustand, embla-carousel, embla-carousel-react, react-sortablejs, sortablejs, @types/sortablejs)
- [x] 1.2. Добавить модели `PromptList`, `PromptAttachment`, `PromptAttachmentHistory` в `prisma/schema.prisma`
- [x] 1.3. Выполнить миграцию `npx prisma db push` → 3 таблицы созданы, Prisma Client сгенерирован

### Фаза 2: Серверная логика ✅
- [x] 2.1. Создать `app/party-prompts/actions.ts` — Server Actions (CRUD: getLists, createList, deleteList, reorderLists, createAttachment, updateAttachment, deleteAttachment, reorderAttachments, addHistoryEntry)
- [x] 2.2. Создать `app/party-prompts/api/upload/route.ts` — отдельный endpoint для party-prompts, сохраняет в `public/uploads/party-prompts/<uuid>.<ext>`. **Не защищён middleware** (middleware матчит только `/api/upload/*`, наш путь `/party-prompts/api/upload`)

### Фаза 3: Клиентский код ✅ (быстрая интеграция)
> Монолит App.tsx перенесён как единый компонент `PartyPromptsApp.tsx` с минимальными изменениями.

- [x] 3.1. `app/party-prompts/fixtures.ts` — типы и моки (прямой перенос)
- [x] 3.2. `app/party-prompts/store.ts` — Zustand store, адаптирован для SSR (lazy init sessionStorage, client-side hydration)
- [x] 3.3. `app/party-prompts/PartyPromptsApp.tsx` — весь SPA как единый `'use client'` компонент
  - Импорт `motion/react` → `framer-motion`
  - `testImg` mock → заменён на реальный OpenRouter API в Detail Modal
  - `uploadFile()` helper для загрузки файлов через `/party-prompts/api/upload`
  - Speech Recognition: `setIsRecording` через `useAppStore.getState()` для SSR-safety
- [x] 3.4. `app/party-prompts/logger.ts` — стилизованный console-логгер (прямой перенос)
- [x] 3.5. `app/party-prompts/page.tsx` — серверный entry point с metadata

**Отложено на рефакторинг:**
- [ ] Декомпозиция PartyPromptsApp.tsx на 10-12 компонентов (Header, SideMenu, SettingsModal, etc.)
- [ ] Хуки: useImageGeneration, useSpeechRecognition, useTimer
- [ ] `_utils/formatters.ts` — formatTimestamp и convertBlobUrlToBase64

### Фаза 4: Интеграция store ↔ БД — Персистентность данных ✅

> **Реализовано:**
> - Все списки, вложения и их история сохраняются в SQLite через Prisma.
> - Все загружаемые файлы сохраняются на диск в `public/uploads/party-prompts/`.
> - Все настройки (OpenRouter API Key, время таймера, toggles) сохраняются в таблицу `PromptSettings`.
> - При старте страницы `page.tsx` загружает данные из БД на сервере и передаёт в клиентский компонент.

- [x] 4.0.1. Добавить модель `PromptSettings` в `prisma/schema.prisma`
- [x] 4.0.2. Выполнить `npx prisma db push`
- [x] 4.0.3. Добавить Server Actions: `getSettings()`, `updateSettings(data)`
- [x] 4.1.1. В `page.tsx` — вызвать `getLists()` и `getSettings()` на сервере, передать как props
- [x] 4.1.2. В `PartyPromptsApp.tsx` — гидрировать Zustand store при mount
- [x] 4.2.1-4.2.11. Sync всех 11 операторов (списки, вложения, история, настройки) с БД
- [x] 4.3.1-4.3.3. Замена Blob URLs на реальные серверные пути `/uploads/party-prompts/...` через `uploadFile()`

#### 4.4. Маппинг данных Prisma ↔ Zustand

```
Prisma PromptList          →  Zustand DashboardItem
  .id                      →  .id
  .name                    →  .name
  .attachments[]           →  .attachments[] + .items[]

Prisma PromptAttachment    →  Zustand Attachment
  .id                      →  .id
  .name                    →  .name
  .prompt                  →  .prompt
  .imageUrl                →  .url
  .isUploaded              →  .isUploaded
  .referenceUrl            →  .referenceUrl
  .referenceUrls (JSON)    →  .referenceUrls (string[]) — JSON.parse
  .history[]               →  .history[]

Prisma PromptAttachmentHistory → Zustand AttachmentHistoryItem
  .id                      →  .id
  .imageUrl                →  .url
  .prompt                  →  .prompt
  .createdAt (Date)        →  .timestamp (number) — Date.getTime()
  .isUploaded              →  .isUploaded
  .referenceUrl            →  .referenceUrl
  .referenceUrls (JSON)    →  .referenceUrls (string[]) — JSON.parse
```

### Фаза 5: Тестирование и сборка ✅
- [x] 5.1. Проверить корректность CRUD операций (списки, вложения, история в БД)
- [x] 5.2. Проверить drag-and-drop загрузку изображений через `/party-prompts/api/upload`
- [x] 5.3. Проверить выбор активной картинки из истории и её сохранение в `PromptAttachment.imageUrl`
- [x] 5.4. Проверить маршрутизацию: `/party-prompts` (Генерация) ↔ `/party-prompts/dashboard` (Дашборд)
- [x] 5.5. Проверить карусель в карточке дашборда (переключение без сброса слайдов и без перезагрузки страницы)
- [x] 5.6. `npm run build` — прошёл успешно (0 TypeScript/ESLint ошибок)

### Фаза 6: Деплой
- [ ] 6.1. Обновить Dockerfile при необходимости (Prisma sqlite volume)
- [ ] 6.2. Обновить `.env.production` при необходимости
- [ ] 6.3. Собрать Docker-образ и задеплоить на сервер

---

### Созданные файлы (интеграция party-prompts)
```
app/party-prompts/
├── page.tsx                 ← серверный entry роута /party-prompts (metadata + DB fetch)
├── dashboard/
│   └── page.tsx             ← серверный entry роута /party-prompts/dashboard (metadata + DB fetch)
├── PartyPromptsApp.tsx      ← 'use client', весь UI + Next.js router + DB sync
├── store.ts                 ← Zustand store (SSR-safe)
├── fixtures.ts              ← типы + моки
├── logger.ts                ← styled console logger
├── actions.ts               ← Server Actions (CRUD для списков, вложений, истории, настроек)
└── api/upload/
    └── route.ts             ← POST upload endpoint (/public/uploads/party-prompts/)
```

### Изменённые файлы
- `package.json` — +5 dependencies (zustand, embla-carousel, embla-carousel-react, react-sortablejs, sortablejs)
- `prisma/schema.prisma` — +4 модели (PromptList, PromptAttachment, PromptAttachmentHistory, PromptSettings)

---
*Date: 2026-07-20 / Дата: 20.07.2026*
*Updated: 2026-07-20T23:18 — полный аудит SPA и верифицированный план*
*Verified: 2026-07-20T23:53 — сверка 28 утверждений, 8 правок внесены*
*Implemented: 2026-07-21T02:15 — быстрая интеграция (Фазы 1-3), npm install + prisma db push выполнены*
*Tested & Persisted: 2026-07-21T21:34 — Фаза 4-5 завершена (БД персистентность, роуты /party-prompts & /party-prompts/dashboard, активный выбор изображений)*


