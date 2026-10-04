import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const IMAGE_REGION = process.env.IMAGE_AWS_REGION || "us-east-1";
const IMAGE_CDN_BASE = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || "";

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 0) return true;
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("ff")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function sniffMime(head: Uint8Array): string | null {
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "gif";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
    return "image/png";
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  )
    return "image/webp";
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (brand === "mif1" || brand === "msf1") return "image/heif";
  }
  return null;
}

async function fetchSafeImage(startUrl: string): Promise<Buffer> {
  let current: string;
  try {
    const parsed = new URL(startUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http(s) image URLs are supported");
    }
    current = parsed.toString();
  } catch {
    throw new Error("That doesn't look like a valid image URL");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    const resolved = await lookup(parsed.hostname).catch(() => null);
    const ips = resolved
      ? [resolved, ...(await lookup(parsed.hostname, { all: true }).catch(() => []))]
      : [];
    const candidates = [...new Set(ips.map((r) => (typeof r === "string" ? r : r.address)))];
    if (candidates.length === 0 || candidates.some(isBlockedIp)) {
      throw new Error("That host isn't reachable for image import");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "context-window-image-import/1.0" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      await res.arrayBuffer().catch(() => null);
      continue;
    }
    if (!res.ok || !res.body) {
      throw new Error(`Image fetch failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => null);
        throw new Error("Remote image exceeds the 20MB cap");
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    if (buf.byteLength === 0) throw new Error("Remote file was empty");
    return buf;
  }
  throw new Error("Too many redirects");
}

/**
 * POST /api/images/from-url
 *
 * Re-hosts a remote image into our own storage so library cards never
 * hotlink. Body: { url, note?, tags? }. Row insert impersonates the user
 * (RLS applies); S3 write uses the worker credentials.
 */
export async function POST(req: Request) {
  if (!IMAGE_BUCKET) {
    return NextResponse.json(
      { error: "Image storage not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = auth.slice("Bearer ".length);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const note = typeof body?.note === "string" ? body.note : "";
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string")
    : [];
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await fetchSafeImage(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image fetch failed" },
      { status: 400 }
    );
  }

  const sniffed = sniffMime(new Uint8Array(buf.subarray(0, 16)));
  if (sniffed === "gif") {
    return NextResponse.json(
      { error: "GIFs aren't supported in v1" },
      { status: 400 }
    );
  }
  if (!sniffed || !ACCEPTED_MIME.has(sniffed)) {
    return NextResponse.json(
      { error: "Remote file isn't a supported image (jpeg, png, webp, avif, heic)" },
      { status: 400 }
    );
  }

  let meta: { width?: number; height?: number };
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that image — try another URL" },
      { status: 400 }
    );
  }
  if (!meta.width || !meta.height) {
    return NextResponse.json(
      { error: "Couldn't read that image — try another URL" },
      { status: 400 }
    );
  }

  const hash = await crypto.subtle
    .digest("SHA-256", new Uint8Array(buf))
    .then((d) =>
      [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
    );

  const authed = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: dupe } = await authed
    .from("links")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "image")
    .contains("metadata", { hash })
    .limit(1)
    .maybeSingle();
  if (dupe) {
    return NextResponse.json({ ok: true, deduped: true, id: dupe.id });
  }

  const itemId = randomUUID();
  const key = `originals/${userId}/${itemId}.${EXT_BY_MIME[sniffed]}`;
  try {
    const s3 = new S3Client({ region: IMAGE_REGION });
    await s3.send(
      new PutObjectCommand({
        Bucket: IMAGE_BUCKET,
        Key: key,
        Body: buf,
        ContentType: sniffed,
      })
    );
  } catch (err) {
    console.error("/api/images/from-url S3 error:", err);
    return NextResponse.json({ error: "Failed to store image" }, { status: 502 });
  }

  const publicUrl = IMAGE_CDN_BASE
    ? `${IMAGE_CDN_BASE.replace(/\/$/, "")}/${key}`
    : key;
  let host = "";
  try {
    host = new URL(url).hostname.replace("www.", "");
  } catch {
    host = "image";
  }

  const { data, error } = await authed
    .from("links")
    .insert({
      user_id: userId,
      kind: "image",
      url: publicUrl,
      title: host,
      description: "",
      favicon: "",
      thumbnail: "",
      file_key: key,
      mime_type: sniffed,
      width: meta.width,
      height: meta.height,
      size_bytes: buf.byteLength,
      metadata: { hash, sourceUrl: url },
      note,
      status: "library",
      category: "Images",
      tags,
      collection_ids: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("/api/images/from-url insert error:", error);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
