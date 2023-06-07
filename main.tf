terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      prefix = "roamjs-smartblocks"
    }
  }
  required_providers {
    github = {
      source = "integrations/github"
      version = "4.2.0"
    }
  }
}

variable "aws_access_token" {
  type = string
}

variable "aws_secret_token" {
  type = string
}

variable "developer_token" {
  type = string
}

variable "github_token" {
  type = string
}

provider "aws" {
  region = "us-east-1"
  access_key = var.aws_access_token
  secret_key = var.aws_secret_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

module "roamjs_lambda" {
  source = "dvargas92495/lambda/roamjs"
  providers = {
    aws = aws
    github = github
  }

  name = "smartblocks"
  lambdas = [
    { 
      path = "smartblocks-store", 
      method = "get"
    },
    { 
      path = "smartblocks-store", 
      method = "put"
    },
    { 
      path = "smartblocks-store", 
      method = "delete"
    },
  ]
  aws_access_token = var.aws_access_token
  aws_secret_token = var.aws_secret_token
  github_token     = var.github_token
  developer_token  = var.developer_token
}

resource "aws_dynamodb_table" "store" {
  name           = "RoamJSSmartBlocks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uuid"

  attribute {
    name = "uuid"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "name"
    type = "S"
  }

  attribute {
    name = "author"
    type = "S"
  }

  global_secondary_index {
    hash_key           = "status"
    name               = "status-index"
    non_key_attributes = []
    projection_type    = "ALL"
    read_capacity      = 0
    write_capacity     = 0
  }

  global_secondary_index {
    hash_key           = "name"
    name               = "name-index"
    non_key_attributes = []
    projection_type    = "ALL"
    read_capacity      = 0
    write_capacity     = 0
  }

  global_secondary_index {
    hash_key           = "author"
    name               = "status-author-index"
    non_key_attributes = []
    projection_type    = "ALL"
    range_key          = "status"
    read_capacity      = 0
    write_capacity     = 0
  }

  global_secondary_index {
    hash_key           = "name"
    name               = "name-author-index"
    non_key_attributes = []
    projection_type    = "ALL"
    range_key          = "author"
    read_capacity      = 0
    write_capacity     = 0
  }

  global_secondary_index {
    hash_key           = "status"
    name               = "name-status-index"
    non_key_attributes = []
    projection_type    = "ALL"
    range_key          = "name"
    read_capacity      = 0
    write_capacity     = 0
  }

  tags = {
    Application = "Roam JS Extensions"
  }
}

data "aws_iam_role" "lambda_execution" {
  name = "roam-js-extensions-lambda-execution"
}

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = [
      "arn:aws:s3:::roamjs-smartblocks/*",
    ]

    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.lambda_execution.arn]
    }
  }
}

resource "aws_s3_bucket" "main" {
  bucket = "roamjs-smartblocks"
  policy = data.aws_iam_policy_document.bucket_policy.json
  tags = {
    Application = "Roam JS Extensions"
  }
}
