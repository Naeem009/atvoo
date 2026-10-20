import Link from "next/link";

export function SiteHeader() {
  return (
    <>
      <div className="announcement-bar">
        <p>Good finds. More ways to discover.</p>
      </div>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="ATVOO home">
          ATVOO<span>.</span>
        </Link>
        <nav className="site-navigation" aria-label="Main navigation">
          <Link href="/products">Shop</Link>
          <Link href="/categories">Categories</Link>
        </nav>
        <Link className="header-action" href="/cart">
          Cart <span aria-hidden="true">↗</span>
        </Link>
      </header>
    </>
  );
}