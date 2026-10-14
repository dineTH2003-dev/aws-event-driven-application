.PHONY: help install test test-coverage lint format tf-fmt tf-validate tf-plan tf-apply clean

AWS_PROFILE ?= account2
AWS_REGION ?= ap-south-1

help:
	@echo "AWS Event-Driven Application — Developer Commands"
	@echo "================================================="
	@echo "install        : Install npm dependencies"
	@echo "test           : Run unit tests with Jest"
	@echo "test-coverage  : Run unit tests with coverage report"
	@echo "lint           : Run ESLint checks"
	@echo "format         : Format code and docs with Prettier"
	@echo "tf-fmt         : Check Terraform code formatting"
	@echo "tf-validate    : Initialize and validate Terraform configuration"
	@echo "tf-plan        : Run terraform plan with profile $(AWS_PROFILE) in $(AWS_REGION)"
	@echo "clean          : Clean build artifacts and coverage reports"

install:
	npm ci

test:
	npm test

test-coverage:
	npm run test:coverage

lint:
	npm run lint

format:
	npm run format

tf-fmt:
	terraform -chdir=infrastructure/terraform fmt -check -recursive

tf-validate:
	terraform -chdir=infrastructure/terraform init -backend=false
	terraform -chdir=infrastructure/terraform validate

tf-plan:
	@export AWS_PROFILE=$(AWS_PROFILE); \
	export AWS_REGION=$(AWS_REGION); \
	aws sts get-caller-identity; \
	terraform -chdir=infrastructure/terraform plan

clean:
	rm -rf coverage dist build *.zip
