import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { bucket, createS3Client } from './s3-client.ts';

const client = createS3Client();
try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('Private product-images bucket already exists.');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('$metadata' in error) ||
      (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404
    )
      throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log('Created private product-images bucket.');
  }
} finally {
  client.destroy();
}
