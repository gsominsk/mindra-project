# Architectural Plan: Instagram to Mindra CMS Pipeline

> **Статус:** Technical Implementation Plan  
> **Дата:** 2026-04-15 (обновлено 2026-04-16)

---

## 1. Концепция (The Pipeline Concept)
Задача: Автоматизировать превращение постов из открытого Instagram-аккаунта в полноценные сгенерированные лендинги мероприятий через нашу существующую Админку.

**Поток данных (Data Flow):**
1. `Instaloader` (Python-скрипт) скачивает пост (Видео/Фото-карусель и текст).
2. Скрипт поочередно загружает медиафайлы через POST-запрос на наш локальный `api/upload`.
3. Полученные ссылки на медиа и вытянутый текст поста комбинируются в JSON-объект `PageState` (на основе наших 4 типов блоков).
4. Скрипт отправляет финальный JSON через POST-запрос на `api/admin/pages`, автоматически сохраняя "черновик" в базе.

## 2. Локация в структуре проекта
Скрипт не должен засорять Next.js экосистему. Он будет изолирован:

```
scripts/instagram_sync/
├── __init__.py
├── config.py          # Конфигурация, ENV, константы
├── logger.py          # Structured JSON logging
├── models.py          # Pydantic-модели (валидация, зеркало TypeScript-типов)
├── downloader.py      # Instaloader wrapper с rate-limiting
├── mapper.py          # IG Post → PageState converter
├── uploader.py        # MindraCMSAPI HTTP client
├── checkpoint.py      # Resume/checkpoint filesystem state
├── entrypoint.py      # CLI (argparse), orchestration
├── requirements.txt   # instaloader, requests, pydantic, python-dotenv
├── Dockerfile         # Для Docker Compose sidecar
└── .env.sync.example  # Шаблон переменных окружения
```

## 3. Маппинг данных (Как IG-пост превращается в Лендинг)
Когда мы качаем пост, нам нужно разбить его на "кирпичики" (PageBlocks):

**A. Карусель (Несколько фото/видео) + Текст**
- Слайд 1 (Крайне важное хук-видео): превращается в `media-only` 100vh контейнер (главный баннер).
- Текст (Caption из Instagram): Блок `media-left`. Слева — слайд номер 2, справа — текст из поста (скрипт автоматом парсит хэштеги, убирая их из тела).
- Слайды 3, 4, 5: Превращаются в вертикальную череду `media-right` и `media-only` для формирования "галереи" отчета о вечеринке.

**B. Один Reels + Текст**
- Блок 1: `media-only` с видео Рился.
- Блок 2: `text-only` (Манифест) в котором залит текст рилса.

**C. Одно фото + Текст**
- Блок 1: `media-only` с фото.
- Блок 2: `text-only` (если есть caption).

## 4. Архитектура Загрузчика (Instaloader API)
Парсинг больше не использует хэштеги. Любая скачанная сущность по умолчанию имеет `eventType = 'uncategorized'` и `isPublished = false` в CMS. Пользователь сортирует их вручную через веб-интерфейс.

## 5. Обход блокировок (Rate-Limiting & Safe Sync)
Инстаграм агрессивно банит за массовый парсинг. Система защиты:
1. **Jitter/Sleep:** Случайные интервалы (1–5 мин) между запросами, имитация человека.
2. **Session limit:** После 12 постов — принудительный перерыв 1–1.5 часа.
3. **Cookie-based auth:** Вход через cookie-файл (`--cookiefile`), а не plaintext пароль.
4. **Два режима работы:**
   - `--mode initial`: Медленная первая выгрузка с checkpoint/resume.
   - `--mode daily`: Инкрементальная выгрузка — только новые посты.

## 6. Roadmap
1. ~~Настроить директорию Python `scripts/` и виртуальное окружение.~~
2. ~~Написать архитектурный план.~~
3. ~~Расширить Prisma-схему (Instagram source tracking + SyncJob).~~
4. ~~Создать внутренние `/api/sync/*` эндпоинты (без auth, Docker-сеть).~~
5. ~~Написать Python pipeline (9 модулей, включая DLQ).~~
6. ~~Интегрировать в Docker Compose.~~
7. Тесты + dry-run верификация.
8. Безопасность (отдельная задача).

---
---

# ТЕХНИЧЕСКАЯ ИМПЛЕМЕНТАЦИЯ

## 7. Существующая инфраструктура (что есть сейчас)

| Компонент | Путь | Описание |
|---|---|---|
| Prisma Schema | `prisma/schema.prisma` | SQLite, модели `EventPage` + `Block` |
| Upload API | `app/api/upload/route.ts` | `POST`, пишет в `public/uploads/`, отдаёт `/uploads/{uuid}.ext` |
| Pages API | `app/api/admin/pages/route.ts` | `POST` — создаёт `EventPage` + `Block[]` |
| Pages API (ID) | `app/api/admin/pages/[id]/route.ts` | `PUT` — обновление, `GET` — чтение по ID |
| Pages List | `app/api/admin/pages/list/route.ts` | `GET` — список всех страниц |
| Auth Middleware | `middleware.ts` | Cookie `admin_session` на `/admin/*`, `/api/admin/*`, `/api/upload/*` |
| Block Types | `app/admin/types.ts` | `media-left`, `media-right`, `media-only`, `text-only` |
| Dynamic Page | `app/[slug]/page.tsx` | SSR-рендеринг по slug из БД |
| Docker | `docker-compose.yml` | Монтирует `/root/media` → `/app/public/media` |

## 8. Prisma Schema Evolution

Добавляем поля для отслеживания Instagram-источника + модель аудита синхронизаций:

```prisma
model EventPage {
  id          String   @id @default(cuid())
  title       String
  eventType   String
  slug        String   @unique
  isPublished Boolean  @default(false)
  blocks      Block[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // === NEW: Instagram source tracking ===
  igShortcode   String?  @unique  // "C123456" — главный ключ дедупликации
  igSourceType  String?           // "post" | "highlight" | "reel"
  igProfileName String?           // "@target_account"
  igSyncedAt    DateTime?         // время последней синхронизации
}

model Block {
  id        String    @id @default(cuid())
  order     Int
  layout    String
  text      String?
  textStyle String?
  mediaUrl  String?
  mediaType String?
  pageId    String
  page      EventPage @relation(fields: [pageId], references: [id], onDelete: Cascade)
}

// === NEW: Лог синхронизаций (аналог job-run) ===
model SyncJob {
  id          String    @id @default(cuid())
  mode        String    // "initial" | "daily"
  status      String    @default("running")  // "running" | "completed" | "failed"
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  postsFound    Int     @default(0)
  postsCreated  Int     @default(0)
  postsSkipped  Int     @default(0)
  errors        Int     @default(0)
  errorLog      String? // JSON array of error summaries
}
```

**Зачем `igShortcode @unique`?** Главный механизм идемпотентности: скрипт получает shortcode → `GET /api/sync/check-shortcode?code=X` → если существует, skip.

## 9. Next.js API: Внутренние sync-эндпоинты

> **Архитектурное решение:** Sync-сервис живёт рядом в Docker Compose и общается с Next.js по внутренней Docker-сети (`mindra-network`). Эндпоинты размещены под `/api/sync/*` — этот путь НЕ защищён middleware (middleware ловит только `/admin/*`, `/api/admin/*`, `/api/upload/*`). Безопасность будет проработана отдельно.

### 9.1 Проверка по shortcode

**`app/api/sync/check-shortcode/route.ts`** (NEW):
```typescript
// GET /api/sync/check-shortcode?code=C123456
// → { exists: true, id: "cuid...", slug: "..." } или { exists: false }
```

### 9.2 Создание страницы

**`app/api/sync/pages/route.ts`** (NEW):
```typescript
// POST /api/sync/pages
// Body: { title, eventType, blocks, igShortcode?, igSourceType?, igProfileName? }
// → 201 { id, slug, title }
```

### 9.3 Загрузка медиа

**`app/api/sync/upload/route.ts`** (NEW):
```typescript
// POST /api/sync/upload (multipart/form-data)
// → { url: "/uploads/uuid.ext" }
```

### 9.4 SyncJob CRUD

**`app/api/sync/jobs/route.ts`** + **`app/api/sync/jobs/[id]/route.ts`** (NEW):
```
POST /api/sync/jobs        → создаёт job { mode: "daily" }
GET  /api/sync/jobs         → список последних 20 jobs
PATCH /api/sync/jobs/:id   → обновление счётчиков и статуса
```

## 10. Python Pipeline: Конфигурация (`config.py`)

```python
@dataclass
class SyncConfig:
    # CMS (внутренняя Docker-сеть, без auth)
    cms_base_url: str = os.getenv("CMS_BASE_URL", "http://localhost:3000")

    # Instagram
    ig_cookie_file: str = os.getenv("IG_COOKIE_FILE", "session.cookie")
    ig_target_profile: str = os.getenv("IG_TARGET_PROFILE", "")

    # Rate limiting
    min_delay_seconds: int = 60     # 1 мин минимум
    max_delay_seconds: int = 300    # 5 мин максимум
    posts_per_session: int = 12     # потом cooldown 1–1.5 часа

    # Paths
    download_dir, checkpoint_dir, log_dir, dlq_dir

    # DLQ
    dlq_max_retries: int = 3
    dry_run: bool = False
```

`.env.sync.example`:
```env
CMS_BASE_URL=http://localhost:3000
IG_COOKIE_FILE=session.cookie
IG_TARGET_PROFILE=target_account
DLQ_MAX_RETRIES=3
```

## 11. Structured JSON Logging (`logger.py`)

Каждая строка лога — JSON-объект, пригодный для `grep`/`jq`. Один файл на запуск: `ig_sync_2026-04-16_01-32-02.jsonl`. Авто-очистка старых файлов при превышении ~200MB. Correlation ID по shortcode для трейсинга одного поста через весь pipeline.

```python
import logging, json, sys, uuid
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from contextvars import ContextVar

_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="global")

def set_correlation_id(shortcode: str) -> None:
    _correlation_id.set(shortcode)

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
            "correlation_id": _correlation_id.get(),
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }
        if hasattr(record, "extra_data"):
            entry["data"] = record.extra_data
        return json.dumps(entry, ensure_ascii=False)

def _cleanup_old_logs(log_dir: Path, prefix: str = "ig_sync_") -> None:
    """Remove oldest logs when total exceeds ~200MB."""
    log_files = sorted(log_dir.glob(f"{prefix}*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)
    total = 0
    for f in log_files:
        total += f.stat().st_size
        if total > 200 * 1024 * 1024:
            f.unlink()

def setup_logger(log_dir: Path, name: str = "ig_sync") -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    _cleanup_old_logs(log_dir, f"{name}_")

    # Один файл на запуск: ig_sync_2026-04-16_01-32-02.jsonl
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    fh = logging.FileHandler(log_dir / f"{name}_{timestamp}.jsonl", encoding="utf-8")
    fh.setFormatter(JSONFormatter())
    fh.setLevel(logging.DEBUG)

    # Консоль — человекочитаемый
    ch = logging.StreamHandler(sys.stderr)
    ch.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(module)s: %(message)s"))
    ch.setLevel(logging.INFO)

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger
```

**Пример вывода:**
```json
{"ts":"2026-04-16T01:30:00Z","level":"INFO","module":"downloader","func":"fetch_post","line":42,"correlation_id":"C7xK9pQ","msg":"Downloaded 5 media items","data":{"media_count":5,"has_video":true}}
```

## 12. Pydantic Validation (`models.py`)

Зеркало TypeScript-типов из `app/admin/types.ts` с бизнес-валидацией:

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from enum import Enum

class EventType(str, Enum):
    BUSINESS = "business"
    WEDDING = "wedding"
    PARTY = "party"
    UNCATEGORIZED = "uncategorized"

class BlockLayout(str, Enum):
    MEDIA_LEFT = "media-left"
    MEDIA_RIGHT = "media-right"
    MEDIA_ONLY = "media-only"
    TEXT_ONLY = "text-only"

class TextStyle(BaseModel):
    align: Literal["left", "center", "right", "justify"] = "left"
    size: Literal["sm", "base", "lg", "xl", "2xl", "4xl"] = "base"
    family: Literal["sans", "serif", "mono"] = "sans"
    bold: bool = False
    italic: bool = False
    color: str = "#333333"

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not v.startswith("#") or len(v) not in (4, 7):
            raise ValueError(f"Invalid hex color: {v}")
        return v

class BlockContent(BaseModel):
    text: str = ""
    textStyle: TextStyle = Field(default_factory=TextStyle)
    mediaUrl: Optional[str] = None
    mediaType: Optional[Literal["image", "video"]] = None

    @field_validator("mediaUrl")
    @classmethod
    def validate_media_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("/uploads/"):
            raise ValueError(f"mediaUrl must start with /uploads/, got: {v}")
        return v

class PageBlock(BaseModel):
    layout: BlockLayout
    content: BlockContent

    def model_post_init(self, __context) -> None:
        if self.layout == BlockLayout.MEDIA_ONLY and not self.content.mediaUrl:
            raise ValueError("media-only block must have a mediaUrl")
        if self.layout == BlockLayout.TEXT_ONLY and not self.content.text:
            raise ValueError("text-only block must have text content")

class PageState(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    eventType: EventType = EventType.UNCATEGORIZED
    blocks: list[PageBlock] = Field(min_length=1)
    igShortcode: Optional[str] = None
    igSourceType: Optional[Literal["post", "highlight", "reel"]] = None
    igProfileName: Optional[str] = None

class UploadResponse(BaseModel):
    url: str

class PageResponse(BaseModel):
    id: str
    slug: str
    title: str
```

## 13. Instagram Downloader (`downloader.py`)

Instaloader-обёртка с rate-limiting, session-limit, cookie-auth:

```python
import instaloader, time, random, logging
from pathlib import Path
from dataclasses import dataclass
from typing import Iterator, Optional
from .config import SyncConfig
from .logger import set_correlation_id

logger = logging.getLogger("ig_sync")

class InstagramRateLimitError(Exception):
    """Instagram вернул 429 — временная блокировка."""
    pass

@dataclass
class DownloadedPost:
    shortcode: str
    caption: str
    media_files: list[Path]       # Абсолютные пути к скачанным файлам
    media_types: list[str]        # "image" | "video" для каждого файла
    source_type: str              # "post" | "reel" | "highlight"
    profile_name: str
    timestamp: float
    is_video: bool
    hashtags: list[str]

class IGDownloader:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.loader = instaloader.Instaloader(
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern="",
            max_connection_attempts=3,
        )
        self._session_post_count = 0
        self._load_session()

    def _load_session(self) -> None:
        cookie_path = Path(self.config.ig_cookie_file)
        if cookie_path.exists():
            try:
                self.loader.load_session_from_file("__cached__", str(cookie_path))
                logger.info("Loaded Instagram session from cookie file")
            except Exception as e:
                logger.warning(f"Failed to load session: {e}")

    def _rate_limit_sleep(self) -> None:
        delay = random.uniform(self.config.min_delay_seconds, self.config.max_delay_seconds)
        logger.debug(f"Rate limit sleep: {delay:.1f}s")
        time.sleep(delay)

    def _check_session_limit(self) -> None:
        self._session_post_count += 1
        if self._session_post_count >= self.config.posts_per_session:
            cooldown = random.uniform(3600, 5400)  # 1–1.5 часа
            logger.warning(f"Session limit ({self.config.posts_per_session}). Cooldown {cooldown/60:.0f}min")
            time.sleep(cooldown)
            self._session_post_count = 0

    def fetch_single_post(self, shortcode: str) -> DownloadedPost:
        set_correlation_id(shortcode)
        logger.info(f"Fetching post: {shortcode}")
        try:
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
        except instaloader.exceptions.QueryReturnedNotFoundException:
            raise ValueError(f"Post not found: {shortcode}")
        except instaloader.exceptions.ConnectionException as e:
            if "429" in str(e) or "rate" in str(e).lower():
                raise InstagramRateLimitError(f"Rate limited on {shortcode}")
            raise
        return self._process_post(post)

    def fetch_profile_posts(
        self, profile_name: str,
        known_shortcodes: set[str] | None = None,
        max_posts: int | None = None,
    ) -> Iterator[DownloadedPost]:
        profile = instaloader.Profile.from_username(self.loader.context, profile_name)
        count = 0
        for post in profile.get_posts():
            if known_shortcodes and post.shortcode in known_shortcodes:
                logger.info(f"Hit known shortcode {post.shortcode}. Stopping incremental sync.")
                return
            if max_posts and count >= max_posts:
                return
            try:
                self._rate_limit_sleep()
                self._check_session_limit()
                yield self._process_post(post)
                count += 1
            except InstagramRateLimitError:
                logger.error("Rate limited! Waiting 30 min...")
                time.sleep(1800)
                yield self._process_post(post)
                count += 1

    def _process_post(self, post) -> DownloadedPost:
        shortcode = post.shortcode
        set_correlation_id(shortcode)
        target_dir = self.config.download_dir / shortcode
        target_dir.mkdir(parents=True, exist_ok=True)

        media_files, media_types = [], []

        if post.typename == "GraphSidecar":
            for i, node in enumerate(post.get_sidecar_nodes()):
                ext = ".mp4" if node.is_video else ".jpg"
                filename = target_dir / f"slide_{i}{ext}"
                url = node.video_url if node.is_video else node.display_url
                self.loader.context.get_and_write_raw(url, filename)
                media_files.append(filename)
                media_types.append("video" if node.is_video else "image")
        elif post.is_video:
            filename = target_dir / "video.mp4"
            self.loader.context.get_and_write_raw(post.video_url, filename)
            media_files.append(filename)
            media_types.append("video")
        else:
            filename = target_dir / "photo.jpg"
            self.loader.context.get_and_write_raw(post.url, filename)
            media_files.append(filename)
            media_types.append("image")

        caption = post.caption or ""
        hashtags = [t.strip("#").lower() for t in caption.split() if t.startswith("#")]

        logger.info(f"Downloaded {len(media_files)} media items")
        return DownloadedPost(
            shortcode=shortcode, caption=caption,
            media_files=media_files, media_types=media_types,
            source_type="reel" if post.is_video and post.typename != "GraphSidecar" else "post",
            profile_name=post.owner_username,
            timestamp=post.date_utc.timestamp(),
            is_video=post.is_video, hashtags=hashtags,
        )
```

## 14. Mapper (`mapper.py`)

Логика маппинга из секции 3, реализованная с Pydantic-валидацией:

```python
import re, logging
from .models import PageState, PageBlock, BlockContent, BlockLayout, TextStyle, EventType
from .downloader import DownloadedPost

logger = logging.getLogger("ig_sync")

def _sanitize_caption(caption: str) -> tuple[str, str]:
    """Извлекаем title (первая строка) и body (остальное, без хэштегов)."""
    lines = caption.strip().split("\n")
    title = (lines[0].strip() if lines else "Untitled Event")[:200]
    body_lines = lines[1:] if len(lines) > 1 else []
    body = "\n".join(l for l in body_lines if not re.match(r"^[#\s]+$", l)).strip()
    body = re.sub(r"#\w+", "", body).strip()
    return title, body

def map_post(post: DownloadedPost, uploaded_urls: list[str]) -> PageState:
    """Диспетчер: выбирает стратегию по типу контента."""
    if len(post.media_files) > 1:
        return _map_carousel(post, uploaded_urls)
    elif post.is_video:
        return _map_reel(post, uploaded_urls)
    else:
        return _map_photo(post, uploaded_urls)

def _map_carousel(post: DownloadedPost, urls: list[str]) -> PageState:
    title, body = _sanitize_caption(post.caption)
    blocks = [PageBlock(
        layout=BlockLayout.MEDIA_ONLY,
        content=BlockContent(mediaUrl=urls[0], mediaType=post.media_types[0]),
    )]
    if body and len(urls) > 1:
        blocks.append(PageBlock(
            layout=BlockLayout.MEDIA_LEFT,
            content=BlockContent(
                text=body, textStyle=TextStyle(align="left", size="lg"),
                mediaUrl=urls[1], mediaType=post.media_types[1],
            ),
        ))
    elif body:
        blocks.append(PageBlock(
            layout=BlockLayout.TEXT_ONLY,
            content=BlockContent(text=body, textStyle=TextStyle(align="center", size="xl")),
        ))
    start = 2 if body and len(urls) > 1 else 1
    cycle = [BlockLayout.MEDIA_RIGHT, BlockLayout.MEDIA_ONLY]
    for i, url in enumerate(urls[start:]):
        layout = cycle[i % 2]
        mt = post.media_types[start + i]
        if layout == BlockLayout.MEDIA_ONLY:
            blocks.append(PageBlock(layout=layout, content=BlockContent(mediaUrl=url, mediaType=mt)))
        else:
            blocks.append(PageBlock(layout=layout, content=BlockContent(text="", mediaUrl=url, mediaType=mt)))

    return PageState(
        title=title, eventType=EventType.UNCATEGORIZED, blocks=blocks,
        igShortcode=post.shortcode, igSourceType=post.source_type, igProfileName=post.profile_name,
    )

def _map_reel(post: DownloadedPost, urls: list[str]) -> PageState:
    title, body = _sanitize_caption(post.caption)
    blocks = [PageBlock(layout=BlockLayout.MEDIA_ONLY, content=BlockContent(mediaUrl=urls[0], mediaType="video"))]
    if body:
        blocks.append(PageBlock(
            layout=BlockLayout.TEXT_ONLY,
            content=BlockContent(text=body, textStyle=TextStyle(align="center", size="2xl", bold=True)),
        ))
    return PageState(
        title=title, eventType=EventType.UNCATEGORIZED, blocks=blocks,
        igShortcode=post.shortcode, igSourceType="reel", igProfileName=post.profile_name,
    )

def _map_photo(post: DownloadedPost, urls: list[str]) -> PageState:
    title, body = _sanitize_caption(post.caption)
    blocks = [PageBlock(layout=BlockLayout.MEDIA_ONLY, content=BlockContent(mediaUrl=urls[0], mediaType="image"))]
    if body:
        blocks.append(PageBlock(
            layout=BlockLayout.TEXT_ONLY,
            content=BlockContent(text=body, textStyle=TextStyle(align="center", size="xl")),
        ))
    return PageState(
        title=title, eventType=EventType.UNCATEGORIZED, blocks=blocks,
        igShortcode=post.shortcode, igSourceType="post", igProfileName=post.profile_name,
    )
```

## 15. CMS API Client (`uploader.py`)

HTTP-клиент с retry-логикой для transient ошибок:

```python
import logging, requests
from pathlib import Path
from typing import Optional
from .config import SyncConfig
from .models import PageState, UploadResponse, PageResponse

logger = logging.getLogger("ig_sync")

class CMSApiError(Exception):
    def __init__(self, status_code: int, message: str, endpoint: str):
        self.status_code = status_code
        self.endpoint = endpoint
        super().__init__(f"[{status_code}] {endpoint}: {message}")

class MindraCMSAPI:
    """HTTP клиент для внутренних /api/sync/* эндпоинтов."""
    def __init__(self, config: SyncConfig):
        self.base_url = config.cms_base_url.rstrip("/")
        self.session = requests.Session()
        # Без auth — внутренняя Docker-сеть
        self.session.timeout = 60
        self.dry_run = config.dry_run

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        for attempt in range(1, 4):
            try:
                resp = self.session.request(method, url, **kwargs)
                if resp.status_code >= 500 and attempt < 3:
                    logger.warning(f"Server {resp.status_code} on {path}, retry {attempt}/3")
                    continue
                if resp.status_code >= 400:
                    raise CMSApiError(resp.status_code, resp.text, path)
                return resp
            except requests.exceptions.ConnectionError as e:
                if attempt < 3:
                    logger.warning(f"Connection error on {path}, retry {attempt}/3")
                    continue
                raise CMSApiError(0, f"Connection failed: {e}", path)
        raise CMSApiError(0, "Max retries exceeded", path)

    def check_shortcode_exists(self, shortcode: str) -> Optional[str]:
        resp = self._request("GET", f"/api/sync/check-shortcode?code={shortcode}")
        data = resp.json()
        return data["id"] if data.get("exists") else None

    def upload_media(self, file_path: Path) -> str:
        if self.dry_run:
            logger.info(f"[DRY RUN] Would upload: {file_path.name}")
            return f"/uploads/dry-run-{file_path.stem}{file_path.suffix}"
        with open(file_path, "rb") as f:
            resp = self._request("POST", "/api/sync/upload", files={"file": (file_path.name, f)})
        result = UploadResponse.model_validate(resp.json())
        logger.info(f"Uploaded {file_path.name} → {result.url}")
        return result.url

    def create_page(self, page_state: PageState) -> PageResponse:
        if self.dry_run:
            logger.info(f"[DRY RUN] Would create: {page_state.title}")
            return PageResponse(id="dry-run", slug="dry-run", title=page_state.title)
        resp = self._request("POST", "/api/admin/pages", json=page_state.model_dump(mode="json"))
        result = PageResponse.model_validate(resp.json())
        logger.info(f"Created page: {result.title} → /{result.slug}")
        return result
```

## 16. Checkpoint/Resume System (`checkpoint.py`)

При `--mode initial` скрипт может работать сутками. Чекпоинт — JSON-файл, обновляемый после каждого поста:

```python
import json, logging
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("ig_sync")

@dataclass
class CheckpointState:
    profile: str = ""
    mode: str = "initial"
    processed_shortcodes: list[str] = field(default_factory=list)
    last_processed_shortcode: str | None = None
    total_processed: int = 0
    total_errors: int = 0
    started_at: str = ""
    last_checkpoint_at: str = ""

class CheckpointManager:
    def __init__(self, checkpoint_dir: Path, profile: str, mode: str):
        self.checkpoint_dir = checkpoint_dir
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.checkpoint_dir / f"{profile}_{mode}.checkpoint.json"
        self.state = self._load_or_create(profile, mode)

    def _load_or_create(self, profile: str, mode: str) -> CheckpointState:
        if self.filepath.exists():
            try:
                data = json.loads(self.filepath.read_text("utf-8"))
                state = CheckpointState(**data)
                logger.info(f"Resumed: {state.total_processed} done, last: {state.last_processed_shortcode}")
                return state
            except (json.JSONDecodeError, TypeError) as e:
                logger.error(f"Corrupt checkpoint, starting fresh: {e}")
        return CheckpointState(profile=profile, mode=mode, started_at=datetime.now(timezone.utc).isoformat())

    def mark_processed(self, shortcode: str) -> None:
        self.state.processed_shortcodes.append(shortcode)
        self.state.last_processed_shortcode = shortcode
        self.state.total_processed += 1
        self._save()

    def mark_error(self, shortcode: str) -> None:
        self.state.total_errors += 1
        self._save()

    def is_processed(self, shortcode: str) -> bool:
        return shortcode in self.state.processed_shortcodes

    def get_known_shortcodes(self) -> set[str]:
        return set(self.state.processed_shortcodes)

    def _save(self) -> None:
        self.state.last_checkpoint_at = datetime.now(timezone.utc).isoformat()
        self.filepath.write_text(json.dumps(asdict(self.state), ensure_ascii=False, indent=2), "utf-8")

    def finalize(self) -> None:
        logger.info(f"Sync complete. Processed: {self.state.total_processed}, Errors: {self.state.total_errors}")
```

## 17. CLI Entrypoint (`entrypoint.py`)

```python
#!/usr/bin/env python3
"""
Instagram → Mindra CMS Sync Pipeline

Usage:
    python -m scripts.instagram_sync.entrypoint --mode daily --profile target_account
    python -m scripts.instagram_sync.entrypoint --shortcode C123456
    python -m scripts.instagram_sync.entrypoint --mode initial --profile target_account --dry-run
"""
import argparse, sys, logging
from .config import SyncConfig
from .logger import setup_logger, set_correlation_id
from .downloader import IGDownloader, InstagramRateLimitError
from .mapper import map_post
from .uploader import MindraCMSAPI, CMSApiError
from .checkpoint import CheckpointManager

logger: logging.Logger = None

def process_single_post(post, api, checkpoint=None) -> bool:
    """
    Pipeline для одного поста:
    1. Idempotency check (checkpoint + CMS)
    2. Upload media
    3. Map → PageState (Pydantic validation)
    4. Create page
    5. Save checkpoint
    Returns True если создана страница.
    """
    set_correlation_id(post.shortcode)

    if checkpoint and checkpoint.is_processed(post.shortcode):
        logger.info(f"Skip {post.shortcode} — checkpoint")
        return False

    existing = api.check_shortcode_exists(post.shortcode)
    if existing:
        logger.info(f"Skip {post.shortcode} — exists in CMS ({existing})")
        if checkpoint:
            checkpoint.mark_processed(post.shortcode)
        return False

    # Upload
    uploaded_urls = []
    for mf in post.media_files:
        try:
            uploaded_urls.append(api.upload_media(mf))
        except CMSApiError as e:
            logger.error(f"Upload failed {mf.name}: {e}")
            if checkpoint: checkpoint.mark_error(post.shortcode)
            return False

    # Map
    try:
        page_state = map_post(post, uploaded_urls)
    except Exception as e:
        logger.error(f"Mapping failed {post.shortcode}: {e}", exc_info=True)
        if checkpoint: checkpoint.mark_error(post.shortcode)
        return False

    # Create
    try:
        result = api.create_page(page_state)
        logger.info(f"✅ Created: {result.title} → /{result.slug}")
        if checkpoint: checkpoint.mark_processed(post.shortcode)
        return True
    except CMSApiError as e:
        logger.error(f"Create failed {post.shortcode}: {e}")
        if checkpoint: checkpoint.mark_error(post.shortcode)
        return False

def run_profile_sync(profile: str, mode: str, config: SyncConfig) -> None:
    downloader = IGDownloader(config)
    api = MindraCMSAPI(config)
    checkpoint = CheckpointManager(config.checkpoint_dir, profile, mode)
    known = checkpoint.get_known_shortcodes()
    max_posts = None if mode == "initial" else 50
    stats = {"created": 0, "skipped": 0, "errors": 0}

    try:
        for post in downloader.fetch_profile_posts(
            profile,
            known_shortcodes=known if mode == "daily" else None,
            max_posts=max_posts,
        ):
            try:
                if process_single_post(post, api, checkpoint):
                    stats["created"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.error(f"Unexpected: {post.shortcode}: {e}", exc_info=True)
                stats["errors"] += 1
                checkpoint.mark_error(post.shortcode)
    except InstagramRateLimitError:
        logger.critical("Hard rate limit. Aborting — will resume from checkpoint.")
    finally:
        checkpoint.finalize()
        logger.info(f"Done. Created={stats['created']} Skipped={stats['skipped']} Errors={stats['errors']}")

def main() -> None:
    global logger
    parser = argparse.ArgumentParser(description="Instagram → Mindra CMS Pipeline")
    parser.add_argument("--mode", choices=["initial", "daily"])
    parser.add_argument("--profile", type=str)
    parser.add_argument("--retry-dlq", action="store_true", help="Retry DLQ entries")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--cms-url", type=str, help="Override CMS URL")
    args = parser.parse_args()

    config = SyncConfig(dry_run=args.dry_run)
    if args.cms_url:
        config = SyncConfig(cms_base_url=args.cms_url, dry_run=args.dry_run)
    logger = setup_logger(config.log_dir)

    if args.shortcode:
        dl = IGDownloader(config)
        api = MindraCMSAPI(config)
        post = dl.fetch_single_post(args.shortcode)
        process_single_post(post, api)
    elif args.profile and args.mode:
        run_profile_sync(args.profile, args.mode, config)
    else:
        parser.error("--shortcode or (--profile + --mode) required")

if __name__ == "__main__":
    main()
```

## 18. Error Taxonomy & Retry Strategy

| Ошибка | Тип | Действие | Retry? |
|---|---|---|---|
| `InstagramRateLimitError` (429) | Transient | Sleep 30 мин → retry | ✅ 1x | DLQ при 2-м фейле |
| `ConnectionException` (network) | Transient | Sleep 60с → retry | ✅ 3x | DLQ при истощении |
| `QueryReturnedNotFoundException` | Fatal/Post | Log + skip | ❌ | DLQ |
| `ProfileNotExistsException` | Fatal/Config | Abort run | ❌ | — |
| `CMSApiError(5xx)` | Transient | Retry 3x | ✅ | DLQ при истощении |
| `CMSApiError(400)` | Fatal/Data | Log + skip | ❌ | DLQ |
| `ValidationError` (Pydantic) | Fatal/Data | Log + skip | ❌ | DLQ |
| `FileNotFoundError` (media) | Fatal/IO | Log + skip | ❌ | DLQ |
| `KeyboardInterrupt` | External | Save checkpoint → exit | ❌ | — |

## 19. Docker Integration

Расширение `docker-compose.yml` — Python-скрипт как sidecar-сервис:

```yaml
services:
  app:
    # ... существующий Next.js сервис ...
    volumes:
      - /root/media:/app/public/media:ro
      - uploads-data:/app/public/uploads    # shared с sync

  ig-sync:
    build:
      context: ./scripts/instagram_sync
      dockerfile: Dockerfile
    container_name: mindra-ig-sync
    volumes:
      - uploads-data:/uploads
      - sync-state:/app/state
      - sync-logs:/app/logs
    environment:
      - CMS_BASE_URL=http://app:3000
      - IG_TARGET_PROFILE=${IG_TARGET_PROFILE}
    depends_on:
      - app
    command: ["python", "-m", "entrypoint", "--mode", "daily", "--profile", "${IG_TARGET_PROFILE}"]
    profiles:
      - sync  # docker compose --profile sync up ig-sync

volumes:
  uploads-data:
  sync-state:
  sync-logs:
```

`scripts/instagram_sync/Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENTRYPOINT ["python", "-m"]
CMD ["entrypoint", "--help"]
```

`scripts/instagram_sync/requirements.txt`:
```
instaloader>=4.11,<5.0
requests>=2.31,<3.0
pydantic>=2.5,<3.0
python-dotenv>=1.0,<2.0
```

## 20. Файлы и изменения (Summary)

| Действие | Путь |
|---|---|
| **MODIFY** | `prisma/schema.prisma` — +4 поля в `EventPage`, +модель `SyncJob` |
| **MODIFY** | `app/api/admin/pages/route.ts` — IG-метаданные + валидация |
| **MODIFY** | `docker-compose.yml` — shared volumes, sync sidecar |
| **MODIFY** | `.gitignore` — sync директории |
| **NEW** | `app/api/sync/check-shortcode/route.ts` |
| **NEW** | `app/api/sync/pages/route.ts` |
| **NEW** | `app/api/sync/upload/route.ts` |
| **NEW** | `app/api/sync/jobs/route.ts` |
| **NEW** | `app/api/sync/jobs/[id]/route.ts` |

---
---

# НА ПАЛЬЦАХ: Что делает каждый элемент системы

> Эта секция — подробный человеческий гид по каждому компоненту пайплайна. Без кода, на пальцах. Если через полгода ты откроешь этот файл и забудешь что к чему — начинай отсюда.

---

## Общая картина: Как работает конвейер

Представь себе конвейер на заводе. На одном конце — Instagram-пост (фотки, видео, текст). На другом конце — готовая страница-лендинг на сайте Mindra. Между ними — 5 станций:

```
[Instagram] → Скачать → Загрузить медиа → Собрать страницу → Создать в CMS → [Готовый лендинг]
                                                                      ↓ (при ошибке)
                                                                   [DLQ] → retry позже
```

Каждый Python-модуль — это одна станция конвейера. Они работают последовательно: пока предыдущая станция не закончит — следующая не начинает. Если одна станция сломалась — пост уходит в **DLQ** (Dead Letter Queue — очередь мертвых писем), и конвейер едет дальше к следующему посту. Позже DLQ можно перепрогнать.

---

## Серверная часть (Next.js)

### `prisma/schema.prisma` — Чертёж базы данных

**Что это:** Файл-описание всех таблиц в базе данных. Prisma читает его и создаёт таблицы в SQLite.

**Что мы добавили:**
- **4 новых поля в таблице `EventPage`:**
  - `igShortcode` — короткий код поста из Instagram (например `C7xK9pQ`). Каждый пост в Instagram имеет уникальный код в URL. Мы его сохраняем, чтобы **не создать дубликат** при повторном запуске скрипта. Поле помечено `@unique` — база данных не даст вставить два поста с одинаковым кодом.
  - `igSourceType` — откуда пришёл пост: `"post"` (обычный), `"reel"` (видео-рилс), или `"highlight"` (кружочек). Нужно для фильтрации в админке.
  - `igProfileName` — имя аккаунта-источника (например `"@djfriend"`). Если мы синкаем несколько аккаунтов — можем фильтровать по источнику.
  - `igSyncedAt` — время, когда этот пост был синхронизирован. Просто для аудита — "когда этот лендинг был создан автоматически".

- **Новая таблица `SyncJob`:**
  Это журнал синхронизаций. Каждый раз, когда скрипт запускается — создаётся запись: "начал работу в 03:00, нашёл 15 постов, создал 12, пропустил 2, ошибок 1". Потом в админке можно посмотреть историю: когда последний раз синкались, были ли ошибки.

**Аналогия:** Prisma schema — это как таблица в Excel с названиями столбцов. Мы добавили 4 новые колонки в существующую таблицу и создали новую таблицу-журнал.

---

### `middleware.ts` — Охранник на входе (НЕ изменён)

**Что это:** Код, который перехватывает КАЖДЫЙ запрос к защищённым URL (всё что начинается с `/admin` или `/api/admin`). Проверяет cookie `admin_session` — ту, которую ставит браузер при логине через веб-интерфейс.

**Для синк-скрипта:** Middleware НЕ трогает пути `/api/sync/*`. Синк-сервис живёт рядом в Docker Compose на внутренней сети (`mindra-network`), и ходит на отдельные эндпоинты, которые middleware не перехватывает.

**Безопасность:** Будет проработана отдельно как самостоятельная задача. Сейчас `/api/sync/*` роуты доступны без авторизации — это допустимо, потому что на проде порт 3000 не выставлен наружу, а Docker-сеть изолирована.

---

### Внутренние sync-эндпоинты (`/api/sync/*`)

Все эндпоинты, которые дёргает Python-скрипт, живут под `/api/sync/` — отдельно от защищённых `/api/admin/`. Это позволяет скрипту работать без авторизации через внутреннюю Docker-сеть.

#### `GET /api/sync/check-shortcode?code=C7xK9pQ` — Проверка "уже есть?"

Идемпотентность: перед созданием страницы проверяем — нет ли уже записи с таким shortcode. Если есть → пропускаем. Без этого при каждом запуске скрипта появлялись бы дубликаты.

**Аналогия:** Перед тем как положить книгу на полку, смотришь — нет ли её там уже.

#### `POST /api/sync/pages` — Создание страницы

Принимает JSON с `title`, `eventType`, `blocks` + IG-метаданные (`igShortcode`, `igSourceType`, `igProfileName`). Создаёт EventPage в Prisma с автосгенерённым slug. Входная валидация: если нет title или blocks — 400.

#### `POST /api/sync/upload` — Загрузка медиафайлов

Принимает файл через multipart/form-data. Генерирует UUID-имя, сохраняет в `public/uploads/`, возвращает URL вида `/uploads/uuid.jpg`.

#### `POST /api/sync/jobs` — Создание записи о синхронизации

Скрипт вызывает это в начале работы: "я начал, режим = daily".

#### `PATCH /api/sync/jobs/:id` — Обновление статуса синхронизации

Обновляет счётчики по ходу: "нашёл 15 постов", "создал ещё одну страницу", "закончил, статус = completed".

#### `GET /api/sync/jobs` — Список синхронизаций

Последние 20 синхронизаций — для мониторинга в админке.

---

## Python-пайплайн (scripts/instagram_sync/)

### `config.py` — Все настройки в одном месте

**Что это:** Dataclass (структурированный объект) со ВСЕМИ параметрами, которые нужны скрипту. Читает из файла `.env.sync`.

**Что хранит:**
- `cms_base_url` — куда стучаться (по умолчанию `http://localhost:3000`, в Docker = `http://app:3000`)
- `ig_cookie_file` — путь к файлу cookie-сессии Instagram
- `min_delay_seconds` / `max_delay_seconds` — диапазон задержек между запросами (60-300 секунд)
- `posts_per_session` — сколько постов качать до перерыва (12)
- `download_dir`, `checkpoint_dir`, `log_dir`, `dlq_dir` — где хранить скачанные файлы, состояние, логи, DLQ
- `dry_run` — режим "прогона без последствий"
- `dlq_max_retries` — сколько раз пытаться перепрогнать упавший пост (по умолчанию 3)

**Зачем отдельный файл:** Настройки не должны быть размазаны по коду. Когда нужно поменять задержку — открываешь `.env.sync`, меняешь число, перезапускаешь.

**Аналогия:** Пульт управления — все рычажки и кнопки в одном месте.

---

### `logger.py` — Чёрный ящик

**Что это:** Система логирования. Записывает ВСЁ, что происходит в скрипте — в два места одновременно.

**Два формата вывода:**

1. **В файл** (`logs/ig_sync.jsonl`): Каждая строка — JSON-объект. Машиночитаемый формат. Можно фильтровать через `jq`, парсить, строить графики.
   ```json
   {"ts":"2026-04-16T01:30:00Z","level":"INFO","module":"downloader","correlation_id":"C7xK9pQ","msg":"Downloaded 5 media items"}
   ```

2. **В консоль**: Человекочитаемый формат с временем и уровнем.
   ```
   2026-04-16 01:30:00 [INFO] downloader: Downloaded 5 media items
   ```

**Один файл на запуск:** Каждый запуск скрипта создаёт новый файл с датой-временем в имени:
```
logs/
├── ig_sync_2026-04-15_03-00-00.jsonl   ← запуск 15 апреля в 3:00
├── ig_sync_2026-04-16_03-00-00.jsonl   ← запуск 16 апреля в 3:00
├── ig_sync_2026-04-16_14-22-31.jsonl   ← ручной запуск 16 апреля в 14:22
└── ...
```
Это удобнее, чем один общий файл: можно сразу открыть лог конкретного запуска и не фильтровать. Старые файлы автоматически удаляются, когда общий размер превышает ~200MB (самые старые уходят первыми).

**Correlation ID:** Это "трекер" — короткий код поста (shortcode), который прописывается в КАЖДУЮ строку лога, связанную с этим постом. Когда пост `C7xK9pQ` падает с ошибкой — ты пишешь `grep C7xK9pQ ig_sync_2026-04-16*.jsonl` и видишь ВСЮ историю этого поста: скачивание, маппинг, загрузка, падение. Без correlation ID пришлось бы угадывать, какая строчка к какому посту относится.

**Аналогия:** Бортовой самописец самолёта — записывает всё, потом можно разобраться что пошло не так.

---

### `models.py` — Контролёр качества

**Что это:** Набор Pydantic-моделей — "чертежей" данных. Каждый объект, который проходит через пайплайн, проверяется на соответствие чертежу.

**Что проверяет:**
- `TextStyle.color` — это реально HEX-цвет (`#333333`), а не абракадабра?
- `BlockContent.mediaUrl` — URL начинается с `/uploads/`? (не случайная ссылка на imgur)
- `PageBlock` — если layout = `media-only`, то mediaUrl ОБЯЗАН быть. Если layout = `text-only`, то text ОБЯЗАН быть непустым.
- `PageState.title` — от 1 до 200 символов, не пустой.
- `PageState.blocks` — минимум 1 блок (страница без блоков — бессмысленна).

**Зачем:** Без валидации API получит мусор — блок `media-only` без картинки, или страницу без заголовка — и либо упадёт с непонятной ошибкой Prisma, либо создаст сломанную страницу. Pydantic ловит косяки ДО отправки в API и выдаёт понятное сообщение: "media-only block must have a mediaUrl".

**Зеркало TypeScript:** Эти модели копируют структуру типов из `app/admin/types.ts`. `BlockLayout`, `TextStyle`, `PageState` — одинаковые в Python и TypeScript. Если ты добавишь новый тип блока в TypeScript — нужно добавить его и в Python-модели, иначе Pydantic его отвергнет.

**Аналогия:** ОТК на заводе — проверяет каждую деталь перед тем, как она уедет к клиенту.

---

### `downloader.py` — Качальщик

**Что это:** Обёртка вокруг библиотеки `instaloader`. Качает посты из Instagram, извлекает медиафайлы и метаданные.

**Три режима скачивания:**
1. `fetch_single_post("C7xK9pQ")` — один конкретный пост по shortcode
2. `fetch_profile_posts("djfriend")` — все посты профиля по порядку (от новых к старым)
3. (Будущее) Highlights — кружочки из профиля

**Что он качает:**
- Пост-карусель → папка `downloads/C7xK9pQ/` → файлы `slide_0.jpg`, `slide_1.mp4`, `slide_2.jpg`
- Reels → `downloads/C7xK9pQ/video.mp4`
- Одно фото → `downloads/C7xK9pQ/photo.jpg`

**Выход:** Объект `DownloadedPost` — всё, что нужно для следующей станции:
- `shortcode` — идентификатор
- `caption` — текст поста
- `media_files` — список путей к скачанным файлам
- `media_types` — что в каждом файле: `"image"` или `"video"`
- `hashtags` — список хэштегов (извлечены из caption)
- `is_video`, `source_type`, `profile_name`, `timestamp`

**Три уровня защиты от бана:**

1. **Jitter/Sleep** (`_rate_limit_sleep`): Между КАЖДЫМ постом — случайная пауза от 1 до 5 минут. Рандомизация важна: если делать паузу ровно 60 секунд — Instagram увидит паттерн и поймёт, что это бот. Случайный интервал — как человек, который листает ленту.

2. **Session limit** (`_check_session_limit`): После 12 постов — принудительный перерыв 1-1.5 часа. Живой человек не сидит и не листает посты 2 часа подряд. Скрипт тоже не должен.

3. **Rate limit handler**: Если Instagram всё-таки вернёт ошибку 429 ("слишком много запросов") — скрипт ждёт 30 минут и пробует ещё раз. Если и после этого 429 — полная остановка, дальше продолжим по checkpoint.

**Cookie-авторизация:** Вместо хранения пароля в коде — используется файл `session.cookie`. Один раз запускаешь `instaloader --login your_username`, вводишь пароль, и instaloader сохраняет cookie в файл. Дальше скрипт загружает этот файл. Cookie живут несколько месяцев.

**Аналогия:** Курьер, который ходит в Instagram-магазин, покупает товар (медиа) и приносит на склад (downloads/).

---

### `mapper.py` — Архитектор страницы

**Что это:** Получает на вход `DownloadedPost` + список URL загруженных медиа → собирает из них структуру страницы (`PageState`) по правилам маппинга.

**Три стратегии маппинга:**

1. **Карусель (≥2 медиа)** → `_map_carousel`:
   - Первый слайд → блок `media-only` (полноэкранный баннер-герой)
   - Текст из caption + второй слайд → блок `media-left` (картинка слева, текст справа)
   - Оставшиеся слайды → чередование `media-right` и `media-only` (как фотогалерея)

2. **Один Reels** → `_map_reel`:
   - Видео → `media-only`
   - Текст из caption → `text-only` (жирный, по центру — как манифест)

3. **Одно фото** → `_map_photo`:
   - Фото → `media-only`
   - Текст → `text-only` (если есть caption)

**Обработка caption** (`_sanitize_caption`):
- Первая строка → заголовок страницы (title). Обрезается до 200 символов.
- Всё остальное → тело текста (body).
- Строки, состоящие только из хэштегов — удаляются.
- Одиночные хэштеги внутри текста — тоже удаляются (`#party #vibes` → пустая строка).

**Пример:** Пост с 5 фотками и текстом "NEON NIGHTS 2026\nСамая безумная вечеринка года!\n#party #neon #mindra" превратится в:
```
Блок 1: media-only  → slide_0.jpg (герой-баннер)
Блок 2: media-left  → slide_1.jpg + "Самая безумная вечеринка года!"
Блок 3: media-right → slide_2.jpg
Блок 4: media-only  → slide_3.jpg
Блок 5: media-right → slide_4.jpg
```
Title = "NEON NIGHTS 2026", eventType = "uncategorized"

**Аналогия:** Дизайнер, который получает стопку фоток и текст от клиента и раскладывает их по шаблону лендинга.

---

### `uploader.py` — Почтальон

**Что это:** HTTP-клиент, который общается с API нашего сайта. Три основных метода:

1. **`check_shortcode_exists(shortcode)`** → Перед созданием спрашивает: "такой пост уже есть?" Вызывает `GET /api/sync/check-shortcode?code=...`

2. **`upload_media(file_path)`** → Загружает файл (фото/видео) через `POST /api/sync/upload`. Отправляет как multipart/form-data, получает обратно URL вида `/uploads/uuid-abc123.jpg`

3. **`create_page(page_state)`** → Создаёт страницу через `POST /api/sync/pages`. Отправляет готовый JSON со всеми блоками.

**Retry-логика (`_request`):**
Не все ошибки фатальные. Сервер может быть временно перегружен (500), или сеть моргнула (ConnectionError). Для таких случаев — автоматический retry до 3 раз:
- **5xx ошибка** → подождать, попробовать ещё раз
- **ConnectionError** → подождать, попробовать ещё раз
- **401** → НЕ повторять (ключ неверный — повтор не поможет)
- **400** → НЕ повторять (данные кривые — повтор не поможет)

**Dry-run режим:** Если `--dry-run`, то методы upload_media и create_page НЕ отправляют реальные запросы. Вместо этого логируют "[DRY RUN] Would upload: slide_0.jpg" и возвращают фейковые ответы. Позволяет прогнать весь пайплайн и увидеть что БУДЕТ создано — без последствий.

**Аналогия:** Почтальон, который несёт посылки (медиа и JSON) на почту (API), а если почта закрыта — ждёт и пробует снова.

---

### `checkpoint.py` — Страховка от сбоев

**Что это:** Система сохранения прогресса. При `--mode initial` скрипт может обрабатывать сотни постов СУТКАМИ. Если на 87-м посту отключат свет — без checkpoint придётся начинать с нуля. С checkpoint — продолжит с 88-го.

**Как работает:**
- При запуске: создаёт или загружает файл `state/djfriend_initial.checkpoint.json`
- После КАЖДОГО успешно обработанного поста: добавляет его shortcode в список и перезаписывает файл
- При следующем запуске: загружает файл, видит "87 постов уже обработано, последний — C7xK9pQ" и пропускает все 87

**Что хранится в checkpoint:**
```json
{
  "profile": "djfriend",
  "mode": "initial",
  "processed_shortcodes": ["C7xK9pQ", "C8aB2dE", ...],
  "last_processed_shortcode": "C8aB2dE",
  "total_processed": 87,
  "total_errors": 3,
  "started_at": "2026-04-16T01:00:00Z",
  "last_checkpoint_at": "2026-04-16T14:23:45Z"
}
```

**Два уровня дедупликации:**
1. Checkpoint (локальный, быстрый) — "я уже обрабатывал этот shortcode?"
2. CMS API (удалённый, надёжный) — "этот shortcode уже есть в базе?"

Зачем оба? Checkpoint может потеряться (почистил папку). CMS-проверка — гарантия. Но checkpoint быстрее (не нужен HTTP-запрос), поэтому он проверяется первым.

**Аналогия:** Закладка в книге — когда продолжаешь читать, открываешь не с первой страницы, а с того места, где остановился.

---

### `dead_letter.py` — Морг для сломанных постов (DLQ)

**Что это:** Dead Letter Queue — система учёта упавших постов. Когда пост не удалось обработать (сеть моргнула, API вернул ошибку, Pydantic отверг данные) — он НЕ теряется, а записывается в DLQ-файл с деталями ошибки.

**Как работает:**
- Каждый упавший пост → отдельный файл `state/dlq/{shortcode}.dlq.json`
- Файл содержит: shortcode, тип ошибки, на каком этапе упал, текст ошибки, счётчик попыток, timestamp первой и последней ошибки
- При retry (`--retry-dlq`): скрипт берёт все файлы с `retry_count < max_retries` и прогоняет заново
- При успехе retry: файл удаляется из DLQ
- Когда `retry_count >= max_retries` (по умолчанию 3): пост помещается как "exhausted" — больше автоматически не пытаемся, нужно ручное вмешательство

**Что хранится в DLQ-файле:**
```json
{
  "shortcode": "C7xK9pQ",
  "profile_name": "djfriend",
  "source_type": "post",
  "error_type": "CMSApiError",
  "error_message": "[500] /api/sync/pages: Internal Server Error",
  "pipeline_stage": "create",
  "retry_count": 2,
  "first_failed_at": "2026-04-16T01:30:00Z",
  "last_failed_at": "2026-04-16T03:00:00Z",
  "caption_preview": "NEON NIGHTS 2026...",
  "media_count": 5
}
```

**Этапы (pipeline_stage):**
- `"download"` — не скачался с Instagram
- `"upload"` — не загрузился в CMS (файл)
- `"map"` — Pydantic отверг данные
- `"create"` — CMS не создал страницу
- `"check"` — не получилось проверить idempotency
- `"unknown"` — необработанное исключение

**Зачем DLQ вместо простого "логируем и забываем":**
1. **Не теряем данные** — каждый упавший пост задокументирован
2. **Автоматический retry** — `--retry-dlq` прогоняет всё что можно
3. **Ручная инспекция** — можно посмотреть `ls state/dlq/` и понять: "3 поста упали на upload, возможно сеть была нестабильна"
4. **Exhaustion tracking** — если пост падает 3 раза подряд, он помечается как "exhausted" и не блокирует автоматику

**Аналогия:** Полка "брак" на заводе. Дефектные детали не выбрасывают, а складывают отдельно. Потом мастер смотрит: можно починить — чинит и отправляет обратно на конвейер. Нельзя — списывает.

---

### `entrypoint.py` — Дирижёр

**Что это:** Главный файл. Точка входа. Парсит аргументы командной строки и запускает правильный режим работы.

**Четыре режима:**

1. **`--shortcode C7xK9pQ`** → обработать ОДИН конкретный пост. Без checkpoint. Для тестирования или ручной синхронизации.

2. **`--mode daily --profile djfriend`** → инкрементальная синхронизация. Берёт посты профиля от новых к старым. Как только встречает shortcode, который уже есть в базе — останавливается. Максимум 50 постов за раз. Запускается по крону раз в сутки.

3. **`--mode initial --profile djfriend`** → полная первичная выгрузка. Обрабатывает ВСЕ посты без лимита. Работает с checkpoint. Может занять сутки для аккаунта с 500+ постами.

4. **`--retry-dlq --profile djfriend`** → перепрогон упавших постов из Dead Letter Queue. Берёт все записи с `retry_count < max_retries`, скачивает заново, пробует обработать. Успешные посты удаляются из DLQ.

**Флаги:**
- `--dry-run` → прогон без последствий (логирует, но не загружает и не создаёт)
- `--cms-url http://...` → переопределить URL сервера (для тестирования на staging)

**Функция `process_single_post`** — ядро конвейера для одного поста. Пять шагов:
```
1. Проверить checkpoint + DLQ exhaustion (уже обрабатывали? / исчерпаны ли попытки?)
2. Проверить CMS API (уже есть в базе?)
3. Загрузить все медиафайлы через API upload
4. Собрать PageState через mapper (с Pydantic-валидацией)
5. Создать страницу через API
```
Если любой шаг ломается — пост уходит в DLQ, ошибка логируется, конвейер едет дальше.

**Обработка аварий:**
- `InstagramRateLimitError` → лог CRITICAL, сохранение checkpoint, выход
- `KeyboardInterrupt` (Ctrl+C) → лог WARNING, сохранение checkpoint, выход
- Любая другая ошибка на отдельном посте → лог ERROR, пост в DLQ, продолжение

**Аналогия:** Диспетчер на вокзале — получает задание ("синхронизируй профиль"), проверяет расписание, отправляет поезда (посты) по правильным путям.

---

## Инфраструктура

### `requirements.txt` — Список зависимостей

4 библиотеки, не более:
- `instaloader` — парсер Instagram (качает посты, профили, медиа)
- `requests` — HTTP-клиент (отправляет запросы в наш API)
- `pydantic` — валидация данных (проверяет структуру PageState)
- `python-dotenv` — загрузка переменных из `.env.sync` файла

### `.env.sync.example` — Шаблон настроек

Файл-образец. Копируешь его в `.env.sync` и заполняешь реальными значениями (API ключ, имя аккаунта). Сам `.env.sync` в git НЕ попадает (есть в .gitignore).

### `Dockerfile` — Рецепт контейнера

Инструкция для Docker: "возьми Python 3.12, установи зависимости, скопируй код". Нужен для запуска скрипта в Docker Compose на сервере.

### `docker-compose.yml` — Оркестровка на сервере

**Что было:** Один сервис `app` (Next.js).

**Что добавили:** Второй сервис `ig-sync` (Python-скрипт). Они связаны:
- `uploads-data` — общий том для загруженных медиа. Python загружает файлы → Next.js их отдаёт.
- `sync-state` — том для checkpoint-файлов (выживают при перезапуске контейнера).
- `sync-logs` — том для файлов логов.
- `profiles: [sync]` — скрипт НЕ запускается автоматически с `docker compose up`. Только явно: `docker compose --profile sync up ig-sync`.

### `.gitignore` — Что не попадает в репозиторий

Добавлены:
- `scripts/instagram_sync/downloads/` — скачанные медиа (могут весить гигабайты)
- `scripts/instagram_sync/state/` — checkpoint-файлы (локальное состояние)
- `scripts/instagram_sync/logs/` — логи (чувствительные данные)
- `scripts/instagram_sync/.env.sync` — секреты (API ключ)
- `scripts/instagram_sync/session.cookie` — cookie Instagram (ОЧЕНЬ секретное)

---

## Таблица ошибок: что может пойти не так

| Ситуация | Что происходит | Что делает скрипт |
|---|---|---|
| Instagram вернул 429 | Слишком много запросов | Ждёт 30 мин → пробует ещё раз → если опять 429, сохраняет checkpoint и выходит |
| Сеть отвалилась | Запрос не дошёл | Повторяет до 3 раз |
| Пост удалён | 404 от Instagram | Логирует, пропускает, едет дальше |
| Профиль не существует | Пустой ответ | Немедленная остановка (config-ошибка) |
| API key неверный | 401 от CMS | Немедленная остановка (нечего повторять) |
| CMS сервер упал | 500 от CMS | Повторяет до 3 раз |
| CMS отверг данные | 400 от CMS | Логирует, пропускает пост |
| Pydantic отверг | Невалидные данные | Логирует, пропускает пост |
| Медиафайл не скачался | Файл не найден | Логирует, пропускает пост |
| Ctrl+C | Ручная остановка | Сохраняет checkpoint, выходит корректно |
| Свет кончился | Kill процесса | Checkpoint уже записан после предыдущего поста — продолжит оттуда |

---

## Как запускать (Quick Start)

### Локально (разработка):
```bash
# 1. Настройка
cd scripts/instagram_sync
cp .env.sync.example .env.sync
# Заполни CMS_BASE_URL и IG_TARGET_PROFILE

# 2. Установка
pip install -r requirements.txt

# 3. Тестовый прогон без последствий
cd ../..  # обратно в корень проекта
python -m scripts.instagram_sync.entrypoint --shortcode C_ТЕСТ --dry-run

# 4. Реальный прогон одного поста
python -m scripts.instagram_sync.entrypoint --shortcode C_РЕАЛЬНЫЙ_КОД

# 5. Ежедневная синхронизация
python -m scripts.instagram_sync.entrypoint --mode daily --profile имя_аккаунта

# 6. Перепрогнать упавшие посты из DLQ
python -m scripts.instagram_sync.entrypoint --retry-dlq --profile имя_аккаунта
```

### На сервере (Docker):
```bash
# Разовый запуск
docker compose --profile sync run --rm ig-sync python -m entrypoint --mode daily --profile djfriend

# Перепрогон DLQ
docker compose --profile sync run --rm ig-sync python -m entrypoint --retry-dlq --profile djfriend

# Или через cron (добавить в crontab):
# 0 3 * * * cd /path/to/mindra && docker compose --profile sync run --rm ig-sync python -m entrypoint --mode daily --profile djfriend
```

---

## 18. Обнаруженная Архитектурная Проблема (2026-04-17)
В ходе аудита макетов Party-секции (Pencil.dev) выявлено, что логика маппинга (`mapper.py`) чрезмерно упрощена и обрезает контентную вариативность.

### Проблема
Парсер извлекает `title` (первая строка) и `body` (весь остальной текст), записывая `body` как монолитную строку в БД (`Block.text`). Эта архитектура не покрывает дизайн-макеты:
- Блоки `media-left` и `media-right` в дизайне содержат `Tag`, `Title`, `Body` и `CTA`-кнопки.
- Из-за монолитного сохранения базы, фронтенд не получает этих структурных элементов. Пришлось бы удалять красивый дизайн ради жесткого кода.

### Планируемое решение (см. задачу 2026-04-17-party-backend-fixes.md)
Не вырубать дизайн, а "поумнить" парсер. Нужно добавить логику выделения JSON-структур (либо через паттерн-матчинг контента инсты, либо через легкую LLM-обертку в Python-пайплайне), чтобы в базу записывался JSON: `{"tag": "...", "title": "...", "body": "...", "cta": "..."}`.


