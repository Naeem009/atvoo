export function getSiteOrigin(): string {
  const configuredUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.origin;
  } catch {
    throw new Error("APP_URL must be a valid HTTP(S) URL.");
  }
}

export function absoluteSiteUrl(path: string): string {
  return new URL(path, `${getSiteOrigin()}/`).href;
}
