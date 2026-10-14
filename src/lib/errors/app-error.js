/**
 * Custom Application Errors
 * Distinguishes between client errors (4xx), transient retryable errors, and permanent terminal failures.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, isTransient = false) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isTransient = isTransient;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, false);
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, false);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, false);
  }
}

export class TransientError extends AppError {
  constructor(message) {
    super(message, 503, true);
  }
}

export class PoisonPillError extends AppError {
  constructor(message) {
    super(message, 500, false);
  }
}
