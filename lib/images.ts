"use client";

// Client-side image pipeline: validate -> normalize -> hash -> upload.
// Bytes never transit our servers; PUT goes browser -> S3 via presigned URL.

import { supabase } from "@/lib/supabase";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_EDGE_PX = 2048;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export class RejectedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RejectedImageError";
  }
}

export interface PreparedImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  hash: string;
  fileName: string;
}

function sniffMime(head: Uint8Array, fileType: string): string | "gif" | "svg" | null {
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "gif";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
    return "image/png";
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  )
    return "image/webp";
  const box = String.fromCharCode(...head.slice(4, 12));
  if (box.startsWith("ftyp")) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx")
      return "image/heic";
    if (brand === "mif1" || brand === "msf1") return "image/heif";
  }
  if (fileType === "image/svg+xml") return "svg";
  return null;
}

async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

async function convertHeic(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const out = (await heic2any({ blob, toType: "image/jpeg", quality: 0.9 })) as
    | Blob
    | Blob[];
  const jpeg = Array.isArray(out) ? out[0] : out;
  return jpeg;
}

async function downscale(blob: Blob, mimeType: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const longest = Math.max(bitmap.width, bitmap.height);
  // JPEG/WebP always round-trip through canvas even when already small:
  // that strips EXIF (GPS, orientation) before bytes leave the device.
  // PNG/AVIF pass through untouched to avoid recompression cost.
  const mustStrip = mimeType === "image/jpeg" || mimeType === "image/webp";
  if (longest <= MAX_EDGE_PX && !mustStrip) {
    bitmap.close();
    return blob;
  }
  const scale = MAX_EDGE_PX / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType === "image/png" ? "image/png" : "image/jpeg", 0.88)
  );
  return out ?? blob;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate + normalize a user-supplied file. Throws RejectedImageError. */
export async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new RejectedImageError("Image must be between 1 byte and 20MB");
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffMime(head, file.type);
  if (sniffed === "gif") {
    throw new RejectedImageError("GIFs aren't supported in v1 — try a still image");
  }
  if (sniffed === "svg" || file.type === "image/svg+xml") {
    throw new RejectedImageError("SVG isn't supported in v1");
  }
  const declared = EXT_BY_MIME[file.type] ? file.type : null;
  const mimeType = sniffed && sniffed in EXT_BY_MIME ? sniffed : declared;
  if (!mimeType) {
    throw new RejectedImageError("Unsupported image type (jpeg, png, webp, avif, heic only)");
  }

  let blob: Blob = file;
  let effectiveMime = mimeType;
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    blob = await convertHeic(file);
    effectiveMime = "image/jpeg";
  }
  blob = await downscale(blob, effectiveMime);
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new RejectedImageError("Processed image still exceeds 20MB");
  }

  let width = 0;
  let height = 0;
  try {
    ({ width, height } = await readDimensions(blob));
  } catch {
    throw new RejectedImageError("Couldn't read that image — try another file");
  }
  const hash = await sha256Hex(blob);
  return {
    blob,
    mimeType: effectiveMime,
    width,
    height,
    sizeBytes: blob.size,
    hash,
    fileName: file.name || `image.${EXT_BY_MIME[effectiveMime]}`,
  };
}

export interface PresignedUpload {
  putUrl: string;
  key: string;
  itemId: string;
  cdnBase: string;
}

/** Fire-and-forget: ask the server to build thumb/display variants now.
 *  The daily cron is the backstop; failures here are silent by design. */
export async function requestVariantProcessing(id: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await fetch("/api/images/process-variants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });
  } catch {
    // Cron backstop covers it.
  }
}

const DIRECT_IMAGE_EXT = /\.(jpe?g|png|webp|avif|he(ic|if))(\?.*)?$/i;

/** Extension heuristic: does this URL look like a direct image file? */
export function isDirectImageUrl(url: string): boolean {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return DIRECT_IMAGE_EXT.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Re-host a remote image URL into the library. Returns the new row id. */
export async function importImageUrl(
  url: string,
  opts?: { note?: string; tags?: string[] }
): Promise<{ id: string; deduped: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in to save images");

  const res = await fetch("/api/images/from-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, note: opts?.note ?? "", tags: opts?.tags ?? [] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || "Couldn't save that image");
  }
  return { id: body.id as string, deduped: Boolean(body.deduped) };
}

/** Mint a scoped PUT URL (auth via Supabase JWT) and upload bytes to S3. */
export async function uploadPreparedImage(
  prepared: PreparedImage
): Promise<PresignedUpload> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in to upload images");

  const res = await fetch("/api/images/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      contentType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
      hash: prepared.hash,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Couldn't start image upload");
  }
  const presigned = (await res.json()) as PresignedUpload;

  const put = await fetch(presigned.putUrl, {
    method: "PUT",
    headers: { "Content-Type": prepared.mimeType },
    body: prepared.blob,
  });
  if (!put.ok) throw new Error("Image upload failed — try again");
  return presigned;
}
