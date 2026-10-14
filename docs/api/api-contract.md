# 📡 API Contract Specification

## Base URL
`https://{apiId}.execute-api.{region}.amazonaws.com/dev`

---

## 1. Create Order

Submits a new order for asynchronous event-driven processing.

- **Method**: `POST`
- **Path**: `/orders`
- **Content-Type**: `application/json`

### Request Headers
| Header | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `Content-Type` | String | Yes | Must be `application/json` |
| `x-correlation-id` | String | No | Distributed tracing ID. If omitted, the API generates one. |

### Request Body
```json
{
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
  "currency": "LKR"
}
```

### Validation Rules
- `customerId`: Required, non-empty string.
- `items`: Required, array with at least 1 item and maximum 50 items.
- `items[].productId`: Required, non-empty string.
- `items[].quantity`: Required, integer `>= 1`.
- `items[].unitPrice`: Required, number `>= 0`.
- `currency`: Required, ISO currency code string (e.g. `"LKR"`, `"USD"`).

### Responses

#### `202 Accepted`
Returned when the order is successfully validated, persisted as `PENDING`, and enqueued via SNS.

```json
{
  "orderId": "ord-7f93a210-67c2-4a0b-8d5f-4d436a5b6c01",
  "status": "PENDING",
  "message": "Order accepted for asynchronous processing",
  "createdAt": "2026-10-14T13:30:00.000Z"
}
```

#### `400 Bad Request`
Returned when payload fails validation rules.

```json
{
  "error": "BAD_REQUEST",
  "message": "Validation failed: items array must contain at least 1 item with positive quantity",
  "correlationId": "corr-1b2c3d4e"
}
```

#### `429 Too Many Requests`
Returned when client exceeds API Gateway throttling limits (100 burst / 50 steady RPS).

```json
{
  "message": "Too Many Requests"
}
```

---

## 2. Get Order Status

Retrieves the current state and details of an order from DynamoDB.

- **Method**: `GET`
- **Path**: `/orders/{orderId}`

### Responses

#### `200 OK`
```json
{
  "orderId": "ord-7f93a210-67c2-4a0b-8d5f-4d436a5b6c01",
  "customerId": "cust-5001",
  "status": "COMPLETED",
  "totalAmount": 6500,
  "currency": "LKR",
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
  "createdAt": "2026-10-14T13:30:00.000Z",
  "updatedAt": "2026-10-14T13:30:02.500Z"
}
```

#### `404 Not Found`
```json
{
  "error": "NOT_FOUND",
  "message": "Order ord-9999 not found"
}
```

---

## 3. Sample cURL Invocations

### Submit Order
```bash
curl -X POST https://xyz.execute-api.ap-south-1.amazonaws.com/dev/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-5001",
    "items": [
      { "productId": "prod-101", "quantity": 1, "unitPrice": 2500 }
    ],
    "currency": "LKR"
  }'
```

### Query Order Status
```bash
curl -X GET https://xyz.execute-api.ap-south-1.amazonaws.com/dev/orders/ord-7f93a210-67c2-4a0b-8d5f-4d436a5b6c01
```
