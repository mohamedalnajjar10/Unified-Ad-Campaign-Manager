import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface SuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (data === null || data === undefined) {
          return { success: true };
        }

        if (data instanceof Buffer) {
          return data;
        }

        if (typeof data !== 'object') {
          return { success: true, data } as SuccessResponse<T>;
        }

        const obj = data as Record<string, unknown>;
        const keys = Object.keys(obj);

        if (keys.length === 1 && 'message' in obj) {
          return { success: true, message: obj.message as string };
        }

        return { success: true, data } as SuccessResponse<T>;
      }),
    );
  }
}
