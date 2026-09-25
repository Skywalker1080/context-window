/**
 * Backfill missing link thumbnails (og:image / YouTube oEmbed).
 *
 * Fills `links.thumbnail` for your own rows where it is empty, using the
 * same sources as the app: YouTube oEmbed for YouTube URLs, otherwise the
 * Next.js scrape proxy (requires `npm run dev` when BASE_URL is localhost).
 *
 * Usage (PowerShell):
 *   $env:THUMBNAIL_BACKFILL_EMAIL="you@example.com"
 *   $env:THUMBNAIL_BACKFILL_PASSWORD="your-password"
 *   npm run backfill:thumbnails
 *
 * Optional:
 *   $env:THUMBNAIL_BACKFILL_BASE_URL="https://your-prod-url"  (default http://localhost:3000)
 *
 * Only touches your own rows (authenticated via Supabase, RLS applies).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.THUMBNAIL_BACKFILL_EMAIL || process.argv[2];
const PASSWORD = process.env.THUMBNAIL_BACKFILL_PASSWORD || process.argv[3];
const BASE_URL =
  process.env.THUMBNAIL_BACKFILL_BASE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local"
  );
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error(
    "Set THUMBNAIL_BACKFILL_EMAIL + THUMBNAIL_BACKFILL_PASSWORD (or pass as args)."
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isYoutube = (url) => url.includes("youtube.com") || url.includes("youtu.be");

async function resolveThumbnail(url) {
  if (isYoutube(url)) {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.thumbnail_url || "";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE_URL}/api/scrape?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.thumbnail || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (signInError) {
  console.error("Sign-in failed:", signInError.message);
  process.exit(1);
}

const { data: links, error: listError } = await supabase
  .from("links")
  .select("id, url")
  .or("thumbnail.is.null,thumbnail.eq.");
if (listError) {
  console.error("List failed:", listError.message);
  process.exit(1);
}

console.log(`Found ${links.length} link(s) without a thumbnail.`);
let updated = 0;
let skipped = 0;
for (const link of links) {
  const thumbnail = await resolveThumbnail(link.url);
  if (!thumbnail) {
    skipped++;
    console.log(`  - no image: ${link.url}`);
  } else {
    const { error: updateError } = await supabase
      .from("links")
      .update({ thumbnail })
      .eq("id", link.id);
    if (updateError) {
      skipped++;
      console.log(`  ! update failed: ${link.url} (${updateError.message})`);
    } else {
      updated++;
      console.log(`  + backfilled: ${link.url}`);
    }
  }
  await sleep(500); // be polite to the scraper + oEmbed
}

console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
await supabase.auth.signOut();
