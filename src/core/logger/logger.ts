/**
 * Levelled, subsystem-tagged logger. TRACE/DEBUG are dropped in production builds.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const ORDER: Readonly<Record<LogLevel, number>> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };
const MIN_LEVEL: LogLevel = import.meta.env.PROD ? 'info' : 'debug';

export interface ILogger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export function createLogger(subsystem: string): ILogger {
  const log = (level: LogLevel, msg: string, data?: unknown): void => {
    if (ORDER[level] < ORDER[MIN_LEVEL]) return;
    const line = `[${subsystem}] ${msg}`;
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data === undefined) sink(line);
    else sink(line, data);
  };
  return {
    debug: (m, d) => log('debug', m, d),
    info: (m, d) => log('info', m, d),
    warn: (m, d) => log('warn', m, d),
    error: (m, d) => log('error', m, d),
  };
}
