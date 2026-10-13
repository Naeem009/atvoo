import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  CatalogApiError,
  formatCatalogPrice,
  getBrands,
  getCategories,
  getProductPage,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogProduct,
  type ProductPage,
} from "@/app/lib/catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toQueryString(
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

function queryHref(
  query: string,
  page: number,
): string {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  return `/products?${params.toString()}`;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const image = product.images[0];

  return (
    <article className="catalog-card">
      <Link className="catalog-card-image" href={`/products/${product.slug}`}>
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          />
        ) : (
          <span className="catalog-image-placeholder" aria-hidden="true">
            ATVOO
          </span>
        )}
      </Link>
      <div className="catalog-card-copy">
        <p className="catalog-card-category">{product.category.name}</p>
        <h2>
          <Link href={`/products/${product.slug}`}>{product.title}</Link>
        </h2>
        <p className="catalog-card-vendor">{product.vendor.name}</p>
        {product.price && (
          <p className="catalog-price">{formatCatalogPrice(product.price)}</p>
        )}
      </div>
    </article>
  );
}

function FilterForm({
  query,
  categories,
  brands,
}: {
  query: URLSearchParams;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
}) {
  return (
    <form className="catalog-filters" action="/products" method="get">
      <label>
        Search products
        <input
          type="search"
          name="q"
          minLength={2}
          maxLength={100}
          defaultValue={query.get("q") ?? ""}
          placeholder="What are you looking for?"
        />
      </label>
      <label>
        Category
        <select name="category" defaultValue={query.get("category") ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <select name="brand" defaultValue={query.get("brand") ?? ""}>
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Minimum price (PKR paisa)
        <input
          type="number"
          name="minPrice"
          min="0"
          step="1"
          defaultValue={query.get("minPrice") ?? ""}
        />
      </label>
      <label>
        Maximum price (PKR paisa)
        <input
          type="number"
          name="maxPrice"
          min="0"
          step="1"
          defaultValue={query.get("maxPrice") ?? ""}
        />
      </label>
      <label>
        Availability
        <select
          name="availability"
          defaultValue={query.get("availability") ?? "all"}
        >
          <option value="all">All products</option>
          <option value="in-stock">In stock</option>
        </select>
      </label>
      <label>
        Sort by
        <select name="sort" defaultValue={query.get("sort") ?? "newest"}>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          {query.has("q") && <option value="relevance">Relevance</option>}
        </select>
      </label>
      <button className="catalog-submit" type="submit">
        Apply filters
      </button>
      <Link className="catalog-clear" href="/products">
        Clear filters
      </Link>
    </form>
  );
}

function CatalogFailure({
  message,
  retryHref,
}: {
  message: string;
  retryHref: string;
}) {
  return (
    <div className="catalog-state" role="alert">
      <h2>We couldn&apos;t load the catalog</h2>
      <p>{message}</p>
      <Link className="catalog-submit" href={retryHref}>
        Try again
      </Link>
    </div>
  );
}

function ProductGrid({
  products,
  meta,
  query,
}: {
  products: CatalogProduct[];
  meta: ProductPage["meta"];
  query: string;
}) {
  if (products.length === 0) {
    return (
      <div className="catalog-state">
        <h2>No products match those filters</h2>
        <p>Try changing your search or clearing one or more filters.</p>
        <Link className="catalog-submit" href="/products">
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="catalog-product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {meta.totalPages > 1 && (
        <nav className="catalog-pagination" aria-label="Product pages">
          {meta.page > 1 ? (
            <Link href={queryHref(query, meta.page - 1)}>Previous</Link>
          ) : (
            <span aria-disabled="true">Previous</span>
          )}
          <p>
            Page {meta.page} of {meta.totalPages}
          </p>
          {meta.page < meta.totalPages ? (
            <Link href={queryHref(query, meta.page + 1)}>Next</Link>
          ) : (
            <span aria-disabled="true">Next</span>
          )}
        </nav>
      )}
    </>
  );
}

async function CatalogContent({ searchParams }: { searchParams: SearchParams }) {
  const params = new URLSearchParams(toQueryString(await searchParams));
  const query = params.toString();

  let catalogData:
    | {
        result: ProductPage;
        categories: CatalogCategory[];
        brands: CatalogBrand[];
      }
    | { error: string };
  try {
    const [result, categories, brands] = await Promise.all([
      getProductPage(query || "page=1&pageSize=20"),
      getCategories(),
      getBrands(),
    ]);
    catalogData = { result, categories, brands };
  } catch (error) {
    if (error instanceof CatalogApiError) {
      catalogData = { error: error.message };
    } else {
      throw error;
    }
  }

  if ("error" in catalogData) {
    return (
      <main className="catalog-page">
        <CatalogFailure
          message={catalogData.error}
          retryHref={query ? `/products?${query}` : "/products"}
        />
      </main>
    );
  }

  const { result, categories, brands } = catalogData;
  return (
    <main className="catalog-page">
      <header className="catalog-heading">
        <Link className="catalog-back-link" href="/">
          ← ATVOO
        </Link>
        <p className="eyebrow">Discover something worth keeping</p>
        <h1>Explore products</h1>
        <p>
          Browse {result.meta.total.toLocaleString("en-PK")} products from
          independent sellers.
        </p>
      </header>
      <div className="catalog-layout">
        <aside aria-label="Catalog filters">
          <FilterForm query={params} categories={categories} brands={brands} />
        </aside>
        <section aria-label="Product results">
          <ProductGrid
            products={result.data}
            meta={result.meta}
            query={query}
          />
        </section>
      </div>
    </main>
  );
}

function ProductGridSkeleton() {
  return (
    <main className="catalog-page" aria-busy="true" aria-label="Loading products">
      <div className="catalog-heading">
        <span className="catalog-skeleton catalog-skeleton-heading" />
      </div>
      <div className="catalog-product-grid">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="catalog-skeleton-card" key={index}>
            <span className="catalog-skeleton catalog-skeleton-image" />
            <span className="catalog-skeleton catalog-skeleton-line" />
            <span className="catalog-skeleton catalog-skeleton-line short" />
          </div>
        ))}
      </div>
    </main>
  );
}

export const metadata = {
  title: "Explore products",
  description: "Browse public products from independent ATVOO sellers.",
};

export default function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CatalogContent searchParams={searchParams} />
    </Suspense>
  );
}
