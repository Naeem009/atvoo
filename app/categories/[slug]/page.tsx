import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CatalogApiError,
  getCategories,
  type CatalogCategory,
} from "@/app/lib/catalog";
import { absoluteSiteUrl } from "@/app/lib/site";
import {
  CatalogListing,
  categoryListingPath,
} from "@/app/products/catalog-listing";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const instant = false;

async function getCategory(slug: string): Promise<CatalogCategory> {
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return category;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  let category: CatalogCategory;
  try {
    category = await getCategory(slug);
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return { title: "Category temporarily unavailable" };
    }
    throw error;
  }
  return {
    title: category.name,
    description:
      category.description ??
      `Browse ${category.name} products from independent sellers on ATVOO.`,
    alternates: {
      canonical: absoluteSiteUrl(categoryListingPath(slug)),
    },
    openGraph: {
      title: category.name,
      description:
        category.description ??
        `Browse ${category.name} products from independent sellers on ATVOO.`,
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  let category: CatalogCategory;
  try {
    category = await getCategory(slug);
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return (
        <main id="main-content" className="catalog-page">
          <div className="catalog-state" role="alert">
            <h1>Categories are temporarily unavailable</h1>
            <p>{error.message}</p>
            <Link className="catalog-submit" href="/products">
              Browse all products
            </Link>
          </div>
        </main>
      );
    }
    throw error;
  }
  return <CatalogListing searchParams={searchParams} category={category} />;
}
