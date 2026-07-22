import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Shared upload helpers: path resolution (with traversal protection),
 * MIME mapping, and timestamped filename generation.
 *
 * Used by:
 *  - app/uploads/[...path]/route.ts  (catch-all static serving for standalone)
 *  - app/api/upload/route.ts          (write, filename generation)
 *  - app/api/sync/upload/route.ts     (write, filename generation)
 *  - app/party-prompts/api/upload/route.ts (write, filename generation)
 */

// Base uploads directory: <cwd>/public/uploads
export const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Whitelist of extensions the catch-all route is allowed to serve.
// Matches the upload validation set plus mp4 (party-prompts reels).
export const SERVE_ALLOWED_EXTENSIONS: Set<string> = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif', '.mp4',
]);

// Extension -> Content-Type map for serving.
export const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
};

export type ResolveResult =
  | { ok: true; fullPath: string }
  | { ok: false; status: number; error: string };

/**
 * Resolve URL path segments to an absolute filesystem path inside UPLOADS_DIR.
 * Protects against path traversal (`..`) by resolving and verifying the
 * result stays within the uploads root.
 */
export function resolveUploadPath(segments: string[]): ResolveResult {
  // Reject empty requests and segments containing a literal `..` segment
  // (defence in depth — path.resolve below already normalises these).
  if (segments.length === 0) {
    return { ok: false, status: 400, error: 'Empty path' };
  }
  if (segments.some((seg) => seg === '..')) {
    return { ok: false, status: 403, error: 'Traversal denied' };
  }

  const fullPath = path.resolve(UPLOADS_DIR, ...segments);
  const root = UPLOADS_DIR + path.sep;
  if (fullPath !== UPLOADS_DIR && !fullPath.startsWith(root)) {
    return { ok: false, status: 403, error: 'Traversal denied' };
  }

  return { ok: true, fullPath };
}

/**
 * Generate a timestamped filename: `${YYYYMMDDHHmmss}-${uniquePart}${ext}`.
 * Lexicographically sortable, human-readable, and carries a batch index
 * (passed as `uniquePart` by party-prompts) or a short uuid (single uploads).
 *
 * On collision (same second + same uniquePart — only possible with parallel
 * uploads), appends a short uuid suffix before the extension.
 *
 * `subdir` (e.g. 'party-prompts') makes the collision check look in the
 * correct nested directory rather than the uploads root.
 */
export function generateTimestampedFilename(
  ext: string,
  uniquePart: string,
  subdir?: string,
): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  let filename = `${ts}-${uniquePart}${ext}`;
  const dir = subdir ? path.join(UPLOADS_DIR, subdir) : UPLOADS_DIR;

  if (fs.existsSync(path.join(dir, filename))) {
    const suffix = randomUUID().slice(0, 8);
    filename = `${ts}-${uniquePart}-${suffix}${ext}`;
  }

  return filename;
}
