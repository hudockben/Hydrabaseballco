import Script from 'next/script';

export default function HomePage() {
  return (
    <>
      {/* ===== Navigation ===== */}
      <header className="nav" id="nav">
        <div className="container nav__inner">
          <a href="#top" className="brand" aria-label="Hydra Baseball Co. home">
            <span className="brand__mark" aria-hidden="true">
              H<sup>™</sup>
            </span>
            <span className="brand__name">
              Hydra<span className="brand__sub">Baseball Co.</span>
            </span>
          </a>

          <nav className="nav__links" id="navLinks" aria-label="Primary">
            <a href="#products">Products</a>
            <a href="#prime">Hydra Prime</a>
            <a href="#heritage">Heritage</a>
            <a href="#contact">Contact</a>
            <a href="#products" className="btn btn--small btn--solid">
              Shop Baseballs
            </a>
          </nav>

          <button className="nav__toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="hero" id="top">
        <div className="hero__glow" aria-hidden="true"></div>
        <span className="hero__watermark" aria-hidden="true">
          H
        </span>

        <div className="container hero__inner reveal">
          <span className="hero__emblem" aria-hidden="true">
            H<sup>™</sup>
          </span>
          <h1 className="hero__title">
            HYDRA<span>BASEBALL CO.</span>
          </h1>
          <p className="hero__tagline">Built for Competition.</p>
          <p className="hero__lead">
            Competition-grade baseballs engineered with full grain leather and precision cores — for
            every pitch, every inning, every game.
          </p>
          <div className="hero__cta">
            <a href="#products" className="btn btn--solid">
              Shop Baseballs
            </a>
            <a href="#heritage" className="btn btn--ghost">
              Our Heritage
            </a>
          </div>
        </div>
      </section>

      {/* ===== Brand color stripe ===== */}
      <section className="stripe" aria-hidden="true">
        <div className="stripe__panel stripe__panel--cream">
          <span>H</span>
        </div>
        <div className="stripe__panel stripe__panel--bronze">
          <span>H</span>
        </div>
        <div className="stripe__panel stripe__panel--ink">
          <span>H</span>
        </div>
      </section>

      {/* ===== Featured product: Hydra Prime ===== */}
      <section className="prime" id="prime">
        <div className="container prime__inner">
          <div className="prime__media reveal">
            <div className="ball ball--lg">
              <svg viewBox="0 0 200 200" role="img" aria-label="Hydra Prime baseball">
                <defs>
                  <radialGradient id="ballShade" cx="38%" cy="32%" r="75%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="70%" stopColor="#f4f0e7" />
                    <stop offset="100%" stopColor="#ddd5c4" />
                  </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="94" fill="url(#ballShade)" stroke="#e6dfcf" strokeWidth="2" />
                <path className="seam" d="M44 22 C 78 70, 78 130, 44 178" />
                <path className="seam" d="M156 22 C 122 70, 122 130, 156 178" />
                <path className="stitch" d="M44 22 C 78 70, 78 130, 44 178" />
                <path className="stitch" d="M156 22 C 122 70, 122 130, 156 178" />
              </svg>
              <span className="ball__brand">H</span>
            </div>
          </div>

          <div className="prime__copy reveal">
            <span className="eyebrow">Flagship Game Ball</span>
            <h2 className="prime__title">
              Hydra <em>Prime</em>
            </h2>
            <p className="prime__desc">
              Our collegiate-grade flagship. A cushioned cork &amp; rubber core wrapped in genuine full
              grain leather and raised seams — tuned for true flight, sharp break, and a consistent feel
              from the first pitch to the last out.
            </p>
            <ul className="specs">
              <li>
                <span className="specs__k">Grade</span>
                <span className="specs__v">Collegiate</span>
              </li>
              <li>
                <span className="specs__k">Core</span>
                <span className="specs__v">Cork + Rubber</span>
              </li>
              <li>
                <span className="specs__k">Cover</span>
                <span className="specs__v">Full Grain Leather</span>
              </li>
              <li>
                <span className="specs__k">Seams</span>
                <span className="specs__v">Raised, Hand-Stitched</span>
              </li>
            </ul>
            <div className="prime__cta">
              <a href="#contact" className="btn btn--solid">
                Request a Quote
              </a>
              <a href="#products" className="btn btn--ghost">
                See Full Lineup
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Product lineup ===== */}
      <section className="products" id="products">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">The Lineup</span>
            <h2 className="section-title">Balls Built for Every Level</h2>
            <p className="section-sub">
              From the youth diamond to the collegiate stage — one standard of quality.
            </p>
          </div>

          <div className="grid">
            <article className="card reveal">
              <div className="card__ball">
                <span className="mini-ball"></span>
              </div>
              <h3 className="card__title">Hydra Prime</h3>
              <p className="card__tag">Collegiate Game Ball</p>
              <p className="card__desc">Full grain leather, cork + rubber core, raised seams. Our flagship.</p>
              <span className="card__badge">Best Seller</span>
            </article>

            <article className="card reveal">
              <div className="card__ball">
                <span className="mini-ball"></span>
              </div>
              <h3 className="card__title">Hydra Pro</h3>
              <p className="card__tag">Pro-Grade Leather</p>
              <p className="card__desc">Premium top-grain cover and tightly wound core for elite-level play.</p>
            </article>

            <article className="card reveal">
              <div className="card__ball">
                <span className="mini-ball"></span>
              </div>
              <h3 className="card__title">Hydra Youth</h3>
              <p className="card__tag">League Approved</p>
              <p className="card__desc">Reduced-impact construction sized and weighted for youth leagues.</p>
            </article>

            <article className="card reveal">
              <div className="card__ball">
                <span className="mini-ball"></span>
              </div>
              <h3 className="card__title">Hydra Practice</h3>
              <p className="card__tag">Training Dozen</p>
              <p className="card__desc">Durable synthetic-blend cover built to grind through bucket work.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ===== Why Hydra / features ===== */}
      <section className="features">
        <div className="container">
          <div className="features__grid">
            <div className="feature reveal">
              <span className="feature__icon">◆</span>
              <h3>Full Grain Leather</h3>
              <p>Genuine leather covers selected for grip, durability, and a broken-in feel out of the box.</p>
            </div>
            <div className="feature reveal">
              <span className="feature__icon">◎</span>
              <h3>Precision Cores</h3>
              <p>Cork and rubber cores wound to spec for true flight and consistent rebound.</p>
            </div>
            <div className="feature reveal">
              <span className="feature__icon">▲</span>
              <h3>Raised Seams</h3>
              <p>Hand-stitched, raised seams give pitchers the bite they need to compete.</p>
            </div>
            <div className="feature reveal">
              <span className="feature__icon">✦</span>
              <h3>Built to Compete</h3>
              <p>Every ball is held to one standard — game-ready, inning after inning.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Heritage ===== */}
      <section className="heritage" id="heritage">
        <div className="container heritage__inner">
          <div className="heritage__copy reveal">
            <span className="eyebrow">Inspired by the Best</span>
            <h2 className="section-title">A Legacy, Reimagined</h2>
            <p>
              Hydra draws influence from the legacy of <strong>Rawlings</strong>, <strong>Wilson</strong>,
              and <strong>Baden</strong> — brands that set the standard. We combine that heritage with
              modern innovation to elevate every pitch, every inning, every game.
            </p>
            <div className="heritage__brands">
              <span>Rawlings</span>
              <span>Wilson</span>
              <span>Baden</span>
            </div>
          </div>
          <div className="heritage__panel reveal" aria-hidden="true">
            <span className="heritage__big">H</span>
            <p className="heritage__slogan">Built for Competition.</p>
          </div>
        </div>
      </section>

      {/* ===== Contact / CTA ===== */}
      <section className="contact" id="contact">
        <div className="container contact__inner reveal">
          <h2 className="section-title">Get Hydra on Your Field</h2>
          <p className="section-sub">
            Teams, leagues, and retailers — reach out for pricing, bulk orders, and samples.
          </p>
          <form className="contact__form">
            <input type="text" placeholder="Name" aria-label="Name" required />
            <input type="email" placeholder="Email" aria-label="Email" required />
            <input type="text" placeholder="Team or organization" aria-label="Team or organization" />
            <button type="submit" className="btn btn--solid">
              Request Info
            </button>
          </form>
          <p className="contact__note">
            Or email us at <a href="mailto:sales@hydrabaseball.co">sales@hydrabaseball.co</a>
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <span className="brand__mark" aria-hidden="true">
              H<sup>™</sup>
            </span>
            <div>
              <strong>Hydra Baseball Co.</strong>
              <span>Built for Competition.</span>
            </div>
          </div>
          <nav className="footer__links" aria-label="Footer">
            <a href="#products">Products</a>
            <a href="#prime">Hydra Prime</a>
            <a href="#heritage">Heritage</a>
            <a href="#contact">Contact</a>
          </nav>
          <p className="footer__copy">
            &copy; <span id="year">2026</span> Hydra Baseball Co.™ All rights reserved.
          </p>
        </div>
      </footer>

      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
