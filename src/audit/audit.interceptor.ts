import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeForAudit } from '../common/sanitize';

/**
 * /admin/** 경로로 들어오는 모든 요청(=관리자 행동)을 자동으로 AuditLog에 남긴다.
 * "누가 언제 어떤 게임/쿠폰/보너스/난이도를 건드렸는지" 를 나중에 추적할 수 있게 해준다.
 * 감사로그 저장 자체가 실패해도 실제 API 응답에는 영향을 주지 않도록 예외를 삼킨다.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const path: string = req.originalUrl ?? req.url ?? '';
    const user = req.user as { sub?: string } | undefined;

    const isAdminRoute = path.startsWith('/admin');
    if (!isAdminRoute || !user?.sub) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.prisma.auditLog
          .create({
            data: {
              adminId: user.sub as string,
              method: req.method,
              path,
              body: sanitizeForAudit(req.body) as any,
            },
          })
          .catch((err: unknown) => this.logger.error('감사로그 저장 실패', err as Error));
      }),
    );
  }
}
