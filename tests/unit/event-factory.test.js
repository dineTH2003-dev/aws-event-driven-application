import { EventFactory } from "../../src/lib/events/event-factory.js";
import {
  EVENT_TYPES,
  validateOrderInput,
  validateCloudEvent
} from "../../src/lib/events/schemas.js";
import { ValidationError } from "../../src/lib/errors/app-error.js";

describe("EventFactory & Schema Validation", () => {
  describe("validateOrderInput", () => {
    test("should accept a valid order payload", () => {
      const validPayload = {
        customerId: "cust-123",
        items: [{ productId: "prod-1", quantity: 2, unitPrice: 500 }],
        currency: "LKR"
      };

      expect(validateOrderInput(validPayload)).toBe(true);
    });

    test("should reject missing or empty customerId", () => {
      expect(() =>
        validateOrderInput({
          customerId: "",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
          currency: "USD"
        })
      ).toThrow(ValidationError);
      expect(() =>
        validateOrderInput({
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
          currency: "USD"
        })
      ).toThrow("Field 'customerId' is required");
    });

    test("should reject empty items array", () => {
      expect(() =>
        validateOrderInput({ customerId: "cust-1", items: [], currency: "USD" })
      ).toThrow("Field 'items' is required and must be a non-empty array");
    });

    test("should reject items with negative or non-integer quantity", () => {
      expect(() =>
        validateOrderInput({
          customerId: "cust-1",
          items: [{ productId: "p", quantity: -1, unitPrice: 10 }],
          currency: "USD"
        })
      ).toThrow("must have integer 'quantity' >= 1");
      expect(() =>
        validateOrderInput({
          customerId: "cust-1",
          items: [{ productId: "p", quantity: 1.5, unitPrice: 10 }],
          currency: "USD"
        })
      ).toThrow("must have integer 'quantity' >= 1");
    });

    test("should reject invalid currency", () => {
      expect(() =>
        validateOrderInput({
          customerId: "cust-1",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
          currency: "US"
        })
      ).toThrow("Field 'currency' is required");
    });
  });

  describe("EventFactory CloudEvent Construction", () => {
    test("should create a valid CloudEvents 1.0 envelope", () => {
      const event = EventFactory.createEvent("orders-api", EVENT_TYPES.ORDER_CREATED, {
        foo: "bar"
      });

      expect(event.specversion).toBe("1.0");
      expect(event.id).toMatch(/^evt-/);
      expect(event.source).toBe("orders-api");
      expect(event.type).toBe(EVENT_TYPES.ORDER_CREATED);
      expect(event.datacontenttype).toBe("application/json");
      expect(event.data).toEqual({ foo: "bar" });
      expect(new Date(event.time).toISOString()).toBe(event.time);
    });

    test("should generate OrderCreated event matching domain schema", () => {
      const order = {
        orderId: "ord-999",
        customerId: "cust-1",
        items: [{ productId: "prod-1", quantity: 2, unitPrice: 100 }],
        totalAmount: 200,
        currency: "LKR"
      };

      const event = EventFactory.createOrderCreatedEvent(order);
      expect(event.type).toBe(EVENT_TYPES.ORDER_CREATED);
      expect(event.data.orderId).toBe("ord-999");
      expect(event.data.totalAmount).toBe(200);
      expect(validateCloudEvent(event)).toBe(true);
    });

    test("should generate OrderCompleted event", () => {
      const order = {
        orderId: "ord-999",
        customerId: "cust-1",
        items: [{ productId: "prod-1", quantity: 1, unitPrice: 100 }],
        totalAmount: 100,
        currency: "USD"
      };

      const event = EventFactory.createOrderCompletedEvent(order);
      expect(event.type).toBe(EVENT_TYPES.ORDER_COMPLETED);
      expect(event.data.status).toBe("COMPLETED");
      expect(event.data.itemsCount).toBe(1);
    });

    test("should generate OrderFailed event", () => {
      const event = EventFactory.createOrderFailedEvent("ord-999", "cust-1", "PAYMENT_DECLINED");
      expect(event.type).toBe(EVENT_TYPES.ORDER_FAILED);
      expect(event.data.status).toBe("FAILED");
      expect(event.data.failureReason).toBe("PAYMENT_DECLINED");
    });
  });
});
