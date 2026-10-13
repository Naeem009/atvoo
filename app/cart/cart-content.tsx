"use client";

import Link from "next/link";
import { useState } from "react";
import { parseCartData, type CartData, type CartMoney } from "@/app/lib/cart-contract";

function formatMoney(money: CartMoney): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 2,
  }).format(Number(money.amount) / 100);
}

export function CartContent({ initialCart }: { initialCart: CartData }) {
  const [cart, setCart] = useState(initialCart);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function updateItem(itemId: string, quantity: number) {
    setBusyItem(itemId);
    setError("");
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload));
      if (!isRecord(payload) || !("data" in payload)) {
        throw new Error("The cart service returned an invalid response.");
      }
      setCart(parseCartData(payload.data));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update the cart.",
      );
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    setError("");
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload));
      if (!isRecord(payload) || !("data" in payload)) {
        throw new Error("The cart service returned an invalid response.");
      }
      setCart(parseCartData(payload.data));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove the item.",
      );
    } finally {
      setBusyItem(null);
    }
  }

  const groupedItems = new Map<string, CartData["items"]>();
  for (const item of cart.items) {
    const vendorItems = groupedItems.get(item.vendor) ?? [];
    vendorItems.push(item);
    groupedItems.set(item.vendor, vendorItems);
  }

  return (
    <main id="main-content" className="catalog-page cart-page">
      <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Your cart</span>
      </nav>
      <header className="catalog-heading">
        <p className="eyebrow">Your finds, gathered</p>
        <h1>Your cart</h1>
        <p>
          {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"} across{" "}
          {groupedItems.size} seller{groupedItems.size === 1 ? "" : "s"}.
        </p>
      </header>
      {error && (
        <p className="cart-feedback error" role="alert">
          {error}
        </p>
      )}
      {cart.items.length === 0 ? (
        <div className="catalog-state">
          <h2>Your cart is empty</h2>
          <p>Explore the catalog and add something you love.</p>
          <Link className="catalog-submit" href="/products">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section aria-label="Cart items">
            {[...groupedItems].map(([vendor, items]) => (
              <section className="cart-vendor" key={vendor}>
                <h2>Sold by {vendor}</h2>
                {items.map((item) => (
                  <article className="cart-line" key={item.id}>
                    <div className="cart-line-copy">
                      <Link href={`/products/${encodeURIComponent(item.slug)}`}>
                        <h3>{item.title}</h3>
                      </Link>
                      <p>{item.category}</p>
                      <p>{formatMoney(item.price)} each</p>
                      {item.previousPrice && (
                        <p className="cart-feedback warning" role="status">
                          Price changed from {formatMoney(item.previousPrice)}.
                          Review the current price before checkout.
                        </p>
                      )}
                      {item.warnings
                        .filter((warning) => !warning.startsWith("The price changed"))
                        .map((warning) => (
                          <p className="cart-feedback warning" role="alert" key={warning}>
                            {warning}
                          </p>
                        ))}
                    </div>
                    <div className="cart-line-controls">
                      <label>
                        Quantity
                        <select
                          value={item.quantity}
                          disabled={busyItem === item.id || !item.available}
                          onChange={(event) =>
                            void updateItem(item.id, Number(event.target.value))
                          }
                        >
                          {Array.from(
                            { length: Math.min(10, item.stock) },
                            (_, index) => index + 1,
                          ).map((quantity) => (
                            <option key={quantity} value={quantity}>
                              {quantity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <strong>{formatMoney(item.lineTotal)}</strong>
                      <button
                        className="cart-remove"
                        type="button"
                        disabled={busyItem === item.id}
                        onClick={() => void removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </section>
          <aside className="cart-summary" aria-label="Cart summary">
            <h2>Summary</h2>
            <p>
              Current item subtotal
              <strong>
                {cart.totals.map((total) => formatMoney(total)).join(" · ")}
              </strong>
            </p>
            <p>
              Shipping, tax, and payment options will be confirmed at checkout.
            </p>
            <button className="catalog-submit" type="button" disabled>
              Checkout unavailable
            </button>
          </aside>
        </div>
      )}
      <p className="cart-expiry">
        Cart saved until {new Date(cart.expiresAt).toLocaleDateString("en-PK")}.
        Prices and stock are checked again at checkout.
      </p>
    </main>
  );
}

function getErrorMessage(value: unknown): string {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }
  return "The cart request could not be completed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
