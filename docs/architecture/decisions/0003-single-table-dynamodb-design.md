# ADR 0003: Single-Table DynamoDB Design for Orders and Idempotency Records

## Status

Accepted

## Context

The application needs persistence for two distinct entities:

1. **Order Entities**: Long-lived records containing order ID, customer details, items, amounts, timestamps, and lifecycle status (`PENDING`, `COMPLETED`, `FAILED`).
2. **Idempotency Records**: Transient locks and deduplication records keyed by event ID with lifecycle status (`IN_PROGRESS`, `COMPLETED`) and cached results.

Maintaining separate tables increases operational overhead, provisioning costs, and IAM complexity.

## Decision

We implement a **Single-Table DynamoDB Design** using generic partition and sort keys:

- Primary Key: `PK` (String)
- Sort Key: `SK` (String)
- Billing Mode: `PAY_PER_REQUEST` (On-Demand)

### Key Schema Patterns

| Entity               | Partition Key (`PK`)    | Sort Key (`SK`) | Attributes & Purpose                                                                |
| :------------------- | :---------------------- | :-------------- | :---------------------------------------------------------------------------------- |
| **Order Record**     | `ORDER#<orderId>`       | `METADATA`      | `orderId`, `customerId`, `items`, `totalAmount`, `status`, `createdAt`, `updatedAt` |
| **Idempotency Lock** | `IDEMPOTENCY#<eventId>` | `RECORD`        | `eventId`, `orderId`, `status` (`IN_PROGRESS` \| `COMPLETED`), `ttl`                |

## Consequences

### Positive

- Single IAM policy grant and single table definition in Terraform.
- Cost-efficient: zero idle cost with On-Demand billing.
- DynamoDB native TTL automatically deletes expired idempotency records after 24 hours without consuming write capacity units or requiring background cleanup cron jobs.

### Negative / Trade-offs

- Overloading key attributes requires disciplined prefix management (`ORDER#`, `IDEMPOTENCY#`) in application code.
