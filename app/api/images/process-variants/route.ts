import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { processOne, type PendingRow } from "@/lib/image-worker";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const IMAGE_REGION = process.env.IMAGE_AWS_REGION || "us-east-1";
const IMAGE_CDN_BASE = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || "";

// Indie-scale worker: eager POST per upload (seconds) + daily cron backstop
// (Hobby plan allows daily crons only). Until variants exist, cards serve the
// original via CDN (graceful fallback). Upgrade path: S3-event Lambda.
const BATCH_LIMIT = 5;

/**
 * GET /api/images/process-variants (Vercel Cron, daily backstop)
 *
 * Processes the oldest unprocessed library images (thumbnail='').
 * Primary path is the eager POST below, fired right after each upload.
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

  for (const row of (rows ?? []) as PendingRow[]) {
    try {
      const outcome = await processOne(sb, s3, IMAGE_BUCKET, IMAGE_CDN_BASE, row);
      if (outcome === "ok") processed++;
      else quarantined++;
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

/**
 * POST /api/images/process-variants { id } (user JWT)
 *
 * Eager path: fired fire-and-forget by the client right after an upload or
 * URL import lands, so variants exist within seconds. Ownership is enforced
 * by selecting the row through RLS before the service role touches it.
 */
export async function POST(req: Request) {
  if (!SERVICE_ROLE_KEY || !IMAGE_BUCKET) {
    return NextResponse.json({ error: "Variant worker not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = auth.slice("Bearer ".length);

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // RLS read: proves the row belongs to the caller.
  const authed = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: row, error } = await authed
    .from("links")
    .select("id, user_id, file_key, mime_type, metadata")
    .eq("id", id)
    .eq("kind", "image")
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const s3 = new S3Client({ region: IMAGE_REGION });
  try {
    const outcome = await processOne(sb, s3, IMAGE_BUCKET, IMAGE_CDN_BASE, row as PendingRow);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error(`/api/images/process-variants eager failed for ${id}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
