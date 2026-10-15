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
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, false);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, false);
    this.name = "ConflictError";
  }
}

export class TransientError extends AppError {
  constructor(message) {
    super(message, 503, true);
    this.name = "TransientError";
  }
}

export class PoisonPillError extends AppError {
  constructor(message) {
    super(message, 500, false);
    this.name = "PoisonPillError";
  }
}
