# Логические исправления Бэкенда (Party Subdomain)

> **Статус:** Technical Implementation Plan  
> **Дата:** 2026-04-17

Этот файл фиксирует архитектурные изменения бэкенда, необходимые для поддержки гибкого data-driven дизайна и сохранения заявок.

## 1. Сохранение заявок (Contact Form)
Текущая логика (`app/api/contact/route.ts`) только отправляет email через `nodemailer`. Для сохранения лидов необходимо дублирование в БД.

**Задачи к реализации:**
1. **Prisma Schema (`prisma/schema.prisma`):**
   Добавить новую модель:
   ```prisma
   model BookingRequest {
     id        String   @id @default(cuid())
     name      String
     contact   String
     message   String?
     eventType String?
     date      String?
     status    String   @default("NEW") // "NEW", "CONTACTED", "ARCHIVED"
     createdAt DateTime @default(now())
   }
   ```
2. **Dual-Fallback API (`app/api/contact/route.ts`):** 
   Импортировать клиента Prisma. Требуется максимальная отказоустойчивость:
   - Сначала происходит `await prisma.bookingRequest.create()`.
   - Затем выполняется попытка отправки через `nodemailer`.
   - Если SMTP падает, мы перехватываем ошибку, логируем её (DLQ-паттерн), и возвращаем пользователю `200 OK` (заявка безопасно легла в нашу базу).
   - *Fallback:* Если упадет Prisma, в блоке catch вызывается fallback-отправка на Email. Ни один лид не должен быть потерян.

---

## 2. Умный парсинг Instagram-постов (LLM Adapter)
Текущая версия `mapper.py` вытягивает из Instagram одну монолитную строку текста, что убивает возможность строить красивые длинные лендинги на основе каруселей через чередование блоков (`media-left`, `media-right`). 

Вместо жесткой смены схемы БД, мы будем использовать LLM (модель адаптера из `ai_trader`) для смысловой "нарезки" лонгридов на Markdown-блоки.

**Задачи к реализации:**

### A. Адаптер и Few-Shot Промптинг (`scripts/instagram_sync/llm.py`)
1. Адаптировать `OpenRouterClient` для работы в изолированном Python-окружении (использовать стандартный `logging` вместо `SystemLogger`).
2. **Few-Shot Промптинг:** Модели скармливается 2-3 примера "Вход -> Выход", чтобы гарантировать 100% стабильную отдачу валидного JSON-объекта (требование OpenAI/OpenRouter для формата `response_format: { type: json_object }`). 
3. Формат отдачи LLM — строго JSON объект с массивом внутри:
   ```json
   {
      "chunks": ["### Tag\n\nBody...", "## Title 2\n\nBody2"]
   }
   ```
   *Никакой классификации (eventType) от LLM не требуется, только нарезка текста.*

### B. Обновление маппера (`scripts/instagram_sync/mapper.py`)
Интегрировать LLM-анализ, заменив линейный цикл на паттерн **«Скелет + Заливка»**, который гарантирует 100% сохранение хронологии рассказа и фотографий.

**Объяснение логики на пальцах:**
Представь две стопки (хронологические пулы): 
- Стопка фоток (`urls`: фото1, фото2) 
- Стопка абзацев от LLM (`chunks`: абзац1, абзац2, абзац3, абзац4).
Если мы просто будем лепить их подряд, фотки кончатся, и оставшиеся абзацы кучей свалятся в подвал страницы. Это уродливо. 
Поэтому скрипт работает в два шага:
1. **Скелет:** Без данных рассчитывается "макет". Скрипт видит, что текста много, а фото мало, и создает структуру: `[Пустой MediaLeft] -> [Пустой TextOnly] -> [Пустой TextOnly] -> [Пустой MediaRight]`.
2. **Заливка (Pushing):** Скрипт идет по скелету и «зачерпывает» (вызывает `.pop(0)`) по порядку из стопок: картинку для слота 1, абзац 1 для слота 1, абзац 2 для слота 2, и т.д. Хронология идеальна, а текст размазан красиво.

**Python-диф (реальная реализация для `_map_carousel`):**
```python
    blocks: list[PageBlock] = []

    # 1. Slide 0: Всегда Hero banner
    blocks.append(PageBlock(
        layout=BlockLayout.MEDIA_ONLY,
        content=BlockContent(
            mediaUrl=urls[0],
            mediaType="video" if post.media_types[0] == "video" else "image"
        )
    ))

    # Пулы (хвост после слайда 0)
    media_pool = urls[1:]
    m_types_pool = post.media_types[1:]
    text_pool = text_chunks[:] # Массив строк от LLM
    skeleton = []

    # Шаг 1: Рассчет пропорций Скелета
    m_count, t_count = len(media_pool), len(text_pool)
    while m_count > 0 or t_count > 0:
        if m_count > 0 and t_count > 0:
            layout = BlockLayout.MEDIA_LEFT if m_count % 2 == 0 else BlockLayout.MEDIA_RIGHT
            skeleton.append({"type": "composite", "layout": layout})
            m_count -= 1; t_count -= 1
        elif t_count > 0:
            # Органично вставляем TextOnly внутрь скелета (избегаем дампа)
            insert_idx = len(skeleton) // 2 if skeleton else 0
            skeleton.insert(insert_idx, {"type": "text-only"})
            t_count -= 1
        elif m_count > 0:
            skeleton.append({"type": "media-only"})
            m_count -= 1

    # Шаг 2: Хронологическая заливка
    for slot in skeleton:
        if slot["type"] == "composite":
            blocks.append(PageBlock(
                layout=slot["layout"], 
                content=BlockContent(
                    text=text_pool.pop(0),
                    mediaUrl=media_pool.pop(0),
                    mediaType="video" if m_types_pool.pop(0) == "video" else "image"
                )
            ))
        elif slot["type"] == "text-only":
            blocks.append(PageBlock(
                layout=BlockLayout.TEXT_ONLY, 
                content=BlockContent(text=text_pool.pop(0))
            ))
        elif slot["type"] == "media-only":
            blocks.append(PageBlock(
                layout=BlockLayout.MEDIA_ONLY, 
                content=BlockContent(
                    mediaUrl=media_pool.pop(0),
                    mediaType="video" if m_types_pool.pop(0) == "video" else "image"
                )
            ))
```

### C. Структурная классификация (Без LLM)
Категоризация постов производится `mapper.py` строго программно на основе физических параметров поста:
* **Для неполноценных лендингов (Синглы или Без Текста):** Если пост содержит только 1 медиа-файл (`len(urls) == 1`) ИЛИ в посте полностью отсутствует текст (`caption.strip() == ""`), он структурно не может сформировать событие-лендинг. Маппер автоматически ставит метку `eventType: "blog"` и статус `Draft`.
* **Для Каруселей с Текстом:** Если есть объемная фактура (много фото + текст), скрипт ставит `eventType: "UNCATEGORIZED"` и статус `isPublished: false`. Администратор вручную открывает эти собранные смарт-лендинги (события) и решает, куда их отнести (Party / Wedding).

---

## 3. План Тестирования и Интеграции

Каждый затронутый компонент будет протестирован в изоляции, а затем в интеграции.

### A. Тестирование отказоустойчивости (Contact API)
*   **Кейс 1 (Идеальный сценарий):** Отправить POST через форму. Убедиться, что письмо ушло + запись появилась в локальной БД SQLite.
*   **Кейс 2 (Тест Fallback/DLQ):** Искусственно сломать SMTP (сменить пароль в `.env`). Отправить POST. Убедиться, что API **не падает** с `500 Internal`, возвращает клиенту зеленый `200 OK`, а лид успешно лежит сохраненный в базе данных. Отсутствие потери лида — ключевая метрика успеха.
*   **Изменения в коде тестов:** При наличии Jest/Vitest моков обновить моки `nodemailer`, добавив еще и mock для `prisma.bookingRequest.create()`. Возвраты Prisma должны резолвиться до вызова транспорта почты.

### B. Изолированное тестирование LLM Адаптера
*   Нельзя гонять весь многоминутный цикл Instagram Sync для проверки LLM. Создаем легкий скрипт (например `scripts/instagram_sync/test_llm.py`).
*   **Кейс (Валидация Формата):** Передать в адаптер гигантский портяночный текст с кучей эмодзи. Проверить, что Python-библиотека `json` не крашится (значит LLM вернула чистый `["string1", "string2"]` без мусорных оберток ` ```json `).
*   **Кейс (Поведения при сбое):** Замокать ошибку 429 от OpenRouter API и доказать, что адаптер делает retry + exponential backoff, как и задумывалось в исходном классе.

### C. Unit-Тесты для компоновки (`mapper.py`)
Интегрировать эту логику в общий план тестирования `2026-04-16-instagram-pipeline-testing-plan.md` путем добавления Mock-вызовов LLM.
*   **Assert 1 (Структурный блог):** Мокаем пост где `len(urls) == 1`. Мокаем LLM, возвращающую 2 чанка. *Проверка:* На выходе скрипт выдал `eventType="blog"`, `isPublished=false`. Сгенерирован массив `[MediaOnly, TextOnly, TextOnly]`.
*   **Assert 2 (Длинная карусель):** Мокаем пост `len(urls) == 4`. LLM вернула 2 чанка текстов. *Проверка:* `eventType="UNCATEGORIZED"`. Сгенерирован массив из чередующихся блоков `[MediaOnly, MediaLeft, MediaRight, MediaOnly]`.

---

## 4. Журнал Исполнения и Рефакторинга (Execution Log)

### Этап 1: Contact API (Завершено)
*   Успешно интегрирована Prisma `BookingRequest`, реализован алгоритм Dual-Fallback в `app/api/contact/route.ts`. 
*   Успешно проведен нагрузочный тест вставки в локальную SQLite (без использования почты).

### Этап 2: LLM Adapter (Найдены архитектурные ошибки)
В ходе первоначальной реализации `scripts/instagram_sync/llm.py` был допущен ряд архитектурных нарушений (отклонение от паттернов продакшен-системы `ai_trader`):
1. **Нарушение Separation of Concerns (SoC):** Доменно-специфичный системный промпт (правила форматирования для Instagram) был жестко "вшит" прямо в инфра-класс клиента `llm.py`.
2. **Отсутствие безопасности:** Токен `Authorization` не маскировался при логировании ошибки.
3. **Отсутствие гибкости:** Класс не позволял переиспользовать LLM API для парсинга других данных, превратившись в монолит только для Инстаграма.

**План рефакторинга перед Этапом 3:**
1. Преобразовать `llm.py` в "чистый" абстрактный класс `OpenRouterClient` (по образу и подобию `AbstractLLMClient`). Класс будет принимать абстрактный `user_prompt` и `system_prompt` извне.
2. Реализовать маскировку заголовков (header masking) при логировании API-ответов.
3. Вынести "Инстаграм-специфичные" промпты (Few-shot шаблоны) в слой бизнес логики (в словарь констант или `prompts.py`). Скрипт `mapper.py` будет импортировать шаблон, подставлять текст и отдавать чистую готовую строку в `OpenRouterClient`.

---

## 5. Итоги Внедрения (Final Verification)

Оптимизация Backend'а раздела Party и пайплайна Instagram успешно реализована на 100% согласно изначальному плану и скорректирована в процессе рефакторинга.

### Завершенная Архитектура
1. **Безопасный LLM-Клиент:** Скрипт `llm.py` переписан в универсальный `OpenRouterClient`. Бизнес-логика (псевдокод и промпты инстаграма) вынесена в константы маппера. Логирование защищено от утечек `Authorization` токенов. Система ретраев работает стабильно (Exponential Backoff).
2. **Алгоритм Skeleton + Pour:** В `mapper.py` встроен динамический механизм переплетения (interleaving) контента. Алгоритм поглощает несинхронизированные массивы `urls` и сгенерированных `chunks`, распределяя их по сетке `media-left` и `media-right` в зависимости от длины лонгрида.
3. **Строгий Fallback / Роутинг:** 
    * Если пост не имеет текста, или LLM падает в таймаут — скрипт не крашится, а отдает 1 цельный текстовый блок.
    * Посты без текста или одиночные фото/Reels автоматически маршрутизируются в `eventType = "blog"`, экономя время контент-менеджера.
4. **Отказоустойчивый Contact API:** В `app/api/contact/route.ts` реализован Dual-Fallback. Лиды пишутся напрямую в SQLite (`BookingRequest`), а при сбое (или как запасной канал) отправляются на SMTP `nodemailer`. Ошибки логируются (DLQ-паттерн), не прерывая успешный ответ пользователю.

Все Unit-тесты (`test_llm.py`, `test_mapper.py`) успешно пройдены локально. Модули готовы к связке с Admin UI на фронтенде.

---

## 6. Балансировка и Очереди (Новый Этап)

Из-за нагрузки на сервера OpenRouter, требуется внедрить умный фолбек и временную капсулу для Dead Letter Queue.

**Задачи Этапа 4 (Детализированный План):**

1. **Рефакторинг `llm.py` (Нативные OpenRouter Fallbacks):** 
   - Не усложнять питон-код циклами запросов. OpenRouter "под капотом" поддерживает фолбек-моделинг. 
   - Нам нужно заменить в классе `OpenRouterClient` поле `model="gpt-4o-mini"` на возможность передавать массив моделей `models=["openai/gpt-4o-mini", "anthropic/claude-3-haiku"]`.
   - Если первая модель отвалится с 429/502/520, OpenRouter сам попытается перебросить запрос ко второй, а если ничего не поможет — отдаст `Exception`. Это снимает с нас логику балансировки.

2. **Обновление Маршрутизации в `mapper.py`:**
   - Сейчас в `_map_carousel` есть глухой блок `try...except`, который в случае падения LLM возвращает неструктурированный кусок как `chunks_pool = [body]` и тихо пропускает пост.
   - Мы уберем перехват ошибки и позволим `LLMResponseError` "вылететь" из маппера. 
   - Благодаря этому в `entrypoint.py:process_single_post` блок перехвата `except Exception as e:` поймает эту ошибку на стадии `"map"` и **официально занесет пост в DLQ (`dead_letter.py`)**, предоставив возможность позже его переструктурировать, а не портить структуру навсегда.

3. **Интервалы Очереди DLQ (`dead_letter.py`):**
   - Метод `list_retryable()` формирует список постов для повторной попытки.
   - Будет добавлена математика: `now - last_failed_at`. Если с последнего падения прошло `< 600 секунд (10 минут)`, пост не включается в выборку.
   - **Дополнительный Плюс:** это защитит систему в случае массового падения CMS при выгрузках медиа — сервер не будет зафлужен запросами каждую минуту, а равномерно распределит их (Throttling) с 10-минутными задержками, не ломая старые данные в DLQ.

### План реализации (Execution Actions):
- [x] **`scripts/instagram_sync/llm.py`**: Поддержка OpenRouter fallbacks через параметр `models` (массив).
- [x] **`scripts/instagram_sync/mapper.py`**: Удаление `try...except`, чтобы ошибки LLM всплывали вверх и уходили в DLQ.
- [x] **`scripts/instagram_sync/dead_letter.py`**: Добавлен таймер-карантин 10 минут (`now - last_failed_at >= 600`) перед ретраем.

---

## 7. Этап 5: Разделение монолита Instagram Sync (ETL Architecture)

**Проблема:**
Текущий пайплайн `entrypoint.py` абсолютно монолитен и синхронен. Он скачивает пост с Instagram, сразу заливает картинки в локальное хранилище и в тот же миг ждет ответа от LLM (OpenRouter).
Тем самым жестко слеплены "надежный" процесс скачивания (лимитированный Instagram API) и "слабый" процесс разметки (внешняя нестабильная нейросеть). Если OpenRouter падает (502, timeout), скрипт теряет обработанный в памяти пост и вынужден при ретрае через старый файловый DLQ скачивать его с Instagram **с самого начала**, сжигая rate limits и рискуя блокировкой.

**Решение (Паттерн ETL: Extract -> Transform -> Load):**
Мы разорвем скрипт на две изолированные фазы, используя локальную базу данных SQLite (Prisma) как буфер и транспортную очередь (Transactional Outbox).
1. **Extractor (Сборщик):** Скачивает посты из Instagram и складывает их "сырыми" (текст и локальные пути к фото) в БД (`RawInstagramPost`). Процесс работает максимально быстро и игнорирует блок LLM.
2. **Transformer (Очередь обработки):** Асинхронный воркер читает из БД готовые скачанные посты, обращается к OpenRouter и при успехе формирует финальный `EventPage` в CMS. Если LLM падает, пост просто помечается статусом `ERROR` (заменяя файловый DLQ), откладываясь на 10 минут, но **Instagram API для этого поста больше никогда не вызывается**.

### Детальный План Архитектуры

#### Шаг 1. Обновление Database Layer (`prisma/schema.prisma`)
Создадим "бункер" для сырых скачанных данных:
```prisma
model RawInstagramPost {
  id            String   @id @default(cuid())
  shortcode     String   @unique
  profileName   String
  sourceType    String   // "post", "reel", "highlight"
  rawCaption    String   // Оригинальный текст поста
  mediaUrls     String   // JSON массив загруженных путей
  mediaTypes    String   // JSON массив ("image", "video")

  // Механизм очереди (Queue fields вместо файлового DLQ)
  status        String   @default("PENDING") // PENDING, PROCESSING, ERROR, COMPLETED, FAILED
  retryCount    Int      @default(0)
  lastError     String?  // Последняя ошибка парсинга
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  nextRetryAt   DateTime @default(now()) // Карантинный таймер ретраев
}
```

#### Шаг 2. Разработка Next.js API Middleware (`app/api/sync/queue/route.ts`)
Бэкенд Next.js должен предоставить шлюз-очередь для Python скриптов:
*   `POST /api/sync/queue` — Залить свежескачанный пост (сразу в статус `PENDING`).
*   `GET /api/sync/queue?action=fetch` — Взять 1 пост для Transformer-воркера. Бэкенд ищет элемент (статус `PENDING`|`ERROR` и `nextRetryAt <= NOW()`) и при выдаче **атомарно меняет его статус** на `PROCESSING`, блокируя race-conditions между фоновыми кронами.
*   `PATCH /api/sync/queue` — Обновляет результат LLM: либо `status = COMPLETED`, либо `status = ERROR` со сдвигом `nextRetryAt` на 10 минут вперед.

#### Шаг 3. Рефакторинг Python API Клиента (`uploader.py`)
Добавляются методы HTTP-общения с созданной очередью:
*   `push_raw_post()`
*   `fetch_job_from_queue()`
*   `update_job_status()`

#### Шаг 4. Рефакторинг Python Пайплайна (`entrypoint.py` и `mapper.py`)
Скрипт `entrypoint.py` перестанет быть линейным конвейером и расщепится на два режима работы:
1. **Режим Extractor (`--mode fetch`):** 
   Вызывает `downloader.fetch_profile_posts`. Заливает медиа (`uploader.upload_media`) и шлёт всё вместе с текстом (Caption) в БД через `api.push_raw_post()`. На этом останавливается для поста.
2. **Режим Transformer (`--mode process-queue`):** 
   Без сетевых походов в Инстаграм дёргает `api.fetch_job_from_queue()`. Полученный сырой объект из базы передает в `mapper.map_post`. Формирует Markdown блоки -> создаёт страницу сайта. Меняет статус на `COMPLETED`.

#### Шаг 5. Уничтожение файлов-костылей
Полное удаление `scripts/instagram_sync/dead_letter.py` и морально устаревших `.dlq.json` файлов, так как всю логику карантина и повторов с этого момента обслуживает `status` и `nextRetryAt` в базе.

---

## 8. Итоги миграции (Архитектурный Walkthrough)

Глобальный архитектурный рефакторинг процесса синхронизации Instagram с Mindra CMS был успешно завершен. Старая синхронная, хрупкая реализация была разделена на два надежных, асинхронных этапа.

### Фактически реализовано:
1. **Создана БД-Очередь (Prisma)**
   - В `schema.prisma` добавлена модель `RawInstagramPost`, которая выступает бункер-очередью (`Transactional Outbox`).
   - Модель отслеживает статусы (`PENDING`, `PROCESSING`, `ERROR`, `COMPLETED`), счетчик попыток и время следующего ретрая (`nextRetryAt`).

2. **Next.js шлюз для Воркеров**
   - Разработан файл `app/api/sync/queue/route.ts` с методами `POST` (добавить сырой пост), `GET` (атомарно захватить работу) и `PATCH` (отчитаться об успехе/ошибке).

3. **Рефакторинг Python Монолита**
   - Уничтожен старый файл `dead_letter.py` и его кэш-файлы `data/dlq/`. Эта логика теперь на 100% реализуется базой данных.
   - `entrypoint.py` разбит на 2 независимых функции: `run_extractor` и `run_transformer`.
   - `mapper.py` переписан на работу со словарями из очереди `map_job(job: dict)`, избавившись от привязки к `instaloader`-моделям.

### Новые процессы (Команды Makefile)
Теперь пайплайн запускается в 2 шага (могут работать параллельно по крону):

1. **Скачивание (Extractor):**
   ```bash
   make sync-fetch PROFILE=username
   ```
   *Быстро выкачивает посты из Инсты, сохраняет картинки в CMS и кладет сырые тексты в БД. Игнорирует LLM.*

2. **Обработка LLM (Transformer):**
   ```bash
   make sync-process
   ```
   *Забирает сырые посты из БД, прогоняет их через OpenRouter и формирует статьи CMS без риска бана от Instagram.*

**Покрытие ошибками (Автоматический Retry):** Если при вызове `make sync-process` OpenRouter отвечает ошибкой 5xx или таймаутом, статус поста переходит в `ERROR`, таймер `nextRetryAt` сдвигается на 10 минут вперед. При следующем вызове `make sync-process` скрипт снова попытается обработать текст, даже не касаясь Instagram API.

---

## 9. Этап 6: Стабилизация и реструктуризация тестов (Test Suite Audit)

В ходе реализации Этапа 5 (ETL Queue) монолитный конвейер был расщеплен. Это повлекло за собой необходимость радикального рефакторинга всего набора `pytest`. Старые тесты, ожидающие `DownloadedPost` и файловый `DLQ`, начали выдавать `collection errors`. Нам предстоит полная реконструкция для возвращения покрытия кода $100\%$:

### 9.1. Что подлежит удалению/изменению:
- **Удаление:** `test_dead_letter.py` (т.к. файловой версии больше не существует).
- **Маппер (`test_mapper.py`):** Замена Mocks `make_post` на словари `make_raw_job`, симулирующие JSON данные из базы. Метод `map_post` заменён проверкой `map_job`.
- **Загрузчик API (`test_uploader.py`):** Нам необходимо покрыть три новых метода Next.js роутера: `push_raw_post()`, `fetch_job_from_queue()`, `update_job_status()`, а также проверить корректность работы флага `dry_run` на них.

### 9.2 Интеграционные (`test_entrypoint.py`) и E2E (`test_e2e_smoke.py`)
Они больше не тестируют одну "трубу", теперь они проверяют:
1. **Режим Extractor:** симуляция ошибки скачивания `InstagramRateLimitError` и успешного `push_raw_post` в БД (через мок API).
2. **Режим Transformer:** симуляция `fetch_job_from_queue` (где очередь пуста или есть задание). 
3. **E2E Smoke:** Прогон всего пайплайна в 2 шага, не касаясь сети, но тестируя переброску "Mock IG -> Mock DB -> Mock LLM -> Mock CMS".

---

## 10. Отладка LLM слоя: Фактический Анализ Fallback API (Апрель 2026)

В ходе лайв-тестирования свежего ETL-пайплайна была задокументирована проблема с надежностью Free-Tier моделей на OpenRouter, которая приводила к сбою `KeyError: 'choices'`. Было проведено [документированное расследование](https://openrouter.ai/docs/features/model-routing#fallbacks) поведения API.

### 10.1 Ключевые факты (OpenRouter Fallbacks):
* **Штатный Routing:** Согласно [документации OpenRouter по Fallbacks](https://openrouter.ai/docs/features/model-routing#fallbacks), при передаче в Payload объекта `{"models": ["model-A", "model-B"]}`, балансировщик самостоятельно пытается переключиться на резервные модели, если первая отказывает по таймауту или лимитам.
* **Причина бага `KeyError`:** При отправке тяжелого Payload (текст 14 слайдов Carousel), бесплатный пул `nemotron` и `gemma` синхронно падал с `429 Too Many Requests`. Когда падают все модели из переданного пула `"models"`, OpenRouter по спецификации возвращает HTTP `200 OK`, но с телом формата `{"error": {"message": "All fallback models failed"}}` без привычного узла `choices`. Наш скрипт не ожидал `error` внутри `200 OK` и падал с перехватом.
* **Автоматическая DLQ:** Логика БД `RawInstagramPost` доказала свою 100% эффективность (Self-Healing). После падения `entrypoint.py` шлет `PATCH` запрос. Задача получает статус `ERROR`, таймер `nextRetryAt` сдвигается ровно на 10 минут вперед. При третьем автономном запуске по крону, очередь на бесплатные модели разгрузилась, и OpenRouter вернул валидный JSON.

### 10.2 Вывод
Зависеть от бесплатных моделей OpenRouter, которые часто лежат в 429 статусе — непозволительно для Production стабильности. Очередь DLQ решает проблему, но замедляет выгрузку до 30-40 минут в худших сценариях.

## 11. Этап 7: Провайдер-Агностичная LLM Архитектура (NVIDIA NIM)

В связи с доступностью мощной бесплатной агентивной модели [moonshotai/kimi-k2.5](https://build.nvidia.com) на корпоративных серверах NVIDIA API (`integrate.api.nvidia.com`), принято решение интегрировать паттерн **Adapter/Provider Factory**, чтобы иметь возможность переключаться между `OPENROUTER_API_KEY` и `NVIDIA_API_KEY` одной переменной в `.env`, не переписывая ядро парсера.

### 11.1 Задачи рефакторинга:
1. Создать абстракцию `BaseLLMClient` с методом `get_analysis(system_prompt, user_prompt, ...)`.
2. Написать два драйвера: `OpenRouterClient(BaseLLMClient)` (существующий) и `NvidiaClient(BaseLLMClient)` (официальный API-совместимый эндпоинт).

### 11.2 Фактические Diff'ы на внедрение:

**1. Конфигурация (`scripts/instagram_sync/config.py`)**:
Нам необходимо дать возможность выбирать провайдера через `.env`:
```diff
+    llm_provider: str
+    nvidia_api_key: Optional[str]

     def __init__(self):
+        self.llm_provider = os.getenv("LLM_PROVIDER", "openrouter").lower()
+        self.nvidia_api_key = os.getenv("NVIDIA_API_KEY")
```

**2. Фабрика в Провайдере (`scripts/instagram_sync/llm.py`)**:
```diff
+from abc import ABC, abstractmethod
+
+class BaseLLMClient(ABC):
+    @abstractmethod
+    def get_analysis(self, system_prompt: str, user_prompt: str, **kwargs) -> Dict[str, Any]:
+        pass

-class OpenRouterClient:
+class OpenRouterClient(BaseLLMClient):
     def __init__(self, api_key: Optional[str] = None, model: Union[str, list, None] = None):
         self.api_url = "https://openrouter.ai/api/v1/chat/completions"
         # ... existing OpenRouter logic
 
+class NvidiaClient(BaseLLMClient):
+    def __init__(self, api_key: Optional[str] = None, model: str = "moonshotai/kimi-k2.5"):
+        self.api_key = api_key or os.getenv("NVIDIA_API_KEY")
+        self.model = model
+        self.api_url = "https://integrate.api.nvidia.com/v1/chat/completions"
+        
+    def get_analysis(self, system_prompt: str, user_prompt: str, **kwargs) -> Dict[str, Any]:
+        headers = {
+            "Authorization": f"Bearer {self.api_key}",
+            "Content-Type": "application/json"
+        }
+        payload = {
+            "model": self.model,
+            "messages": [
+                {"role": "system", "content": system_prompt},
+                {"role": "user", "content": user_prompt}
+            ],
+            "response_format": {"type": "json_object"}
+        }
+        # ... error boundary identical to OpenRouterClient
+
+def create_llm_client(config: SyncConfig) -> BaseLLMClient:
+    if config.llm_provider == "nvidia":
+        return NvidiaClient(api_key=config.nvidia_api_key)
+    return OpenRouterClient(api_key=config.api_key)
```

**3. Внедрение Фабрики (`scripts/instagram_sync/entrypoint.py`):**
При инициализации воркера (Transformer Phase) фабрика будет выдавать нужный экземпляр:
```diff
-    from .llm import OpenRouterClient
+    from .llm import create_llm_client
 
     config = SyncConfig()
-    llm_client = OpenRouterClient(api_key=config.api_key)
+    llm_client = create_llm_client(config)
```

**4. Подготовка Тестов (`scripts/instagram_sync/tests/test_llm.py`)**:
Слой моков (Mocking) в модуле тестирования будет расширен для симуляции `BaseLLMClient` ответа по адресу `api.nvidia.com/v1`, подтверждающего корректную обработку JSON-словарей без утечек ключей.
