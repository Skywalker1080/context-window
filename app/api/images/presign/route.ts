import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const IMAGE_REGION = process.env.IMAGE_AWS_REGION || "us-east-1";
const IMAGE_CDN_BASE = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || "";

// v1 allowlist: GIF (animation cost) and SVG (XSS) rejected.
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

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * POST /api/images/presign
 *
 * Mints a short-lived presigned PUT for one image original. Bytes go
 * browser -> S3 directly; this route never sees them. Key is server-chosen
 * under originals/{userId}/ so users can't overwrite each other.
 */
export async function POST(req: Request) {
  if (!IMAGE_BUCKET) {
    return NextResponse.json(
      { error: "Image storage not configured" },
      { status: 503 }
    );
  }

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;

  if (!ACCEPTED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported image type (jpeg, png, webp, avif, heic only)" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 20MB" },
      { status: 400 }
    );
  }

  const itemId = randomUUID();
  const key = `originals/${userId}/${itemId}.${EXT_BY_MIME[contentType]}`;

  try {
    const s3 = new S3Client({ region: IMAGE_REGION });
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: IMAGE_BUCKET,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 60 }
    );
    return NextResponse.json({ putUrl, key, itemId, cdnBase: IMAGE_CDN_BASE });
  } catch (err) {
    console.error("/api/images/presign error:", err);
    return NextResponse.json(
      { error: "Failed to mint upload URL" },
      { status: 502 }
    );
  }
}
