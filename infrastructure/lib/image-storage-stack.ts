import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Private image store + CDN for library images (and future v2 documents).
 *
 * Layout:
 *   originals/{user_id}/{item_id}            <- browser PUTs here (presigned)
 *   variants/{user_id}/{item_id}/thumb_400.webp
 *   variants/{user_id}/{item_id}/display_1600.webp   <- worker writes here
 *
 * The `originals/` prefix exists so the lifecycle rule can move aging
 * originals to Standard-IA while keeping hot thumbnails on Standard.
 */
export class ImageStorageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const accessLogs = new s3.Bucket(this, 'ImageAccessLogs', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Logs are operational, not user data: safe to destroy with the stack.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ id: 'expire-logs', expiration: cdk.Duration.days(90) }],
    });

    const bucket = new s3.Bucket(this, 'ImageBucket', {
      bucketName: `context-window-images-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: accessLogs,
      serverAccessLogsPrefix: 'image-bucket/',
      versioned: false,
      // User data: never auto-delete on stack destroy.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'originals-to-ia',
          prefix: 'originals/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'abort-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    const distribution = new cloudfront.Distribution(this, 'ImageDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      // Cost lever: 100 = North America + Europe only. Move to
      // PRICE_CLASS_ALL if latency outside those regions matters.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Least-privilege presigner for the Next.js /api/images/presign route.
    // Size enforcement happens in the route (declared size checked before
    // minting) and client-side: s3:content-length-range is a POST-policy
    // key and would deny every PutObject if placed on this statement.
    // Provision keys out-of-band:
    //   aws iam create-access-key --user-name <user> -> Vercel env.
    const presigner = new iam.User(this, 'ImageUploadPresigner', {
      userName: 'context-window-image-presigner',
    });
    presigner.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('originals/*')],
      })
    );

    // Worker (Fargate scraper / sweeper) role policy: read originals,
    // write/delete variants + originals. Attach to the task role in the
    // scraper stack; kept here as a managed policy for single-source scope.
    const workerPolicy = new iam.ManagedPolicy(this, 'ImageWorkerPolicy', {
      managedPolicyName: 'context-window-image-worker',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [
            bucket.arnForObjects('originals/*'),
            bucket.arnForObjects('variants/*'),
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:DeleteObject'],
          resources: [
            bucket.arnForObjects('originals/*'),
            bucket.arnForObjects('variants/*'),
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListBucket'],
          resources: [bucket.bucketArn],
          conditions: {
            StringLike: {
              's3:prefix': ['originals/*', 'variants/*'],
            },
          },
        }),
      ],
    });

    new cdk.CfnOutput(this, 'ImageBucketName', {
      value: bucket.bucketName,
      description: 'Private bucket for image originals + variants',
    });
    new cdk.CfnOutput(this, 'ImageCdnDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain for image reads (NEXT_PUBLIC_IMAGE_CDN_BASE)',
    });
    new cdk.CfnOutput(this, 'ImageWorkerPolicyArn', {
      value: workerPolicy.managedPolicyArn,
      description: 'Attach to the scraper/sweeper task role',
    });
  }
}
