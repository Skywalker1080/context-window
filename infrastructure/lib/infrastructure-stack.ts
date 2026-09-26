import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
          },
          secrets: {
            API_SECRET: ecs.Secret.fromSsmParameter(
              ssm.StringParameter.fromSecureStringParameterAttributes(
                this,
                'ApiSecret',
                { parameterName: '/context-window-scraper/api-secret' }
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
