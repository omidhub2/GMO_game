import { GetObjectCommand, PutObjectCommand, S3Client, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_BUCKET = "assets";
const DEFAULT_UPLOAD_PREFIX = "uploads/";
const MAX_SIGNED_URL_SECONDS = 3600;

let s3Client: S3Client | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getBucket(): string {
  return process.env.AWS_S3_BUCKET?.trim() || DEFAULT_BUCKET;
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const endpoint = requiredEnv("AWS_ENDPOINT_URL_S3");
  const region = requiredEnv("AWS_REGION");
  const accessKeyId = requiredEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("AWS_SECRET_ACCESS_KEY");

  s3Client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

export function validateUploadKey(key: string): string {
  const normalized = key.trim();
  if (
    !normalized.startsWith(DEFAULT_UPLOAD_PREFIX) ||
    normalized.length > 512 ||
    normalized.includes("\\") ||
    normalized.split("/").some((segment) => segment === ".." || segment === ".") ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error("Object key must be a safe path under uploads/.");
  }
  return normalized;
}

function validateExpiry(expiresIn: number): number {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_SIGNED_URL_SECONDS) {
    throw new Error(`Signed URL expiry must be between 1 and ${MAX_SIGNED_URL_SECONDS} seconds.`);
  }
  return expiresIn;
}

/** Upload bytes from trusted server-side code. Never pass credentials to the browser. */
export async function putPrivateObject(input: {
  key: string;
  body: NonNullable<PutObjectCommandInput["Body"]>;
  contentType: string;
}) {
  const key = validateUploadKey(input.key);
  if (!input.contentType.trim() || /[\r\n]/.test(input.contentType)) {
    throw new Error("A valid content type is required.");
  }

  return getS3Client().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: input.body,
    ContentType: input.contentType,
  }));
}

/** Create a short-lived upload URL. Call only after application authorization succeeds. */
export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const key = validateUploadKey(input.key);
  if (!input.contentType.trim() || /[\r\n]/.test(input.contentType)) {
    throw new Error("A valid content type is required.");
  }

  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: input.contentType }),
    { expiresIn: validateExpiry(input.expiresIn ?? 300) },
  );
}

/** Create a short-lived read URL for a known object after application authorization succeeds. */
export async function createDownloadUrl(input: {
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const key = validateUploadKey(input.key);
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: validateExpiry(input.expiresIn ?? 300) },
  );
}
