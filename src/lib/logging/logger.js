/**
 * Structured JSON Logger for AWS Lambda Functions
 * Ensures all log entries are formatted with consistent metadata for CloudWatch Logs Insights.
 */

export class Logger {
  constructor(serviceName, defaultContext = {}) {
    this.serviceName = serviceName;
    this.defaultContext = defaultContext;
  }

  setContext(context) {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  formatEntry(level, message, extra = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...this.defaultContext,
      ...extra
    });
  }

  info(message, extra = {}) {
    console.log(this.formatEntry("INFO", message, extra));
  }

  warn(message, extra = {}) {
    console.warn(this.formatEntry("WARN", message, extra));
  }

  error(message, error = null, extra = {}) {
    const errorDetails = error
      ? {
          errorName: error.name || "Error",
          errorMessage: error.message,
          stack: error.stack,
          isTransient: Boolean(error.isTransient)
        }
      : {};

    console.error(
      this.formatEntry("ERROR", message, {
        ...errorDetails,
        ...extra
      })
    );
  }
}
