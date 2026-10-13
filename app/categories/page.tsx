import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  CatalogApiError,
  getCategories,
  type CatalogCategory,
} from "@/app/lib/catalog";
import { absoluteSiteUrl } from "@/app/lib/site";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    title: "Shop by category",
    description: "Explore ATVOO products by category.",
    alternates: { canonical: absoluteSiteUrl("/categories") },
  };
}

export default async function CategoriesPage() {
  let categories: CatalogCategory[];
  try {
    categories = await getCategories();
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return (
        <main id="main-content" className="catalog-page">
          <div className="catalog-state" role="alert">
            <h1>Categories are temporarily unavailable</h1>
            <p>{error.message}</p>
            <Link className="catalog-submit" href="/categories">
              Try again
            </Link>
          </div>
        </main>
      );
    }
    throw error;
  }

  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Shop by category",
    url: absoluteSiteUrl("/categories"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categories.length,
      itemListElement: categories.map((category, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteSiteUrl(
          `/categories/${encodeURIComponent(category.slug)}`,
        ),
        name: category.name,
      })),
    },
  };

  return (
    <main id="main-content" className="catalog-page">
      <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Categories</span>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
        }}
      />
      <header className="catalog-heading">
        <p className="eyebrow">Find your kind of good</p>
        <h1>Shop by category</h1>
        <p>Browse {categories.length.toLocaleString("en-PK")} categories.</p>
      </header>
      {categories.length === 0 ? (
        <div className="catalog-state">
          <h2>Categories are being prepared</h2>
          <p>Check back soon to explore the catalog.</p>
        </div>
      ) : (
        <ul className="category-list">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/categories/${encodeURIComponent(category.slug)}`}>
                <span>{category.name}</span>
                {category.description && <span>{category.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
