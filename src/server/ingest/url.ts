const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid"
];

export function normalizeUrl(input: string) {
  const url = new URL(input);
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  url.hash = "";
  return url.toString();
}

export function isUrl(input: string): boolean {
  try {
    new URL(input.trim());
    return true;
  } catch {
    return false;
  }
}
