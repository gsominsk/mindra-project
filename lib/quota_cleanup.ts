import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { appendServerLog } from './logger_server';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'party-prompts');
const MAX_UPLOADS_BYTES = 800 * 1024 * 1024; // 800 MB Limit

let isCleaningQuota = false;

export function getUploadsSize(): number {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return 0;
    const files = fs.readdirSync(UPLOADS_DIR);
    let total = 0;
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          total += stats.size;
        }
      } catch (_e) {
        // Ignore stat errors
      }
    }
    return total;
  } catch (err) {
    console.error('[QUOTA_CLEANUP] Error calculating directory size:', err);
    return 0;
  }
}

export async function checkAndCleanupUploadQuota(maxBytes: number = MAX_UPLOADS_BYTES): Promise<{ freedBytes: number; deletedListsCount: number }> {
  if (isCleaningQuota) {
    return { freedBytes: 0, deletedListsCount: 0 };
  }

  isCleaningQuota = true;
  let freedBytes = 0;
  let deletedListsCount = 0;

  try {
    let currentSize = getUploadsSize();

    if (currentSize <= maxBytes) {
      return { freedBytes: 0, deletedListsCount: 0 };
    }

    appendServerLog({
      level: 'warn',
      namespace: 'QUOTA_CLEANUP',
      msg: `Upload quota exceeded: ${(currentSize / (1024 * 1024)).toFixed(2)} MB / ${(maxBytes / (1024 * 1024)).toFixed(2)} MB limit. Initiating cleanup...`,
    });

    while (currentSize > maxBytes) {
      // Find oldest list from database
      const oldestList = await prisma.promptList.findFirst({
        orderBy: { createdAt: 'asc' },
        include: {
          attachments: {
            include: {
              history: true,
            },
          },
        },
      });

      // Stop if no lists left
      if (!oldestList) {
        appendServerLog({
          level: 'info',
          namespace: 'QUOTA_CLEANUP',
          msg: 'No prompt lists found in database to delete for quota cleanup.',
        });
        break;
      }

      // Collect all image URLs associated with this list
      const filesToDelete = new Set<string>();

      for (const attachment of oldestList.attachments) {
        if (attachment.imageUrl && attachment.imageUrl.startsWith('/uploads/party-prompts/')) {
          filesToDelete.add(path.basename(attachment.imageUrl));
        }
        for (const historyItem of attachment.history) {
          if (historyItem.imageUrl && historyItem.imageUrl.startsWith('/uploads/party-prompts/')) {
            filesToDelete.add(path.basename(historyItem.imageUrl));
          }
        }
      }

      // Delete physical image files from disk
      for (const filename of filesToDelete) {
        const fullPath = path.join(UPLOADS_DIR, filename);
        try {
          if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            freedBytes += stats.size;
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          // ENOENT handling: ignore if missing
          console.error(`[QUOTA_CLEANUP] Failed to delete file ${fullPath}:`, err);
        }
      }

      // Delete oldest list from SQLite DB (Cascade deletes attachments and history)
      await prisma.promptList.delete({
        where: { id: oldestList.id },
      });

      deletedListsCount++;
      currentSize = getUploadsSize();
    }

    appendServerLog({
      level: 'success',
      namespace: 'QUOTA_CLEANUP',
      msg: `Quota cleanup completed. Freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB. Deleted ${deletedListsCount} oldest prompt lists.`,
      data: { freedBytes, deletedListsCount }
    });

  } catch (err) {
    appendServerLog({
      level: 'error',
      namespace: 'QUOTA_CLEANUP',
      msg: 'Error during quota cleanup execution',
      data: err
    });
  } finally {
    isCleaningQuota = false;
  }

  return { freedBytes, deletedListsCount };
}
