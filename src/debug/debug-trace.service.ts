import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface TracePayload {
  request_id?: string;
  tenant_id?: string;
  user_id?: string;
  booking_id?: string;
  assignment_id?: string;
  transfer_id?: string;
  invoice_id?: string;
  step?: string;
  message?: string;
  context?: Record<string, any>;
  error?: Error | any;
}

// Fields to redact from context before logging
const REDACTED_KEYS = new Set([
  'password', 'password_hash', 'otp_code', 'reset_token',
  'stripe_secret_key', 'stripe_publishable_key', 'stripe_webhook_secret',
  'authorization', 'card', 'payment_method', 'token', 'accessToken',
  'secret', 'api_key', 'private_key',
]);

function redact(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => redact(v, depth + 1));
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redact(val, depth + 1);
    }
  }
  return result;
}

@Injectable()
export class DebugTraceService {
  private readonly logger = new Logger('Trace');

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  traceInfo(eventName: string, payload: TracePayload, persist = false) {
    this._log('info', eventName, payload, persist);
  }

  traceWarn(eventName: string, payload: TracePayload, persist = false) {
    this._log('warn', eventName, payload, persist);
  }

  traceError(eventName: string, payload: TracePayload, persist = true) {
    this._log('error', eventName, payload, persist);
  }

  private _log(
    level: 'info' | 'warn' | 'error',
    eventName: string,
    payload: TracePayload,
    persist: boolean,
  ) {
    const safeContext = payload.context ? redact(payload.context) : undefined;
    const errorInfo = payload.error
      ? {
          error_name: payload.error?.name ?? payload.error?.constructor?.name ?? 'Error',
          error_message: payload.error?.message ?? String(payload.error),
          stack: payload.error?.stack?.split('\n').slice(0, 5).join(' | '),
        }
      : undefined;

    const entry = {
      event: eventName,
      level,
      request_id: payload.request_id,
      tenant_id: payload.tenant_id,
      user_id: payload.user_id,
      booking_id: payload.booking_id,
      step: payload.step,
      message: payload.message ?? eventName,
      ...(safeContext && { context: safeContext }),
      ...(errorInfo && { error: errorInfo }),
    };

    const msg = JSON.stringify(entry);
    if (level === 'error') this.logger.error(msg);
    else if (level === 'warn') this.logger.warn(msg);
    else this.logger.log(msg);

    if (persist || level === 'error') {
      this._persist(level, eventName, payload, safeContext, errorInfo).catch(() => {});
    }
  }

  private async _persist(
    level: string,
    eventName: string,
    payload: TracePayload,
    safeContext: any,
    errorInfo: any,
  ) {
    try {
      await this.db.query(
        `INSERT INTO public.system_debug_logs
           (level, source, request_id, tenant_id, user_id, booking_id,
            assignment_id, transfer_id, invoice_id, event_name, message, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          level,
          'backend',
          payload.request_id ?? null,
          payload.tenant_id ?? null,
          payload.user_id ?? null,
          payload.booking_id ?? null,
          payload.assignment_id ?? null,
          payload.transfer_id ?? null,
          payload.invoice_id ?? null,
          eventName,
          payload.message ?? eventName,
          JSON.stringify({ step: payload.step, context: safeContext, error: errorInfo }),
        ],
      );
    } catch {
      // Never throw from trace service
    }
  }
}
