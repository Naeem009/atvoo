import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  CatalogApiError,
  formatCatalogPrice,
  getProductPage,
  type CatalogProduct,
} from "@/app/lib/catalog";

export const instant = false;

const categories = [
  {
    name: "Fashion",
    slug: "fashion",
    description: "Clothing, shoes and accessories",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85",
    position: "center 42%",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Thoughtful finds for your space",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
  {
    name: "Electronics",
    slug: "electronics",
    description: "Everyday tech and accessories",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    description: "Daily essentials and care",
    image:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
];

function LatestProductCard({ product }: { product: CatalogProduct }) {
  const image = product.images[0];
  return (
    <article className="latest-product-card">
      <Link
        className="latest-product-image"
        href={`/products/${encodeURIComponent(product.slug)}`}
        aria-label={`View ${product.title}`}
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <span className="catalog-image-placeholder" aria-hidden="true">
            ATVOO
          </span>
        )}
      </Link>
      <div className="latest-product-copy">
        <p className="catalog-card-category">{product.category.name}</p>
        <h3>
          <Link href={`/products/${encodeURIComponent(product.slug)}`}>
            {product.title}
          </Link>
        </h3>
        <p className="catalog-card-vendor">From {product.vendor.name}</p>
        {product.price && (
          <p className="catalog-price">{formatCatalogPrice(product.price)}</p>
        )}
      </div>
    </article>
  );
}

export default async function Home() {
  await connection();
  let latestProducts: CatalogProduct[] = [];
  let catalogUnavailable = false;
  try {
    ({ data: latestProducts } = await getProductPage(
      "page=1&pageSize=5&sort=newest",
    ));
  } catch (error) {
    if (!(error instanceof CatalogApiError)) throw error;
    catalogUnavailable = true;
  }
  const featuredProduct = latestProducts[0];

  return (
    <>
      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          {featuredProduct?.images[0] && (
            <Image
              className="hero-image"
              src={featuredProduct.images[0].url}
              alt={featuredProduct.images[0].alt || featuredProduct.title}
              fill
              priority
              sizes="100vw"
            />
          )}
          <div className="hero-shade" />
          <div className="hero-content">
            {featuredProduct ? (
              <>
                <p className="eyebrow hero-eyebrow">Latest from our vendors</p>
                <h1 id="hero-title">{featuredProduct.title}</h1>
                <p className="hero-copy">
                  {featuredProduct.category.name} · Sold by {featuredProduct.vendor.name}
                </p>
                {featuredProduct.price && (
                  <p className="hero-price">
                    {formatCatalogPrice(featuredProduct.price)}
                  </p>
                )}
                <div className="hero-actions">
                  <Link
                    className="button button-light"
                    href={`/products/${encodeURIComponent(featuredProduct.slug)}`}
                  >
                    View latest find <span aria-hidden="true">↗</span>
                  </Link>
                  <Link className="button button-quiet" href="/products">
                    Shop all products
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow hero-eyebrow">New finds, from local vendors</p>
                <h1 id="hero-title">Find your next favorite.</h1>
                <p className="hero-copy">
                  {catalogUnavailable
                    ? "The latest arrivals are temporarily unavailable. Explore categories while we reconnect."
                    : "Discover new products from independent vendors across the marketplace."}
                </p>
                <Link className="button button-light" href="/categories">
                  Explore categories <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </div>
          <p className="hero-caption">
            {featuredProduct
              ? `New from ${featuredProduct.vendor.name}`
              : "Independent finds. Everyday favorites."}
          </p>
        </section>

        {latestProducts.length > 1 && (
          <section className="latest-section section-wrap" aria-labelledby="latest-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Freshly listed</p>
                <h2 id="latest-heading">Just landed</h2>
              </div>
              <Link className="text-link latest-all-link" href="/products?sort=newest">
                See all new arrivals <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="latest-product-grid">
              {latestProducts.slice(1).map((product) => (
                <LatestProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section className="category-section section-wrap" id="categories">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A good place to start</p>
              <h2>Explore the everyday</h2>
            </div>
            <p className="section-note">
              Browse the collections that bring a little more intention to the
              things you choose.
            </p>
          </div>
          <Link className="text-link category-all-link" href="/categories">
            See all categories <span aria-hidden="true">↗</span>
          </Link>
          <div className="category-grid">
            {categories.map((category) => (
              <Link
                className="category-tile"
                href={`/categories/${category.slug}`}
                key={category.slug}
                aria-label={`Explore ${category.name}: ${category.description}`}
              >
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectPosition: category.position }}
                />
                <div className="tile-shade" />
                <div className="tile-copy">
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="manifesto" id="our-point-of-view">
          <div className="manifesto-inner">
            <p className="eyebrow">Shopping, with room to explore</p>
            <h2>
              The best finds aren&apos;t always the ones you were looking for.
            </h2>
            <Link className="text-link" href="/products">
              Take a look around <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="manifesto-art" aria-hidden="true">
            <Image
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=85"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
            />
          </div>
        </section>
      </main>

    </>
  );
}
