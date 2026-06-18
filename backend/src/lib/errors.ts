/**
 * Typed exception classes with HTTP-status mapping.
 *
 * Service + route code throws these; `route-error-handler.ts` catches them and
 * maps to a uniform `{ error: string }` response at the right status. This is
 * what lets routes drop per-handler `try/catch → c.json(...)` boilerplate — and
 * what the `no-restricted-syntax` lint selector enforces by banning `new Error()`.
 */

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

export class AppError extends Error {
  readonly status: HttpStatus;

  constructor(message: string, status: HttpStatus = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

/** 400 — client sent invalid/malformed input. */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

/** 404 — requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = 'not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/** 409 — action conflicts with current resource state. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/** 422 — request is well-formed but semantically invalid. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'ValidationError';
  }
}

/** 503 — a dependency is not ready. */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'service unavailable') {
    super(message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/** Best-effort string from a caught `unknown`. */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e !== null && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return String(e);
}
