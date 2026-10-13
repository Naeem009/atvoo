import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getProductPage } from "@/app/lib/catalog";

const productUrlLimit = 49_998;
const pageSize = 100;
const apiMaxPages = 10_000;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const origin = siteOrigin();
  const firstPage = await getProductPage("page=1&pageSize=100");
  if (firstPage.meta.total > productUrlLimit) {
    throw new Error(
      "The catalog exceeds the single-sitemap limit; sitemap index support is required.",
    );
  }
  if (firstPage.meta.totalPages > apiMaxPages) {
    throw new Error("The catalog exceeds the supported API pagination limit.");
  }

  const remainingPages: number[] = [];
  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    remainingPages.push(page);
  }

  const products = [...firstPage.data];
  for (let start = 0; start < remainingPages.length; start += 10) {
    const batch = remainingPages.slice(start, start + 10);
    const results = await Promise.all(
      batch.map((page) =>
        getProductPage(`page=${page}&pageSize=${pageSize}`),
      ),
    );
    products.push(...results.flatMap((result) => result.data));
  }

  if (products.length !== firstPage.meta.total) {
    throw new Error("The catalog changed while its sitemap was being generated.");
  }

  return [
    {
      url: origin,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${origin}/products`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...products.map((product) => ({
      url: `${origin}/products/${encodeURIComponent(product.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      images: product.images.map((image) => image.url),
    })),
  ];
}
