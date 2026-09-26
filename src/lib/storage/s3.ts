// S3-compatible object storage (MinIO/AWS/DigitalOcean Spaces) with a
// local-disk fallback for development and offline testing.
//
// Buckets used by the application:
//   "manuscripts" — uploaded DOCX/PDF files
//   "artifacts"   — rendered PDFs and preview PNGs
//
// The local fallback writes to STORAGE_FALLBACK_DIR (default "./storage")
// with slashes in keys flattened to underscores so a key like
// "uploads/job123/manuscript.docx" becomes "uploads_job123_manuscript.docx"
// on disk.  This is safe (no path traversal) and consistent between
// put and get.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

const endpoint = process.env.S3_ENDPOINT || "";
const accessKey = process.env.S3_ACCESS_KEY || "";
const secretKey = process.env.S3_SECRET_KEY || "";
const region = process.env.S3_REGION || "us-east-1";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
const fallbackDir = process.env.STORAGE_FALLBACK_DIR || "./storage";

// Lazily create the S3 client — if credentials are missing we use the
// local-disk fallback exclusively.
let s3Client: S3Client | null = null;
let s3Available = false;

function getS3Client(): S3Client | null {
  if (s3Client !== null) return s3Client;
  if (!endpoint || !accessKey || !secretKey) return null;
  try {
    s3Client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle,
    });
    s3Available = true;
    return s3Client;
  } catch (err) {
    console.warn("[Storage] S3 client init failed, using local fallback:", (err as Error).message);
    return null;
  }
}

// Flatten a slash-separated S3 key into a single filename for local disk
// storage.  This prevents path traversal (e.g. "../../etc/passwd") because
// the resulting name has no directory separators.
function flattenKey(key: string): string {
  return key.replace(/\//g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureFallbackDir(): Promise<string> {
  await fs.mkdir(fallbackDir, { recursive: true });
  return fallbackDir;
}

export interface StorageResult {
  bucket: string;
  key: string;
  size: number;
  backend: "s3" | "local";
}

// Upload a buffer to storage.  Tries S3 first, falls back to local disk.
export async function uploadToStorage(
  key: string,
  buffer: Buffer,
  mimeType: string,
  bucket: string = "manuscripts"
): Promise<StorageResult> {
  const client = getS3Client();

  if (client && s3Available) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      return { bucket, key, size: buffer.length, backend: "s3" };
    } catch (err) {
      console.warn(`[Storage] S3 upload failed for ${bucket}/${key}, using local fallback:`, (err as Error).message);
    }
  }

  // Local-disk fallback
  const dir = await ensureFallbackDir();
  const flatName = flattenKey(key);
  const filePath = path.join(dir, flatName);
  await fs.writeFile(filePath, buffer);
  return { bucket: "local", key: flatName, size: buffer.length, backend: "local" };
}

// Download a buffer from storage.  Tries S3 first, falls back to local disk.
export async function getFromStorage(
  key: string,
  bucket: string = "manuscripts"
): Promise<Buffer> {
  const client = getS3Client();

  if (client && s3Available) {
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      if (!response.Body) throw new Error("Empty response body");
      // @aws-sdk requires streaming the body to a buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      console.warn(`[Storage] S3 download failed for ${bucket}/${key}, trying local fallback:`, (err as Error).message);
    }
  }

  // Local-disk fallback
  const dir = await ensureFallbackDir();
  // Try flattened key first (how it was written)
  const flatName = flattenKey(key);
  const filePath = path.join(dir, flatName);
  try {
    return await fs.readFile(filePath);
  } catch {
    // Also try the raw key in case it was stored with directory structure
    const altPath = path.join(dir, key);
    try {
      return await fs.readFile(altPath);
    } catch {
      throw new Error(`File not found in storage: ${key} (tried ${flatName} and ${key})`);
    }
  }
}

// Generate a presigned download URL.  Falls back to a relative API path
// when S3 is not available (the download route handles the actual fetch).
export async function getPresignedDownloadUrl(
  key: string,
  bucket: string = "artifacts",
  expiresIn: number = 3600
): Promise<string | null> {
  const client = getS3Client();
  if (!client || !s3Available) return null;

  try {
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(client, command, { expiresIn });
  } catch {
    return null;
  }
}
