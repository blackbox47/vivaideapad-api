import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ZodError } from 'zod';

import { ApiException } from '../exceptions/api-exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof ApiException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof ZodError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        error: {
          code: 'validation_failed',
          message: 'Invalid request',
          details: exception.flatten(),
        },
      });
      return;
    }

    if (exception instanceof QueryFailedError) {
      const err = exception as QueryFailedError & {
        code?: string;
        sqlMessage?: string;
      };
      const code = err.code;
      let apiCode = 'db_error';
      let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
      if (code === 'ER_DUP_ENTRY') {
        apiCode = 'duplicate';
        status = HttpStatus.CONFLICT;
      } else if (code === 'ER_NO_REFERENCED_ROW_2') {
        apiCode = 'fk_violation';
        status = HttpStatus.CONFLICT;
      } else if (code === 'ER_ROW_IS_REFERENCED_2') {
        apiCode = 'fk_in_use';
        status = HttpStatus.CONFLICT;
      }
      this.logger.error(
        `DB error on ${req.method} ${req.url}: code=${code} message=${err.sqlMessage ?? err.message}`,
      );
      res.status(status).json({
        error: {
          code: apiCode,
          message: err.sqlMessage ?? err.message,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const message =
        typeof r === 'object' && r !== null && 'message' in r
          ? String(r.message)
          : exception.message;
      res.status(status).json({
        error: {
          code: statusToCode(status),
          message,
          details: typeof r === 'object' ? r : undefined,
        },
      });
      return;
    }

    this.logger.error(
      `Unhandled error on ${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'internal_error', message: 'Internal server error' },
    });
  }
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation_failed';
    case 429:
      return 'rate_limited';
    default:
      return 'error';
  }
}
