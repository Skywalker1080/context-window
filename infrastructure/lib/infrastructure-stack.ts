import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ScraperServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = 'context-window-scraper';

    const vpc = new ec2.Vpc(this, 'ScraperVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    const repository = new ecr.Repository(this, 'ScraperRepo', {
      repositoryName: appName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const cluster = new ecs.Cluster(this, 'ScraperCluster', {
      clusterName: `${appName}-cluster`,
      vpc,
    });

    const logGroup = new logs.LogGroup(this, 'ScraperLogGroup', {
      logGroupName: `/ecs/${appName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'ScraperFargateService',
      {
        cluster,
        serviceName: appName,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
          containerPort: 3000,
          environment: {
            PORT: '3000',
            NODE_ENV: 'production',
            ENABLE_REDIS: 'false',
            BEDROCK_MODEL_ID: 'global.moonshotai.kimi-k3',
            AWS_REGION: 'us-east-1',
          },
          secrets: {
            API_SECRET: ecs.Secret.fromSsmParameter(
              ssm.StringParameter.fromSecureStringParameterAttributes(
                this,
                'ApiSecret',
                { parameterName: '/context-window-scraper/api-secret' }
              )
            ),
            SUPABASE_URL: ecs.Secret.fromSsmParameter(
              ssm.StringParameter.fromSecureStringParameterAttributes(
                this,
                'SupabaseUrl',
                { parameterName: '/context-window-scraper/supabase-url' }
              )
            ),
            SUPABASE_SERVICE_ROLE_KEY: ecs.Secret.fromSsmParameter(
              ssm.StringParameter.fromSecureStringParameterAttributes(
                this,
                'SupabaseServiceRoleKey',
                { parameterName: '/context-window-scraper/supabase-service-role-key' }
              )
            ),
          },
          logDriver: ecs.LogDriver.awsLogs({
            streamPrefix: 'scraper',
            logGroup,
          }),
        },
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
        assignPublicIp: true,
      }
    );

    // Allow the task to invoke Bedrock models. Covers foundation-model ARNs
    // in every region (cross-region inference resolves to the target region's
    // ARN) plus inference-profile ARNs on this account.
    fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    );

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'Scraper service URL',
    });

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR repository URI for pushing images',
    });
  }
}
