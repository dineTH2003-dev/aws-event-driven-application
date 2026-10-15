/**
 * Event Schemas and Validation Functions
 * Validates domain models and CloudEvents 1.0 specifications using Zod.
 */

import { z } from "zod";
import { ValidationError } from "../errors/app-error.js";

export const EVENT_TYPES = {
  ORDER_CREATED: "com.example.orders.created",
  ORDER_COMPLETED: "com.example.orders.completed",
  ORDER_FAILED: "com.example.orders.failed"
};

export const OrderItemSchema = z.object({
  productId: z
    .string({ message: "is missing valid 'productId'" })
    .min(1, "is missing valid 'productId'"),
  quantity: z
    .number({ message: "must have integer 'quantity' >= 1" })
    .int("must have integer 'quantity' >= 1")
    .positive("must have integer 'quantity' >= 1"),
  unitPrice: z
    .number({ message: "must have numeric 'unitPrice' >= 0" })
    .nonnegative("must have numeric 'unitPrice' >= 0")
});

export const OrderInputSchema = z.object({
  customerId: z
    .string({ message: "Field 'customerId' is required and must be a non-empty string" })
    .min(1, "Field 'customerId' is required and must be a non-empty string"),
  items: z
    .array(OrderItemSchema, {
      message: "Field 'items' is required and must be a non-empty array"
    })
    .nonempty("Field 'items' is required and must be a non-empty array")
    .max(50, "Field 'items' exceeds maximum allowed limit of 50 items"),
  currency: z
    .string({
      message:
        "Field 'currency' is required and must be a valid 3-letter currency code (e.g. LKR, USD)"
    })
    .min(
      3,
      "Field 'currency' is required and must be a valid 3-letter currency code (e.g. LKR, USD)"
    )
});

export const CloudEventSchema = z.object({
  specversion: z.literal("1.0", {
    errorMap: () => ({ message: "Unsupported specversion. Expected '1.0'" })
  }),
  id: z.string().min(1, "CloudEvent envelope missing required field: 'id'"),
  source: z.string().min(1, "CloudEvent envelope missing required field: 'source'"),
  type: z.string().min(1, "CloudEvent envelope missing required field: 'type'"),
  time: z.string().min(1, "CloudEvent envelope missing required field: 'time'"),
  datacontenttype: z.literal("application/json", {
    errorMap: () => ({ message: "Unsupported datacontenttype. Expected 'application/json'" })
  }),
  data: z.record(z.unknown(), {
    message: "CloudEvent envelope missing required field: 'data'"
  })
});

export function validateOrderInput(payload) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Order payload must be a non-null JSON object");
  }

  if (typeof payload.customerId === "string" && payload.customerId.trim() === "") {
    throw new ValidationError("Field 'customerId' is required and must be a non-empty string");
  }

  const result = OrderInputSchema.safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const firstError = issues[0];
    const path = firstError ? firstError.path : [];
    if (path[0] === "items" && typeof path[1] === "number") {
      throw new ValidationError(`Item at index ${path[1]} ${firstError.message}`);
    }
    throw new ValidationError(firstError ? firstError.message : "Validation failed");
  }

  return true;
}

export function validateCloudEvent(event) {
  if (!event || typeof event !== "object") {
    throw new ValidationError("Event must be a non-null JSON object");
  }

  const requiredFields = ["specversion", "id", "source", "type", "time", "datacontenttype", "data"];
  for (const field of requiredFields) {
    if (!event[field]) {
      throw new ValidationError(`CloudEvent envelope missing required field: '${field}'`);
    }
  }

  if (event.specversion !== "1.0") {
    throw new ValidationError(`Unsupported specversion '${event.specversion}'. Expected '1.0'`);
  }

  if (event.datacontenttype !== "application/json") {
    throw new ValidationError(
      `Unsupported datacontenttype '${event.datacontenttype}'. Expected 'application/json'`
    );
  }

  return true;
}
