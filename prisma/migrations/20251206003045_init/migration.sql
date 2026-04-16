/*
  Warnings:

  - You are about to drop the column `published` on the `EventPage` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EventPage" ("createdAt", "eventType", "id", "slug", "title", "updatedAt") SELECT "createdAt", "eventType", "id", "slug", "title", "updatedAt" FROM "EventPage";
DROP TABLE "EventPage";
ALTER TABLE "new_EventPage" RENAME TO "EventPage";
CREATE UNIQUE INDEX "EventPage_slug_key" ON "EventPage"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
