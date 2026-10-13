import type { Metadata } from "next";
import { CatalogListing, getCatalogPageMetadata } from "./catalog-listing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function queryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }
  return query.toString();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  return getCatalogPageMetadata(queryString(await searchParams));
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return <CatalogListing searchParams={searchParams} />;
}
