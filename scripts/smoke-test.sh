#!/usr/bin/env bash
# Smoke test script for AWS Event-Driven Application
set -euo pipefail

API_URL="${1:-}"

if [[ -z "$API_URL" ]]; then
  echo "Usage: ./scripts/smoke-test.sh <API_BASE_URL>"
  echo "Example: ./scripts/smoke-test.sh https://xyz.execute-api.ap-south-1.amazonaws.com/dev"
  exit 1
fi

echo "🚀 Submitting new order to $API_URL/orders..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-smoke-1",
    "items": [
      { "productId": "prod-smoke-1", "quantity": 1, "unitPrice": 1999 }
    ],
    "currency": "LKR"
  }')

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

echo "HTTP Status Code: $HTTP_CODE"
echo "Response Body: $HTTP_BODY"

if [[ "$HTTP_CODE" -eq 202 ]]; then
  echo "✅ Order accepted successfully (HTTP 202)!"
  ORDER_ID=$(echo "$HTTP_BODY" | grep -o '"orderId":"[^"]*' | cut -d'"' -f4 || true)
  if [[ -n "$ORDER_ID" ]]; then
    echo "📋 Tracking Order ID: $ORDER_ID"
    echo "Waiting 5 seconds for asynchronous fulfillment..."
    sleep 5
    echo "Querying order status: GET $API_URL/orders/$ORDER_ID"
    curl -s "$API_URL/orders/$ORDER_ID" | jq . || curl -s "$API_URL/orders/$ORDER_ID"
    echo ""
  fi
else
  echo "❌ Smoke test failed. Expected HTTP 202, received $HTTP_CODE."
  exit 1
fi
