export default function LoadingProducts() {
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
