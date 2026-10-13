import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCategories, getProductPage } from "@/app/lib/catalog";
import { absoluteSiteUrl, getSiteOrigin } from "@/app/lib/site";

const pageSize = 100;
const apiMaxPages = 10_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const [categories, firstPage] = await Promise.all([
    getCategories(),
    getProductPage("page=1&pageSize=100"),
  ]);
  const productUrlLimit = 50_000 - 3 - categories.length;
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
      url: getSiteOrigin(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteSiteUrl("/products"),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteSiteUrl("/categories"),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...categories.map((category) => ({
      url: absoluteSiteUrl(
        `/categories/${encodeURIComponent(category.slug)}`,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteSiteUrl(
        `/products/${encodeURIComponent(product.slug)}`,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.6,
      images: product.images.map((image) => image.url),
    })),
  ];
}
