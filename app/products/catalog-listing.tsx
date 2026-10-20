import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  CatalogApiError,
  formatCatalogPrice,
  getBrands,
  getCategories,
  getProductPage,
  getVendors,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogVendor,
  type ProductPage,
} from "@/app/lib/catalog";
import { absoluteSiteUrl } from "@/app/lib/site";

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

function queryHref(query: string, page: number): string {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  return `/products?${params.toString()}`;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const image = product.images[0];
  const productHref = `/products/${encodeURIComponent(product.slug)}`;

  return (
    <article className="catalog-card">
      <Link
        className="catalog-card-image"
        href={productHref}
        aria-label={`View ${product.title}`}
      >
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
          <Link href={productHref}>{product.title}</Link>
        </h2>
        <p className="catalog-card-vendor">
          Sold by{" "}
          <Link href={`/products?vendorId=${encodeURIComponent(product.vendor.id)}`}>
            {product.vendor.name}
          </Link>
        </p>
        {product.price && (
          <p className="catalog-price">{formatCatalogPrice(product.price)}</p>
        )}
        <p className="catalog-card-availability">
          {product.availability === "IN_STOCK" ? "In stock" : "Out of stock"}
        </p>
      </div>
    </article>
  );
}

function FilterForm({
  query,
  categories,
  brands,
  vendors,
}: {
  query: URLSearchParams;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  vendors: CatalogVendor[];
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
        Supplier
        <select name="vendorId" defaultValue={query.get("vendorId") ?? ""}>
          <option value="">All suppliers</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
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
          {!query.has("q") && <option value="popular">Most popular</option>}
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
          <p aria-current="page">
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

function Breadcrumbs({
  category,
}: {
  category: CatalogCategory | null;
}) {
  return (
    <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/products">Products</Link>
      {category && (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{category.name}</span>
        </>
      )}
    </nav>
  );
}

function CatalogStructuredData({
  products,
  category,
}: {
  products: CatalogProduct[];
  category: CatalogCategory | null;
}) {
  const listingUrl = category
    ? `/categories/${encodeURIComponent(category.slug)}`
    : "/products";
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    ...(category ? [{ name: category.name, path: listingUrl }] : []),
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: category?.name ?? "Explore products",
      url: absoluteSiteUrl(listingUrl),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absoluteSiteUrl(
            `/products/${encodeURIComponent(product.slug)}`,
          ),
          name: product.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absoluteSiteUrl(crumb.path),
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}

async function CatalogContent({
  searchParams,
  category,
}: {
  searchParams: SearchParams;
  category: CatalogCategory | null;
}) {
  const params = new URLSearchParams(toQueryString(await searchParams));
  if (category) params.set("category", category.slug);
  const query = params.toString() || "page=1&pageSize=20";

  let catalogData:
    | {
        result: ProductPage;
        categories: CatalogCategory[];
        brands: CatalogBrand[];
        vendors: CatalogVendor[];
      }
    | { error: string };
  try {
    const [result, categories, brands, vendors] = await Promise.all([
      getProductPage(query),
      getCategories(),
      getBrands(),
      getVendors(),
    ]);
    catalogData = { result, categories, brands, vendors };
  } catch (error) {
    if (error instanceof CatalogApiError) {
      catalogData = { error: error.message };
    } else {
      throw error;
    }
  }

  if ("error" in catalogData) {
    return (
      <main id="main-content" className="catalog-page">
        <Breadcrumbs category={category} />
        <div className="catalog-state" role="alert">
          <h1>We couldn&apos;t load the catalog</h1>
          <p>{catalogData.error}</p>
          <Link
            className="catalog-submit"
            href={category ? `/categories/${encodeURIComponent(category.slug)}` : "/products"}
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }

  const { result, categories, brands, vendors } = catalogData;
  const heading = category?.name ?? "Explore products";
  return (
    <main id="main-content" className="catalog-page">
      <Breadcrumbs category={category} />
      <CatalogStructuredData products={result.data} category={category} />
      <header className="catalog-heading">
        <p className="eyebrow">Discover something worth keeping</p>
        <h1>{heading}</h1>
        <p>
          Browse {result.meta.total.toLocaleString("en-PK")} products from
          independent sellers.
        </p>
      </header>
      <div className="catalog-layout">
        <aside aria-label="Catalog filters">
          <FilterForm
            query={params}
            categories={categories}
            brands={brands}
            vendors={vendors}
          />
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
    <main
      id="main-content"
      className="catalog-page"
      aria-busy="true"
      aria-label="Loading products"
    >
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

export function CatalogListing({
  searchParams,
  category = null,
}: {
  searchParams: SearchParams;
  category?: CatalogCategory | null;
}) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CatalogContent searchParams={searchParams} category={category} />
    </Suspense>
  );
}

export function getCatalogPageMetadata(query: string) {
  const searchParams = new URLSearchParams(query);
  const page = searchParams.get("page");
  const canonicalPath =
    page && Number(page) > 1 ? `/products?page=${encodeURIComponent(page)}` : "/products";
  const filtered = new URLSearchParams(query);
  const hasFilters = [...filtered.keys()].some((key) => key !== "page");
  return {
    title: "Explore products",
    description: "Browse public products from independent ATVOO sellers.",
    alternates: { canonical: absoluteSiteUrl(canonicalPath) },
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

export function categoryListingPath(slug: string): string {
  return `/categories/${encodeURIComponent(slug)}`;
}
