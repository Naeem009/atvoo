import Image from "next/image";

const categories = [
  {
    name: "Fashion",
    description: "Clothing, shoes and accessories",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85",
    position: "center 42%",
  },
  {
    name: "Home & Kitchen",
    description: "Thoughtful finds for your space",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
  {
    name: "Electronics",
    description: "Everyday tech and accessories",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
  {
    name: "Beauty & Personal Care",
    description: "Daily essentials and care",
    image:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&q=85",
    position: "center",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="announcement-bar">
        <p>Good finds. More ways to discover.</p>
      </div>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="ATVOO home">
          ATVOO<span>.</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#categories">Explore categories</a>
          <a href="#our-point-of-view">Our point of view</a>
        </nav>
        <a className="header-action" href="#categories">
          Explore <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <Image
            className="hero-image"
            src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=2400&q=90"
            alt="A shopper browsing a clothing rack in a bright boutique"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow hero-eyebrow">
              A marketplace, with a point of view
            </p>
            <h1 id="hero-title">ATVOO</h1>
            <p className="hero-copy">
              Find the things that make a place, a day, or a whole life feel more
              like yours.
            </p>
            <a className="button button-light" href="#categories">
              Find your corner <span aria-hidden="true">↘</span>
            </a>
          </div>
          <p className="hero-caption">Independent finds. Everyday favorites.</p>
        </section>

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
          <div className="category-grid">
            {categories.map((category) => (
              <article className="category-tile" key={category.name}>
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
              </article>
            ))}
          </div>
        </section>

        <section className="manifesto" id="our-point-of-view">
          <div className="manifesto-inner">
            <p className="eyebrow">Shopping, with room to explore</p>
            <h2>
              The best finds aren&apos;t always the ones you were looking for.
            </h2>
            <a className="text-link" href="#categories">
              Take a look around <span aria-hidden="true">↗</span>
            </a>
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

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#top" aria-label="ATVOO home">
          ATVOO<span>.</span>
        </a>
        <p>Made for the things you make your own.</p>
        <a className="footer-top" href="#top">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </>
  );
}
