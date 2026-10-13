import type { MetadataRoute } from "next";
import { connection } from "next/server";

function siteOrigin(): string {
  const configuredUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.origin;
  } catch {
    throw new Error("APP_URL must be a valid HTTP(S) URL.");
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
