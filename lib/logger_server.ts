import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs', 'party_prompts');
const MAX_LOG_BYTES = 30 * 1024 * 1024; // 30 MB

let currentLogFile: string | null = null;

function formatTimestamp(): string {
  const now = new Date();
  const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${dateStr}_${timeStr}`;
}

function ensureLogDir(): string {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!currentLogFile) {
    currentLogFile = path.join(LOG_DIR, `party_prompts_${formatTimestamp()}.jsonl`);
  }
  return currentLogFile;
}

export function rotatePartyLogs(maxBytes: number = MAX_LOG_BYTES): void {
  try {
    if (!fs.existsSync(LOG_DIR)) return;

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('party_prompts_') && f.endsWith('.jsonl'))
      .map(f => {
        const filePath = path.join(LOG_DIR, f);
        const stats = fs.statSync(filePath);
        return { path: filePath, size: stats.size, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    let totalSize = files.reduce((acc, f) => acc + f.size, 0);

    if (totalSize > maxBytes) {
      // Remove oldest files until size is below limit
      const oldestFiles = [...files].reverse(); // Oldest first
      for (const file of oldestFiles) {
        if (totalSize <= maxBytes) break;
        // Don't delete the active log file if it's the only one left
        if (file.path === currentLogFile && files.length === 1) break;
        
        try {
          fs.unlinkSync(file.path);
          totalSize -= file.size;
          console.log(`[LOGGER_ROTATION] Removed old log file: ${path.basename(file.path)}`);
        } catch (err) {
          console.error(`[LOGGER_ROTATION] Error deleting log file ${file.path}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[LOGGER_ROTATION] Error rotating log files:', err);
  }
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'success';
  namespace: string;
  msg: string;
  data?: unknown;
}

export function appendServerLog(entry: LogEntry): void {
  try {
    const filePath = ensureLogDir();
    const payload = {
      ts: new Date().toISOString(),
      level: entry.level.toUpperCase(),
      namespace: entry.namespace,
      msg: entry.msg,
      ...(entry.data !== undefined ? { data: entry.data } : {})
    };
    
    fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf-8');
    rotatePartyLogs();
  } catch (err) {
    console.error('[LOGGER_SERVER] Error writing log:', err);
  }
}
