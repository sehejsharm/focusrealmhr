import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2, through its S3-compatible API. SERVER ONLY — the keys below
 * can read every Aadhaar copy. Used by store.server.ts and nothing else.
 *
 *   R2_ACCOUNT_ID         the Cloudflare account id
 *   R2_ACCESS_KEY_ID      an R2 API token's access key, scoped to the bucket below
 *   R2_SECRET_ACCESS_KEY  its secret
 *   R2_BUCKET             the bucket, e.g. focusrealm-onboarding — never made public
 *
 * With any of them unset, r2() returns null and uploads stay on Supabase.
 */

export interface R2 {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Null when there is no such object. */
  get(key: string): Promise<Buffer | null>;
}

let cached: R2 | null | undefined;

export function r2(): R2 | null {
  if (cached !== undefined) return cached;

  const account = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return (cached = null);

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 2 });
  const base = `https://${account}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`;
  const url = (key: string) => `${base}/${encodeURIComponent(key)}`;

  cached = {
    async put(key, bytes, contentType) {
      const res = await client.fetch(url(key), {
        method: "PUT",
        // Exactly these bytes, as a plain ArrayBuffer (a Buffer may share a larger pool).
        body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        // Never overwrite: a name that already exists is refused (412).
        headers: { "content-type": contentType || "application/octet-stream", "if-none-match": "*" },
      });
      if (!res.ok) throw new Error(`R2 refused the upload (${res.status}).`);
    },
    async get(key) {
      const res = await client.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 could not return the file (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
  return cached;
}
