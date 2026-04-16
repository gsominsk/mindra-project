# MCP AI Designer Prompt: Party Layer UI Specification

**System Context for Design Agent:**
You are an expert UI/UX designer managing the `1.pen` file via Pencil MCP. Your task is to refactor and finalize the design system and layouts for a high-end "Party & DJ Event" segment of a website. The design language is "Cyberpunk / Nightclub / VJ UI". 
*Forget any frontend code specifications you don't need them. Your output is pure `.pen` JSON nodes, manipulating frames, rectangles, text, strokes, and effects.*

## 🎨 1. Design System & Tokens
Прямо с порога, обновите или создайте следующие переменные стиля (`get_variables` -> `set_variables`):
- **Backgrounds:** `Background Primary` = `#09090b` (Deep Void), `Background Secondary` = `#18181b` (Surface).
- **Accents (Neon Effect):** `Neon Cyan` = `#80d8ff`, `Neon Magenta` = `#ffb0c9`. Для эффекта свечения используйте массив эффектов: `[{type: "shadow", shadowType: "outer", color: "#80d8ff66", blur: 24}]`.
- **Typography:** Использовать гротески с агрессивным характером. Заголовки: `Clash Display` или `Space Grotesk`, начертание `700` или `800`. Текст: `Inter`, цвет `#a1a1aa`.
- **Glasmorphism:** Панели (например, навигация) должны быть `fill: "#18181b5c"` с `effect: {type: "background_blur", radius: 25}`.

---

## 📱 2. Desktop Layouts (Ширина 1280px - 1440px)

### A. Фрейм `landing — Desktop` (Главная Витрина)
Цель: Чистая агрессия и конверсия. Никогда не перегружайте экран.
1. **TopNavBar:** **УДАЛИТЬ (D)** узел с верхней навигацией. Очистить воздух.
2. **Hero Section (Первый экран):**
   - Бэкграунд: Темный контейнер `height: 900` или `fill_container`.
   - Внутри: Центрированный текст гигантского размера (например, `fontSize: 120`): "MAKE IT LOUD".
   - Элемент: Акцентная кнопка (`height: 56`, `cornerRadius: 4`, обводка `Neon Cyan`). Текст кнопки: "ENTER THE VAULT".
3. **Signature Vibe Curation (Bento Grid):**
   - Пересобрать сетку (Bento Grid). Это не просто витрина, а навигационные карточки.
   - Три основные карточки. Размеры: одна `width: fill_container`, две под ней делят пространство 50/50.
   - Контент карточек: Крупные заголовки ("Sonic Architecture", "Visual Distortion", "Energy Control"). Фон каждой карточки: `Background Secondary` с наложенным нойзом (image noise) или `hover` стейтом.
4. **The Vault (Gateway Section):**
   - **ВАЖНО:** Этот раздел больше не является самим портфолио! Это портал.
   - Скомпонуйте фрейм `padding: [128, 32]`. По центру гигантская неоновая дверь/окно (Frame с `stroke: {thickness: 2, fill: "#ffb0c9"}`, прозрачной заливкой и эффектом `box-shadow` свечения). Текст внутри: "ACCESS THE ARCHIVE". При клике в проде это будет вести на `/portfolio`.

### B. Фрейм `portfolio — Desktop` (Архив / Универсальный Скроллер)
**СОЗДАТЬ С НУЛЯ (I)**. Это страница для просмотра ивентов (видео и фото).
1. **Main Display (Окно плеера):**
   - Фрейм `layout: absolute`, размер: `width: fill_container, height: 600`.
   - Поместить внутрь плейсхолдер картинки (сгенерировать через `G` AI: "crowd at a neon cyberpunk rave, dark, laser lights").
   - Добавить поверх слой с градиентом (bottom to top, от черного к прозрачному) для читаемости текста.
   - В нижнем левом углу поверх плеера: Название ивента (Текст, fontSize: 48, белый).
2. **Carousel (Лента таймлайна):**
   - Фрейм `layout: horizontal`, `width: fill_container, gap: 16`.
   - Расположение: либо `padding` поверх плеера внизу, либо отдельным блоком сразу под ним.
   - Внутри `Carousel` поместить 4-5 Thumbnail-карточек (размер `width: 200, height: 120`).
   - Активная карточка: обводка `Neon Cyan`. Неактивные: убрать обводку, `opacity: 0.4`.

### C. Фрейм `contact — Desktop` (Форма Бронирования)
Текущий фрейм называется `comment — Desktop`. Сначала **Переименовать (U)** его в `contact — Desktop`.
1. Изолировать интерфейс: **УДАЛИТЬ** все лишнее (навигацию).
2. **The Ticket Card:**
   - Структура: Расположить по центру экрана (абсолютное позиционирование или `alignItems: center, justifyContent: center`).
   - Дизайн билета: Фон `#09090b`, обводка `stroke: dashed 2px #3f3f46`, форма — вытянутый прямоугольник (как посадочный талон или VIP pass). Обязательно добавить графический элемент "Штрихкод / Barcode" (можно сгенерировать линию/паттерн).
   - Поля ввода (Frames с `layout: horizontal`, нижняя обводка `border-bottom`):
     - `FIRST NAME // LAST NAME`
     - `VIBE REQUIREMENT // BUDGET`
     - `DATE CLASH [00.00.00]`
   - Кнопка Submit: Полностью залита `Neon Magenta` с черным текстом "SECURE THE DATE".

---

## 📱 3. Mobile Layouts (Ширина 375px - 430px)
Абсолютно все десктопные фреймы должны быть продублированы для мобильной ориентации со следующими правилами ресайтинга:

### A. Фрейм `landing — Mobile`
1. Ширина фрейма: `390`.
2. **Hero:** Размер шрифта "MAKE IT LOUD" уменьшен до `fontSize: 64`.
3. **Bento Grid:** Блоки, которые шли в сетке 50/50, здесь перестраиваются в одну колонку (`layout: vertical, width: fill_container, gap: 16`).
4. Внутренние `padding` всех секций ограничены до `[48, 16]`.

### B. Фрейм `portfolio — Mobile`
1. **Main Display (Плеер):** Высота ужимается до `height: 300` (чтобы сохранить пропорции 16:9). Заголовок ивента `fontSize: 28`.
2. **Carousel:** Карточки остаются `horizontal`, но теперь они скроллятся за экран (горизонтальный скроллинг). Ширина карточки `width: 140, height: 80`.

### C. Фрейм `contact — Mobile`
1. **The Ticket Card:** Вместо горизонтального вытянутого билета, превратить в вертикальный флаер. Поля ввода идут друг под другом.
2. Штрихкод переместить в самый низ билета.

---

## 🧭 4. Универсальная Навигация (На всех экранах)
**Bottom Navigation Bar (The Pulse Dock)**
- Это **ЕДИНСТВЕННАЯ** навигация на сайте Party.
- Размещение на каждом экране (Desktop и Mobile): `layoutPosition: absolute`, прижато к нижнему краю (`y` высчитывается от дна экрана с отступом 32px), центрировано по горизонтали `x: 50%` или через constraints.
- Структура дока: `effect: background_blur 35`, скруглённые углы `cornerRadius: 9999`, внутри иконки или ссылки: "HOME", "VAULT", "TICKET".

## 📌 Инструкция для ИИ
Получив этот промпт, не пытайся сделать весь сайт одним запросом. Действуй строго поблочно:
1. Вызови `batch_design` для создания Токенов и цветового фона.
2. Сделай проход по `landing - Desktop`. Очисти мусор, собери Hero и Bento. Запроси скриншот `get_screenshot`.
3. Сделай проход по `portfolio - Desktop` (сборка с нуля таймлайна).
4. Отрефакторь `contact - Desktop` в Ticket Card.
5. Зафиналь мобильные версии через Copy (`C`) и Update (`U`) layout параметров.
