/**
 * Copies every uploaded file (Aadhaar copies, agreements) from the Supabase
 * `onboarding-aadhaar` bucket to the Cloudflare R2 bucket, under the same name.
 *
 *   npm run uploads:copy-to-r2              copy, then verify each file's size in R2
 *   npm run uploads:copy-to-r2 -- --dry-run list what would be copied
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the four R2_* variables
 * (see lib/onboarding/r2.server.ts) in the environment. Safe to re-run: a file
 * already in R2 at the same size is skipped. It never deletes anything — empty
 * the Supabase bucket yourself once the console has been reading from R2.
 */
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const SOURCE_BUCKET = "onboarding-aadhaar";
const dryRun = process.argv.includes("--dry-run");

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const r2 = new AwsClient({
  accessKeyId: need("R2_ACCESS_KEY_ID"),
  secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
  retries: 2,
});
const base = `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${encodeURIComponent(need("R2_BUCKET"))}`;
const url = (key) => `${base}/${encodeURIComponent(key)}`;

/** Size of the object in R2, or null if it is not there. */
async function sizeInR2(key) {
  const res = await r2.fetch(url(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`);
  return Number(res.headers.get("content-length"));
}

async function listSource() {
  const names = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).list("", { limit: 1000, offset });
    if (error) throw new Error(`Could not list ${SOURCE_BUCKET}: ${error.message}`);
    // Only our own files: 32 hex characters, as store.server.ts names them.
    names.push(...data.filter((o) => /^[a-f0-9]{32}$/.test(o.name)).map((o) => o.name));
    if (data.length < 1000) return names;
  }
}

const names = await listSource();
console.log(`${names.length} file(s) in Supabase ${SOURCE_BUCKET}.${dryRun ? " Dry run — nothing is copied." : ""}`);

let copied = 0;
let skipped = 0;
const failed = [];

for (const name of names) {
  try {
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).download(name);
    if (error || !data) throw new Error(error?.message ?? "download failed");
    const bytes = new Uint8Array(await data.arrayBuffer());

    const existing = await sizeInR2(name);
    if (existing === bytes.byteLength) {
      skipped++;
      continue;
    }
    if (existing !== null) throw new Error(`already in R2 with a different size (${existing} vs ${bytes.byteLength})`);
    if (dryRun) {
      console.log(`would copy ${name} (${bytes.byteLength} bytes)`);
      copied++;
      continue;
    }

    const put = await r2.fetch(url(name), {
      method: "PUT",
      body: bytes.buffer,
      headers: { "content-type": data.type || "application/octet-stream", "if-none-match": "*" },
    });
    if (!put.ok) throw new Error(`R2 PUT ${put.status}`);
    if ((await sizeInR2(name)) !== bytes.byteLength) throw new Error("size in R2 does not match after copying");
    copied++;
  } catch (error) {
    failed.push(name);
    console.error(`FAILED ${name}: ${error.message}`);
  }
}

console.log(`${dryRun ? "Would copy" : "Copied"} ${copied}, already in R2 ${skipped}, failed ${failed.length}.`);
process.exit(failed.length > 0 ? 1 : 0);
