#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ScraperServiceStack } from '../lib/infrastructure-stack';

const app = new cdk.App();
new ScraperServiceStack(app, 'ContextWindowScraperStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  description: 'ECS Fargate service for context-window scraper',
  terminationProtection: false,
});
