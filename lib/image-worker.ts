// Server-only image variant worker core (imported by API routes, never the
// browser bundle). Converts one S3 original into thumb + display webp.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMMUTABLE_CACHE = "public,max-age=31536000,immutable";

export interface PendingRow {
  id: string;
  user_id: string;
  file_key: string;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
}

type SbClient = SupabaseClient<any>;

export async function dropPoisonRow(
  sb: SbClient,
  s3: S3Client,
  bucket: string,
  row: PendingRow
) {
  // Undecodable/oversize originals would otherwise retry forever
  // (thumbnail stays ''). Self-clean: remove bytes + row, log it.
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: [{ Key: row.file_key }] },
    })
  );
  await sb.from("links").delete().eq("id", row.id);
}

/** Convert one original into thumb + display variants; "ok" | "quarantined". */
export async function processOne(
  sb: SbClient,
  s3: S3Client,
  bucket: string,
  cdnBase: string,
  row: PendingRow
): Promise<"ok" | "quarantined"> {
  const m = /^originals\/([^/]+)\/([^/]+)\.[^./]+$/.exec(row.file_key);
  if (!m) return "quarantined";
  const [, uid, itemId] = m;
  const thumbKey = `variants/${uid}/${itemId}/thumb_400.webp`;
  const displayKey = `variants/${uid}/${itemId}/display_1600.webp`;

  const obj = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: row.file_key })
  );
  if (!obj.Body) throw new Error("empty original");
  const chunks: Uint8Array[] = [];
  for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
    chunks.push(
      chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer)
    );
  }
  const original = Buffer.concat(chunks);
  // Belt-and-braces: presigned PUTs can't carry a Content-Length
  // condition, so enforce the 20MB cap on actual bytes here.
  if (original.byteLength === 0 || original.byteLength > MAX_IMAGE_BYTES) {
    await dropPoisonRow(sb, s3, bucket, row);
    return "quarantined";
  }

  const meta = await sharp(original, { failOn: "none" })
    .metadata()
    .catch(() => null);
  if (!meta?.width || !meta?.height) {
    await dropPoisonRow(sb, s3, bucket, row);
    return "quarantined";
  }

  const [thumb, display] = await Promise.all([
    sharp(original)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
    sharp(original)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
  ]);

  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumb,
        ContentType: "image/webp",
        CacheControl: IMMUTABLE_CACHE,
      })
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: displayKey,
        Body: display,
        ContentType: "image/webp",
        CacheControl: IMMUTABLE_CACHE,
      })
    ),
  ]);

  const base = cdnBase.replace(/\/$/, "");
  const displayUrl = base ? `${base}/${displayKey}` : displayKey;
  const thumbUrl = base ? `${base}/${thumbKey}` : thumbKey;

  const { error: updateError } = await sb
    .from("links")
    .update({
      thumbnail: displayUrl,
      width: meta.width,
      height: meta.height,
      // Merge: preserve hash / sourceUrl stored at insert time.
      metadata: {
        ...(row.metadata ?? {}),
        variants: { thumb: thumbUrl, display: displayUrl },
      },
    })
    .eq("id", row.id);
  if (updateError) throw updateError;
  return "ok";
}
