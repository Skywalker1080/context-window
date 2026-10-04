#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ScraperServiceStack } from '../lib/infrastructure-stack';
import { ImageStorageStack } from '../lib/image-storage-stack';

const app = new cdk.App();
new ScraperServiceStack(app, 'ContextWindowScraperStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  description: 'ECS Fargate service for context-window scraper',
  terminationProtection: false,
});
new ImageStorageStack(app, 'ContextWindowImageStorageStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Private S3 image store + CloudFront CDN (library images)',
  terminationProtection: true,
});
