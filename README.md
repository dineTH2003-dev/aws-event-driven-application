# ⚡ AWS Event-Driven Order Processing Platform

[![CI Pipeline](https://img.shields.io/badge/CI-GitHub%20Actions-blue?logo=github-actions)](.github/workflows/ci.yml)
[![Terraform Checks](https://img.shields.io/badge/IaC-Terraform%20%3E%3D1.6.0-623CE4?logo=terraform)](infrastructure/terraform)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?logo=nodedotjs)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![AWS Profile](https://img.shields.io/badge/AWS%20Profile-account2-FF9900?logo=amazon-aws)](https://aws.amazon.com/)
[![AWS Region](https://img.shields.io/badge/AWS%20Region-ap--south--1-FF9900?logo=amazon-aws)](https://aws.amazon.com/)

A production-grade, enterprise-oriented **Event-Driven Serverless Application** built on Amazon Web Services (AWS). Designed to demonstrate decoupled asynchronous processing, burst absorption via durable message buffering, poison-pill isolation via Dead-Letter Queues (DLQ), exactly-once processing guarantees via application-level idempotency, and automated Infrastructure as Code (IaC) with Terraform.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph IngestionTier ["🚪 Ingestion Tier (Synchronous Acceptance)"]
        Client["💻 Client (cURL / Postman / Web)"] -->|1. POST /orders | APIGW["🚪 Amazon API Gateway<br/>(Request Validation & Throttling)"]
        Client -.->|7. GET /orders/{id} | APIGW
        APIGW -->|2. Invoke (Request-Response)| OrderApiLambda["⚡ Lambda: create-order<br/>(Input Validation, ID Gen, State: PENDING)"]
        OrderApiLambda -->|3. Publish CloudEvent| SNSTopic["📢 Amazon SNS: order-events-topic<br/>(Event Distribution & Filtering)"]
        OrderApiLambda -.->|202 Accepted { orderId }| Client
    end

    subgraph MessagingTier ["📥 Messaging & Buffering Tier (Decoupled Backbone)"]
        SNSTopic -->|4. Fan-Out Subscription| SQSMain["📥 Amazon SQS: order-processing-queue<br/>(Visibility Timeout: 180s, MaxReceiveCount: 3)"]
        
        SQSMain -.->|MaxReceiveCount Exceeded<br/>Poison Pill Isolation| SQSDLQ["☠️ Amazon SQS: order-processing-dlq<br/>(Retention: 14 Days)"]
        
        SNSTopic -.->|Filter: eventType = OrderCompleted| SQSNotify["📬 Amazon SQS: notification-queue<br/>(Downstream Subscriber)"]
    end

    subgraph ProcessingTier ["⚙️ Processing Tier (Asynchronous Compute)"]
        SQSMain -->|5. Event Source Mapping<br/>Batch: 10, Partial Batch Failures| OrderWorkerLambda["⚡ Lambda: process-order<br/>(Idempotency Check, Business Logic, Result State)"]
        
        SQSNotify --> LambdaNotify["⚡ Lambda: publish-notification<br/>(Email / Mock Dispatcher)"]
        
        OrderWorkerLambda -.->|Publish: OrderCompleted / OrderFailed| SNSTopic
    end

    subgraph PersistenceTier ["🗄️ Persistence & State Store"]
        OrderApiLambda -->|Write Initial Order| DynamoDB[("🗄️ Amazon DynamoDB: orders<br/>(Single-Table Design + TTL)")]
        OrderWorkerLambda <-->|Atomic Conditional Writes<br/>Check & Claim Idempotency| DynamoDB
    end

    subgraph ObservabilityTier ["📊 Observability & Reliability (SRE)"]
        CWLogs["📝 CloudWatch Logs<br/>(JSON Structured + Correlation IDs)"]
        CWAlarms["🚨 CloudWatch Alarms<br/>(DLQ Depth > 0, Queue Age > 60s, Worker Errors)"]
        CWDash["📈 CloudWatch Operational Dashboard"]
        Runbooks["📖 SRE Runbooks<br/>(DLQ Investigation, Queue Backlog, Lambda Errors)"]
        
        OrderWorkerLambda -.-> CWLogs
        SQSMain -.-> CWAlarms
        SQSDLQ -.-> CWAlarms
    end
```

---

## 🎯 Key Architectural Decisions & Engineering Trade-offs

| Architectural Dimension | Engineering Decision | Trade-off & Justification |
| :--- | :--- | :--- |
| **Communication Paradigm** | **Asynchronous Event-Driven vs Synchronous REST** | Decouples the ingestion layer from the fulfillment engine. The API Gateway acknowledges requests immediately with `202 Accepted`, allowing the system to absorb high concurrency bursts without exhausting downstream databases. |
| **Queue Type** | **Standard Queue + Application Idempotency** | Standard SQS provides virtually unlimited throughput and sub-millisecond publishing. While it guarantees *at-least-once* delivery, our consumer uses DynamoDB conditional writes (`attribute_not_exists(PK)`) to guarantee *exactly-once* business semantics. |
| **Failure Isolation** | **Dead-Letter Queue (DLQ) with MaxReceiveCount = 3** | Poison-pill messages (corrupt data or unexpected runtime errors) are isolated after 3 retries, preventing head-of-line blocking and infinite retry loops from starving healthy messages. |
| **Queue Timing Configuration** | **SQS Visibility Timeout = 6x Lambda Timeout** | With Lambda timeout at 30 seconds, SQS visibility timeout is configured to 180 seconds. This prevents other concurrent consumers from prematurely receiving and duplicating messages while a worker is actively processing. |
| **Batch Failure Handling** | **`ReportBatchItemFailures`** | Lambda returns an array of specific failed message IDs instead of failing the entire batch of 10 messages, preventing unnecessary duplicate execution of successfully processed items. |
| **Data Persistence** | **Single-Table DynamoDB with TTL** | Low latency, zero server management, and automatic cleanup of transient idempotency records via DynamoDB TTL, saving storage costs. |
| **Observability** | **Structured JSON Logging & SRE Runbooks** | Every log includes `service`, `level`, `orderId`, `eventId`, and `correlationId`. Coupled with CloudWatch Metric Alarms on DLQ depth and age of oldest message. |

---

## 📁 Repository Layout

```
aws-event-driven-application/
├── .editorconfig
├── .gitignore
├── LICENSE
├── Makefile
├── README.md
├── package.json
├── eslint.config.js
├── .prettierrc
├── docs/
│   ├── architecture/
│   │   ├── architecture.md
│   │   ├── sequence-diagram.md
│   │   └── decisions/
│   │       ├── 0001-event-driven-over-synchronous-rest.md
│   │       ├── 0002-standard-queue-with-application-idempotency.md
│   │       └── 0003-single-table-dynamodb-design.md
│   ├── api/
│   │   └── api-contract.md
│   ├── runbooks/
│   │   ├── dlq-investigation.md
│   │   ├── queue-backlog.md
│   │   └── lambda-errors.md
│   ├── event-schema.md
│   ├── security.md
│   ├── cost-management.md
│   ├── testing.md
│   └── interview-deep-dive.md
├── infrastructure/
│   └── terraform/
│       ├── versions.tf
│       ├── provider.tf
│       ├── variables.tf
│       ├── locals.tf
│       ├── outputs.tf
│       ├── iam.tf
│       ├── messaging.tf
│       ├── dynamodb.tf
│       ├── lambda.tf
│       ├── api-gateway.tf
│       ├── monitoring.tf
│       ├── alarms.tf
│       └── terraform.tfvars.example
├── src/
│   ├── functions/
│   │   ├── create-order/
│   │   ├── process-order/
│   │   └── publish-notification/
│   └── lib/
│       ├── events/
│       ├── idempotency/
│       ├── persistence/
│       ├── logging/
│       └── errors/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── scripts/
    ├── smoke-test.sh
    ├── inject-poison-pill.sh
    ├── redrive-dlq.sh
    └── destroy.sh
```

---

## 🚀 Quick Start & Local Testing

### Prerequisites
- Node.js `>= 20.0.0`
- Terraform `>= 1.6.0`
- AWS CLI configured with profile `account2` and region `ap-south-1`

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Unit Tests
```bash
npm test
# Run with coverage report
npm run test:coverage
```

### 3. Run Code Quality Checks
```bash
npm run lint
npm run format:check
```

### 4. Validate Terraform Infrastructure
```bash
make tf-fmt
make tf-validate
```

---

## 🛡️ SRE Incident Runbooks

When operational issues occur in production, refer directly to our documented runbooks:
- **[DLQ Investigation & Message Redrive](docs/runbooks/dlq-investigation.md)**: Handling poison pills and safely replaying failed messages.
- **[Queue Backlog & Processing Delays](docs/runbooks/queue-backlog.md)**: Diagnosing message aging and adjusting Lambda concurrency.
- **[Lambda Runtime Errors](docs/runbooks/lambda-errors.md)**: Querying CloudWatch Insights and addressing unhandled exceptions.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
