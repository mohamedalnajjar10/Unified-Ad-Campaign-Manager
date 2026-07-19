import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2000':
        httpStatus = HttpStatus.BAD_REQUEST;
        message = 'Value too long for column';
        break;
      case 'P2002':
        httpStatus = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        break;
      case 'P2003':
        httpStatus = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint failed';
        break;
      case 'P2014':
        httpStatus = HttpStatus.BAD_REQUEST;
        message = 'Constraint violation';
        break;
      case 'P2025':
        httpStatus = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
        break;
    }

    this.logger.warn(`Prisma error [${exception.code}]: ${exception.message}`);

    const responseBody = {
      success: false,
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
