import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Generate or propagate request ID
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    // Extract context safely
    const tenantId =
      req.tenant?.id ?? req.user?.tenant_id ?? req.customer?.tenant_id ?? undefined;
    const userId = req.user?.sub ?? req.customer?.sub ?? undefined;
    const method = req.method;
    const url = req.url?.split('?')[0]; // strip query params (may contain tokens)

    const start = Date.now();

    this.logger.log(
      JSON.stringify({
        event: 'REQUEST_START',
        request_id: requestId,
        method,
        url,
        tenant_id: tenantId,
        user_id: userId,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              event: 'REQUEST_END',
              request_id: requestId,
              method,
              url,
              status_code: res.statusCode,
              duration_ms: Date.now() - start,
            }),
          );
        },
        error: (err) => {
          this.logger.error(
            JSON.stringify({
              event: 'REQUEST_ERROR',
              request_id: requestId,
              method,
              url,
              tenant_id: tenantId,
              user_id: userId,
              status_code: err?.status ?? 500,
              error_name: err?.name ?? 'Error',
              error_message: err?.message,
              duration_ms: Date.now() - start,
            }),
          );
        },
      }),
    );
  }
}
