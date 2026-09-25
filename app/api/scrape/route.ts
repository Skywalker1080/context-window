import { NextResponse } from "next/server";

function fallbackFavicon(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const scraperUrl =
      process.env.SCRAPER_SERVICE_URL ||
      'http://Contex-Scrap-bPuOad2Z3F7G-528788321.us-east-1.elb.amazonaws.com/scrape';
    const response = await fetch(scraperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.API_SECRET || "" // or your Vercel env var
      },
      body: JSON.stringify({ url: targetUrl })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const metadata = await response.json();

    return NextResponse.json({
      title: metadata.title,
      description: metadata.description,
      favicon: metadata.logo || metadata.image || metadata.favicon || fallbackFavicon(targetUrl),
      thumbnail: metadata.thumbnail || metadata.image || "",
    });
  } catch (error: any) {
    console.error("Metascraper API Error:", error);
    return NextResponse.json(
      { error: error.message || "Metadata extraction failed" },
      { status: 500 }
    );
  }
}
