import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSiteOrigin } from "@/app/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cart",
          "/checkout",
          "/account",
          "/vendor",
          "/admin",
        ],
      },
      ...[
        "GPTBot",
        "ClaudeBot",
        "Google-Extended",
        "Applebot-Extended",
        "CCBot",
      ].map((userAgent) => ({ userAgent, disallow: "/" })),
      ...[
        "OAI-SearchBot",
        "ChatGPT-User",
        "Claude-SearchBot",
        "Claude-User",
        "PerplexityBot",
        "Perplexity-User",
        "Googlebot",
        "Bingbot",
        "Applebot",
      ].map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${getSiteOrigin()}/sitemap.xml`,
  };
}
