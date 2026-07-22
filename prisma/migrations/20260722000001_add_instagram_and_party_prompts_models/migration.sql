-- AlterTable
ALTER TABLE "EventPage" ADD COLUMN "igProfileName" TEXT;
ALTER TABLE "EventPage" ADD COLUMN "igShortcode" TEXT;
ALTER TABLE "EventPage" ADD COLUMN "igSourceType" TEXT;
ALTER TABLE "EventPage" ADD COLUMN "igSyncedAt" DATETIME;

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "postsFound" INTEGER NOT NULL DEFAULT 0,
    "postsCreated" INTEGER NOT NULL DEFAULT 0,
    "postsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "message" TEXT,
    "eventType" TEXT,
    "date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RawInstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortcode" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "rawCaption" TEXT NOT NULL,
    "mediaUrls" TEXT NOT NULL,
    "mediaTypes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nextRetryAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PromptList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromptAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "isUploaded" BOOLEAN NOT NULL DEFAULT false,
    "referenceUrl" TEXT,
    "referenceUrls" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "listId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromptAttachment_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PromptList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptAttachmentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageUrl" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "isUploaded" BOOLEAN NOT NULL DEFAULT false,
    "referenceUrl" TEXT,
    "referenceUrls" TEXT,
    "attachmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptAttachmentHistory_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "PromptAttachment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "openRouterKey" TEXT NOT NULL DEFAULT '',
    "timerDuration" INTEGER NOT NULL DEFAULT 5,
    "autoSendTranscription" BOOLEAN NOT NULL DEFAULT false,
    "hideTextPrompt" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RawInstagramPost_shortcode_key" ON "RawInstagramPost"("shortcode");

-- CreateIndex
CREATE UNIQUE INDEX "EventPage_igShortcode_key" ON "EventPage"("igShortcode");
