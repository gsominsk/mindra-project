/**
 * Beautiful styled console logger for debugging and transparency.
 * Includes precise time, namespace tags, and custom colors.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'success';

const COLORS: Record<string, { bg: string; text: string }> = {
  SYSTEM: { bg: '#475569', text: '#f8fafc' },
  DASHBOARD: { bg: '#0891b2', text: '#ecfeff' },
  UPLOAD: { bg: '#16a34a', text: '#f0fdf4' },
  OPENROUTER_API: { bg: '#4f46e5', text: '#e0e7ff' },
  SPEECH_REC: { bg: '#ea580c', text: '#fff7ed' },
  STATE: { bg: '#db2777', text: '#fdf2f8' },
  DEFAULT: { bg: '#2563eb', text: '#eff6ff' }
};

class Logger {
  private formatTime(): string {
    const now = new Date();
    const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  }

  private getColors(namespace: string) {
    return COLORS[namespace] || COLORS.DEFAULT;
  }

  public info(namespace: string, message: string, extra?: unknown) {
    this.print(namespace, message, 'info', extra);
  }

  public success(namespace: string, message: string, extra?: unknown) {
    this.print(namespace, message, 'success', extra);
  }

  public warn(namespace: string, message: string, extra?: unknown) {
    this.print(namespace, message, 'warn', extra);
  }

  public error(namespace: string, message: string, extra?: unknown) {
    this.print(namespace, message, 'error', extra);
  }

  public async measure<T>(namespace: string, label: string, task: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    this.info(namespace, `Starting process: ${label}...`);
    try {
      const result = await task();
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      this.success(namespace, `Completed process: ${label} (took ${duration}s)`);
      return result;
    } catch (err) {
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      this.error(namespace, `Failed process: ${label} (failed after ${duration}s)`, err);
      throw err;
    }
  }

  private print(namespace: string, message: string, level: LogLevel, extra?: unknown) {
    const timeStr = this.formatTime();
    const colors = this.getColors(namespace);
    
    let levelSymbol = 'ℹ️';
    let msgColor = 'color: #e5e5e5';
    
    if (level === 'success') { levelSymbol = '✅'; msgColor = 'color: #34d399'; }
    else if (level === 'warn') { levelSymbol = '⚠️'; msgColor = 'color: #fbbf24'; }
    else if (level === 'error') { levelSymbol = '❌'; msgColor = 'color: #f87171; font-weight: bold'; }

    const badgeStyle = `background: ${colors.bg}; color: ${colors.text}; font-weight: bold; padding: 2px 6px; border-radius: 4px;`;
    const timeStyle = 'color: #737373; font-family: monospace; font-size: 11px;';
    const textStyle = `${msgColor}; font-family: system-ui, sans-serif;`;

    if (extra !== undefined) {
      console.log(`%c[${timeStr}] %c${namespace} %c${levelSymbol} ${message}`, timeStyle, badgeStyle, textStyle, extra);
    } else {
      console.log(`%c[${timeStr}] %c${namespace} %c${levelSymbol} ${message}`, timeStyle, badgeStyle, textStyle);
    }

    // Forward log to server in background if in browser
    if (typeof window !== 'undefined') {
      try {
        fetch('/party-prompts/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            namespace,
            msg: message,
            data: extra !== undefined ? extra : null
          })
        }).catch(() => {});
      } catch (_e) {
        // Ignore network errors on log forwarding
      }
    }
  }
}

export const logger = new Logger();
