import Script from 'next/script';

/* ---- Inline icons (stroke = currentColor) ---- */
const IconShieldCheck = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconTarget = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);
const IconDiamond = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l4 5-4 13-4-13 4-5z" />
    <path d="M8 8h8" />
  </svg>
);
const IconUsers = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 7.6a3 3 0 0 1 0 6" />
    <path d="M17.6 19a5.6 5.6 0 0 0-2.6-4.7" />
  </svg>
);
const IconShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
  </svg>
);
const IconStar = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.9 7.4 18.1l.9-5.1L4.5 9.2l5.2-.8L12 4z" />
  </svg>
);
const IconTrophy = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
    <path d="M7 5H4v1a3 3 0 0 0 3 3" />
    <path d="M17 5h3v1a3 3 0 0 1-3 3" />
    <path d="M12 12v3.5" />
    <path d="M9.5 20h5l-.5-4h-4l-.5 4z" />
  </svg>
);
const IconHeadset = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 13v-1a7 7 0 0 1 14 0v1" />
    <rect x="3.5" y="12.5" width="3.6" height="6.5" rx="1.3" />
    <rect x="16.9" y="12.5" width="3.6" height="6.5" rx="1.3" />
    <path d="M19 19a3.8 3.8 0 0 1-3.8 3H13" />
  </svg>
);
const IconInstagram = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4.6" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.6" cy="7.4" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const IconMail = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.4" />
    <path d="M4.4 7.6l7.6 5 7.6-5" />
  </svg>
);

/* Stacked brand logo used in the header and footer */
function Brand({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  return (
    <a href="#home" className={`brand brand--${variant}`} aria-label="Hydra Baseball Co. home">
      <span className="brand__mark" aria-hidden="true">H</span>
      <span className="brand__word">
        <span className="brand__name">Hydra</span>
        <span className="brand__co">Baseball Co.</span>
      </span>
    </a>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ===== Header / Navigation ===== */}
      <header className="site-header" id="header">
        <div className="container site-header__inner">
          <Brand />

          <nav className="site-nav" id="siteNav" aria-label="Primary">
            <a href="#about">About</a>
            <a href="#balls">Balls</a>
            <a href="#team-orders">Team Orders</a>
            <a href="#contact">Contact</a>
          </nav>

          <a href="#team-orders" className="btn btn--dark btn--header">
            Shop / Inquire
          </a>

          <button className="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="hero" id="home">
        <div className="hero__media" id="heroSlides" aria-hidden="true">
          {/* Slide 1 paints immediately; slides 2–4 are added by the slideshow
              only if their image loads (missing files are skipped gracefully). */}
          <div className="hero__slide is-active" style={{ backgroundImage: "url('/images/hero.jpg')" }}></div>
          <div className="hero__slide" data-src="/images/hero-2.jpg"></div>
          <div className="hero__slide" data-src="/images/hero-3.jpg"></div>
          <div className="hero__slide" data-src="/images/hero-4.jpg"></div>
        </div>
        <div className="hero__dots" id="heroDots"></div>
        <div className="container hero__inner">
          <div className="hero__content reveal">
            <span className="hero__eyebrow">Hydra Baseball Co.</span>
            <h1 className="hero__title">
              By Players
              <br />
              For Players
            </h1>
            <p className="hero__lead">
              High quality baseballs. Built for competition.
              <br />
              Trusted by players at every level.
            </p>
            <div className="hero__cta">
              <a href="#team-orders" className="btn btn--light">
                Team Orders
              </a>
              <a href="#about" className="btn btn--outline">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== The Hydra Difference ===== */}
      <section className="difference" id="about">
        <div
          className="difference__media"
          id="balls"
          role="img"
          aria-label="Hydra A1492 Pro Series baseball resting on the grass"
        ></div>

        <div className="difference__panel">
          <div className="difference__inner reveal">
            <span className="eyebrow eyebrow--red">The Hydra Difference</span>
            <h2 className="section-title">
              Game Quality.
              <br />
              Every Time.
            </h2>
            <p className="lead-dark">
              Hydra baseballs are engineered for performance and consistency. Premium materials, precise
              construction, and rigorous testing deliver the quality players demand.
            </p>

            <ul className="feature-grid">
              <li className="feature">
                <span className="feature__icon">{IconShieldCheck}</span>
                <div>
                  <h3>Premium Materials</h3>
                  <p>Full grain leather, pro quality construction</p>
                </div>
              </li>
              <li className="feature">
                <span className="feature__icon">{IconTarget}</span>
                <div>
                  <h3>Consistent Performance</h3>
                  <p>Compression tested for reliability you can trust</p>
                </div>
              </li>
              <li className="feature">
                <span className="feature__icon">{IconDiamond}</span>
                <div>
                  <h3>Durable &amp; Long Lasting</h3>
                  <p>Built to handle the grind of practice and play</p>
                </div>
              </li>
              <li className="feature">
                <span className="feature__icon">{IconUsers}</span>
                <div>
                  <h3>Trusted By Players</h3>
                  <p>Used by competitive programs at every level</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Quote band ===== */}
      <section className="quote">
        <div className="quote__media" aria-hidden="true"></div>
        <div className="quote__panel">
          <div className="quote__inner reveal">
            <span className="quote__mark" aria-hidden="true">
              &ldquo;
            </span>
            <blockquote className="quote__text">
              We play the game
              <br />
              the right way.
            </blockquote>
            <span className="quote__rule" aria-hidden="true"></span>
            <p className="quote__attrib">By Players For Players</p>
          </div>
        </div>
      </section>

      {/* ===== Trust bar ===== */}
      <section className="trustbar">
        <div className="container trustbar__grid">
          <div className="trust">
            <span className="trust__icon">{IconShield}</span>
            <div className="trust__text">
              <strong>Competition Ready</strong>
              <span>Built for game day</span>
            </div>
          </div>
          <div className="trust">
            <span className="trust__icon">{IconStar}</span>
            <div className="trust__text">
              <strong>Player Trusted</strong>
              <span>Performance you can feel</span>
            </div>
          </div>
          <div className="trust">
            <span className="trust__icon">{IconTrophy}</span>
            <div className="trust__text">
              <strong>Team Focused</strong>
              <span>Built for programs</span>
            </div>
          </div>
          <div className="trust">
            <span className="trust__icon">{IconHeadset}</span>
            <div className="trust__text">
              <strong>Dedicated Support</strong>
              <span>We&rsquo;re here for you</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Team Orders / Inquiry ===== */}
      <section className="orders" id="team-orders">
        <div className="container orders__inner reveal">
          <span className="eyebrow eyebrow--red">Team Orders</span>
          <h2 className="section-title">Outfit Your Program</h2>
          <p className="orders__lead">
            Teams, programs, and leagues — get Hydra baseballs at every level. Reach out for pricing, bulk
            orders, and samples.
          </p>

          <form className="orders__form" id="ordersForm" noValidate>
            <input type="text" name="name" placeholder="Name" aria-label="Name" required />
            <input type="email" name="email" placeholder="Email" aria-label="Email" required />
            <input type="text" name="team" placeholder="Team or organization" aria-label="Team or organization" />
            <button type="submit" className="btn btn--dark">
              Request Info
            </button>
          </form>

          <p className="orders__note">
            Prefer email? <a href="mailto:info@hydrabaseball.co">info@hydrabaseball.co</a>
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="footer" id="contact">
        <div className="container footer__grid">
          <div className="footer__brand">
            <Brand variant="footer" />
            <p>
              Hydra Baseball Co. is dedicated to providing high quality baseballs for players who compete
              every day.
            </p>
          </div>

          <nav className="footer__col" aria-label="Quick links">
            <h4>Quick Links</h4>
            <a href="#about">About</a>
            <a href="#balls">Balls</a>
            <a href="#team-orders">Team Orders</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="footer__col">
            <h4>Contact</h4>
            <a href="mailto:info@hydrabaseball.co">info@hydrabaseball.co</a>
            <div className="footer__social">
              <a href="https://instagram.com/hydrabaseballco" aria-label="Instagram" target="_blank" rel="noreferrer">
                {IconInstagram}
              </a>
              <a href="mailto:info@hydrabaseball.co" aria-label="Email us">
                {IconMail}
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bar">
          <p>
            &copy; <span id="year">2026</span> Hydra Baseball Co. All rights reserved.
          </p>
        </div>
      </footer>

      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
