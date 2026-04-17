# Instagram Sync Pipeline — План тестирования

> Дата: 2026-04-16
> Статус: **В разработке**

---

## Цель

Полное покрытие интеграционными тестами всех модулей пайплайна Instagram → Mindra CMS, плюс end-to-end smoke-тест, который поднимает мок-сервер, прогоняет pipeline разными сценариями, и корректно завершается.

---

## Структура тестов

```
scripts/instagram_sync/tests/
├── conftest.py              ← общие фикстуры (tmp_path, mock config, factory для DownloadedPost)
├── test_config.py           ← конфигурация
├── test_logger.py           ← логирование
├── test_models.py           ← Pydantic-валидация
├── test_dead_letter.py      ← Dead Letter Queue
├── test_checkpoint.py       ← Checkpoint/Resume
├── test_mapper.py           ← маппинг IG → PageState
├── test_uploader.py         ← HTTP-клиент (мок requests)
├── test_entrypoint.py       ← логика process_single_post + dispatch
└── test_e2e_smoke.py        ← E2E: мок-сервер + полный pipeline
```

---

## Часть 1: Юнит/интеграционные тесты

### `test_config.py` (3 теста)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_defaults` | Значения по умолчанию: `cms_base_url`, `dry_run=False`, `dlq_max_retries=3` |
| 2 | `test_env_overrides` | Переменные окружения перезаписывают дефолты (monkeypatch) |
| 3 | `test_paths_created` | `download_dir`, `log_dir`, `dlq_dir` — Path объекты |

### `test_logger.py` (5 тестов)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_creates_timestamped_file` | Лог-файл создаётся в формате `ig_sync_YYYY-MM-DD_HH-MM-SS.jsonl` |
| 2 | `test_json_format` | Каждая строка — валидный JSON с полями `ts`, `level`, `module`, `correlation_id`, `msg` |
| 3 | `test_correlation_id` | `set_correlation_id("ABC")` → все последующие записи содержат `"correlation_id":"ABC"` |
| 4 | `test_cleanup_old_logs` | Создаём 10 файлов по 30MB (фейковых). После cleanup остаются только те, что помещаются в 200MB |
| 5 | `test_no_duplicate_handlers` | Повторный вызов `setup_logger()` не добавляет дублирующихся handler'ов |

### `test_models.py` (10 тестов)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_valid_page_state` | Корректный PageState проходит валидацию |
| 2 | `test_empty_title_rejected` | `title=""` → `ValidationError` |
| 3 | `test_long_title_rejected` | `title="a"*201` → `ValidationError` |
| 4 | `test_empty_blocks_rejected` | `blocks=[]` → `ValidationError` |
| 5 | `test_invalid_hex_color` | `color="red"` → `ValidationError` |
| 6 | `test_valid_short_hex` | `color="#abc"` → OK |
| 7 | `test_media_url_must_start_with_uploads` | `mediaUrl="https://evil.com/x.jpg"` → `ValidationError` |
| 8 | `test_media_only_requires_media` | `layout=media-only, mediaUrl=None` → `ValueError` |
| 9 | `test_text_only_requires_text` | `layout=text-only, text=""` → `ValueError` |
| 10 | `test_ig_metadata_optional` | `igShortcode=None` → OK, все IG-поля опциональны |

### `test_dead_letter.py` (8 тестов)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_add_creates_file` | `dlq.add(...)` создаёт `{shortcode}.dlq.json` в dlq_dir |
| 2 | `test_add_increments_retry` | Повторный `add()` для того же shortcode → `retry_count` увеличивается |
| 3 | `test_should_retry_within_limit` | `retry_count < max_retries` → True |
| 4 | `test_should_retry_exhausted` | `retry_count >= max_retries` → False |
| 5 | `test_remove_deletes_file` | `dlq.remove(shortcode)` → файл удалён |
| 6 | `test_remove_nonexistent_no_error` | `dlq.remove("nope")` → не падает |
| 7 | `test_list_entries` | Добавили 3 записи → `list_entries()` возвращает 3 |
| 8 | `test_summary_stats` | `summary()` возвращает корректные `total`, `retryable`, `exhausted`, `stage_*` |

### `test_checkpoint.py` (7 тестов)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_fresh_checkpoint` | Новый checkpoint: `total_processed=0`, файл создаётся |
| 2 | `test_mark_processed` | После `mark_processed("ABC")`: shortcode в списке, `total_processed=1` |
| 3 | `test_is_processed` | `is_processed("ABC")` → True после mark, False для неизвестного |
| 4 | `test_persistence_across_instances` | Создаём manager, mark_processed, пересоздаём manager → состояние сохранено |
| 5 | `test_mark_error` | `mark_error()` увеличивает `total_errors`, НЕ добавляет shortcode |
| 6 | `test_get_known_shortcodes` | Возвращает `set` из всех обработанных shortcodes |
| 7 | `test_corrupt_checkpoint_recovery` | Файл с невалидным JSON → создаёт новый checkpoint, не падает |

### `test_mapper.py` (9 тестов)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_single_photo_no_caption` | 1 фото, пустой caption → 1 block (media-only), `title="Untitled Event"` |
| 2 | `test_single_photo_with_caption` | 1 фото + caption → 2 blocks (media-only + text-only) |
| 3 | `test_reel` | 1 видео → media-only (video) + text-only |
| 4 | `test_carousel_2_slides` | 2 фото + caption → hero (media-only) + caption+slide (media-left) |
| 5 | `test_carousel_5_slides` | 5 фото → hero + caption+slide2 + 3 alternating blocks |
| 6 | `test_caption_sanitize_hashtags` | Caption с `#party #dj` → хештеги удалены из body |
| 7 | `test_caption_sanitize_title` | Первая строка → title (cap 200 chars), остальное → body |
| 8 | `test_carousel_no_caption` | Carousel без caption → hero + slide[1] как media-only (без text-only) |
| 9 | `test_ig_metadata_passed` | `igShortcode`, `igSourceType`, `igProfileName` пробрасываются в PageState |

### `test_uploader.py` (7 тестов, мок requests)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_check_shortcode_exists_true` | Мок-ответ `{exists:true, id:"abc"}` → возвращает `"abc"` |
| 2 | `test_check_shortcode_exists_false` | Мок-ответ `{exists:false}` → возвращает `None` |
| 3 | `test_upload_media_success` | Мок-ответ `{url:"/uploads/x.jpg"}` → возвращает URL |
| 4 | `test_create_page_success` | Мок 201 → возвращает PageResponse |
| 5 | `test_retry_on_500` | 1-й запрос → 500, 2-й → 200 → success |
| 6 | `test_retry_on_connection_error` | 1-й → ConnectionError, 2-й → 200 → success |
| 7 | `test_dry_run_skips_requests` | `dry_run=True` → никаких HTTP-запросов |

### `test_entrypoint.py` (6 тестов, мок downloader + uploader)
| # | Тест | Что проверяем |
|---|---|---|
| 1 | `test_process_single_post_success` | Полный цикл: check → upload → map → create → checkpoint saved |
| 2 | `test_process_single_post_skip_exists` | CMS говорит "exists" → пост пропущен, checkpoint updated |
| 3 | `test_process_single_post_skip_checkpoint` | Checkpoint содержит shortcode → пост пропущен |
| 4 | `test_process_single_post_upload_fail` | Upload → CMSApiError → пост в DLQ, not created |
| 5 | `test_process_single_post_create_fail` | Create → CMSApiError → пост в DLQ |
| 6 | `test_dlq_exhaustion_skip` | `retry_count >= max_retries` → пост пропущен |

---

## Часть 2: E2E Smoke Test (`test_e2e_smoke.py`)

Полный end-to-end тест, который:

### Архитектура
```
[Pytest] → запускает мок HTTP-сервер (FastAPI/Flask or http.server)
         → этот сервер имитирует /api/sync/* эндпоинты
         → pipeline запускается с моковым DownloadedPost (без реального Instagram)
         → проверяем что мок-сервер получил правильные запросы
         → проверяем состояние: checkpoint, DLQ, логи
         → мок-сервер останавливается
```

### Сценарии (8 тестов)
| # | Сценарий | Описание |
|---|---|---|
| 1 | **Happy path: single post** | Один пост → upload → create → page в "базе" мока |
| 2 | **Idempotency** | Тот же shortcode дважды → второй раз skip |
| 3 | **Dry run** | `--dry-run` → ни одного HTTP-запроса кроме check |
| 4 | **Server error + retry** | Мок-сервер отвечает 500 на первый upload, 200 на retry → success |
| 5 | **Upload failure → DLQ** | Мок-сервер отвечает 500 3 раза → пост в DLQ |
| 6 | **DLQ retry → success** | Пост из DLQ → мок-сервер отвечает 200 → DLQ запись удалена |
| 7 | **Multiple posts (batch)** | 3 поста за раз (имитация daily) → 3 страницы, checkpoint обновлён |
| 8 | **Mixed: success + fail + skip** | 3 поста: один новый, один дубликат, один → ошибка. Проверяем финальное состояние |

### Mock Server
- `POST /api/sync/upload` → возвращает `{"url": "/uploads/mock-uuid.jpg"}`
- `GET /api/sync/check-shortcode?code=X` → проверяет локальный dict
- `POST /api/sync/pages` → сохраняет в локальный dict, 201
- `POST /api/sync/jobs` → 201 с id
- `PATCH /api/sync/jobs/:id` → 200
- Можно настроить: "на следующий запрос ответь 500"

---

## Технические решения

| Вопрос | Решение |
|---|---|
| **Фреймворк** | `pytest` + `pytest-tmp-files` (pytest built-in `tmp_path`) |
| **Мок HTTP** | `responses` или `requests-mock` для unit-тестов uploader |
| **E2E мок-сервер** | `threading.Thread` + `http.server` (stdlib, без зависимостей) |
| **Instagram** | НЕ тестируем реальный Instagram. `DownloadedPost` создаём вручную (factory). Downloader мокаем |
| **Файловая система** | Все тесты используют `tmp_path` — изолированные tmpdir |
| **Зависимости** | `pytest`, `responses` (для мока requests) — добавляем в `requirements-dev.txt` |

---

## Файлы для создания

| Файл | Описание |
|---|---|
| `scripts/instagram_sync/tests/__init__.py` | Пустой |
| `scripts/instagram_sync/tests/conftest.py` | Фикстуры: `mock_config`, `make_post`, `mock_uploaded_urls` |
| `scripts/instagram_sync/tests/test_config.py` | 3 теста |
| `scripts/instagram_sync/tests/test_logger.py` | 5 тестов |
| `scripts/instagram_sync/tests/test_models.py` | 10 тестов |
| `scripts/instagram_sync/tests/test_dead_letter.py` | 8 тестов |
| `scripts/instagram_sync/tests/test_checkpoint.py` | 7 тестов |
| `scripts/instagram_sync/tests/test_mapper.py` | 9 тестов |
| `scripts/instagram_sync/tests/test_uploader.py` | 7 тестов |
| `scripts/instagram_sync/tests/test_entrypoint.py` | 6 тестов |
| `scripts/instagram_sync/tests/test_e2e_smoke.py` | 8 тестов + mock server |
| `scripts/instagram_sync/requirements-dev.txt` | `pytest`, `responses` |

**Итого: ~68 тестов** покрывающих все модули + end-to-end flow.

---

## Команда запуска

```bash
# Все тесты
cd scripts/instagram_sync
pip install -r requirements-dev.txt
python -m pytest tests/ -v

# Только юнит-тесты (без E2E)
python -m pytest tests/ -v --ignore=tests/test_e2e_smoke.py

# Только E2E
python -m pytest tests/test_e2e_smoke.py -v

# С покрытием
python -m pytest tests/ -v --cov=. --cov-report=term-missing
```

---

## Что было сделано (Реализация)

**Статус: Завершено 🟢**

**Модульные и интеграционные тесты (`scripts/instagram_sync/tests/`)**
1. Внедрена директория тестов с изолированными фикстурами.
2. Протестированы все схемы валидации (`test_models.py`), механизмы логирования с ротацией и структурированным JSON (`test_logger.py`).
3. Покрыта логика извлечения и мэппинга медиа-ресурсов (Single, Carousel, Reel) с очисткой текста (`test_mapper.py`).
4. Написан E2E Smoke тест (`test_e2e_smoke.py`), который поднимает локальный `http.server`, мокирует CMS API и прогоняет весь пайплайн (Happy path, Idempotency, Batch, DLQ Process).
5. Разрешены конфликты типизации Python 3.9 (добавлено `from __future__ import annotations` в рабочих файлах).

**Нагрузочное тестирование (`load_test.py`)**
1. Создан скрипт `scripts/instagram_sync/load_test.py` для тестирования высоких объемов загрузки.
2. Имплементирован mock-сервер с внедрением **искусственных сетевых задержек** (latency) и программируемым **шансом на отказ** (HTTP 500 и обрывы соединений).
3. При тестовом прогоне на `500` сгенерированных постах: скрипт успешно прошел проверку за ~30 секунд, корректно заполнил DLQ перманентно сбойными постами (настроенные 5%), успешно обновил checkpoint-состояние и корректно ограничил объем ротации логов.

## Что было сделано (Миграция на архитектуру ETL, Апрель 2026)

**Статус: Завершено 🟢**

**Рефакторинг тестовой базы для БД Очередей (Без DLQ)**
1. **Удаление DLQ тестов**: Файл `test_dead_letter.py` полностью удален из репозитория. Старые локальные заглушки директорий `state/dlq/` удалены.
2. **Адаптация E2E Tests**: Разделение пайплайна в `test_e2e_smoke.py` имитирует работу Prisma API `POST /api/sync/queue` вместо файловой системы. Исправлены конфликтующие зависимости при моке `Profile.from_username()` (наследуемые Mock-объекты Instaloader). Отключены искусственные паузы (`time.sleep`) внутри E2E, что сократило время прохождения с минут до пары секунд.
3. **Защита от утечки LLM**: В тестах обнаружено пробитие `openai/httpx` в продакшен среду OpenRouter минуя библиотеку `responses`. Имплементирован корректный mock `llm_client.get_analysis`, чтобы устранить зависимости от интернета и падающие 401/502 запросы.
4. **Обновление Mapper-валидаций**: Тесты `test_mapper.py` обновлены для проверки новых default title (`"Untitled Event"` вместо пустых строк). Также скорректировано ожидаемое количество блоков (`len(page.blocks)`) для ситуаций с fallback логикой.
5. **Тест обработки падения**: Создан тест для JSON corruption `test_etl_transformer_crash`, проверяющий, что Transformer корректно обрабатывает падения кода и обновляет статус джоба (`PATCH /api/sync/queue`) с состоянием `ERROR`.

В данный момент команда `make sync-tests` выполняется на 100% успешно (51 пройденный тест). Инфраструктура полностью приведена в соответствие с новой архитектурой баз данных (Prisma) и API Gateway (Next.js).

---

## Итог: Что было сделано "на пальцах"

**Проблема:** Изначальный пайплайн работал "в лоб" и складывал ошибки в файлики (Legacy DLQ — папка `state/dlq/`). Скрипт шел в Instagram, скачивал медиа, отправлял текст нейросети, и если на каком-то моменте API падало, пост просто сваливался в папку со сломанными `.json` файлами в надежде, что кто-то запустит отдельный скрипт для их спасения. Это было нестабильно, файлы могли потеряться, а интерфейса для их восстановления не было.

**Решение (Новая ETL архитектура):**
1. **Разделение монолита:**
   * **Extractor (Добытчик):** Его единственная задача — сходить в Instagram, выкачать картинки/видео, загрузить их к нам на сайт (в папку `uploads`) и создать в нашей *базе данных* запись (модель `RawInstagramPost`) со статусом `PENDING`.
   * **Transformer (Обработчик):** Отдельный скрипт, который просыпается и смотрит в базу. Находя посты со статусом `PENDING`, он по одному засылает их в нейросеть (OpenRouter), красиво форматирует (алгоритмом Carousel Skeleton) и заливает на сайт в виде уже готовых страниц. После этого статус в БД меняется на `COMPLETED` или `ERROR`.
2. **База данных вместо файлов:** Теперь мы ничего не храним в директориях. Все данные, ошибки и ожидающие посты надежно лежат в Prisma DB, что позволит нам легко вывести их в красивую админку.
3. **Неубиваемость:** Мы написали 54 теста, которые генерируют фальшивые сетевые ошибки, имитируют перебои с БД и обрыв соединения. В случае сбоя LLM, скрипт использует Fallback-сценарий: не падает, собирает страницу без дополнительных разбиений, но сохраняет контент и честно рапортует об этом.

---

## План "Живой прогонки" (Live Run)

Чтобы убедиться на 100% в надежности архитектуры, мы проведем изолированный End-to-End прогон на реальных данных.

**Шаг 1: Подготовка окружения**
* Проверить актуальность `OPENROUTER_API_KEY` в `.env` и валидность Instagram куки-сессии (в `state/ig_session`), чтобы исключить блокировки со стороны API.
* Запустить Prisma Studio (`npx prisma studio`), чтобы мониторить изменения в таблицах `Page` и `RawInstagramPost` в реальном времени.

**Шаг 2: Выкачка (Extractor)**
* Запустить `make sync-fetch` с ограничением лимита на **2-3 последних поста**, нацелив скрипт на тестовый Instagram аккаунт.
* Убедиться в БД Prisma Studio, что новые медиа успешно скачаны, залиты на локальный `uploads`, и в таблице появились записи `PENDING`.

**Шаг 3: Магия ИИ (Transformer)**
* Поднять локальный сервер `npm run dev`, чтобы активировать CMS API-шлюзы для создания страниц (`/api/sync/pages`).
* Запустить `make sync-process`.
* Наблюдать в логах процесс общения с LLM (дробление текста по чанкам). В БД статусы постов должны смениться с `PENDING` на `COMPLETED`.

**Шаг 4: Визуализация в Админке**
* Открыть Frontend дашборд портфолио в браузере (или `/admin/dashboard`, если реализовано).
* Проверить, что страницы успешно созданы, дизайн каруселей и блоков корректно сверстался (алгоритм Skeleton), а фотографии отображаются.

**Шаг 5: Аудит логов**
* Изучить финальный `.jsonl` файл в директории `state/logs/ig_sync_***.jsonl`.
* Исключить скрытые "тихие" Exception'ы, проверив таймстампы и корректность проброса correlation_id.
