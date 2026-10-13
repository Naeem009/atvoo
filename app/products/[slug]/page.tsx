import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  CatalogApiError,
  CatalogNotFoundError,
  formatCatalogPrice,
  getProduct,
  type CatalogProduct,
} from "@/app/lib/catalog";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    return {
      title: product.title,
      description:
        product.description ??
        `${product.title} from ${product.vendor.name} on ATVOO.`,
      openGraph: {
        title: product.title,
        description: product.description ?? undefined,
        images: product.images[0] ? [product.images[0].url] : undefined,
        type: "website",
      },
    };
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return { title: "Product not found" };
    }
    throw error;
  }
}

async function ProductDetails({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: CatalogProduct | undefined;
  let errorMessage: string | undefined;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    if (error instanceof CatalogApiError) {
      errorMessage = error.message;
    } else {
      throw error;
    }
  }

  if (errorMessage) {
    return (
      <main className="catalog-page">
        <div className="catalog-state" role="alert">
          <h1>Product details are unavailable</h1>
          <p>{errorMessage}</p>
          <Link
            className="catalog-submit"
            href={`/products/${encodeURIComponent(slug)}`}
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }
  if (!product) {
    throw new Error("Product lookup completed without a result or an error.");
  }

  const image = product.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.images.map((item) => item.url),
    sku: product.variants[0]?.id,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    category: product.category.name,
    itemCondition:
      product.condition === "NEW"
        ? "https://schema.org/NewCondition"
        : product.condition === "REFURBISHED"
          ? "https://schema.org/RefurbishedCondition"
          : "https://schema.org/UsedCondition",
    offers: product.price
      ? {
          "@type": "Offer",
          price: (Number(product.price.amount) / 100).toFixed(2),
          priceCurrency: product.price.currency,
          availability:
            product.availability === "IN_STOCK"
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: product.vendor.name },
        }
      : undefined,
  };

  return (
    <main className="catalog-page product-page">
      <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.title}</span>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <article className="product-detail">
        <div className="product-detail-image">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt || product.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 55vw"
            />
          ) : (
            <span className="catalog-image-placeholder" aria-hidden="true">
              ATVOO
            </span>
          )}
        </div>
        <div className="product-detail-copy">
          <p className="eyebrow">
            {product.category.name}
            {product.brand ? ` · ${product.brand.name}` : ""}
          </p>
          <h1>{product.title}</h1>
          <p className="product-vendor">Sold by {product.vendor.name}</p>
          {product.price && (
            <p className="product-detail-price">
              {formatCatalogPrice(product.price)}
            </p>
          )}
          <p
            className={
              product.availability === "IN_STOCK"
                ? "product-availability in-stock"
                : "product-availability out-of-stock"
            }
          >
            {product.availability === "IN_STOCK" ? "In stock" : "Out of stock"}
          </p>
          {product.description ? (
            <p className="product-description">{product.description}</p>
          ) : (
            <p className="product-description">
              Product details will be added by the seller.
            </p>
          )}
          <p className="product-detail-note">
            Checkout is not available yet. This product is shown for catalog
            discovery only.
          </p>
          <Link className="catalog-submit" href="/products">
            Continue exploring
          </Link>
        </div>
      </article>
    </main>
  );
}

function ProductSkeleton() {
  return (
    <main className="catalog-page" aria-busy="true" aria-label="Loading product">
      <div className="product-detail">
        <span className="catalog-skeleton catalog-skeleton-detail-image" />
        <div>
          <span className="catalog-skeleton catalog-skeleton-line" />
          <span className="catalog-skeleton catalog-skeleton-heading" />
          <span className="catalog-skeleton catalog-skeleton-line short" />
        </div>
      </div>
    </main>
  );
}

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetails params={params} />
    </Suspense>
  );
}
