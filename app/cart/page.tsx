import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogApiError } from "@/app/lib/catalog";
import { getCurrentCart } from "@/app/lib/cart";
import type { CartData } from "@/app/lib/cart-contract";
import { CartContent } from "./cart-content";

export const instant = false;

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

async function loadCart(): Promise<{ cart: CartData | null; error?: string }> {
  try {
    return { cart: await getCurrentCart() };
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return { cart: null, error: error.message };
    }
    throw error;
  }
}

async function CartPageContent() {
  const result = await loadCart();
  if (result.error) {
    return (
      <main id="main-content" className="catalog-page">
        <div className="catalog-state" role="alert">
          <h1>We couldn&apos;t load your cart</h1>
          <p>{result.error}</p>
          <Link className="catalog-submit" href="/cart">
            Try again
          </Link>
        </div>
      </main>
    );
  }
  if (result.cart) return <CartContent initialCart={result.cart} />;
  return (
    <main id="main-content" className="catalog-page">
      <div className="catalog-state">
        <h1>Your cart is empty</h1>
        <p>Explore the catalog and add something you love.</p>
        <Link className="catalog-submit" href="/products">
          Browse products
        </Link>
      </div>
    </main>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" className="catalog-page" aria-busy="true">
          <div className="catalog-skeleton catalog-skeleton-heading" />
          <div className="catalog-skeleton-card">
            <span className="catalog-skeleton catalog-skeleton-line" />
            <span className="catalog-skeleton catalog-skeleton-line short" />
          </div>
        </main>
      }
    >
      <CartPageContent />
    </Suspense>
  );
}
