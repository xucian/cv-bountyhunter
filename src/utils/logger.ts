import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `codebounty-${new Date().toISOString().split('T')[0]}.log`);

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Open file handle for appending
let logStream: fs.WriteStream | null = null;

function getLogStream(): fs.WriteStream {
  if (!logStream) {
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    // Handle stream errors to prevent silent failures
    logStream.on('error', (err) => {
      process.stderr.write(`[Logger] Stream error: ${err.message}\n`);
    });
  }
  return logStream;
}

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
  const stream = getLogStream();
  stream.write(line);
  // Ensure critical logs are flushed immediately
  if (level === 'ERROR' || level === 'WARN') {
    stream.cork();
    process.nextTick(() => stream.uncork());
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
  return new Promise((resolve) => {
    if (logStream) {
      logStream.once('drain', resolve);
      // If nothing is buffered, drain won't fire, so resolve immediately
      if (!logStream.writableNeedDrain) {
        resolve();
      }
    } else {
      resolve();
    }
  });
}

export function closeLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
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
