// Parses search-field text of the form "URL [optional note]".
// Returns null when the input is a plain search query rather than a pasted link.

export function parseQuickCapture(input: string): {
  url: string;
  note: string;
} | null {
  const text = input.trim();
  if (!text) return null;
  const [first, ...rest] = text.split(/\s+/);
  if (!looksLikeUrl(first)) return null;
  const url = /^https?:\/\//i.test(first) ? first : `https://${first}`;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url, note: rest.join(" ") };
}

function looksLikeUrl(token: string): boolean {
  // Bare words ("react") must stay searches — require a dotted host.
  return /^(https?:\/\/)?[^\s]+\.[^\s]{2,}(\/\S*)?$/i.test(token);
}
