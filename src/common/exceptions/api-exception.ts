import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Spec-aligned error envelope: `{ error: { code, message, details? } }`.
 * Throw this from services / guards / controllers to short-circuit a
 * request with a stable code, message, and optional details payload.
 */
export class ApiException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    const body: ApiErrorBody = { error: { code, message, details } };
    super(body, status);
  }

  static notFound(resource: string, details?: unknown) {
    return new ApiException(
      'not_found',
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      details,
    );
  }

  static forbidden(
    code = 'forbidden',
    message = 'Forbidden',
    details?: unknown,
  ) {
    return new ApiException(code, message, HttpStatus.FORBIDDEN, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiException('unauthorized', message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new ApiException(code, message, HttpStatus.CONFLICT, details);
  }

  static validation(message = 'Invalid request', details?: unknown) {
    return new ApiException(
      'validation_failed',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }

  static businessRule(code: string, message: string, details?: unknown) {
    return new ApiException(
      code,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }

  static insufficientBalance() {
    return new ApiException(
      'insufficient_balance',
      'Wallet balance is insufficient',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
