import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const requiredBucketVariables = [
  'BUCKET_ENDPOINT',
  'BUCKET_ACCESS_KEY_ID',
  'BUCKET_SECRET_ACCESS_KEY',
  'BUCKET_NAME',
] as const;

function bucketConfig() {
  const missing = requiredBucketVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`File storage is not configured (missing ${missing.join(', ')}).`);
  }

  const endpoint = process.env.BUCKET_ENDPOINT!;
  const forcePathStyle = process.env.BUCKET_FORCE_PATH_STYLE === 'true'
    || endpoint.includes('localhost')
    || endpoint.includes('127.0.0.1');

  return {
    bucket: process.env.BUCKET_NAME!,
    client: new S3Client({
      endpoint,
      region: process.env.BUCKET_REGION || 'us-east-1',
      forcePathStyle,
      credentials: {
        accessKeyId: process.env.BUCKET_ACCESS_KEY_ID!,
        secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY!,
      },
    }),
  };
}

export async function storeDocument(input: {
  path: string;
  body: Uint8Array;
  contentType: string;
}) {
  const { client, bucket } = bucketConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.path,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

/** Private files are delivered only through a five-minute S3 presigned URL. */
export async function getDocumentDownloadUrl(input: { path: string; filename: string }) {
  const { client, bucket } = bucketConfig();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: input.path,
      ResponseContentDisposition: `attachment; filename="${input.filename.replaceAll('"', '')}"`,
    }),
    { expiresIn: 60 * 5 },
  );
}

/** Read a private document server-side so it can be supplied to Gemini. */
export async function getDocumentBytes(path: string) {
  const { client, bucket } = bucketConfig();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
  if (!response.Body) throw new Error('Stored document had no body.');
  return new Uint8Array(await response.Body.transformToByteArray());
}
