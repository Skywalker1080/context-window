import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const IMAGE_REGION = process.env.IMAGE_AWS_REGION || "us-east-1";
const IMAGE_CDN_BASE = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || "";

// Indie-scale worker: a 10-minute cron converting a few originals per run.
// Upgrade path when this saturates: S3 ObjectCreated -> Lambda(sharp).
// Until variants exist, cards serve the original via CDN (graceful fallback).
const BATCH_LIMIT = 5;
const IMMUTABLE_CACHE = "public,max-age=31536000,immutable";

interface PendingRow {
  id: string;
  user_id: string;
  file_key: string;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * GET /api/images/process-variants (Vercel Cron, every 10 min)
 *
 * For the oldest unprocessed library images (thumbnail=''): reads the
 * original, writes thumb_400 + display_1600 webp variants, patches the row
 * (thumbnail display URL, verified w/h, metadata.variants). Cards pick the
 * swap up via Realtime with no refresh.
 */
export async function GET(req: Request) {
  if (!CRON_SECRET || !SERVICE_ROLE_KEY || !IMAGE_BUCKET) {
    return NextResponse.json({ error: "Variant worker not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await sb
    .from("links")
    .select("id, user_id, file_key, mime_type, metadata")
    .eq("kind", "image")
    .eq("status", "library")
    .eq("thumbnail", "")
    .not("file_key", "is", null)
    .order("created_at")
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("/api/images/process-variants select error:", error);
    return NextResponse.json({ error: "Worker query failed" }, { status: 500 });
  }

  const s3 = new S3Client({ region: IMAGE_REGION });
  let processed = 0;
  let quarantined = 0;
  const errors: { id: string; error: string }[] = [];

  const dropPoisonRow = async (row: PendingRow, reason: string) => {
    // Undecodable/oversize originals would otherwise retry forever
    // (thumbnail stays ''). Self-clean: remove bytes + row, log it.
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: IMAGE_BUCKET,
          Delete: { Objects: [{ Key: row.file_key }] },
        })
      );
      await sb.from("links").delete().eq("id", row.id);
      quarantined++;
    } catch (err) {
      console.error(`/api/images/process-variants quarantine failed for ${row.id}:`, err);
      errors.push({
        id: row.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  };

  for (const row of (rows ?? []) as PendingRow[]) {
    const m = /^originals\/([^/]+)\/([^/]+)\.[^./]+$/.exec(row.file_key);
    if (!m) {
      errors.push({ id: row.id, error: "unexpected file_key shape" });
      continue;
    }
    const [, uid, itemId] = m;
    const thumbKey = `variants/${uid}/${itemId}/thumb_400.webp`;
    const displayKey = `variants/${uid}/${itemId}/display_1600.webp`;
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: IMAGE_BUCKET, Key: row.file_key })
      );
      if (!obj.Body) throw new Error("empty original");
      const chunks: Uint8Array[] = [];
      for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer));
      }
      const original = Buffer.concat(chunks);
      // Belt-and-braces: presigned PUTs can't carry a Content-Length
      // condition, so enforce the 20MB cap on actual bytes here.
      if (original.byteLength === 0 || original.byteLength > 20 * 1024 * 1024) {
        await dropPoisonRow(row, "oversize-or-empty");
        continue;
      }

      const pipeline = sharp(original, { failOn: "none" });
      const meta = await pipeline.metadata().catch(() => null);
      if (!meta?.width || !meta?.height) {
        await dropPoisonRow(row, "undecodable");
        continue;
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
            Bucket: IMAGE_BUCKET,
            Key: thumbKey,
            Body: thumb,
            ContentType: "image/webp",
            CacheControl: IMMUTABLE_CACHE,
          })
        ),
        s3.send(
          new PutObjectCommand({
            Bucket: IMAGE_BUCKET,
            Key: displayKey,
            Body: display,
            ContentType: "image/webp",
            CacheControl: IMMUTABLE_CACHE,
          })
        ),
      ]);

      const displayUrl = IMAGE_CDN_BASE
        ? `${IMAGE_CDN_BASE.replace(/\/$/, "")}/${displayKey}`
        : displayKey;
      const thumbUrl = IMAGE_CDN_BASE
        ? `${IMAGE_CDN_BASE.replace(/\/$/, "")}/${thumbKey}`
        : thumbKey;

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
      processed++;
    } catch (err) {
      console.error(`/api/images/process-variants failed for ${row.id}:`, err);
      errors.push({
        id: row.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  console.log(
    JSON.stringify({ job: "image-variants", processed, quarantined, errorCount: errors.length })
  );
  return NextResponse.json({ ok: true, processed, quarantined, errorCount: errors.length, errors });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
