# 💰 Cost Management & Guardrails

## 1. Cost-Conscious Architecture Choices
To keep development and operational costs near **$0.00** within AWS Free Tier:

| Service | Architecture Choice | Cost Rationale |
| :--- | :--- | :--- |
| **Amazon DynamoDB** | `PAY_PER_REQUEST` (On-Demand) | Zero baseline cost when idle. First 25 GB of storage and 25 write/read capacity units are free per month. |
| **AWS Lambda** | 256MB memory, 30s timeout | 1,000,000 free requests and 3,200,000 seconds of compute time per month in AWS Free Tier. |
| **Amazon SQS** | Standard Queue with long polling | First 1,000,000 requests per month are free. Long polling (`ReceiveMessageWaitTimeSeconds = 20`) reduces empty receive calls by over 90%. |
| **Amazon SNS** | Standard Topic | First 1,000,000 publishes and 100,000 SQS deliveries per month are free. |
| **Amazon CloudWatch** | 7-day log retention | Prevents infinite retention of log data. Free tier covers 5 GB ingestion and 10 custom metrics/alarms. |
| **Networking** | No NAT Gateways, no VPC | Eliminates the standard ~$32/month NAT Gateway baseline charge. |

---

## 2. Monthly Cost Estimate (Development Traffic)
Assuming ~10,000 orders generated during development and chaos testing:

| Component | Usage | Estimated Cost |
| :--- | :--- | :--- |
| API Gateway | 10,000 calls | $0.01 |
| Lambda (API + Worker) | 20,000 invocations (<100ms each) | $0.00 (Free Tier) |
| SNS Publishes | 20,000 events | $0.00 (Free Tier) |
| SQS Requests | 40,000 requests | $0.00 (Free Tier) |
| DynamoDB | 30,000 read/write units | $0.00 (Free Tier) |
| CloudWatch | < 500 MB logs, 4 alarms | $0.00 (Free Tier) |
| **Total Estimated Cost** | | **~ $0.01 / month** |

---

## 3. Cost Guardrails
1. **API Gateway Throttling**: Limited to 50 steady RPS and 100 burst RPS to prevent accidental denial-of-wallet attacks.
2. **DynamoDB TTL**: Automatic expiration of transient idempotency records after 24 hours.
3. **Automated Teardown Script**: `scripts/destroy.sh` runs `terraform destroy` when testing is complete.
