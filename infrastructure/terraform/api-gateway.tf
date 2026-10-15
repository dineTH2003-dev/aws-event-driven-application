# Amazon API Gateway (REST Ingestion API)

resource "aws_api_gateway_rest_api" "orders_api" {
  name        = "${local.name_prefix}-api"
  description = "Regional REST Ingestion API for Event-Driven Order Processing Platform"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# /orders Resource
resource "aws_api_gateway_resource" "orders" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  parent_id   = aws_api_gateway_rest_api.orders_api.root_resource_id
  path_part   = "orders"
}

# POST /orders Method & Integration
resource "aws_api_gateway_method" "post_orders" {
  rest_api_id   = aws_api_gateway_rest_api.orders_api.id
  resource_id   = aws_api_gateway_resource.orders.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_orders_integration" {
  rest_api_id             = aws_api_gateway_rest_api.orders_api.id
  resource_id             = aws_api_gateway_resource.orders.id
  http_method             = aws_api_gateway_method.post_orders.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.create_order.invoke_arn
}

# /orders/{orderId} Resource
resource "aws_api_gateway_resource" "order_id" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  parent_id   = aws_api_gateway_resource.orders.id
  path_part   = "{orderId}"
}

# GET /orders/{orderId} Method & Integration
resource "aws_api_gateway_method" "get_order" {
  rest_api_id   = aws_api_gateway_rest_api.orders_api.id
  resource_id   = aws_api_gateway_resource.order_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_order_integration" {
  rest_api_id             = aws_api_gateway_rest_api.orders_api.id
  resource_id             = aws_api_gateway_resource.order_id.id
  http_method             = aws_api_gateway_method.get_order.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.create_order.invoke_arn
}

# -------------------------------------------------------------
# CORS Preflight OPTIONS Configurations
# -------------------------------------------------------------

# OPTIONS /orders
resource "aws_api_gateway_method" "options_orders" {
  rest_api_id   = aws_api_gateway_rest_api.orders_api.id
  resource_id   = aws_api_gateway_resource.orders.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_orders_integration" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.orders.id
  http_method = aws_api_gateway_method.options_orders.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_orders_200" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.orders.id
  http_method = aws_api_gateway_method.options_orders.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_orders_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.orders.id
  http_method = aws_api_gateway_method.options_orders.http_method
  status_code = aws_api_gateway_method_response.options_orders_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,x-correlation-id,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_orders_integration]
}

# OPTIONS /orders/{orderId}
resource "aws_api_gateway_method" "options_order_id" {
  rest_api_id   = aws_api_gateway_rest_api.orders_api.id
  resource_id   = aws_api_gateway_resource.order_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_order_id_integration" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.order_id.id
  http_method = aws_api_gateway_method.options_order_id.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_order_id_200" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.order_id.id
  http_method = aws_api_gateway_method.options_order_id.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_order_id_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  resource_id = aws_api_gateway_resource.order_id.id
  http_method = aws_api_gateway_method.options_order_id.http_method
  status_code = aws_api_gateway_method_response.options_order_id_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,x-correlation-id,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_order_id_integration]
}

# Deployment & Stage
resource "aws_api_gateway_deployment" "orders_deployment" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.orders.id,
      aws_api_gateway_method.post_orders.id,
      aws_api_gateway_integration.post_orders_integration.id,
      aws_api_gateway_method.options_orders.id,
      aws_api_gateway_integration.options_orders_integration.id,
      aws_api_gateway_resource.order_id.id,
      aws_api_gateway_method.get_order.id,
      aws_api_gateway_integration.get_order_integration.id,
      aws_api_gateway_method.options_order_id.id,
      aws_api_gateway_integration.options_order_id_integration.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.post_orders_integration,
    aws_api_gateway_integration.get_order_integration,
    aws_api_gateway_integration_response.options_orders_integration_response,
    aws_api_gateway_integration_response.options_order_id_integration_response
  ]
}

resource "aws_api_gateway_stage" "dev" {
  deployment_id        = aws_api_gateway_deployment.orders_deployment.id
  rest_api_id          = aws_api_gateway_rest_api.orders_api.id
  stage_name           = var.environment
  xray_tracing_enabled = true
  tags                 = local.common_tags
}

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.orders_api.id
  stage_name  = aws_api_gateway_stage.dev.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled        = true
    logging_level          = "OFF"
    throttling_rate_limit  = 100
    throttling_burst_limit = 200
  }
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "api_gateway_post" {
  statement_id  = "AllowAPIGatewayInvokePost"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.orders_api.execution_arn}/*/*"
}
