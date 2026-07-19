import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let errors: any;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else {
      const resp = exceptionResponse as Record<string, any>;
      if (Array.isArray(resp.message)) {
        message = 'Validation failed';
        errors = resp.message;
      } else {
        message = resp.message || exception.message;
      }
    }

    const responseBody: Record<string, any> = {
      success: false,
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    if (errors) {
      responseBody.errors = errors;
    }

    this.logger.warn(`${httpStatus} ${message}`);

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
