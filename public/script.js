/* Hydra Baseball Co. — landing page interactions */
(function () {
  'use strict';

  var nav = document.getElementById('siteNav');
  var toggle = document.getElementById('navToggle');

  /* Mobile menu toggle */
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* Close menu when a link is tapped */
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Trusted By ticker — the scrolling is all CSS (see .ticker in styles.css).
     This is its pause button, for anyone who can't hover the strip to hold it
     still: on a phone, or from the keyboard. .is-paused stops every copy of the
     logos at once, so they stay in step. */
  var ticker = document.getElementById('ticker');
  var tickerToggle = document.getElementById('tickerToggle');
  if (ticker && tickerToggle) {
    tickerToggle.addEventListener('click', function () {
      var paused = ticker.classList.toggle('is-paused');
      tickerToggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    });
  }

  /* Reveal-on-scroll animations */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Cutaway — the cross-section sweeps open once the block scrolls into view.
     Every frame of the sweep is CSS (see .cut in styles.css), including the
     reduced-motion case, where the ball is simply already open; this only picks
     the moment and lets the button run it again. Stripping the class and
     reading a layout property before putting it back is what restarts a CSS
     animation that has already finished. */
  var cutaway = document.getElementById('ballCut');
  if (cutaway) {
    var runCut = function () {
      cutaway.classList.remove('is-cutting');
      void cutaway.offsetWidth;
      cutaway.classList.add('is-cutting');
    };

    if ('IntersectionObserver' in window) {
      var cutIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCut();
            cutIo.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      cutIo.observe(cutaway);
    } else {
      runCut();
    }

    var cutReplay = document.getElementById('ballCutReplay');
    if (cutReplay) { cutReplay.addEventListener('click', runCut); }
  }

  /* Hero slideshow — cross-fades through the player photos and the intro
     video. Photos load their image first and the video waits until it can
     play; any media that 404s or can't be played is skipped, so the rotation
     only ever contains media that actually works. */
  var heroMedia = document.getElementById('heroSlides');
  if (heroMedia) {
    var slides = Array.prototype.slice.call(heroMedia.querySelectorAll('.hero__slide'));
    var pending = slides.length;

    var settle = function () {
      if (--pending > 0) return;
      startSlideshow();
    };

    slides.forEach(function (slide) {
      var video = slide.querySelector('video');
      if (video) {
        // Ready once the browser can play the clip; drop the slide if the
        // source errors (e.g. an unsupported format on this browser).
        var settled = false;
        var ready = function () {
          if (settled) { return; } settled = true;
          slide.setAttribute('data-ready', '1'); settle();
        };
        var drop = function () {
          if (settled) { return; } settled = true;
          if (slide.parentNode) { slide.parentNode.removeChild(slide); }
          settle();
        };
        video.muted = true; // required for muted autoplay
        if (video.readyState >= 2) { ready(); }
        else {
          video.addEventListener('loadeddata', ready, { once: true });
          video.addEventListener('error', drop, { once: true });
          // Don't let a slow-loading clip hold up the whole slideshow — after a
          // short wait, start anyway and keep the slide (it streams on its turn).
          // (preload="auto" already fetches the source, so no explicit load().)
          window.setTimeout(ready, 2500);
        }
        return;
      }
      var src = slide.getAttribute('data-src');
      if (!src) { slide.setAttribute('data-ready', '1'); settle(); return; } // slide 1: inline bg
      var probe = new Image();
      probe.onload = function () {
        slide.style.backgroundImage = "url('" + src + "')";
        slide.setAttribute('data-ready', '1');
        settle();
      };
      probe.onerror = function () {
        if (slide.parentNode) { slide.parentNode.removeChild(slide); }
        settle();
      };
      probe.src = src;
    });

    function startSlideshow() {
      var active = Array.prototype.slice.call(
        heroMedia.querySelectorAll('.hero__slide[data-ready]')
      );
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function videoOf(slide) { return slide ? slide.querySelector('video') : null; }
      function playVideo(v) {
        if (!v || reduce) { return null; }
        v.muted = true;
        try { v.currentTime = 0; } catch (e) {}
        try { return v.play() || null; } catch (e) { return null; }
      }
      function pauseVideo(v) { if (v) { try { v.pause(); } catch (e) {} } }

      active.forEach(function (s, i) { s.classList.toggle('is-active', i === 0); });
      if (active.length <= 1) {
        var only = videoOf(active[0]);
        if (only) { only.loop = true; var p0 = playVideo(only); if (p0 && p0.catch) { p0.catch(function () {}); } }
        return;
      }

      var dotsWrap = document.getElementById('heroDots');
      var dots = [];
      var idx = 0;
      var timer = null;
      var endedVideo = null;
      var endedHandler = null;
      var PHOTO_MS = 2600;
      var VIDEO_MAX_MS = 20000; // safety cap if a clip's 'ended' never fires
      var VIDEO_FAIL_MS = 2500;  // poster dwell if the clip can't play at all

      function clearTimers() {
        if (timer) { window.clearTimeout(timer); timer = null; }
        if (endedVideo && endedHandler) { endedVideo.removeEventListener('ended', endedHandler); }
        endedVideo = null; endedHandler = null;
      }
      function advance() { go(idx + 1); schedule(); }
      function schedule() {
        clearTimers();
        if (reduce) { return; }
        var v = videoOf(active[idx]);
        if (v) {
          // Play the clip, then move on when it ends (safety cap if 'ended'
          // never fires). If it can't play, only linger on the poster briefly.
          endedVideo = v; endedHandler = advance;
          v.addEventListener('ended', endedHandler);
          timer = window.setTimeout(advance, VIDEO_MAX_MS);
          var p = playVideo(v);
          if (p && p.catch) {
            p.catch(function () {
              if (timer) { window.clearTimeout(timer); }
              timer = window.setTimeout(advance, VIDEO_FAIL_MS);
            });
          }
        } else {
          timer = window.setTimeout(advance, PHOTO_MS);
        }
      }
      function go(n) {
        active[idx].classList.remove('is-active');
        if (dots[idx]) { dots[idx].classList.remove('is-active'); }
        pauseVideo(videoOf(active[idx]));
        idx = (n + active.length) % active.length;
        active[idx].classList.add('is-active');
        if (dots[idx]) { dots[idx].classList.add('is-active'); }
      }
      function stop() { clearTimers(); }
      function start() { schedule(); }
      function restart() { stop(); start(); }

      if (dotsWrap) {
        active.forEach(function (s, i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'hero__dot' + (i === 0 ? ' is-active' : '');
          b.setAttribute('aria-label', 'Show hero slide ' + (i + 1));
          b.addEventListener('click', function () { go(i); restart(); });
          dotsWrap.appendChild(b);
          dots.push(b);
        });
      }

      heroMedia.addEventListener('mouseenter', stop);
      heroMedia.addEventListener('mouseleave', restart);
      start();
    }
  }

  /* Footer year */
  var yearEl = document.getElementById('year');
  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }

  /* What the custom ball preview (further down) hands the Team Orders form
     when someone presses "Add To My Order": the line describing their mockup,
     and a promise of the files that go with it. Null until then, and again
     after "Start over". */
  var orderArt = null;

  /* Team Orders form — submit to the form-to-email service so every inquiry
     lands in the inbox. If that request fails, fall back to a pre-filled
     email so a submission is never lost. An inquiry carrying a mocked-up logo
     is posted as a regular form instead, because that is the route FormSubmit
     documents for file attachments; FormSubmit then sends the visitor back
     here with ?inquiry=sent. */
  var ordersForm = document.getElementById('ordersForm');
  if (ordersForm) {
    var ORDERS_ENDPOINT = 'https://formsubmit.co/ajax/info@hydrabaseballco.com';
    var ORDERS_FORM_ACTION = 'https://formsubmit.co/info@hydrabaseballco.com';
    var CONTACT_EMAIL = 'info@hydrabaseballco.com';
    var submitBtn = ordersForm.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.textContent : '';

    var labels = {
      name: 'Name', email: 'Email', phone: 'Phone',
      team: 'Team / organization', state: 'State', zip: 'Zip code',
      level: 'Level of play', quantity: 'Approx. # of baseballs',
      referral: 'Heard about us from',
      logo: 'Custom logo', message: 'Message'
    };

    function fieldLines(data) {
      var lines = [];
      Object.keys(labels).forEach(function (key) {
        var v = (data.get(key) || '').toString().trim();
        if (v) { lines.push(labels[key] + ': ' + v); }
      });
      return lines;
    }

    function mailtoFallback(data) {
      var href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent('Team Order Inquiry') +
        '&body=' + encodeURIComponent(fieldLines(data).join('\n'));
      window.location.href = href;
    }

    function showThanks() {
      ordersForm.innerHTML =
        '<p class="orders__thanks">Thanks — your request is in. We&rsquo;ll be in touch shortly.</p>';
    }

    function resetButton() {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
    }

    /* Back from FormSubmit after an inquiry that went with attachments. */
    if (/[?&]inquiry=sent(?:&|$)/.test(window.location.search)) {
      showThanks();
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      }
    }

    /* The Back button from FormSubmit can restore this page exactly as it was
       left, button still reading "Sending…". */
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) { resetButton(); }
    });

    /* Inputs a post with attachments added — dropped before any other try, so
       a second attempt never carries the first one's files twice. */
    function clearArtInputs() {
      var old = ordersForm.querySelectorAll('[data-order-art]');
      for (var i = 0; i < old.length; i++) { old[i].parentNode.removeChild(old[i]); }
    }

    /* Post the form the regular way, the artwork riding along in file inputs.
       Returns false, having changed nothing, when this browser can't put a
       file into a form (no DataTransfer), so the caller can send the inquiry
       without it. */
    function postWithFiles(files) {
      if (!files.length || typeof window.DataTransfer !== 'function') { return false; }
      var added = [];
      try {
        for (var i = 0; i < files.length; i++) {
          var dt = new window.DataTransfer();
          dt.items.add(files[i].file);
          var input = document.createElement('input');
          input.type = 'file';
          input.name = files[i].field;
          input.files = dt.files;
          if (!input.files || input.files.length !== 1) { return false; }
          added.push(input);
        }
      } catch (err) {
        return false;
      }
      var next = document.createElement('input');
      next.type = 'hidden';
      next.name = '_next';
      next.value = window.location.origin + window.location.pathname + '?inquiry=sent#team-orders';
      added.push(next);

      clearArtInputs();
      for (var j = 0; j < added.length; j++) {
        added[j].setAttribute('data-order-art', '');
        added[j].style.display = 'none';
        ordersForm.appendChild(added[j]);
      }
      ordersForm.action = ORDERS_FORM_ACTION;
      ordersForm.method = 'post';
      ordersForm.enctype = 'multipart/form-data';
      ordersForm.submit();
      return true;
    }

    function sendInBackground() {
      clearArtInputs();
      var data = new FormData(ordersForm);
      if (!('fetch' in window)) { mailtoFallback(data); resetButton(); return; }

      fetch(ORDERS_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: data
      })
        .then(function (r) { return r.ok ? showThanks() : (mailtoFallback(data), resetButton()); })
        .catch(function () { mailtoFallback(data); resetButton(); });
    }

    ordersForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ordersForm.checkValidity()) { ordersForm.reportValidity(); return; }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      var art = orderArt;
      if (!art) { sendInBackground(); return; }

      /* The email's "logo" line says what came with it, so a file that didn't
         make it is something we know to ask for. */
      var logoField = document.getElementById('ordersLogo');
      var withoutFiles = function () {
        if (logoField) { logoField.value = art.summary + ' — the logo file didn’t come through, so ask for it'; }
        sendInBackground();
      };
      art.packed.then(function (packed) {
        if (logoField) { logoField.value = art.summary + packed.note; }
        if (!postWithFiles(packed.files)) { withoutFiles(); }
      }, withoutFiles);
    });
  }

  /* Custom ball preview — puts an uploaded team logo on the real A1492.
     The stage is the product photograph with the spot being printed retouched
     out (tools/make-ball-blank.py), so a mark lands on bare leather while the
     seams, the grain and the light stay exactly as they were shot. Everything
     else about the ball is the photograph. The artwork is read and composited
     entirely in the browser. It only leaves the page if the customer presses
     "Add To My Order" and then sends the Team Orders form, which attaches the
     logo file and a snapshot of the mockup to that inquiry. */
  var stage = document.getElementById('ballStage');
  if (stage && stage.getContext && stage.getContext('2d') && window.FileReader) {
    var ctx = stage.getContext('2d');

    /* ---- Geometry (internal pixels; CSS scales the canvas down) --------
       Each ball on offer is one photograph, retouched so the spot a mark
       goes in is bare leather, drawn 900px square. Its numbers are measured
       off that photo: the ball's centre and radius (a least-squares fit of the
       limb), where a mark can go, and where the printing left on it sits.

       A1492: public/images/ball.jpg (1100x1100) at 900px — centre (545.5,
       519.8) and radius 394.5 there, scaled by 900/1100 here. Its photos are
       built by tools/make-ball-blank.py.
       A1592: public/images/a1592.jpg, a square cropped around the ball and
       scaled up to 900px, so the ball is bigger on the stage — that photo has
       nothing above or below it to show. tools/make-ball-1592.py builds its
       photos and prints these numbers.

       Spots are in flat decal units (1 = the ball's radius at the centre of
       the sphere), with the box a mark is fitted into and the photo that has
       that spot cleared. The ball keeps the Hydra name either way: printed in
       the horseshoe as it ships, or moved down onto the panel as the
       HYDRA / model lockup when a team takes the horseshoe — retouched into the
       photo by the tools, not drawn here. Both spots were measured off the
       photo and mapped through the projection below. `print` is where the
       printing left on the photos sits — see "The printing already on the
       ball" below. */
    var W = 900, H = 900;
    var TAU = Math.PI * 2;
    var MODELS = {
      a1492: {
        name: 'A1492',
        cx: 446.3, cy: 425.3, r: 322.8,
        spots: {
          panel: { x: 0.05, y: 0.174, fitW: 0.8, fitH: 0.4, src: '/images/ball-blank.jpg' },
          horseshoe: { x: 0.09, y: -0.95, fitW: 1.05, fitH: 0.66, src: '/images/ball-blank-horseshoe.jpg' }
        },
        print: [
          [312, 630, 112, 262],   /* the Hydra wordmark, up in the horseshoe */
          [308, 618, 404, 558],   /* between the seams: the model mark, or the
                                     HYDRA / A1492 lockup that replaces it */
          [302, 602, 643, 740]    /* the specs line along the bottom */
        ]
      },
      a1592: {
        name: 'A1592',
        cx: 450.4, cy: 454.2, r: 422.6,
        spots: {
          panel: { x: 0.07, y: 0.40, fitW: 0.9, fitH: 0.38, src: '/images/ball-1592-blank.jpg' },
          horseshoe: { x: 0.044, y: -0.89, fitW: 1.0, fitH: 0.56, src: '/images/ball-1592-blank-horseshoe.jpg' }
        },
        print: [
          [257, 673, 52, 233],    /* the Hydra wordmark */
          [211, 730, 512, 676]    /* the model mark, or HYDRA / A1592 */
        ]                         /* no specs line: the grass hides that side */
      }
    };

    /* The ball on the stage, and the numbers everything below draws with. */
    var model = 'a1492';
    var CX, CY, R, PLACEMENTS;
    function useModel(key) {
      var m = MODELS[key];
      CX = m.cx; CY = m.cy; R = m.r;
      PLACEMENTS = m.spots;
    }
    useModel(model);
    var placement = 'panel';

    var hint = document.getElementById('ballHint');
    var statusEl = document.getElementById('logoStatus');
    var controls = document.getElementById('logoControls');
    var fileInput = document.getElementById('logoInput');
    var dropEl = document.getElementById('logoDrop');
    var sizeInput = document.getElementById('logoSize');
    var knockBox = document.getElementById('logoKnockout');
    var downloadBtn = document.getElementById('logoDownload');
    var attachBtn = document.getElementById('logoAttach');
    var resetBtn = document.getElementById('logoReset');
    var swatchEls = document.querySelectorAll('[data-ink]');
    var spotEls = document.querySelectorAll('.swatch[data-spot]');
    var modelEls = document.querySelectorAll('.swatch[data-model]');
    var nudgeEls = document.querySelectorAll('[data-nudge]');
    var readout = document.getElementById('inkReadout');

    /* The Pantone palette is authored in the markup (app/page.tsx) and read off
       the chips here, so the colour on a chip and the colour it stamps with
       cannot drift apart. Every run is one ink — the press has no full-colour
       option — so the first chip is what a ball starts out stamped in. */
    var INK = {}, INK_LABEL = {}, DEFAULT_INK = '';
    (function () {
      for (var i = 0; i < swatchEls.length; i++) {
        var id = swatchEls[i].getAttribute('data-ink');
        var hex = /^#?([0-9a-f]{6})$/i.exec(swatchEls[i].getAttribute('data-hex') || '');
        if (!id || !hex) { continue; }
        var v = parseInt(hex[1], 16);
        INK[id] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        INK_LABEL[id] = swatchEls[i].getAttribute('data-name') || id;
        if (!DEFAULT_INK) { DEFAULT_INK = id; }
      }
    })();
    function inkFor(id) {
      return Object.prototype.hasOwnProperty.call(INK, id) ? INK[id] : null;
    }

    var MAX_BYTES = 12 * 1024 * 1024;
    var DEFAULT_HINT = 'Upload a logo to get started.';

    /* Logo state. Positions and sizes are in "flat" units where 1 = the ball's
       radius at the centre of the sphere (see the projection note below). */
    var logoImg = null, logoSrcW = 0, logoSrcH = 0, logoName = '';
    var logoData = null, logoW = 0, logoH = 0;
    /* The file exactly as the customer chose it — what "Add To My Order" sends,
       since a print run is set up from their artwork, not from our preview. */
    var logoFile = null;
    var posX = PLACEMENTS.panel.x, posY = PLACEMENTS.panel.y, widthU = 0.55;
    var ink = DEFAULT_INK, knockout = false;
    /* The backdrop found behind the loaded artwork (see findBackdrop), worked
       out once per file so swapping inks doesn't redo it; and how much ink the
       last pass left standing, so a mark that would print as almost nothing
       can be called out. */
    var backdrop = null, inkCoverage = 1;

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    /* The spot's outline, shown while the mark is being moved or resized so a
       logo growing toward a seam is something you can see coming. */
    var guideOn = false, guideTimer = 0;
    function flashGuide() {
      guideOn = true;
      if (guideTimer) { clearTimeout(guideTimer); }
      guideTimer = setTimeout(function () {
        guideOn = false;
        guideTimer = 0;
        queueDraw();
      }, 1400);
    }

    function makeLayer() {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      return c;
    }

    /* ---- Sphere projection --------------------------------------------
       A decal on a sphere seen head-on is an azimuthal-equidistant map: a
       screen point r from the centre (in radii) sits asin(r) radians of arc
       away, so the flat artwork coordinate is r scaled by asin(r)/r. That
       ratio only depends on r, so it lives in a small lookup table instead of
       an asin() per pixel per frame. */
    var KN = 4096;
    var kTable = new Float32Array(KN + 1);
    (function () {
      for (var i = 0; i <= KN; i++) {
        var rr = i / KN;
        kTable[i] = rr < 1e-6 ? 1 : Math.asin(rr < 1 ? rr : 1) / rr;
      }
    })();
    function kAt(r) {
      var f = r * KN, i = f | 0;
      if (i >= KN) { return kTable[KN]; }
      return kTable[i] + (kTable[i + 1] - kTable[i]) * (f - i);
    }

    /* ---- The ball ------------------------------------------------------
       One photograph, drawn straight onto the canvas. The only thing derived
       from it is a leather mask: grass crosses in front of the ball along the
       bottom of the circle, and a printed mark must not paint over it. Grass is
       the one strongly green thing in the frame, so greenness keys it out —
       white leather, black print and red seams all stay printable. Photos are
       kept per ball and spot ("a1592:panel"), and each ball's mask on that
       ball's entry in MODELS. */
    var photos = {};

    function buildLeatherMask(img, key) {
      var c = makeLayer();
      var cc = c.getContext('2d');
      if (!cc) { return; }
      cc.drawImage(img, 0, 0, W, H);
      var px;
      try {
        px = cc.getImageData(0, 0, W, H).data;
      } catch (err) {
        return; /* same-origin, so this shouldn't happen — but don't die on it */
      }
      var m = new Uint8Array(W * H);
      for (var i = 0, o = 0; i < m.length; i++, o += 4) {
        var other = px[o] > px[o + 2] ? px[o] : px[o + 2];
        var green = px[o + 1] - other;
        /* <= 2 is leather or ink, >= 18 is grass, ramp across the edge. */
        m[i] = green <= 2 ? 255 : (green >= 18 ? 0 : Math.round((18 - green) * 255 / 16));
      }
      MODELS[key].leather = m;
    }

    /* ---- The printing already on the ball ------------------------------
       A stamp run is one ink: the mark a team sends up, the Hydra wordmark,
       the model line and the specs along the bottom all come off the same
       press in the same colour. So picking an ink has to restamp the printing
       in the photograph too — and unlike the uploaded artwork, that printing
       arrives baked into the pixels.

       It is lifted the way tools/make-ball-blank.py lifts a whole panel: a
       grayscale closing fills anything darker and thinner than its kernel, so
       closing - photo is the printing and nothing else. What that yields, per
       photo, is two layers — the leather the ink is sitting on, and the ink as
       a shape. Draw the first over the photo and the printing lifts off; fill
       the second with the chosen colour and multiply it back down and the
       printing returns in that ink, with the grain and the shading of the
       leather still reading through it, exactly as an uploaded mark does.

       Only the three spots that carry printing are searched. Elsewhere the
       lacing holes and the shadow between the stitches run just as dark as a
       glyph, and recolouring those would be plainly wrong. Boxes are each
       ball's `print` in MODELS, in canvas pixels, measured off the photo like
       the placements above; a spot that has been retouched out simply yields
       no ink. */
    var PRINT_R = 16;             /* half the kernel — wider than any stroke */
    var PRINT_LO = 20;            /* below this the leather's own grain */
    var PRINT_HI = 42;            /* above it, ink */
    var PRINT_FLOOR = 0.95;       /* the printing reflects ~5% of its leather */
    var STAIN_R = 6, STAIN_MAX = 8;  /* how close to thread or grass is too close */

    /* Grayscale dilation (grow) or erosion of a bw x bh patch, separable: once
       along the rows, once down the columns. That is what makes a 33px kernel
       a handful of passes over a small box instead of a search per pixel. */
    function morph(src, bw, bh, r, grow) {
      var tmp = new Float32Array(bw * bh), out = new Float32Array(bw * bh);
      var x, y, j, lo, hi, v, s, row;
      for (y = 0; y < bh; y++) {
        row = y * bw;
        for (x = 0; x < bw; x++) {
          lo = x > r ? x - r : 0;
          hi = x + r < bw ? x + r : bw - 1;
          v = src[row + lo];
          for (j = lo + 1; j <= hi; j++) {
            s = src[row + j];
            if (grow ? s > v : s < v) { v = s; }
          }
          tmp[row + x] = v;
        }
      }
      for (x = 0; x < bw; x++) {
        for (y = 0; y < bh; y++) {
          lo = y > r ? y - r : 0;
          hi = y + r < bh ? y + r : bh - 1;
          v = tmp[lo * bw + x];
          for (j = lo + 1; j <= hi; j++) {
            s = tmp[j * bw + x];
            if (grow ? s > v : s < v) { v = s; }
          }
          out[y * bw + x] = v;
        }
      }
      return out;
    }

    /* Build a photo's two printing layers. Runs once, when the photo lands. */
    function buildPrintLayers(entry) {
      var work = makeLayer(), wc = work.getContext('2d');
      var bare = makeLayer(), bc = bare.getContext('2d');
      var mark = makeLayer(), mc = mark.getContext('2d');
      if (!wc || !bc || !mc) { return; }
      wc.drawImage(entry.img, 0, 0, W, H);

      /* The photo's own ball — not necessarily the one on the stage, if it
         landed after a switch. (0.97R)^2 keeps inside the limb, off the edge. */
      var ball = MODELS[entry.model], boxes = ball.print;
      var limb2 = ball.r * ball.r * 0.9409;
      for (var b = 0; b < boxes.length; b++) {
        var box = boxes[b];
        var x0 = box[0], y0 = box[2], bw = box[1] - box[0], bh = box[3] - box[2];
        var patch;
        try {
          patch = wc.getImageData(x0, y0, bw, bh);
        } catch (err) {
          return; /* same-origin, so this shouldn't happen — but don't die on it */
        }
        var px = patch.data, n = bw * bh, i, o;
        var lum = new Float32Array(n), stain = new Float32Array(n);
        for (i = 0, o = 0; i < n; i++, o += 4) {
          lum[i] = 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2];
          /* How far from white leather this pixel's colour is, on the two
             sides that matter: green for the grass, red for the seam thread.
             Print is neutral, so it scores about nothing either way. */
          var other = px[o] > px[o + 2] ? px[o] : px[o + 2];
          var greenish = px[o + 1] - other, reddish = px[o] - px[o + 1] - 20;
          stain[i] = greenish > reddish ? greenish : reddish;
        }
        var paper = morph(morph(lum, bw, bh, PRINT_R, true), bw, bh, PRINT_R, false);
        /* Judged over a neighbourhood rather than pixel by pixel: the shadow
           between two stitches is as neutral as ink, and a dark pixel's own
           colour is too far gone in the JPEG to be worth asking. Growing the
           stain instead keeps the thread, the grass and the shadows they cast
           out of it, and leaves glyph interiors alone. */
        var near = morph(stain, bw, bh, STAIN_R, true);

        /* Coverage is how much of the leather's own light the ink is holding
           back, faded in over the grain so only glyphs are picked up. The
           leather's colour is carried as a ratio against its luminance: it is
           one hide, so the tint the clean pixels agree on is the tint under
           the printing too. */
        var cover = new Float32Array(n);
        var sumR = 0, sumG = 0, sumB = 0, sumL = 0;
        for (i = 0, o = 0; i < n; i++, o += 4) {
          var lit = paper[i];
          var dx = x0 + (i % bw) + 0.5 - ball.cx, dy = y0 + ((i / bw) | 0) + 0.5 - ball.cy;
          /* Lit leather, well inside the limb, clear of thread and grass. */
          var onLeather = lit >= 60 && near[i] <= STAIN_MAX && dx * dx + dy * dy < limb2;
          var t = 0;
          if (onLeather) {
            var d = lit - lum[i];
            t = (d - PRINT_LO) / (PRINT_HI - PRINT_LO);
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            var solid = d / (lit * PRINT_FLOOR);
            t *= solid > 1 ? 1 : solid;
          }
          cover[i] = t;
          if (onLeather && t < 0.02) {
            sumR += px[o]; sumG += px[o + 1]; sumB += px[o + 2]; sumL += lum[i];
          }
        }
        if (!sumL) { continue; }
        var kr = sumR / sumL, kg = sumG / sumL, kb = sumB / sumL;

        var bareImg = bc.createImageData(bw, bh), bd = bareImg.data;
        var markImg = mc.createImageData(bw, bh), md = markImg.data;
        for (i = 0, o = 0; i < n; i++, o += 4) {
          var a = cover[i];
          if (a <= 0) { continue; }
          bd[o] = paper[i] * kr;
          bd[o + 1] = paper[i] * kg;
          bd[o + 2] = paper[i] * kb;
          bd[o + 3] = a * 255;
          md[o] = 255; md[o + 1] = 255; md[o + 2] = 255;
          md[o + 3] = a * 255;
        }
        bc.putImageData(bareImg, x0, y0);
        mc.putImageData(markImg, x0, y0);
      }

      entry.bare = bare;
      entry.mark = mark;
      paintPrint(entry);
    }

    /* Colour a photo's printing. `source-in` keeps the shape's coverage and
       swaps only what fills it, so changing swatch is a repaint of two dozen
       glyphs rather than a rebuild of the mask behind them. */
    function paintPrint(entry) {
      var rgb = inkFor(ink);
      if (!entry || !entry.mark || !rgb) { return; }
      var c = entry.mark.getContext('2d');
      if (!c) { return; }
      c.save();
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    /* Only the photo for the ball and spot in use is fetched; the others
       arrive the first time somebody picks them. A ball's two photos share
       their grass, so its leather mask is built once from whichever lands. */
    function photoFor(spot) { return photos[model + ':' + spot]; }

    function loadPhoto(spot) {
      var key = model, id = key + ':' + spot;
      var entry = photos[id];
      if (entry) { return entry; }
      var img = new Image();
      entry = photos[id] = { img: img, ready: false, model: key };
      img.onload = function () {
        entry.ready = true;
        if (!MODELS[key].leather) { buildLeatherMask(img, key); }
        buildPrintLayers(entry);
        /* A full redraw, not just a composite: the mark's layer is masked by
           this ball's grass, which may only just have arrived. */
        queueDraw();
      };
      img.onerror = function () {
        fail('The ball photo didn\u2019t load. Reload the page and try again.');
      };
      img.src = MODELS[key].spots[spot].src;
      return entry;
    }
    loadPhoto('panel');

    /* Flat decal units back to canvas pixels — the inverse of kAt(). */
    function flatToScreen(fx, fy) {
      var r = Math.sqrt(fx * fx + fy * fy);
      if (r < 1e-6) { return [CX, CY]; }
      var scale = Math.sin(r > Math.PI / 2 ? Math.PI / 2 : r) / r;
      return [CX + fx * scale * R, CY + fy * scale * R];
    }

    var logoLayer = makeLayer();
    var logoCtx = logoLayer.getContext('2d');
    var logoImage = logoCtx ? logoCtx.createImageData(W, H) : null;

    var scratch = document.createElement('canvas');
    var scratchCtx = scratch.getContext('2d');

    /* ---- Preparing the uploaded artwork -------------------------------- */
    /* "Remove background" takes away whatever reaches the edge of the artwork
       through gentle colour changes: a flood fill from the edge that may step
       to a neighbour whose colour is within STEP of its own. Colour is
       smoothed first, so JPEG grain and the weave of a shirt in a phone photo
       don't stop it. Steps that small follow a gradient card, or light falling
       off across a photo, but never the edge of the mark. Keying out the one
       colour sampled at the corners missed both, and took the mark itself
       whenever the artwork ran out to the corners.

       The fill starts only from edge pixels near the edge's commonest colour,
       so a mark cropped tight against the edge isn't taken for backdrop where
       it touches. And being a fill, it leaves whatever the mark encloses (the
       white inside a letter, the badge a mark is reversed out of) in place.
       The few pixels just inside the boundary are judged on their own raw
       colour against the backdrop beside them, which clears the ring the
       smoothing leaves and keeps the mark's edge anti-aliased.

       Worked out once per file. Returns the alpha (0-255) the backdrop leaves
       each pixel, whether there is anything worth removing (a white or clear
       background never prints, so taking it away changes nothing), and
       whether to take it away up front: yes for a light card or the surface a
       logo was photographed on, no for a dark one — that is usually the badge
       the mark is reversed out of, and lifting it would leave nothing to
       print. */
    var STEP = 14, DRIFT = 56, SPAN = 12, SEED = 48, NEAR = 30, FAR = 70, FEATHER = 3;

    function inkOf(r, g, b) { return 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

    /* A 5x5 box blur of the colour, run over a ring of five rows. Weighted
       by alpha, so the clear part of a PNG doesn't bleed its hidden colour
       into the edge of the mark. */
    function smoothColour(d, w, h) {
      var R = 2, S = 2 * R + 1, out = new Uint8ClampedArray(w * h * 3);
      var ring = new Float32Array(S * w * 4);
      function rowSums(y) {
        var yy = y < 0 ? 0 : (y >= h ? h - 1 : y);
        var base = (((y % S) + S) % S) * w * 4;
        for (var x = 0; x < w; x++) {
          var r = 0, g = 0, b = 0, s = 0;
          for (var k = x - R; k <= x + R; k++) {
            var o = (yy * w + (k < 0 ? 0 : (k >= w ? w - 1 : k))) * 4, a = d[o + 3];
            r += d[o] * a; g += d[o + 1] * a; b += d[o + 2] * a; s += a;
          }
          var j = base + x * 4;
          ring[j] = r; ring[j + 1] = g; ring[j + 2] = b; ring[j + 3] = s;
        }
      }
      for (var y = -R; y < R; y++) { rowSums(y); }
      for (y = 0; y < h; y++) {
        rowSums(y + R);
        for (var x = 0; x < w; x++) {
          var r = 0, g = 0, b = 0, s = 0;
          for (var k = 0; k < S; k++) {
            var j = (k * w + x) * 4;
            r += ring[j]; g += ring[j + 1]; b += ring[j + 2]; s += ring[j + 3];
          }
          var o = (y * w + x) * 3;
          if (s) { out[o] = r / s; out[o + 1] = g / s; out[o + 2] = b / s; }
          else { out[o] = out[o + 1] = out[o + 2] = 255; }
        }
      }
      return out;
    }

    function findBackdrop(img) {
      var w = img.width, h = img.height, d = img.data, n = w * h;
      var sm = smoothColour(d, w, h);
      var bg = new Uint8Array(n), queue = new Int32Array(n), head = 0, tail = 0;
      var depth = new Int32Array(n), anchor = new Int32Array(n);
      var keep = new Uint8ClampedArray(n);
      var p, q, i, k, x;
      keep.fill(255);

      function solid(p) { return d[p * 4 + 3] >= 16; }

      /* The edge, and its commonest colour on a coarse 8x8x8 grid — clear
         counts as a colour of its own. */
      var edge = [];
      for (x = 0; x < w; x++) { edge.push(x); if (h > 1) { edge.push((h - 1) * w + x); } }
      for (k = 1; k < h - 1; k++) { edge.push(k * w); if (w > 1) { edge.push(k * w + w - 1); } }
      var CLEAR = 512, counts = new Int32Array(513), keys = new Int32Array(edge.length);
      for (i = 0; i < edge.length; i++) {
        p = edge[i] * 3;
        keys[i] = solid(edge[i])
          ? ((sm[p] >> 5) << 6) | ((sm[p + 1] >> 5) << 3) | (sm[p + 2] >> 5)
          : CLEAR;
        counts[keys[i]]++;
      }
      var top = 0;
      for (k = 1; k < 513; k++) { if (counts[k] > counts[top]) { top = k; } }
      var cr = 0, cg = 0, cb = 0;
      if (top !== CLEAR) {
        for (i = 0; i < edge.length; i++) {
          if (keys[i] !== top) { continue; }
          p = edge[i] * 3;
          cr += sm[p]; cg += sm[p + 1]; cb += sm[p + 2];
        }
        cr /= counts[top]; cg /= counts[top]; cb /= counts[top];
      }
      for (i = 0; i < edge.length; i++) {
        p = edge[i];
        if (bg[p]) { continue; }
        var take;
        if (top === CLEAR) {
          take = !solid(p);
        } else {
          var er = sm[p * 3] - cr, eg = sm[p * 3 + 1] - cg, eb = sm[p * 3 + 2] - cb;
          take = solid(p) && er * er + eg * eg + eb * eb <= SEED * SEED;
        }
        if (take) { bg[p] = 1; queue[tail++] = p; }
      }

      /* The fill. Clear pixels always join; a solid one joins from a solid
         neighbour of nearly the same colour, never from a clear one — that
         step is the mark's own edge. Small steps alone aren't enough: an
         anti-aliased edge that fades over a few pixels is a run of small
         steps, and the fill used to creep across it into the mark. So each
         pixel is also held to an anchor up to SPAN steps back along its path
         and may drift no more than DRIFT from it. A gradient or the light
         across a photo changes a little over that distance; the edge of a
         mark changes a lot. */
      for (i = 0; i < tail; i++) { anchor[queue[i]] = queue[i]; }
      function reach(p, q) {
        if (bg[q]) { return; }
        var an = anchor[p];
        if (solid(q)) {
          if (!solid(p)) { return; }
          var a = p * 3, b = q * 3, c = an * 3;
          var dr = sm[a] - sm[b], dg = sm[a + 1] - sm[b + 1], db = sm[a + 2] - sm[b + 2];
          if (dr * dr + dg * dg + db * db > STEP * STEP) { return; }
          dr = sm[c] - sm[b]; dg = sm[c + 1] - sm[b + 1]; db = sm[c + 2] - sm[b + 2];
          if (dr * dr + dg * dg + db * db > DRIFT * DRIFT) { return; }
        }
        bg[q] = 1; queue[tail++] = q;
        depth[q] = depth[p] + 1;
        anchor[q] = depth[q] - depth[an] >= SPAN ? p : an;
      }
      while (head < tail) {
        p = queue[head++]; x = p % w;
        if (x > 0) { reach(p, p - 1); }
        if (x < w - 1) { reach(p, p + 1); }
        if (p >= w) { reach(p, p - w); }
        if (p < n - w) { reach(p, p + w); }
      }

      /* The ring just inside, judged on raw colour against the backdrop
         colour next to it, carried in a pixel at a time. */
      var refc = new Uint8ClampedArray(n * 3), judged = new Uint8Array(n), front = [];
      for (p = 0; p < n; p++) {
        if (bg[p]) { keep[p] = 0; judged[p] = 1; }
      }
      for (p = 0; p < n; p++) {
        if (bg[p]) { continue; }
        x = p % w;
        q = (x > 0 && bg[p - 1] && solid(p - 1)) ? p - 1
          : (x < w - 1 && bg[p + 1] && solid(p + 1)) ? p + 1
          : (p >= w && bg[p - w] && solid(p - w)) ? p - w
          : (p < n - w && bg[p + w] && solid(p + w)) ? p + w : -1;
        if (q >= 0) { front.push(p, q); }
      }
      for (k = 0; k < FEATHER && front.length; k++) {
        var next = [];
        for (i = 0; i < front.length; i += 2) {
          p = front[i]; q = front[i + 1];
          if (judged[p]) { continue; }
          judged[p] = 1;
          var src = bg[q] ? sm : refc, a3 = p * 3, q3 = q * 3, o = p * 4;
          refc[a3] = src[q3]; refc[a3 + 1] = src[q3 + 1]; refc[a3 + 2] = src[q3 + 2];
          var fr = d[o] - refc[a3], fg = d[o + 1] - refc[a3 + 1], fb = d[o + 2] - refc[a3 + 2];
          var dist = Math.sqrt(fr * fr + fg * fg + fb * fb);
          var t = dist <= NEAR ? 0 : (dist >= FAR ? 1 : (dist - NEAR) / (FAR - NEAR));
          keep[p] = t * 255;
          if (t < 0.5 && solid(p)) {
            x = p % w;
            if (x > 0 && !judged[p - 1]) { next.push(p - 1, p); }
            if (x < w - 1 && !judged[p + 1]) { next.push(p + 1, p); }
            if (p >= w && !judged[p - w]) { next.push(p - w, p); }
            if (p < n - w && !judged[p + w]) { next.push(p + w, p); }
          }
        }
        front = next;
      }

      /* Holes: the backdrop seen through the mark — inside an O, or a ring
         — is the backdrop's colour but walled off from the edge, so the fill
         never gets there, and on a grey card it would print as a tinted blob
         in every counter. A patch near the backdrop's colour that doesn't
         touch the backdrop and is lighter than whatever walls it in is a
         hole, and goes too. Lighter, because a dark mark inside a dark frame
         matches the frame just as well, and that one has to stay. */
      if (top !== CLEAR) {
        var seen = new Uint8Array(n);
        var nearBack = function (p) {
          var er = sm[p * 3] - cr, eg = sm[p * 3 + 1] - cg, eb = sm[p * 3 + 2] - cb;
          return solid(p) && er * er + eg * eg + eb * eb <= SEED * SEED;
        };
        var lumAt = function (p) { return 255 * (1 - inkOf(sm[p * 3], sm[p * 3 + 1], sm[p * 3 + 2])); };
        for (var s0 = 0; s0 < n; s0++) {
          if (bg[s0] || seen[s0] || !nearBack(s0)) { continue; }
          var qh = 0, qt = 0, inLum = 0, wallLum = 0, walls = 0, open = false;
          seen[s0] = 1; queue[qt++] = s0;
          while (qh < qt) {
            p = queue[qh++]; inLum += lumAt(p); x = p % w;
            var nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
            for (k = 0; k < 4; k++) {
              q = nb[k];
              if (q < 0) { continue; }
              if (bg[q]) { open = true; continue; }
              if (seen[q]) { continue; }
              if (nearBack(q)) { seen[q] = 1; queue[qt++] = q; }
              else if (solid(q)) { wallLum += lumAt(q); walls++; }
            }
          }
          if (!open && walls && inLum / qt > wallLum / walls + 20) {
            for (i = 0; i < qt; i++) { keep[queue[i]] = 0; }
          }
        }
      }

      /* What it took, and what that leaves to print. */
      var gone = 0, goneInk = 0, goneLight = 0, removed = 0, printsLeft = 0;
      for (p = 0, o = 0; p < n; p++, o += 4) {
        var al = d[o + 3] / 255;
        if (!al) { continue; }
        var ti = inkOf(d[o], d[o + 1], d[o + 2]), kf = keep[p] / 255, g = al * (1 - kf);
        if (kf < 0.5) { removed++; }
        gone += g; goneInk += ti * g; goneLight += (1 - ti) * g;
        if (ti * al * kf >= 0.5) { printsLeft++; }
      }
      /* 0.02 is about RGB 250: brighter than that never shows on the leather,
         but the fake transparency checkerboard some downloaded logos carry
         (white and RGB 240 squares) does, faintly. */
      var removable = removed >= n * 0.005 && gone > 0 && goneInk / gone >= 0.02;
      return {
        keep: keep,
        removable: removable,
        suggest: removable && goneLight / gone >= 0.45 && printsLeft >= n * 0.005
      };
    }

    /* Recolour to a one-colour stamp. Ink coverage follows the artwork's
       luminance rather than its silhouette: filling the alpha shape would
       flatten a crest into a solid blob, whereas a real single-colour press
       keeps the interior detail and leaves the light areas as bare leather
       (white here, which multiply passes straight through). */
    function inkify(img, rgb) {
      var d = img.data, ir = rgb[0], ig = rgb[1], ib = rgb[2];
      /* The share of the artwork that prints at half strength or more, so a mark
         that would come out as almost nothing — white artwork lifted off a
         dark card — can be called out rather than quietly vanishing into the
         leather. A share of the whole raster, not an average over what's
         standing, so the white inside a frame doesn't water a real mark down. */
      var printed = 0;
      for (var i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) { continue; }
        var t = inkOf(d[i], d[i + 1], d[i + 2]);
        if (t * d[i + 3] / 255 >= 0.5) { printed++; }
        d[i] = 255 + (ir - 255) * t;
        d[i + 1] = 255 + (ig - 255) * t;
        d[i + 2] = 255 + (ib - 255) * t;
      }
      inkCoverage = printed / (d.length / 4);
    }

    function prepareLogo() {
      if (!logoImg || !scratchCtx) { logoData = null; return; }
      /* Cap the working raster so a 6000px export still drags at 60fps. */
      var s = Math.min(1, 900 / Math.max(logoSrcW, logoSrcH));
      logoW = Math.max(1, Math.round(logoSrcW * s));
      logoH = Math.max(1, Math.round(logoSrcH * s));
      scratch.width = logoW; scratch.height = logoH;
      scratchCtx.clearRect(0, 0, logoW, logoH);
      scratchCtx.drawImage(logoImg, 0, 0, logoW, logoH);

      var img;
      try {
        img = scratchCtx.getImageData(0, 0, logoW, logoH);
      } catch (err) {
        /* A few browsers still treat an SVG as tainting the canvas, which
           makes the pixels unreadable — say so instead of dying silently. */
        logoData = null;
        fail('Your browser won’t let this file be read pixel by pixel. Try a PNG or JPG.');
        return;
      }
      /* Found on the artwork as it arrived, before anything is lifted. */
      if (!backdrop) { backdrop = findBackdrop(img); }
      if (knockout && backdrop.removable) {
        var keep = backdrop.keep, px = img.data;
        for (var p = 0, o = 3; p < keep.length; p++, o += 4) {
          if (keep[p] < 255) { px[o] = px[o] * keep[p] / 255; }
        }
      }
      inkCoverage = 1;
      var rgb = inkFor(ink);
      if (rgb) { inkify(img, rgb); }
      logoData = img;
    }

    /* Drop the mark back into the middle of the spot it's printed on. */
    function centreLogo() {
      posX = PLACEMENTS[placement].x;
      posY = PLACEMENTS[placement].y;
    }

    /* Centre the mark on the chosen spot and size it to that spot's box. */
    function fitToPlacement() {
      var spot = PLACEMENTS[placement];
      centreLogo();
      if (logoSrcW && logoSrcH) {
        widthU = clamp(Math.min(spot.fitW, spot.fitH * (logoSrcW / logoSrcH)), 0.15, 1.3);
        if (sizeInput) { sizeInput.value = String(Math.round(widthU * 100)); }
      }
    }

    function setPlacement(next) {
      if (!PLACEMENTS[next] || next === placement) { return; }
      placement = next;
      loadPhoto(next);
      for (var i = 0; i < spotEls.length; i++) {
        var on = spotEls[i].getAttribute('data-spot') === next;
        spotEls[i].classList.toggle('is-active', on);
        spotEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      fitToPlacement();
      queueDraw();
    }

    /* Swap the ball. Positions and sizes are in decal units, fractions of
       the ball's radius, and both balls are regulation size, so the mark
       keeps its size and its offset from the middle of its spot: it lands on
       the new ball where it sat on the old one, nudges and all. */
    function setModel(next) {
      if (!MODELS[next] || next === model) { return; }
      var from = PLACEMENTS[placement];
      model = next;
      useModel(next);
      var to = PLACEMENTS[placement];
      posX = clamp(to.x + (posX - from.x), -1.2, 1.2);
      posY = clamp(to.y + (posY - from.y), -1.2, 1.2);
      loadPhoto(placement);
      for (var i = 0; i < modelEls.length; i++) {
        var on = modelEls[i].getAttribute('data-model') === next;
        modelEls[i].classList.toggle('is-active', on);
        modelEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      stage.setAttribute('aria-label', 'Preview of your logo on a Hydra ' + MODELS[next].name + ' baseball');
      queueDraw();
    }

    /* ---- Wrapping the artwork onto the sphere -------------------------- */
    function renderLogoLayer() {
      if (!logoCtx || !logoImage) { return; }
      var leather = MODELS[model].leather;   /* this ball's grass, once it has landed */
      var dst = logoImage.data;
      dst.fill(0);
      if (!logoData) { logoCtx.putImageData(logoImage, 0, 0); return; }

      var src = logoData.data;
      var heightU = widthU * (logoH / logoW);
      var invW = 1 / widthU, invH = 1 / heightU;
      var lastX = logoW - 1, lastY = logoH - 1;
      var x0 = Math.max(0, Math.floor(CX - R)), x1 = Math.min(W, Math.ceil(CX + R));
      var y0 = Math.max(0, Math.floor(CY - R)), y1 = Math.min(H, Math.ceil(CY + R));

      for (var y = y0; y < y1; y++) {
        var dv = (y + 0.5 - CY) / R, dv2 = dv * dv;
        for (var x = x0; x < x1; x++) {
          var du = (x + 0.5 - CX) / R;
          var r2 = du * du + dv2;
          if (r2 >= 0.9985) { continue; }
          var k = kAt(Math.sqrt(r2));
          var ux = (du * k - posX) * invW + 0.5;
          if (ux < 0 || ux >= 1) { continue; }
          var uy = (dv * k - posY) * invH + 0.5;
          if (uy < 0 || uy >= 1) { continue; }

          /* Bilinear sample, premultiplied so antialiased edges don't fringe. */
          var tx = ux * lastX, ty = uy * lastY;
          var ix = tx | 0, iy = ty | 0;
          var fx = tx - ix, fy = ty - iy;
          var ix1 = ix < lastX ? ix + 1 : ix, iy1 = iy < lastY ? iy + 1 : iy;
          var o00 = (iy * logoW + ix) << 2, o10 = (iy * logoW + ix1) << 2;
          var o01 = (iy1 * logoW + ix) << 2, o11 = (iy1 * logoW + ix1) << 2;
          var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
          var w01 = (1 - fx) * fy, w11 = fx * fy;
          var a00 = w00 * src[o00 + 3], a10 = w10 * src[o10 + 3];
          var a01 = w01 * src[o01 + 3], a11 = w11 * src[o11 + 3];
          var pa = a00 + a10 + a01 + a11;
          if (pa < 1) { continue; }
          var idx = y * W + x, o = idx << 2;
          dst[o] = (a00 * src[o00] + a10 * src[o10] + a01 * src[o01] + a11 * src[o11]) / pa;
          dst[o + 1] = (a00 * src[o00 + 1] + a10 * src[o10 + 1] + a01 * src[o01 + 1] + a11 * src[o11 + 1]) / pa;
          dst[o + 2] = (a00 * src[o00 + 2] + a10 * src[o10 + 2] + a01 * src[o01 + 2] + a11 * src[o11 + 2]) / pa;
          /* Ink stops where the grass crosses in front of the ball. */
          dst[o + 3] = leather ? pa * leather[idx] / 255 : pa;
        }
      }
      logoCtx.putImageData(logoImage, 0, 0);
    }

    /* Before anything is uploaded, show where a mark would land. The spot's
       fit box is mapped through the projection, so the guide sits on the
       leather the same way the artwork will — flatter up on the horseshoe. */
    function drawPanelGuide(withCaption) {
      var spot = PLACEMENTS[placement];
      var left = flatToScreen(spot.x - spot.fitW / 2, spot.y);
      var right = flatToScreen(spot.x + spot.fitW / 2, spot.y);
      var top = flatToScreen(spot.x, spot.y - spot.fitH / 2);
      var bottom = flatToScreen(spot.x, spot.y + spot.fitH / 2);
      var gx = (left[0] + right[0]) / 2, gy = (top[1] + bottom[1]) / 2;
      var rx = Math.abs(right[0] - left[0]) / 2, ry = Math.abs(bottom[1] - top[1]) / 2;
      ctx.save();
      ctx.setLineDash([11, 9]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(11, 11, 13, 0.26)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx, ry, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (withCaption) {
        ctx.fillStyle = 'rgba(11, 11, 13, 0.32)';
        ctx.font = '600 ' + Math.max(15, Math.round(ry * 0.42)) + 'px "Saira Condensed", "Arial Narrow", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOUR LOGO HERE', gx, gy);
      }
      ctx.restore();
    }

    function compose() {
      /* While a newly-picked photo loads, the ball's panel photo stands in.
         A newly-picked ball has neither yet, so the last frame stays up
         rather than flashing an empty stage; its photo redraws on landing. */
      var entry = photoFor(placement);
      if (!entry || !entry.ready) { entry = photoFor('panel'); }
      var ready = Boolean(entry && entry.ready);
      if (!ready && stage.getAttribute('data-drawn')) { return; }
      ctx.clearRect(0, 0, W, H);
      if (ready) { stage.setAttribute('data-drawn', '1'); }
      if (ready) { ctx.drawImage(entry.img, 0, 0, W, H); }
      /* The ball's own printing, lifted off its leather and stamped back down
         in the chosen ink — the same multiply the uploaded mark gets, so both
         sit in the leather the same way. */
      if (ready && entry.bare && inkFor(ink)) {
        ctx.save();
        ctx.drawImage(entry.bare, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(entry.mark, 0, 0);
        ctx.restore();
      }
      if (logoData && ready) {
        ctx.save();
        ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.clip();
        /* Multiply so the leather's grain, shading and highlight come through
           the ink — printed on, not pasted on. */
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.94;
        ctx.drawImage(logoLayer, 0, 0);
        ctx.restore();
      }
      /* Over the mark, so the outline stays readable while it's being placed. */
      if (ready && (!logoData || guideOn)) { drawPanelGuide(!logoData); }
    }

    var frame = 0;
    function queueDraw() {
      if (!window.requestAnimationFrame) { renderLogoLayer(); compose(); return; }
      if (frame) { return; }
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        renderLogoLayer();
        compose();
      });
    }

    compose();

    /* ---- Status ------------------------------------------------------- */
    /* What a press of "Remove background" did. */
    function knockNote() {
      if (!knockout) { return 'Background left in place — it prints as part of the logo.'; }
      if (inkCoverage < 0.005) {
        return 'Background removed, but what’s left is too light to print: one ink can’t print white onto the leather. Send a dark-on-light version, or untick Remove background.';
      }
      return 'Background removed.';
    }

    /* What was decided about the background when the file came in. */
    function loadNote() {
      if (!backdrop || !backdrop.removable) {
        return 'Nothing to remove — its background is white or clear, and that doesn’t print.';
      }
      return knockout
        ? 'Background removed, so only the logo prints.'
        : 'Its background will print too — tick Remove background to drop it.';
    }

    /* The tick box only offers what it can do: greyed out, with the reason,
       when the background is white or clear — the leather looks the same
       with or without it, which used to read as the box being broken. */
    function syncKnockBox() {
      if (!knockBox) { return; }
      var can = Boolean(backdrop && backdrop.removable);
      knockBox.checked = knockout;
      knockBox.disabled = !can;
      var label = knockBox.parentNode;
      if (label && label.classList) {
        label.classList.toggle('is-disabled', !can);
        label.title = can ? '' : 'Nothing to remove: a white or clear background doesn’t print.';
      }
    }

    function say(msg) {
      if (!statusEl) { return; }
      statusEl.textContent = msg;
      statusEl.classList.remove('is-error');
    }
    function fail(msg) {
      if (!statusEl) { return; }
      statusEl.textContent = msg;
      statusEl.classList.add('is-error');
    }

    /* ---- Loading a file ------------------------------------------------ */
    function setInk(next) {
      if (!Object.prototype.hasOwnProperty.call(INK, next)) { next = DEFAULT_INK; }
      ink = next;
      for (var i = 0; i < swatchEls.length; i++) {
        var on = swatchEls[i].getAttribute('data-ink') === next;
        swatchEls[i].classList.toggle('is-active', on);
        swatchEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      /* Restamp the photos already decoded; one that lands later is coloured
         as its layers are built. */
      for (var key in photos) {
        if (Object.prototype.hasOwnProperty.call(photos, key)) { paintPrint(photos[key]); }
      }
      if (readout && INK_LABEL[next]) {
        readout.textContent = INK_LABEL[next] + ' — one ink, every mark on the ball.';
      }
    }

    function loadFile(file) {
      if (!file) { return; }
      if (file.type && file.type.indexOf('image/') !== 0) {
        fail('That file isn’t an image — try a PNG, JPG, SVG or WebP.');
        return;
      }
      if (file.size > MAX_BYTES) {
        fail('That file is over 12 MB. Export it a little smaller and try again.');
        return;
      }

      var revoke = null;
      var src;
      if (window.URL && window.URL.createObjectURL) {
        src = window.URL.createObjectURL(file);
        revoke = function () { window.URL.revokeObjectURL(src); };
        start(src, revoke);
      } else {
        var reader = new FileReader();
        reader.onload = function () { start(String(reader.result), null); };
        reader.onerror = function () { fail('That file couldn’t be read.'); };
        reader.readAsDataURL(file);
      }

      function start(url, done) {
        var img = new Image();
        img.onload = function () {
          if (done) { done(); }
          /* SVGs without intrinsic dimensions report 0 — fall back to a square. */
          logoSrcW = img.naturalWidth || 512;
          logoSrcH = img.naturalHeight || 512;
          logoImg = img;
          logoName = file.name || 'logo';
          logoFile = file;

          /* The background is measured afresh for every file, below. */
          backdrop = null;
          knockout = false;

          /* Drop the mark straight onto the chosen spot, scaled to fill it,
             so a wide wordmark and a tall crest both land somewhere sensible
             before the size slider is ever touched. */
          fitToPlacement();
          /* The ink is the team's, not the file's — swapping artwork keeps the
             colour that was picked for the run. */

          prepareLogo();
          /* prepareLogo has already explained why if it bailed — don't follow
             it with a "loaded" message and a panel of dead controls. */
          if (!logoData) { logoImg = null; logoFile = null; backdrop = null; return; }
          /* A light card, or the surface a logo was photographed on, comes
             off straight away; see findBackdrop for why a dark one doesn't. */
          if (backdrop && backdrop.suggest) { knockout = true; prepareLogo(); }
          syncKnockBox();
          queueDraw();

          if (controls) { controls.hidden = false; }
          stage.classList.add('is-draggable');
          stage.setAttribute('tabindex', '0');
          if (hint) { hint.textContent = 'Drag the logo to place it. Focus the ball and nudge with the arrow keys.'; }
          say(logoName + ' loaded. ' + loadNote());
        };
        img.onerror = function () {
          if (done) { done(); }
          fail('That image couldn’t be read. Try re-saving it as a PNG.');
        };
        img.src = url;
      }
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length) { loadFile(fileInput.files[0]); }
      });
    }

    /* Drag and drop onto the panel, scoped to the dropzone so the rest of the
       page keeps its normal behaviour. */
    if (dropEl) {
      ['dragenter', 'dragover'].forEach(function (type) {
        dropEl.addEventListener(type, function (e) {
          e.preventDefault();
          dropEl.classList.add('is-over');
        });
      });
      ['dragleave', 'dragend'].forEach(function (type) {
        dropEl.addEventListener(type, function () { dropEl.classList.remove('is-over'); });
      });
      dropEl.addEventListener('drop', function (e) {
        e.preventDefault();
        dropEl.classList.remove('is-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          loadFile(e.dataTransfer.files[0]);
        }
      });
    }

    /* ---- Controls ------------------------------------------------------ */
    if (sizeInput) {
      sizeInput.addEventListener('input', function () {
        var v = parseFloat(sizeInput.value);
        if (isNaN(v)) { return; }
        widthU = v / 100;
        flashGuide();
        queueDraw();
      });
    }

    var NUDGE_STEP = 0.03;
    var NUDGE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (var ki = 0; ki < nudgeEls.length; ki++) {
      nudgeEls[ki].addEventListener('click', function () {
        var dir = this.getAttribute('data-nudge');
        if (dir === 'center') {
          centreLogo();
        } else if (NUDGE[dir]) {
          posX = clamp(posX + NUDGE[dir][0] * NUDGE_STEP, -1.2, 1.2);
          posY = clamp(posY + NUDGE[dir][1] * NUDGE_STEP, -1.2, 1.2);
        } else {
          return;
        }
        flashGuide();
        queueDraw();
      });
    }

    /* The ball can be picked before there's a logo, to see it first. */
    for (var mi = 0; mi < modelEls.length; mi++) {
      modelEls[mi].addEventListener('click', function () {
        var next = this.getAttribute('data-model') || 'a1492';
        if (next === model) { return; }
        setModel(next);
        say(MODELS[next].name + ' selected' + (logoData ? ' — your logo moved across with it.' : '.'));
      });
    }

    for (var pi = 0; pi < spotEls.length; pi++) {
      spotEls[pi].addEventListener('click', function () {
        var next = this.getAttribute('data-spot') || 'panel';
        setPlacement(next);
        say(next === 'horseshoe'
          ? 'Printed on the horseshoe — the Hydra name moves down to the panel.'
          : 'Printed on the panel between the seams.');
      });
    }

    for (var si = 0; si < swatchEls.length; si++) {
      swatchEls[si].addEventListener('click', function () {
        setInk(this.getAttribute('data-ink') || DEFAULT_INK);
        prepareLogo();
        queueDraw();
      });
    }

    if (knockBox) {
      knockBox.addEventListener('change', function () {
        knockout = knockBox.checked;
        prepareLogo();
        queueDraw();
        say(knockNote());
      });
    }

    /* ---- Placing the logo ---------------------------------------------- */
    function screenToFlat(clientX, clientY) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) { return [posX, posY]; }
      var du = ((clientX - rect.left) * (W / rect.width) - CX) / R;
      var dv = ((clientY - rect.top) * (H / rect.height) - CY) / R;
      var r = Math.sqrt(du * du + dv * dv);
      if (r > 0.995) { var s = 0.995 / r; du *= s; dv *= s; r = 0.995; }
      var k = kAt(r);
      return [du * k, dv * k];
    }

    /* Pointer Events only — without them the sliders and arrow keys still
       place the logo, so the feature degrades rather than breaks. */
    if (window.PointerEvent) {
      var dragId = null, grabX = 0, grabY = 0;

      stage.addEventListener('pointerdown', function (e) {
        if (!logoData) { return; }
        var f = screenToFlat(e.clientX, e.clientY);
        grabX = posX - f[0];
        grabY = posY - f[1];
        dragId = e.pointerId;
        stage.classList.add('is-dragging');
        if (stage.setPointerCapture) {
          try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        }
        e.preventDefault();
      });

      stage.addEventListener('pointermove', function (e) {
        if (dragId === null || e.pointerId !== dragId) { return; }
        var f = screenToFlat(e.clientX, e.clientY);
        posX = clamp(f[0] + grabX, -1.2, 1.2);
        posY = clamp(f[1] + grabY, -1.2, 1.2);
        flashGuide();
        queueDraw();
      });

      var endDrag = function (e) {
        if (dragId === null || (e && e.pointerId !== dragId)) { return; }
        if (stage.releasePointerCapture) {
          try { stage.releasePointerCapture(dragId); } catch (err) {}
        }
        dragId = null;
        stage.classList.remove('is-dragging');
      };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);
    }

    stage.addEventListener('keydown', function (e) {
      if (!logoData) { return; }
      var step = e.shiftKey ? 0.005 : 0.025;
      if (e.key === 'ArrowLeft') { posX -= step; }
      else if (e.key === 'ArrowRight') { posX += step; }
      else if (e.key === 'ArrowUp') { posY -= step; }
      else if (e.key === 'ArrowDown') { posY += step; }
      else { return; }
      posX = clamp(posX, -1.2, 1.2);
      posY = clamp(posY, -1.2, 1.2);
      e.preventDefault();
      flashGuide();
      queueDraw();
    });

    /* ---- What goes with the order -------------------------------------- */
    /* FormSubmit takes 10 MB of files per inquiry; this leaves room for the
       rest of the form. A logo that won't fit beside the mockup goes as a
       smaller copy, and failing that is left for us to ask for. */
    var FILE_BUDGET = 9 * 1024 * 1024;

    function canvasBlob(canvas, type, quality) {
      return new Promise(function (resolve) {
        if (!canvas.toBlob) { resolve(null); return; }
        try {
          canvas.toBlob(function (blob) { resolve(blob || null); }, type, quality);
        } catch (err) {
          resolve(null); /* a canvas the browser treats as tainted */
        }
      });
    }

    /* The ball as it stands, minus the dashed outline shown while placing.
       toBlob copies the canvas the moment it is called, so the outline can
       come straight back. */
    function snapshotMockup() {
      var entry = photoFor(placement);
      if (!logoData || !entry || !entry.ready) { return Promise.resolve(null); }
      var wasGuide = guideOn;
      guideOn = false;
      renderLogoLayer();
      compose();
      var shot = canvasBlob(stage, 'image/jpeg', 0.9);
      guideOn = wasGuide;
      queueDraw();
      return shot;
    }

    /* The artwork redrawn with its longest side at 2000px. A JPEG stays a
       JPEG; anything else becomes a PNG so a clear background stays clear. */
    function smallerLogo(file) {
      if (!logoImg || !logoSrcW || !logoSrcH) { return Promise.resolve(null); }
      var s = Math.min(1, 2000 / Math.max(logoSrcW, logoSrcH));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(logoSrcW * s));
      c.height = Math.max(1, Math.round(logoSrcH * s));
      var cc = c.getContext('2d');
      if (!cc) { return Promise.resolve(null); }
      cc.drawImage(logoImg, 0, 0, c.width, c.height);
      return canvasBlob(c, /jpe?g/i.test(file.type || '') ? 'image/jpeg' : 'image/png', 0.92);
    }

    function megabytes(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

    /* Resolves to { files: [{ field, file }], note }. The note ends the
       email's "logo" line, saying what is attached. */
    function packArt() {
      var file = logoFile;
      var base = (logoName || 'logo').replace(/\.[^.]*$/, '') || 'logo';
      return snapshotMockup().then(function (mock) {
        var room = FILE_BUDGET - (mock ? mock.size : 0);
        var logo;
        if (!file) {
          logo = Promise.resolve(null);
        } else if (file.size <= room) {
          logo = Promise.resolve(file);
        } else {
          logo = smallerLogo(file).then(function (blob) {
            if (!blob || blob.size > room) { return null; }
            var ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
            return new File([blob], base + '-smaller.' + ext, { type: blob.type });
          });
        }
        return logo.then(function (sent) {
          var files = [], listed = [];
          if (sent) {
            files.push({ field: 'attachment', file: sent });
            listed.push(sent === file
              ? 'logo file'
              : 'smaller copy of the logo (original ' + megabytes(file.size) + ')');
          }
          if (mock) {
            files.push({
              field: 'mockup',
              file: new File([mock], base + '-mockup.jpg', { type: 'image/jpeg' })
            });
            listed.push('mockup');
          }
          var note = listed.length ? ' — attached: ' + listed.join(', ') : '';
          if (file && !sent) {
            note += (note ? '; ' : ' — ') + 'the logo file (' + megabytes(file.size) +
              ') was too big to attach, so ask for it';
          }
          return { files: files, note: note };
        });
      });
    }

    /* ---- Actions ------------------------------------------------------- */
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var url;
        try {
          url = stage.toDataURL('image/png');
        } catch (err) {
          /* Some browsers still taint a canvas that has drawn an SVG. */
          fail('Your browser blocked saving this mockup. Try a PNG or JPG logo instead.');
          return;
        }
        var a = document.createElement('a');
        a.href = url;
        a.download = 'hydra-custom-ball.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        say('Mockup saved — attach it to your inquiry and we’ll match the artwork.');
      });
    }

    if (attachBtn) {
      attachBtn.addEventListener('click', function () {
        var summary = 'Mocked up on site: ' + (logoName || 'team logo') +
          ' (' + MODELS[model].name + ', ' +
          (placement === 'horseshoe' ? 'horseshoe' : 'side panel') + ', ' +
          INK_LABEL[ink] + (knockout ? ', background removed' : '') + ')';
        var field = document.getElementById('ordersLogo');
        if (field) { field.value = summary; }
        /* Packed now, so the email shows exactly what was added — later
           tweaks need another press. */
        orderArt = window.Promise ? { summary: summary, packed: packArt() } : null;
        var msg = ordersForm ? ordersForm.querySelector('textarea[name="message"]') : null;
        if (msg && msg.value.indexOf('custom logo') === -1) {
          msg.value = (msg.value ? msg.value.replace(/\s+$/, '') + '\n\n' : '') +
            'We’d like a quote on custom logo baseballs — I mocked ours up on the site.';
        }
        say('Added to your team order below. Your logo file and this mockup will be attached when you send it.');
        var target = document.getElementById('team-orders');
        /* Plain scrollIntoView so the page's scroll-behavior (and its
           reduced-motion override) stays in charge. */
        if (target && target.scrollIntoView) { target.scrollIntoView(); }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        logoImg = null;
        logoData = null;
        logoName = '';
        logoFile = null;
        orderArt = null;
        setPlacement('panel');
        posX = PLACEMENTS.panel.x; posY = PLACEMENTS.panel.y; widthU = 0.55;
        knockout = false;
        backdrop = null;
        syncKnockBox();
        if (sizeInput) { sizeInput.value = '55'; }
        setInk(DEFAULT_INK);
        if (fileInput) { fileInput.value = ''; }
        if (controls) { controls.hidden = true; }
        var field = document.getElementById('ordersLogo');
        if (field) { field.value = ''; }
        stage.classList.remove('is-draggable', 'is-dragging');
        stage.removeAttribute('tabindex');
        if (hint) { hint.textContent = DEFAULT_HINT; }
        say('');
        queueDraw();
      });
    }
  }
})();
