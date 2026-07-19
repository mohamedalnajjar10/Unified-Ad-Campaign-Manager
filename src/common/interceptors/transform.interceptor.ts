import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T> | T> {
    return next.handle().pipe(
      map(data => {
        if (data === null || data === undefined) {
          return { success: true } as SuccessResponse<T>;
        }

        if (data instanceof Buffer) {
          return data;
        }

        if (typeof data !== 'object') {
          return { success: true, data };
        }

        if ('success' in data) {
          return data;
        }

        if ('data' in data && 'meta' in data) {
          return { success: true, ...data };
        }

        const keys = Object.keys(data);

        if (keys.length === 1 && 'message' in data) {
          return { success: true, message: data.message };
        }

        return { success: true, data };
      }),
    );
  }
}
