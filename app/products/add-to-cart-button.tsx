"use client";

import Link from "next/link";
import { useState } from "react";
import { parseCartData } from "@/app/lib/cart-contract";
import type { CatalogProduct } from "@/app/lib/catalog";

function optionLabel(
  variant: CatalogProduct["variants"][number],
  index: number,
): string {
  const details = variant.options
    ? Object.entries(variant.options)
        .map(([name, value]) => `${name}: ${value}`)
        .join(", ")
    : "";
  return details || `Option ${index + 1}`;
}

export function AddToCartButton({
  variants,
}: {
  variants: CatalogProduct["variants"];
}) {
  const availableVariants = variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState(
    availableVariants[0]?.id ?? variants[0]?.id ?? "",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function addToCart() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorMessage =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : "We could not add this product to your cart.";
        throw new Error(errorMessage);
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("data" in payload)
      ) {
        throw new Error("The cart service returned an invalid response.");
      }
      const cart = parseCartData(payload.data);
      setMessage(`Added to your cart. ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"} total.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not add this product to your cart.",
      );
    } finally {
      setPending(false);
    }
  }

  if (variants.length === 0 || availableVariants.length === 0) {
    return <p className="product-detail-note">This product is out of stock.</p>;
  }

  return (
    <div className="add-to-cart">
      {variants.length > 1 && (
        <label>
          Choose an option
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            disabled={pending}
          >
            {variants.map((variant, index) => (
              <option
                key={variant.id}
                value={variant.id}
                disabled={variant.stock === 0}
              >
                {optionLabel(variant, index)}
                {variant.stock === 0 ? " — Out of stock" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="catalog-submit"
        type="button"
        onClick={addToCart}
        disabled={pending}
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>
      {error && (
        <p className="cart-feedback error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="cart-feedback success" role="status">
          {message} <Link href="/cart">View cart</Link>
        </p>
      )}
    </div>
  );
}
