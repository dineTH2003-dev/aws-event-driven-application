# 📜 Event Contract Specification

## 1. Event Specification Standard

All events emitted by the platform conform to the [CloudEvents 1.0 Specification](https://cloudevents.io/). This ensures standardized metadata headers, interoperability, and clear schema boundaries across decoupled microservices.

## 2. Event Envelope Structure

| Field             | Type   | Required | Description                                                                                                    |
| :---------------- | :----- | :------: | :------------------------------------------------------------------------------------------------------------- |
| `specversion`     | String |   Yes    | CloudEvents specification version. Always `"1.0"`.                                                             |
| `id`              | String |   Yes    | Unique identifier for this specific event instance (e.g. `evt-9f82ab...`). Used for idempotency deduplication. |
| `source`          | String |   Yes    | Context URI identifying the service that produced the event (e.g. `orders-api`, `orders-worker`).              |
| `type`            | String |   Yes    | Fully qualified domain event type (e.g. `com.example.orders.created`).                                         |
| `time`            | String |   Yes    | ISO 8601 UTC timestamp of event generation (e.g. `2026-10-14T13:30:00.000Z`).                                  |
| `datacontenttype` | String |   Yes    | MIME type of the payload. Always `"application/json"`.                                                         |
| `data`            | Object |   Yes    | Business payload specific to the event type.                                                                   |

---

## 3. Supported Event Types

### 3.1 `com.example.orders.created`

Emitted by the **Order Ingestion API (`create-order`)** upon successful validation and initial persistence.

```json
{
  "specversion": "1.0",
  "id": "evt-7f93a210-67c2-4a0b-8d5f-4d436a5b6c01",
  "source": "orders-api",
  "type": "com.example.orders.created",
  "time": "2026-10-14T13:30:00.000Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "ord-1001",
    "customerId": "cust-5001",
    "items": [
      {
        "productId": "prod-101",
        "quantity": 2,
        "unitPrice": 1500
      },
      {
        "productId": "prod-102",
        "quantity": 1,
        "unitPrice": 3500
      }
    ],
    "totalAmount": 6500,
    "currency": "LKR",
    "createdAt": "2026-10-14T13:30:00.000Z"
  }
}
```

### 3.2 `com.example.orders.completed`

Emitted by the **Order Fulfillment Worker (`process-order`)** after successful idempotency checks, business fulfillment, and DynamoDB status update.

```json
{
  "specversion": "1.0",
  "id": "evt-8c11e432-51f1-482d-9a01-1b2c3d4e5f6a",
  "source": "orders-worker",
  "type": "com.example.orders.completed",
  "time": "2026-10-14T13:30:02.500Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "ord-1001",
    "customerId": "cust-5001",
    "status": "COMPLETED",
    "completedAt": "2026-10-14T13:30:02.500Z",
    "itemsCount": 3,
    "totalAmount": 6500,
    "currency": "LKR"
  }
}
```

### 3.3 `com.example.orders.failed`

Emitted by the worker if an order reaches a **terminal business rejection** (e.g. inventory permanently unavailable or customer account suspended).

```json
{
  "specversion": "1.0",
  "id": "evt-9a22f543-62a2-493e-ab12-2c3d4e5f6a7b",
  "source": "orders-worker",
  "type": "com.example.orders.failed",
  "time": "2026-10-14T13:30:01.800Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "ord-1001",
    "customerId": "cust-5001",
    "status": "FAILED",
    "failureReason": "INSUFFICIENT_STOCK",
    "failedAt": "2026-10-14T13:30:01.800Z"
  }
}
```

---

## 4. Schema Evolution Guidelines

1. **Backward Compatibility**: Fields must never be removed or renamed in minor schema versions.
2. **Additive Changes**: New fields must be marked optional.
3. **Consumers Resilience**: Consumers must ignore unknown fields rather than throwing validation errors.
4. **Major Versioning**: Breaking payload changes require incrementing the domain event type (e.g. `com.example.orders.v2.created`).
