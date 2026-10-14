# 🔒 Security Plan & Threat Modeling

## 1. Principles
This platform adheres to the AWS Well-Architected Security Pillar and Defense-in-Depth principles.

---

## 2. IAM Least-Privilege Matrix

| Principal Role | Allowed AWS Actions | Target Resource ARN | Explicit Restrictions |
| :--- | :--- | :--- | :--- |
| **`OrderApiLambdaRole`** | `sns:Publish` | `arn:aws:sns:${region}:${account}:order-events-topic` | Cannot publish to any other topic; cannot manage subscriptions. |
| | `dynamodb:PutItem`, `dynamodb:GetItem` | `arn:aws:dynamodb:${region}:${account}:table/orders-dev` | Cannot delete items; cannot scan or drop table. |
| | `logs:CreateLogStream`, `logs:PutLogEvents` | `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/orders-api-dev:*` | Scoped strictly to function log group. |
| **`OrderWorkerLambdaRole`** | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` | `arn:aws:sqs:${region}:${account}:order-processing-queue` | Cannot consume from DLQ directly during normal operations; cannot delete queues. |
| | `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem` | `arn:aws:dynamodb:${region}:${account}:table/orders-dev` | Scoped to orders table for idempotency locks and state transitions. |
| | `sns:Publish` | `arn:aws:sns:${region}:${account}:order-events-topic` | Only allowed to emit outcome events (`OrderCompleted`, `OrderFailed`). |
| | `logs:CreateLogStream`, `logs:PutLogEvents` | `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/orders-worker-dev:*` | Scoped strictly to function log group. |

---

## 3. Resource Policies

### 3.1 SQS Queue Policy (`order-processing-queue`)
Restricts `sqs:SendMessage` exclusively to the authorized SNS topic using an AWS IAM condition:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSNSTopicPublish",
      "Effect": "Allow",
      "Principal": { "Service": "sns.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:${region}:${account}:order-processing-queue",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:sns:${region}:${account}:order-events-topic"
        }
      }
    }
  ]
}
```

### 3.2 SNS Topic Policy
Enforces encryption in transit by denying non-TLS transport (`aws:SecureTransport: false`).

---

## 4. Encryption
- **In Transit**: All HTTP traffic into API Gateway and internal AWS service communication uses TLS 1.2+.
- **At Rest**:
  - Amazon SQS uses SQS Server-Side Encryption (`SSE-SQS`).
  - Amazon SNS uses AWS managed SSE.
  - Amazon DynamoDB uses AWS managed KMS encryption.

---

## 5. Secrets & Credential Management
- No long-lived AWS Access Keys are stored in the repository, environment files, or GitHub Secrets.
- GitHub Actions CI/CD uses **AWS OIDC Federation** (`sts:AssumeRoleWithWebIdentity`) with narrow repository and branch conditions.
