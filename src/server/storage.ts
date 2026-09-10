import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
let client: S3Client | undefined;
function storage() {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  } = process.env;
  if (
    !S3_ENDPOINT ||
    !S3_REGION ||
    !S3_BUCKET ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY
  )
    throw new Error("Screenshot storage is not configured");
  client ??= new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    requestHandler: { requestTimeout: 60000, connectionTimeout: 10000 },
  });
  return { client, Bucket: S3_BUCKET };
}
export async function putObject(
  Key: string,
  Body: Buffer,
  ContentType: string,
) {
  const { client, Bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
}
export async function getObject(Key: string) {
  const { client, Bucket } = storage();
  return client.send(new GetObjectCommand({ Bucket, Key }));
}
export async function deleteObject(Key: string) {
  const { client, Bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
}
export async function checkStorage() {
  const { client, Bucket } = storage();
  await client.send(new HeadBucketCommand({ Bucket }));
}
