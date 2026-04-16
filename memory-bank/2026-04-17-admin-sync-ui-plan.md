# Разработка UI для модерации Instagram-постов в Админке

> **Статус:** Technical Implementation Plan  
> **Дата:** 2026-04-17

Этот файл описывает необходимые изменения для того, чтобы сырые синхронизированные из Instagram посты отображались в Админке в категории черновиков, а администратор мог назначать им категорию (поддомен), включать видимость и публиковать.

## 1. Концепция

Текущая база данных `Prisma` имеет поле `isPublished` (Boolean), но в `PageState` (frontend тип) и в `PageEditor` этот флаг никак не фигурирует. Также по умолчанию Python-скрипт создает посты с типом `"uncategorized"`.
Чтобы админка могла их корректно "переварить", нам нужно:
1. Добавить `uncategorized` в глобальные типы `EventType`.
2. Передать оригинальную дату инстаграм-поста в БД (`createdAt` в Prisma).
3. Оформить вкладку "Drafts" с выводом превью текста подписи поста и реальной даты.
4. Добавить **"Быстрые действия" (Quick Actions)** прямо в Дашборде на карточках черновиков (в один клик изменить тип и опубликовать).
5. Продублировать управление статусом публикации в самом `PageEditor`.

---

## 2. Предлагаемые изменения (Диффы)

### Шаг 1. Передача даты поста из Instagram
Python скрипт уже забирает `post.date_utc`. Нам нужно передавать его в маппинге и сохранять.
**[MODIFY] `scripts/instagram_sync/mapper.py` / `models.py` / `uploader.py`**
- Добавить поле `created_at` (строка ISO) в JSON payload. 

**[MODIFY] `app/api/admin/pages/route.ts` (POST)**
```diff
-        const page = await prisma.eventPage.create({
+        const { title, eventType, blocks, igShortcode, igSourceType, igProfileName, createdAt } = body;
+        const page = await prisma.eventPage.create({
             data: {
+                createdAt: createdAt ? new Date(createdAt) : new Date(),
```

### Шаг 2. Расширение типов
**[MODIFY] `app/admin/types.ts`**
```diff
-export type EventType = 'business' | 'wedding' | 'party';
+export type EventType = 'business' | 'wedding' | 'party' | 'uncategorized';

 export interface PageState {
   title: string;
   eventType: EventType;
+  isPublished: boolean;
   blocks: PageBlock[];
 }
```

### Шаг 3. Отображение черновиков в Дашборде и API-список
Чтобы дашборд знал о публикации и тексте, отдадим новые поля через API.

**[MODIFY] `app/api/admin/pages/list/route.ts`**
Избавимся от жесткой фильтрации `mediaUrl: { not: null }`, чтобы из базы также вытягивался текст для превью:
```diff
                 id: true,
                 title: true,
                 slug: true,
                 createdAt: true,
                 eventType: true,
+                isPublished: true,
                 blocks: {
-                    where: {
-                        mediaUrl: { not: null },
-                        mediaType: { startsWith: 'image' }
-                    },
-                    take: 1,
                     select: {
-                        mediaUrl: true
+                        mediaUrl: true,
+                        text: true
                     }
                 }
```

**[MODIFY] `app/admin/dashboard/page.tsx`**
Добавим поля в интерфейс Дашборда:
```diff
 interface DashboardPage {
     id: string;
     title: string;
     slug: string;
     createdAt: string;
-    eventType: 'business' | 'wedding' | 'party';
-    blocks: { mediaUrl: string }[];
+    eventType: 'business' | 'wedding' | 'party' | 'uncategorized';
+    isPublished: boolean;
+    blocks: { mediaUrl: string | null, text: string | null }[];
 }
```

И обновим фильтрацию и UI кнопок:
```diff
-    const [filter, setFilter] = useState<'all' | 'business' | 'wedding' | 'party'>('all');
+    const [filter, setFilter] = useState<'all' | 'business' | 'wedding' | 'party' | 'drafts'>('all');

     const filteredPages = filter === 'all'
         ? pages
+        : filter === 'drafts'
+        ? pages.filter(p => !p.isPublished || p.eventType === 'uncategorized')
         : pages.filter(p => p.eventType === filter);
```
В самой карточке:
- Если `page.eventType === 'uncategorized'`, вместо обычных ссылок "View Live", мы нарисуем кнопки `[Свадьба]`, `[Деловой]`, `[Вечеринка]`, которые отправляют безопасный `PATCH` запрос!
- Preview текста: `const previewText = page.blocks.find(b => b.text)?.text?.substring(0, 80) + '...'`

### Шаг 4. Редактор `PageEditor`
Добавляем кнопку "Publish" / "Unpublish", если вы всё же зашли ВНУТРЬ карточки.

**[MODIFY] `app/admin/components/PageEditor.tsx`**
Добавляем Toggle-кнопку рядом с кнопкой Save (Header):
```diff
+                    <button
+                        onClick={() => setState(p => ({ ...p, isPublished: !p.isPublished }))}
+                        className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${state.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
+                    >
+                        {state.isPublished ? 'Published' : 'Draft'}
+                    </button>
```

### Шаг 5. Обновление API сохранения
**[MODIFY] `app/api/admin/pages/[id]/route.ts`**
Обновим PUT запрос:
```diff
         const body = await req.json();
-        const { title, eventType, blocks } = body;
+        const { title, eventType, isPublished, blocks } = body;

         //...
             data: {
+                isPublished,
```
Добавим новый метод `PATCH` для безопасного "Быстрого действия" из Дашборда:
```typescript
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { eventType, isPublished } = await request.json();

        const page = await prisma.eventPage.update({
            where: { id },
            data: { eventType, isPublished },
        });

        return NextResponse.json(page);
    } catch (error) {
        return NextResponse.json({ error: "Failed to quick-update page" }, { status: 500 });
    }
}
```

---

*Авторизовано. Смена URL (slug) при изменении названия в угоду SEO и стабильности решено не производить.*
