# 📖 SRE Runbook: Lambda Consumer Runtime Errors

## 1. Alert Trigger
- **Alarm Name**: `OrderWorker_Errors_Elevated`
- **Condition**: `Errors > 1` in a 5-minute evaluation period for `orders-worker-dev`.
- **Severity**: P2 (High)

---

## 2. Problem Overview
The `process-order` Lambda function is encountering unhandled exceptions during execution. If not mitigated, failing messages will exhaust their `maxReceiveCount` and land in the Dead-Letter Queue (DLQ).

---

## 3. Diagnostic Steps

### Step 1: Query Recent Errors in CloudWatch Logs
Use CloudWatch Logs Insights on `/aws/lambda/orders-worker-dev`:
```sql
fields @timestamp, @message, error.name, error.message, error.stack, eventId, orderId
| filter level = "ERROR" or @message like /(?i)(error|exception|fail)/
| sort @timestamp desc
| limit 25
```

### Step 2: Check Dependency Health
- **DynamoDB**: Check if table status is `ACTIVE` and verify that IAM permissions allow `dynamodb:UpdateItem` and conditional checks.
- **SNS**: Check if the topic exists and has valid permissions for worker publishing.

### Step 3: Identify Failure Scope
- Is it affecting **all messages** (infrastructure/permission breakage) or **specific orders** (bad payload data / edge case)?

---

## 4. Remediation Procedure

1. **Permission / IAM Failure (`AccessDeniedException`)**:
   - Inspect Terraform `iam.tf` policies. Re-apply verified permissions via Terraform.
2. **Code Exception (Null pointer, bad parsing)**:
   - Reproduce locally with Jest using the payload captured in the log.
   - Patch `src/functions/process-order/service.js` and run `npm test`.
   - Deploy patched code.
3. **Transient Network Timeouts**:
   - AWS SDK v3 automatically retries idempotent calls. If DynamoDB is throttling, consider backoff tuning in `src/lib/persistence/dynamodb-client.js`.
