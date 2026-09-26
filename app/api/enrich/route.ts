import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SCRAPER_URL =
  process.env.SCRAPER_SERVICE_URL ||
  "http://Contex-Scrap-bPuOad2Z3F7G-528788321.us-east-1.elb.amazonaws.com";
const API_SECRET = process.env.API_SECRET;

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
 * POST /api/enrich
 *
 * Fire-and-forget from the client's perspective. Verifies the user's JWT,
 * then forwards the enrichment request to the scraper service. The scraper
 * writes results directly to Supabase via the service role; the client picks
 * the update up via Realtime.
 */
export async function POST(req: Request) {
  if (!API_SECRET) {
    return NextResponse.json(
      { error: "Enrichment service not configured" },
      { status: 503 }
    );
  }

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const linkId = typeof body?.linkId === "string" ? body.linkId : "";
  const existingTags = Array.isArray(body?.existingTags)
    ? body.existingTags.filter((t: unknown): t is string => typeof t === "string")
    : [];

  if (!url || !linkId) {
    return NextResponse.json(
      { error: "Missing url or linkId" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      `${SCRAPER_URL.replace(/\/$/, "")}/enrich`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_SECRET,
        },
        body: JSON.stringify({
          url,
          linkId,
          userId,
          existingTags: existingTags.slice(0, 500),
        }),
        // Don't wait forever — the client doesn't care about the response body
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error || "Enrichment service failed" },
        { status: upstream.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Timeouts are fine — the scraper may still finish the job and write to
    // Supabase; the client will pick it up via Realtime.
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return NextResponse.json({ ok: true, accepted: true });
    }
    console.error("/api/enrich proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach enrichment service" },
      { status: 502 }
    );
  }
}
