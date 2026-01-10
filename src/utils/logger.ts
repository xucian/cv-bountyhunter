import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `codebounty-${new Date().toISOString().split('T')[0]}.log`);

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Note: We use synchronous file writes (appendFileSync) for reliability
// This ensures all logs are written even if the process crashes

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(level: string, message: string, ...args: any[]): void {
  const formatted = args.length > 0
    ? `${message} ${args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      }).join(' ')}`
    : message;

  const line = `[${formatTimestamp()}] [${level}] ${formatted}\n`;

  // Use synchronous write to ensure logs are written immediately
  // This is more reliable for debugging than async streams
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    process.stderr.write(`[Logger] Write error: ${err}\n`);
  }
}

// Store original console methods (write to stderr to avoid Ink conflicts)
const writeStderr = (msg: string) => process.stderr.write(msg + '\n');

export const logger = {
  log: (message: string, ...args: any[]) => {
    writeToFile('INFO', message, ...args);
  },

  error: (message: string, ...args: any[]) => {
    writeToFile('ERROR', message, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    writeToFile('WARN', message, ...args);
  },

  info: (message: string, ...args: any[]) => {
    writeToFile('INFO', message, ...args);
  },
};

/**
 * Patch global console to also write to log file.
 * Call this once at app startup.
 */
export function enableFileLogging(): void {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function(message?: any, ...args: any[]) {
    writeToFile('INFO', String(message ?? ''), ...args);
    // Don't call original - Ink handles display
  };

  console.error = function(message?: any, ...args: any[]) {
    writeToFile('ERROR', String(message ?? ''), ...args);
    // Write errors to stderr so they're visible
    writeStderr(`[ERROR] ${message} ${args.join(' ')}`);
  };

  console.warn = function(message?: any, ...args: any[]) {
    writeToFile('WARN', String(message ?? ''), ...args);
  };

  // Log startup
  writeToFile('INFO', `[Logger] Started - logging to ${LOG_FILE}`);
}

export function flushLogger(): Promise<void> {
  // With synchronous writes, there's nothing to flush
  return Promise.resolve();
}

export function closeLogger(): void {
  // With synchronous writes, there's nothing to close
}

/**
 * Convenience function for structured logging
 * Usage: log('info', 'Reviewer', 'Message here')
 */
export function log(level: 'info' | 'warn' | 'error' | 'debug', context: string, message: string): void {
  const formatted = `[${context}] ${message}`;
  switch (level) {
    case 'error':
      logger.error(formatted);
      break;
    case 'warn':
      logger.warn(formatted);
      break;
    case 'debug':
    case 'info':
    default:
      logger.info(formatted);
      break;
  }
}

export default logger;
