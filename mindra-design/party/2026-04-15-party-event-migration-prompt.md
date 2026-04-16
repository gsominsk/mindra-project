# MCP AI Designer Prompt: Party Event Landing Page (Dynamic Blocks)

**System Context & Objective:**
Мы проектируем архитектуру страницы отдельного мероприятия (`Event Landing Page`). Эта страница собирается динамически из CMS. В дизайне нам нужно отрисовать визуализацию 4 базовых блоков для поддомена **Party**. 
Текущая задача для Pencil MCP: Создать библиотеку компонентов (оболочек) для этих 4 типов контента, применив агрессивный киберпанк/клубный стиль.

## 🎨 1. Design System Tokens (Авторизация контекста)
*Выполните `set_variables` перед созданием узлов:*
- **Backgrounds:** `Bg-Core` = `#09090b`
- **Typographic Constants:** 
  - `Title (Clash Display, 800)`: Цвет `#ffffff` (White).
  - `BodyText (Inter, 400)`: Цвет `#a1a1aa` (Zinc 400).
- **Accents:** 
  - `Neon-Purple`: `#a855f7`
  - `Acid-Cyan`: `#22d3ee`
- **Effects:** Неоновое свечение картинок (`drop_shadow`, `blur: 32`, opacity 20%).

## 🧱 2. Построение Компонентов (The Content Blocks)
Создайте фрейм-контейнер `event-template — Desktop` (ширина 1440). Разместите в нем вертикально друг под другом (`layout: vertical`, `gap: 120`) следующие компоненты-блоки:

### Блок 1: `media-only` (Массивный визуал)
**T (Task):** Фулскрин-баннер или видео-рилс, который открывает лендинг.
**K (Key Elements):**
- Фрейм: `width: fill_container`, `height: 800` (или `100vh`).
- Заливка: Placeholder-картинка через `G` ("dark electronic music festival, massive crowd, neon strobe lights").
- Элемент: Поверх картинки, в самом низу (`position: absolute`, `bottom: 40`), градиентный подъем и текст названия ивента (Clash Display, 80px).

### Блок 2: `text-only` (Манифест / Цитата)
**T (Task):** Типографический разрыв для паузы в сторителлинге.
**K (Key Elements):**
- Фрейм: `layout: horizontal`, `width: fill_container`, `justifyContent: center`, `padding: [64, 0]`.
- Текст: Огромная цитата или описание. `fontSize: 48` или `64`, `textAlign: center`, `letterSpacing: -2`. Цвет `#ffffff`.
**E (Expected Behaviors):** Никаких границ и обводок. Полная концентрация на жирном тексте.

### Блок 3: `media-left` (Сайдбар сторителлинга)
**T (Task):** Блок с медиа слева, описанием справа (50/50).
**K (Key Elements):**
- Фрейм-оболочка: `layout: horizontal`, `gap: 64`, `alignItems: center`, `padding: [0, 64]`.
- Дочерний фрейм 1 (Слева): `width: 50%`, `aspect-ratio: 4/5`. Картинка с эффектом `drop_shadow` (Neon-Purple).
- Дочерний фрейм 2 (Справа): `layout: vertical`, `gap: 24`, `width: 50%`. Содержит заголовок `fontSize: 40` и параграф текста `fontSize: 18` (Zinc 400).

### Блок 4: `media-right`
Абсолютный клон блока `media-left`, но дочерние фреймы меняются местами (сначала текст-контейнер, затем медиа-контейнер).

## 📱 3. Ресайз для Mobile (Адаптивность)
Создайте копию `event-template — Mobile` (Ширина `390`). Обязательные изменения макета (Update свойства узлов):
1. У всех 4 блоков меняется `layout` на `vertical` (одноколоночная сетка). 
2. В модулях `media-left` и `media-right` визуальный порядок должен сбрасываться: **всегда сначала** идет картинка (`width: fill_container`), а под ней идет текст (`padding: [24, 16]`), независимо от десктопной логики.
3. Отступы между блоками (глобальный `gap`) ужимаются со 120 до `64`.

## 🚀 4. Инструкция для исполнения в Pencil MCP
1. Инициализируем переменные цвета в документе.
2. Создаем пустой десктоп-холст. Вставляем компонент `media-only` как заголовочный.
3. Добавляем снизу по цепочке блоки `text-only`, `media-left`, `media-right`.
4. Копируем готовый экран, сжимаем до 390px, меняем `layout` дочерних элементов на `vertical`, проверяем мобильную верстку с помощью `get_screenshot`.
