import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_URL = process.env.SEMANTIC_SEARCH_SERVICE_URL;
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

export async function POST(req: Request) {
  if (!SERVICE_URL || !API_SECRET) {
    return NextResponse.json(
      { error: "Semantic search service not configured" },
      { status: 503 }
    );
  }

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const linkId = body?.linkId ?? body?.link_id;
  if (typeof linkId !== "string") {
    return NextResponse.json({ error: "Missing linkId" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${SERVICE_URL.replace(/\/$/, "")}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_SECRET,
      },
      body: JSON.stringify({ link_id: linkId, user_id: userId }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.detail || "Embedding service failed" },
        { status: upstream.status }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("/api/embed proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach embedding service" },
      { status: 502 }
    );
  }
}
