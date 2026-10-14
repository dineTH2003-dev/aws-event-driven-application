import { Logger } from "../../src/lib/logging/logger.js";
import { AppError } from "../../src/lib/errors/app-error.js";

describe("Structured Logger", () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should format and output structured JSON INFO log", () => {
    const logger = new Logger("test-service", { correlationId: "corr-123" });
    logger.info("Order received", { orderId: "ord-100" });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(parsed.level).toBe("INFO");
    expect(parsed.service).toBe("test-service");
    expect(parsed.correlationId).toBe("corr-123");
    expect(parsed.orderId).toBe("ord-100");
    expect(parsed.message).toBe("Order received");
    expect(parsed.timestamp).toBeDefined();
  });

  test("should format and output structured JSON WARN log", () => {
    const logger = new Logger("test-service");
    logger.warn("Slow downstream dependency detected", { latencyMs: 450 });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

    expect(parsed.level).toBe("WARN");
    expect(parsed.message).toBe("Slow downstream dependency detected");
    expect(parsed.latencyMs).toBe(450);
  });

  test("should format and output structured JSON ERROR log with stack trace and transient flag", () => {
    const logger = new Logger("test-service");
    const err = new AppError("Database connection lost", 503, true);
    logger.error("Failed to process batch", err, { batchSize: 5 });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(parsed.level).toBe("ERROR");
    expect(parsed.message).toBe("Failed to process batch");
    expect(parsed.errorName).toBe("AppError");
    expect(parsed.errorMessage).toBe("Database connection lost");
    expect(parsed.isTransient).toBe(true);
    expect(parsed.batchSize).toBe(5);
    expect(parsed.stack).toBeDefined();
  });
});
