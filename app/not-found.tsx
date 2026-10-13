import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="catalog-page">
      <div className="catalog-state">
        <h1>Page not found</h1>
        <p>The page you are looking for may have moved or is no longer available.</p>
        <Link className="catalog-submit" href="/products">
          Browse products
        </Link>
      </div>
    </main>
  );
}
