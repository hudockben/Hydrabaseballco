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
const IconUpload = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15.4V3.8" />
    <path d="M8 7.8l4-4 4 4" />
    <path d="M4.6 14.2v4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-4" />
  </svg>
);

/* Stamp inks offered on a custom run, in the order they appear under the ball.
   A run is stamped in one of these and nothing else — there is no full-colour
   press — so the first entry is what a ball is shown in until a team picks its
   own. The hex is the sRGB a Pantone Solid Coated swatch is published at, close
   enough to judge a mockup by, with the real ink matched to the book on press.
   public/script.js reads the colour and the name straight off these chips, so
   the palette is edited here and nowhere else. */
const PANTONE_INKS: { id: string; name: string; hex: string }[] = [
  { id: 'black-c', name: 'PANTONE Black C', hex: '#2D2926' },
  { id: 'cool-gray-11-c', name: 'PANTONE Cool Gray 11 C', hex: '#53565A' },
  { id: '877-c', name: 'PANTONE 877 C (Silver)', hex: '#8A8D8F' },
  { id: '872-c', name: 'PANTONE 872 C (Gold)', hex: '#85714D' },
  { id: '186-c', name: 'PANTONE 186 C', hex: '#C8102E' },
  { id: '200-c', name: 'PANTONE 200 C', hex: '#BA0C2F' },
  { id: '7427-c', name: 'PANTONE 7427 C', hex: '#971B2F' },
  { id: '202-c', name: 'PANTONE 202 C', hex: '#862633' },
  { id: '021-c', name: 'PANTONE Orange 021 C', hex: '#FE5000' },
  { id: '1665-c', name: 'PANTONE 1665 C', hex: '#DC4405' },
  { id: '1235-c', name: 'PANTONE 1235 C', hex: '#FFB81C' },
  { id: '109-c', name: 'PANTONE 109 C', hex: '#FFD100' },
  { id: '355-c', name: 'PANTONE 355 C', hex: '#009639' },
  { id: '348-c', name: 'PANTONE 348 C', hex: '#00843D' },
  { id: '341-c', name: 'PANTONE 341 C', hex: '#007A53' },
  { id: '350-c', name: 'PANTONE 350 C', hex: '#2C5234' },
  { id: '297-c', name: 'PANTONE 297 C', hex: '#71C5E8' },
  { id: '300-c', name: 'PANTONE 300 C', hex: '#005EB8' },
  { id: '287-c', name: 'PANTONE 287 C', hex: '#003087' },
  { id: '289-c', name: 'PANTONE 289 C', hex: '#0C2340' },
  { id: '282-c', name: 'PANTONE 282 C', hex: '#041E42' },
  { id: '268-c', name: 'PANTONE 268 C', hex: '#582C83' },
  { id: '2685-c', name: 'PANTONE 2685 C', hex: '#330072' },
  { id: '476-c', name: 'PANTONE 476 C', hex: '#4E3629' },
];

/* Brand logo (home-plate H emblem + wordmark) used in the header and footer */
function Brand({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  return (
    <a href="#home" className={`brand brand--${variant}`} aria-label="Hydra Baseball Co. home">
      <img
        src="/logo.png"
        alt="Hydra Baseball Co."
        className="brand__logo"
        width={1037}
        height={555}
      />
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
            <a href="#home">Mission</a>
            <a href="#balls">Balls</a>
            <a href="#about">About</a>
            <a href="#customize">Customize</a>
            <a href="#apparel">Apparel</a>
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
          {/* Slide 1 paints immediately; the remaining slides (photos and the
              video) are added by the slideshow only once their media loads —
              anything that fails to load is skipped gracefully. */}
          <div className="hero__slide is-active" style={{ backgroundImage: "url('/images/hero-6.jpg')" }}></div>
          <div className="hero__slide hero__slide--video">
            <video
              className="hero__video"
              muted
              loop={false}
              playsInline
              preload="auto"
              poster="/images/hero-video-poster.jpg"
            >
              {/* H.264 first for Safari and other browsers; VP9/WebM rescues
                  any browser without H.264. The browser downloads only the
                  first source it can play. */}
              <source src="/videos/hero.mp4" type="video/mp4" />
              <source src="/videos/hero.webm" type="video/webm" />
            </video>
          </div>
          <div className="hero__slide" data-src="/images/hero-2.jpg"></div>
          <div className="hero__slide" data-src="/images/hero-3.jpg"></div>
          <div className="hero__slide" data-src="/images/hero-5.jpg"></div>
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
              We&rsquo;re former players who know what it takes between the lines &mdash; and what
              players truly want and need. Hydra is our way of giving back to the game that gave us
              everything, putting quality gear in the hands of the players who live it every day.
            </p>
            <div className="hero__cta">
              <a href="#balls" className="btn btn--light">
                See The Ball
              </a>
              <a href="#team-orders" className="btn btn--outline">
                Team Orders
              </a>
            </div>
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

      {/* ===== The Ball ===== */}
      <section className="balls" id="balls">
        <div className="container balls__inner reveal">
          <div className="balls__head">
            <span className="eyebrow eyebrow--red">The Ball</span>
            <h2 className="section-title balls__title">A1492 Pro Series</h2>
            <span className="balls__rule" aria-hidden="true"></span>
          </div>

          <div className="balls__grid">
            <figure className="balls__photo">
              <img
                src="/images/ball-plus.jpg"
                alt="Hydra A1492+ Pro Series game ball resting on the grass"
                width={1100}
                height={1100}
                loading="lazy"
              />
            </figure>

            <div className="balls__models">
              <ul className="grades__list balls__list">
                <li className="grade">
                  <span className="grade__badge">A1492+</span>
                  <div>
                    <h3 className="grade__name">Premium Leather Game Ball</h3>
                    <p className="grade__desc">
                      The game-day ball, marked with a &ldquo;+&rdquo; on the leather.
                    </p>
                  </div>
                </li>
                <li className="grade">
                  <span className="grade__badge grade__badge--plain">A1492</span>
                  <div>
                    <h3 className="grade__name">Premium Leather Everyday Practice Ball</h3>
                    <p className="grade__desc">Built for everyday practice and play.</p>
                  </div>
                </li>
              </ul>

              <ul className="specs">
                <li className="spec">
                  <span className="spec__k">Size</span>
                  <span className="spec__v">9 in. &middot; 5 oz.</span>
                </li>
                <li className="spec">
                  <span className="spec__k">Cover</span>
                  <span className="spec__v">Full-grain leather</span>
                </li>
                <li className="spec">
                  <span className="spec__k">Center</span>
                  <span className="spec__v">Red cushioned cork</span>
                </li>
                <li className="spec">
                  <span className="spec__k">Build</span>
                  <span className="spec__v">DuraCore&trade; construction</span>
                </li>
              </ul>

              <div className="balls__cta">
                <a href="#team-orders" className="btn btn--dark">
                  Team Orders
                </a>
                <a href="#customize" className="btn btn--outline-ink">
                  Put Your Logo On It
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== The Hydra Difference ===== */}
      <section className="difference" id="about">
        <div
          className="difference__media"
          role="img"
          aria-label="A tray of Hydra A1492 Pro Series baseballs on the turf, an A1492+ game ball among them"
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

            {/* Three balls off the line: two team runs and the game ball they
                are printed on. Backgrounds rather than <img> so a run whose
                photo has not landed yet falls back to the on-brand gradient
                instead of a broken frame, the way .difference__media does. */}
            <ul className="proof">
              <li className="proof__item">
                <span
                  className="proof__shot proof__shot--indiana"
                  role="img"
                  aria-label="An A1492 stamped for Indiana Baseball in a single red ink"
                ></span>
                <span className="proof__cap">Indiana Baseball</span>
              </li>
              <li className="proof__item">
                <span
                  className="proof__shot proof__shot--icml"
                  role="img"
                  aria-label="An A1492 stamped for the Indiana County Men's League, the league mark in the horseshoe"
                ></span>
                <span className="proof__cap">Indiana County Men&rsquo;s League</span>
              </li>
              <li className="proof__item">
                <span
                  className="proof__shot proof__shot--stock"
                  role="img"
                  aria-label="The stock Hydra A1492+ Pro Series game ball on the grass"
                ></span>
                <span className="proof__cap">A1492+ Game Ball</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Custom ball preview ===== */}
      <section className="customizer" id="customize">
        <div className="container customizer__inner reveal">
          <div className="customizer__head">
            <span className="eyebrow eyebrow--red">Custom Balls</span>
            <h2 className="section-title customizer__title">
              Your Logo.
              <br />
              Our Leather.
            </h2>
            <span className="customizer__rule" aria-hidden="true"></span>
            <p className="customizer__lead">
              Drop in your program&rsquo;s mark and see it printed on a real A1492 &mdash; the same
              ball, photographed, with your logo on the open panel or up in the horseshoe. Every run
              is stamped in a single Pantone ink, so picking one restamps the whole ball &mdash;
              your mark and ours alike. It all happens right here in your browser &mdash; your
              artwork never leaves this page.
            </p>
          </div>

          <div className="customizer__grid">
            <div className="customizer__stage">
              {/* script.js draws the A1492 photo here — the same shot as the Ball
                  section with its printed panel retouched out — and wraps an
                  uploaded logo onto the leather. Dimensions match that photo. */}
              <canvas
                id="ballStage"
                className="customizer__canvas"
                width={900}
                height={900}
                role="img"
                aria-label="Preview of your logo on a Hydra A1492 baseball"
              ></canvas>
              <p className="customizer__hint" id="ballHint">
                Upload a logo to get started.
              </p>
            </div>

            <div className="customizer__panel">
              <div className="dropzone" id="logoDrop">
                <input
                  type="file"
                  id="logoInput"
                  className="dropzone__input"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                />
                <label htmlFor="logoInput" className="dropzone__label">
                  <span className="dropzone__icon">{IconUpload}</span>
                  <strong>Upload your logo</strong>
                  <span className="dropzone__meta">
                    PNG, JPG, SVG or WebP &mdash; up to 12&nbsp;MB.
                    <br />A PNG with a transparent background looks best.
                  </span>
                </label>
              </div>

              <p className="customizer__status" id="logoStatus" role="status" aria-live="polite"></p>

              {/* Revealed by script.js once a logo is loaded */}
              <div className="controls" id="logoControls" hidden>
                <div className="control">
                  <span className="control__label" id="spotLabel">
                    Print location
                  </span>
                  <div className="swatches" role="group" aria-labelledby="spotLabel">
                    <button type="button" className="swatch is-active" data-spot="panel" aria-pressed="true">
                      Panel
                    </button>
                    <button type="button" className="swatch" data-spot="horseshoe" aria-pressed="false">
                      Horseshoe
                    </button>
                  </div>
                </div>

                <div className="control">
                  <label className="control__label" htmlFor="logoSize">
                    Size
                  </label>
                  <input
                    type="range"
                    id="logoSize"
                    className="control__range"
                    min="15"
                    max="130"
                    defaultValue="55"
                    step="1"
                  />
                </div>

                <div className="control">
                  <span className="control__label" id="nudgeLabel">
                    Position
                  </span>
                  <div className="nudge" role="group" aria-labelledby="nudgeLabel">
                    <button
                      type="button"
                      className="nudge__btn nudge__up"
                      data-nudge="up"
                      aria-label="Move the logo up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="nudge__btn nudge__left"
                      data-nudge="left"
                      aria-label="Move the logo left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="nudge__btn nudge__centre"
                      data-nudge="center"
                      title="Put the logo back in the middle of the spot"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      className="nudge__btn nudge__right"
                      data-nudge="right"
                      aria-label="Move the logo right"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="nudge__btn nudge__down"
                      data-nudge="down"
                      aria-label="Move the logo down"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="control">
                  <span className="control__label" id="inkLabel">
                    Pantone ink
                  </span>
                  <div className="pantone" role="group" aria-labelledby="inkLabel">
                    {/* One stamp run is one ink, so a colour here restamps the whole
                        ball — your mark, our wordmark, the model line and the specs.
                        The first chip is the ink a ball starts out in; script.js
                        reads that from the palette rather than naming a default. */}
                    {PANTONE_INKS.map((swatch, i) => (
                      <button
                        key={swatch.id}
                        type="button"
                        className={i === 0 ? 'pantone__chip is-active' : 'pantone__chip'}
                        data-ink={swatch.id}
                        data-hex={swatch.hex}
                        data-name={swatch.name}
                        aria-pressed={i === 0 ? 'true' : 'false'}
                        aria-label={swatch.name}
                        title={swatch.name}
                        style={{ background: swatch.hex }}
                      ></button>
                    ))}
                  </div>
                  {/* Kept in step by setInk() the moment another chip is picked. */}
                  <p className="pantone__readout" id="inkReadout">
                    {PANTONE_INKS[0].name} &mdash; one ink, every mark on the ball.
                  </p>
                </div>

                <label className="control__check">
                  <input type="checkbox" id="logoKnockout" />
                  <span>Remove background</span>
                </label>

                <div className="controls__actions">
                  <button type="button" className="btn btn--light" id="logoAttach">
                    Add To My Order
                  </button>
                  <button type="button" className="btn btn--outline" id="logoDownload">
                    Download Mockup
                  </button>
                  <button type="button" className="controls__reset" id="logoReset">
                    Start over
                  </button>
                </div>
              </div>
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
            <input type="tel" name="phone" placeholder="Phone (optional)" aria-label="Phone" />
            <input type="text" name="team" placeholder="Team or organization" aria-label="Team or organization" required />
            <select name="state" aria-label="State" defaultValue="" autoComplete="address-level1" required>
              <option value="" disabled>
                State
              </option>
              <option>Alabama</option>
              <option>Alaska</option>
              <option>Arizona</option>
              <option>Arkansas</option>
              <option>California</option>
              <option>Colorado</option>
              <option>Connecticut</option>
              <option>Delaware</option>
              <option>District of Columbia</option>
              <option>Florida</option>
              <option>Georgia</option>
              <option>Hawaii</option>
              <option>Idaho</option>
              <option>Illinois</option>
              <option>Indiana</option>
              <option>Iowa</option>
              <option>Kansas</option>
              <option>Kentucky</option>
              <option>Louisiana</option>
              <option>Maine</option>
              <option>Maryland</option>
              <option>Massachusetts</option>
              <option>Michigan</option>
              <option>Minnesota</option>
              <option>Mississippi</option>
              <option>Missouri</option>
              <option>Montana</option>
              <option>Nebraska</option>
              <option>Nevada</option>
              <option>New Hampshire</option>
              <option>New Jersey</option>
              <option>New Mexico</option>
              <option>New York</option>
              <option>North Carolina</option>
              <option>North Dakota</option>
              <option>Ohio</option>
              <option>Oklahoma</option>
              <option>Oregon</option>
              <option>Pennsylvania</option>
              <option>Rhode Island</option>
              <option>South Carolina</option>
              <option>South Dakota</option>
              <option>Tennessee</option>
              <option>Texas</option>
              <option>Utah</option>
              <option>Vermont</option>
              <option>Virginia</option>
              <option>Washington</option>
              <option>West Virginia</option>
              <option>Wisconsin</option>
              <option>Wyoming</option>
            </select>
            <input
              type="text"
              name="zip"
              inputMode="numeric"
              maxLength={10}
              placeholder="Zip code"
              aria-label="Zip code"
              autoComplete="postal-code"
            />
            <select name="level" aria-label="Level of play" defaultValue="" required>
              <option value="" disabled>
                Level of play
              </option>
              <option>Youth</option>
              <option>High School</option>
              <option>Travel / Club</option>
              <option>College</option>
              <option>Adult / League</option>
              <option>Other</option>
            </select>
            <input
              type="number"
              name="quantity"
              min="1"
              inputMode="numeric"
              placeholder="Approx. # of baseballs"
              aria-label="Approximate number of baseballs"
            />
            <textarea
              name="message"
              rows={4}
              placeholder="Anything else? Timeline, product interest, budget, questions…"
              aria-label="Message"
            ></textarea>

            {/* Set by the custom ball preview when a logo mockup is attached */}
            <input type="hidden" name="logo" id="ordersLogo" value="" />

            {/* Form-to-email service config (read by FormSubmit) */}
            <input type="hidden" name="_subject" value="New Team Order Inquiry — Hydra Baseball Co." />
            <input type="hidden" name="_template" value="table" />
            <input type="hidden" name="_captcha" value="false" />
            {/* Honeypot: bots fill this, humans don't */}
            <input
              type="text"
              name="_honey"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="orders__honey"
            />

            <button type="submit" className="btn btn--dark">
              Request Info
            </button>
          </form>

          <p className="orders__note">
            Prefer email? <a href="mailto:info@hydrabaseballco.com">info@hydrabaseballco.com</a>
          </p>
        </div>
      </section>

      {/* ===== Apparel (Coming Soon) ===== */}
      <section className="apparel" id="apparel">
        <div className="container apparel__inner reveal">
          <span className="eyebrow eyebrow--red">Apparel</span>
          <h2 className="section-title apparel__title">Coming Soon&hellip;</h2>
          <span className="apparel__rule" aria-hidden="true"></span>
          <p className="apparel__text">
            Hydra gear for players &mdash; on the field and off. Our apparel line is on deck.
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
            <a href="#home">Mission</a>
            <a href="#balls">Balls</a>
            <a href="#about">About</a>
            <a href="#customize">Customize</a>
            <a href="#apparel">Apparel</a>
            <a href="#team-orders">Team Orders</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="footer__col">
            <h4>Contact</h4>
            <a href="mailto:info@hydrabaseballco.com">info@hydrabaseballco.com</a>
            <div className="footer__social">
              <a href="https://instagram.com/hydrabaseballco" aria-label="Instagram" target="_blank" rel="noreferrer">
                {IconInstagram}
              </a>
              <a href="mailto:info@hydrabaseballco.com" aria-label="Email us">
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
