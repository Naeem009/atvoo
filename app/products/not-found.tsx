import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="catalog-page">
      <div className="catalog-state">
        <p className="eyebrow">That listing isn&apos;t here</p>
        <h1>Product not found</h1>
        <p>This product may have been removed or is no longer available.</p>
        <Link className="catalog-submit" href="/products">
          Browse products
        </Link>
      </div>
    </main>
  );
}
