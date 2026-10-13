import { connection } from "next/server";
import { getCategories } from "@/app/lib/catalog";
import { absoluteSiteUrl } from "@/app/lib/site";

export async function GET(): Promise<Response> {
  await connection();
  const categories = await getCategories();
  const categoryLinks = categories
    .map(
      (category) =>
        `- [${category.name}](${absoluteSiteUrl(
          `/categories/${encodeURIComponent(category.slug)}`,
        )})`,
    )
    .join("\n");
  const document = [
    "# ATVOO",
    "",
    "ATVOO is a multi-vendor commerce platform for the Pakistan market. English and PKR are the launch defaults.",
    "Public catalog product, category, price, and availability facts are served by the storefront from the catalog API.",
    "The catalog pages support discovery only; checkout is not currently available.",
    "",
    "## Public catalog",
    `- [All products](${absoluteSiteUrl("/products")})`,
    `- [All categories](${absoluteSiteUrl("/categories")})`,
    `- [XML sitemap](${absoluteSiteUrl("/sitemap.xml")})`,
    "",
    "## Categories",
    categoryLinks || "No active categories are currently listed.",
    "",
    "Use each product page as the source for current visible price and availability. Do not infer unlisted stock, delivery, review, or policy details.",
    "",
  ].join("\n");
  return new Response(document, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
