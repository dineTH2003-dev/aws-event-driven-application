/**
 * Event Schemas and Validation Functions
 * Validates domain models and CloudEvents 1.0 specifications.
 */

import { ValidationError } from "../errors/app-error.js";

export const EVENT_TYPES = {
  ORDER_CREATED: "com.example.orders.created",
  ORDER_COMPLETED: "com.example.orders.completed",
  ORDER_FAILED: "com.example.orders.failed"
};

export function validateOrderInput(payload) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Order payload must be a non-null JSON object");
  }

  const { customerId, items, currency } = payload;

  if (!customerId || typeof customerId !== "string" || customerId.trim() === "") {
    throw new ValidationError("Field 'customerId' is required and must be a non-empty string");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Field 'items' is required and must be a non-empty array");
  }

  if (items.length > 50) {
    throw new ValidationError("Field 'items' exceeds maximum allowed limit of 50 items");
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.productId || typeof item.productId !== "string") {
      throw new ValidationError(`Item at index ${i} is missing valid 'productId'`);
    }
    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError(`Item at index ${i} must have integer 'quantity' >= 1`);
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      throw new ValidationError(`Item at index ${i} must have numeric 'unitPrice' >= 0`);
    }
  }

  if (!currency || typeof currency !== "string" || currency.length < 3) {
    throw new ValidationError("Field 'currency' is required and must be a valid 3-letter currency code (e.g. LKR, USD)");
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
    throw new ValidationError(`Unsupported datacontenttype '${event.datacontenttype}'. Expected 'application/json'`);
  }

  return true;
}
