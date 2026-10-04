import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const IMAGE_REGION = process.env.IMAGE_AWS_REGION || "us-east-1";

// Trash undo window: rows deleted longer ago than this lose their bytes.
const RETENTION_DAYS = 7;
const BATCH_LIMIT = 200;

interface DeletedRow {
  id: string;
  user_id: string;
  file_key: string;
  updated_at: string;
}

/**
 * GET /api/images/sweep (Vercel Cron, nightly 03:00 UTC)
 *
 * Permanently removes S3 objects + rows for images trashed longer than
 * RETENTION_DAYS ago. Trash itself is a soft status='deleted' set from the
 * card menu, so this is the only hard-delete path for image rows.
 *
 * Env: CRON_SECRET (fail-closed), SUPABASE_SERVICE_ROLE_KEY,
 * IMAGE_BUCKET_NAME, AWS creds backed by the image worker managed policy
 * (Put/Get/List/Delete on originals/* + variants/*).
 */
export async function GET(req: Request) {
  if (!CRON_SECRET || !SERVICE_ROLE_KEY || !IMAGE_BUCKET) {
    return NextResponse.json({ error: "Sweep not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 86400000
  ).toISOString();

  const { data: rows, error } = await sb
    .from("links")
    .select("id, user_id, file_key, updated_at")
    .eq("status", "deleted")
    .not("file_key", "is", null)
    .lt("updated_at", cutoff)
    .order("updated_at")
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("/api/images/sweep select error:", error);
    return NextResponse.json({ error: "Sweep query failed" }, { status: 500 });
  }

  const s3 = new S3Client({ region: IMAGE_REGION });
  let swept = 0;
  const errors: { id: string; error: string }[] = [];

  for (const row of (rows ?? []) as DeletedRow[]) {
    // file_key = originals/{uid}/{itemId}.ext -> variant dir below it.
    const m = /^originals\/([^/]+)\/([^/]+)\.[^./]+$/.exec(row.file_key);
    const variantPrefix = m ? `variants/${m[1]}/${m[2]}/` : null;
    try {
      const keys = [row.file_key];
      if (variantPrefix) {
        let token: string | undefined;
        do {
          const listed = await s3.send(
            new ListObjectsV2Command({
              Bucket: IMAGE_BUCKET,
              Prefix: variantPrefix,
              ContinuationToken: token,
            })
          );
          for (const obj of listed.Contents ?? []) {
            if (obj.Key) keys.push(obj.Key);
          }
          token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (token);
      }
      // Delete in chunks of 1000 (S3 multi-object limit).
      for (let i = 0; i < keys.length; i += 1000) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: IMAGE_BUCKET,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
          })
        );
      }
      const { error: delError } = await sb
        .from("links")
        .delete()
        .eq("id", row.id);
      if (delError) throw delError;
      swept++;
    } catch (err) {
      console.error(`/api/images/sweep failed for ${row.id}:`, err);
      errors.push({
        id: row.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  console.log(
    JSON.stringify({ job: "image-sweep", swept, errorCount: errors.length })
  );
  return NextResponse.json({ ok: true, swept, errorCount: errors.length, errors });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
