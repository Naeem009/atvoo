import Link from "next/link";

const socialProfiles = [
  {
    name: "Instagram",
    url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL,
    hosts: ["instagram.com"],
  },
  {
    name: "Facebook",
    url: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL,
    hosts: ["facebook.com", "fb.com"],
  },
  {
    name: "TikTok",
    url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL,
    hosts: ["tiktok.com"],
  },
  {
    name: "Pinterest",
    url: process.env.NEXT_PUBLIC_SOCIAL_PINTEREST_URL,
    hosts: ["pinterest.com"],
  },
  {
    name: "X",
    url: process.env.NEXT_PUBLIC_SOCIAL_X_URL,
    hosts: ["x.com", "twitter.com"],
  },
];

function getSocialProfiles() {
  return socialProfiles.flatMap((profile) => {
    if (!profile.url) return [];
    try {
      const url = new URL(profile.url);
      const allowedHost = profile.hosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      );
      if (url.protocol !== "https:" || !allowedHost || url.username || url.password) {
        return [];
      }
      return [{ name: profile.name, href: url.href }];
    } catch {
      return [];
    }
  });
}

export function SiteFooter() {
  const profiles = getSocialProfiles();

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link className="wordmark footer-wordmark" href="/" aria-label="ATVOO home">
          ATVOO<span>.</span>
        </Link>
        <p>Made for the things you make your own.</p>
      </div>
      <nav className="footer-navigation" aria-label="Explore ATVOO">
        <h2 className="footer-heading">Explore</h2>
        <ul>
          <li><Link href="/products">Shop all</Link></li>
          <li><Link href="/categories">Categories</Link></li>
          <li><Link href="/cart">Your cart</Link></li>
        </ul>
      </nav>
      {profiles.length > 0 && (
        <nav className="footer-socials" aria-label="ATVOO social profiles">
          <h2 className="footer-heading">Follow along</h2>
          <ul>
            {profiles.map((profile) => (
              <li key={profile.name}>
                <a href={profile.href} target="_blank" rel="noopener noreferrer">
                  {profile.name}
                  <span className="external-mark" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="footer-bottom">
        <p>ATVOO marketplace</p>
        <a className="footer-top" href="#main-content">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}