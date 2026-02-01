// ============================================================================
// STRUCTURED LOGGING FOR SCHEDULING
// lib/scheduling/logger.ts
// ============================================================================
//
// Provides structured JSON logging for all scheduling operations.
// In production, these logs can be ingested by logging services
// (Datadog, Sentry, etc.) for monitoring and alerting.
//
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  requestId?: string;
  data?: Record<string, any>;
  error?: string;
  duration?: number;
}

/**
 * Emit a structured log entry as JSON.
 */
export function log(
  level: LogLevel,
  service: string,
  event: string,
  data?: Record<string, any>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    ...data,
  };

  const message = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(message);
      }
      break;
    default:
      console.log(message);
  }
}

/**
 * Create a scoped logger for a specific service.
 */
export function createLogger(service: string) {
  return {
    info: (event: string, data?: Record<string, any>) => log('info', service, event, data),
    warn: (event: string, data?: Record<string, any>) => log('warn', service, event, data),
    error: (event: string, data?: Record<string, any>) => log('error', service, event, data),
    debug: (event: string, data?: Record<string, any>) => log('debug', service, event, data),
  };
}
