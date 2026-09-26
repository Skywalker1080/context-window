#!/usr/bin/env node
/**
 * Backfill LLM enrichments for existing links.
 *
 * Reads pending + failed non-deleted links from Supabase and posts each one to
 * the deployed scraper's /enrich endpoint, with retries, exponential backoff,
 * and rate-limit awareness (honors Retry-After on 429).
 *
 * Reads:
 *   - NEXT_PUBLIC_SUPABASE_URL from .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY from SSM (/context-window-scraper/supabase-service-role-key)
 *   - API_SECRET from SSM (/context-window-scraper/api-secret)
 *
 * Usage:
 *   node scripts/backfill-enrichments.mjs                # default: 3 concurrent
 *   CONCURRENCY=5 node scripts/backfill-enrichments.mjs  # override
 *   DRY_RUN=1 node scripts/backfill-enrichments.mjs      # list only, don't call
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env.local");

const SCRAPER_URL =
  process.env.SCRAPER_SERVICE_URL ||
  "http://Contex-Scrap-bPuOad2Z3F7G-528788321.us-east-1.elb.amazonaws.com";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "3", 10);
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_RETRIES = 4;          // total attempts = 1 + 3 retries
const BASE_DELAY_MS = 1_000;    // 1s, 2s, 4s, 8s …
const MAX_DELAY_MS = 30_000;    // cap backoff at 30s
const REQUEST_TIMEOUT_MS = 90_000;

// ---------- env / secrets ----------

function readEnv(key) {
  const content = readFileSync(ENV_PATH, "utf-8");
  const line = content.split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : undefined;
}

function getSsmParam(name) {
  const out = execSync(
    `aws ssm get-parameter --name ${name} --with-decryption --region us-east-1 --query Parameter.Value --output text`,
    { encoding: "utf-8" }
  );
  return out.trim();
}

const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_URL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  process.exit(1);
}

console.log("Fetching secrets from SSM…");
const SUPABASE_SERVICE_ROLE_KEY = getSsmParam(
  "/context-window-scraper/supabase-service-role-key"
);
const API_SECRET = getSsmParam("/context-window-scraper/api-secret");

// ---------- Supabase helpers ----------

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchPendingLinks() {
  // enrichment_status in (pending, failed) AND status != deleted
  return supabaseGet(
    "links?select=id,user_id,url,enrichment_status&enrichment_status=in.(pending,failed)&status=neq.deleted&order=created_at.asc"
  );
}

async function fetchExistingTagVocabulary() {
  const rows = await supabaseGet("links?select=tags&status=neq.deleted");
  const tagSet = new Set();
  for (const row of rows) {
    for (const tag of row.tags ?? []) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}

// ---------- HTTP with retries + backoff ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postEnrichWithRetry({ url, linkId, userId, existingTags }) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${SCRAPER_URL}/enrich`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": API_SECRET,
          },
          body: JSON.stringify({ url, linkId, userId, existingTags }),
          signal: controller.signal,
        });

        if (res.ok) {
          return { ok: true, status: res.status };
        }

        // Rate limited — honor Retry-After if present
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
          const waitMs = retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
          lastError = new Error(`429 rate-limited (waiting ${waitMs}ms)`);
          await sleep(waitMs);
          continue;
        }

        // Server errors are retryable
        if (res.status >= 500) {
          lastError = new Error(`${res.status} ${await res.text()}`);
          await sleep(backoffMs(attempt));
          continue;
        }

        // 4xx (other than 429) — not retryable
        const body = await res.text();
        return { ok: false, status: res.status, error: body };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      // Network error / timeout — retryable
      lastError = err;
      await sleep(backoffMs(attempt));
    }
  }
  return {
    ok: false,
    status: 0,
    error: lastError?.message || "max retries exceeded",
  };
}

function backoffMs(attempt) {
  // Exponential backoff with full jitter (AWS architecture blog pattern):
  // sleep = random_between(0, min(cap, base * 2^attempt))
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exponential);
}

// ---------- Concurrency pool ----------

async function runPool(items, worker, concurrency) {
  const results = { done: 0, failed: 0, errors: [] };
  let index = 0;

  async function next() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      const label = `[${i + 1}/${items.length}]`;
      try {
        const result = await worker(item);
        if (result.ok) {
          results.done++;
          console.log(`${label} ✓ ${item.url}`);
        } else {
          results.failed++;
          results.errors.push({ url: item.url, error: result.error });
          console.error(`${label} ✗ ${item.url} — ${result.error}`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ url: item.url, error: err.message });
        console.error(`${label} ✗ ${item.url} — ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

// ---------- Main ----------

async function main() {
  console.log(`\nBackfilling enrichments via ${SCRAPER_URL}`);
  console.log(`Concurrency: ${CONCURRENCY} | Max retries: ${MAX_RETRIES} | Dry run: ${DRY_RUN}\n`);

  const links = await fetchPendingLinks();
  if (links.length === 0) {
    console.log("Nothing to do — no pending/failed non-deleted links.");
    return;
  }
  console.log(`Found ${links.length} link(s) to enrich.`);

  const existingTags = await fetchExistingTagVocabulary();
  console.log(`Existing tag vocabulary: ${existingTags.length} tags.\n`);

  if (DRY_RUN) {
    for (const link of links) {
      console.log(`  - ${link.url}  (id=${link.id}, status=${link.enrichment_status})`);
    }
    console.log("\nDry run — no requests sent.");
    return;
  }

  const startedAt = Date.now();
  const results = await runPool(
    links,
    (link) =>
      postEnrichWithRetry({
        url: link.url,
        linkId: link.id,
        userId: link.user_id,
        existingTags,
      }),
    CONCURRENCY
  );

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n───────────────`);
  console.log(`Done: ${results.done} | Failed: ${results.failed} | Time: ${elapsedSec}s`);

  if (results.errors.length > 0) {
    console.log(`\nFailures:`);
    for (const { url, error } of results.errors) {
      console.log(`  ${url}\n    → ${error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
