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

  /* Team Orders form — submit to the form-to-email service so every inquiry
     lands in the inbox. If that request fails, fall back to a pre-filled
     email so a submission is never lost. */
  var ordersForm = document.getElementById('ordersForm');
  if (ordersForm) {
    var ORDERS_ENDPOINT = 'https://formsubmit.co/ajax/info@hydrabaseballco.com';
    var CONTACT_EMAIL = 'info@hydrabaseballco.com';

    var labels = {
      name: 'Name', email: 'Email', phone: 'Phone',
      team: 'Team / organization', state: 'State', zip: 'Zip code',
      level: 'Level of play', quantity: 'Approx. # of baseballs',
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

    ordersForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ordersForm.checkValidity()) { ordersForm.reportValidity(); return; }

      var data = new FormData(ordersForm);
      var btn = ordersForm.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      var reset = function () { if (btn) { btn.disabled = false; btn.textContent = label; } };

      if (!('fetch' in window)) { mailtoFallback(data); reset(); return; }

      fetch(ORDERS_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: data
      })
        .then(function (r) { return r.ok ? showThanks() : (mailtoFallback(data), reset()); })
        .catch(function () { mailtoFallback(data); reset(); });
    });
  }

  /* Custom ball preview — puts an uploaded team logo on the real A1492.
     The stage is the product photograph with the printed A1492 panel retouched
     out (public/images/ball-blank.jpg), so a mark lands on bare leather while
     the Hydra wordmark, the seams, the grain and the light stay exactly as they
     were shot. The artwork is read and composited entirely in the browser; the
     file is never sent anywhere. */
  var stage = document.getElementById('ballStage');
  if (stage && stage.getContext && stage.getContext('2d') && window.FileReader) {
    var ctx = stage.getContext('2d');

    /* ---- Geometry (internal pixels; CSS scales the canvas down) --------
       The canvas is the retouched photo (1100x1100) at 900px wide. Its ball
       comes from a least-squares fit of the limb — centre (545.5, 519.8),
       radius 394.5 — and the cleared panel is centred at (565, 588). Both are
       scaled by 900/1100 here. tools/make-ball-blank.py builds the photo. */
    var PHOTO_SRC = '/images/ball-blank.jpg';
    var W = 900, H = 900;
    var CX = 446.3, CY = 425.3, R = 322.8;
    /* The empty panel's centre in flat decal units — where a logo starts. */
    var PANEL_X = 0.05, PANEL_Y = 0.174;
    var TAU = Math.PI * 2;

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
    var swatchEls = document.querySelectorAll('.swatch');

    var INK = { full: null, black: [20, 20, 24], red: [200, 32, 47] };
    var INK_LABEL = { full: 'full colour', black: 'black stamp', red: 'red stamp' };
    var MAX_BYTES = 12 * 1024 * 1024;
    var DEFAULT_HINT = 'Upload a logo to get started.';

    /* Logo state. Positions and sizes are in "flat" units where 1 = the ball's
       radius at the centre of the sphere (see the projection note below). */
    var logoImg = null, logoSrcW = 0, logoSrcH = 0, logoName = '';
    var logoData = null, logoW = 0, logoH = 0;
    var posX = PANEL_X, posY = PANEL_Y, widthU = 0.55;
    var ink = 'full', knockout = false;

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

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
       white leather, black print and red seams all stay printable. */
    var photo = new Image();
    var photoReady = false;
    var leather = null;

    function buildLeatherMask() {
      var c = makeLayer();
      var cc = c.getContext('2d');
      if (!cc) { return; }
      cc.drawImage(photo, 0, 0, W, H);
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
      leather = m;
    }

    photo.onload = function () {
      photoReady = true;
      buildLeatherMask();
      compose();
    };
    photo.onerror = function () {
      fail('The ball photo didn\u2019t load. Reload the page and try again.');
    };
    photo.src = PHOTO_SRC;

    var logoLayer = makeLayer();
    var logoCtx = logoLayer.getContext('2d');
    var logoImage = logoCtx ? logoCtx.createImageData(W, H) : null;

    var scratch = document.createElement('canvas');
    var scratchCtx = scratch.getContext('2d');

    /* ---- Preparing the uploaded artwork -------------------------------- */
    /* Lift a flat backdrop off the artwork. The colour is sampled from the
       four corners rather than assumed white, so a mark sitting on a grey or
       cream card keys out as cleanly as one on white — a fixed near-white
       threshold leaves mid-greys half-opaque and the card still shows. If the
       corners disagree (a photo, a busy edge) fall back to knocking back
       near-white pixels, which is the best guess left. */
    function knockBackdrop(img) {
      var w = img.width, h = img.height, d = img.data;
      var corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
      var lo = [255, 255, 255], hi = [0, 0, 0], sum = [0, 0, 0];
      var flat = true, i, ch, v;

      for (i = 0; i < corners.length && flat; i++) {
        var o = corners[i];
        if (d[o + 3] < 250) { flat = false; break; }
        for (ch = 0; ch < 3; ch++) {
          v = d[o + ch];
          if (v < lo[ch]) { lo[ch] = v; }
          if (v > hi[ch]) { hi[ch] = v; }
          sum[ch] += v;
        }
      }

      var spread = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
      var bg = [sum[0] / 4, sum[1] / 4, sum[2] / 4];
      var bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      if (!flat || spread > 20 || bgLum < 140) { knockWhite(img); return; }

      var NEAR = 30, FAR = 70;
      for (i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) { continue; }
        var dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
        var dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= NEAR) { d[i + 3] = 0; }
        else if (dist < FAR) { d[i + 3] = d[i + 3] * ((dist - NEAR) / (FAR - NEAR)); }
      }
    }

    /* Drop near-white pixels. Saturated light colours (a yellow mark, say)
       are left alone. */
    function knockWhite(img) {
      var d = img.data, HI = 246, LO = 208, SAT = 30;
      for (var i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) { continue; }
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        if (mx - mn > SAT) { continue; }
        var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum >= HI) { d[i + 3] = 0; }
        else if (lum > LO) { d[i + 3] = d[i + 3] * ((HI - lum) / (HI - LO)); }
      }
    }

    /* Recolour to a one-colour stamp. Ink coverage follows the artwork's
       luminance rather than its silhouette: filling the alpha shape would
       flatten a crest into a solid blob, whereas a real single-colour press
       keeps the interior detail and leaves the light areas as bare leather
       (white here, which multiply passes straight through). */
    function inkify(img, rgb) {
      var d = img.data, ir = rgb[0], ig = rgb[1], ib = rgb[2];
      for (var i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) { continue; }
        var t = 1 - (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        d[i] = 255 + (ir - 255) * t;
        d[i + 1] = 255 + (ig - 255) * t;
        d[i + 2] = 255 + (ib - 255) * t;
      }
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
      if (knockout) { knockBackdrop(img); }
      if (INK[ink]) { inkify(img, INK[ink]); }
      logoData = img;
    }

    /* ---- Wrapping the artwork onto the sphere -------------------------- */
    function renderLogoLayer() {
      if (!logoCtx || !logoImage) { return; }
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

    /* Before anything is uploaded, show where a mark would land. */
    function drawPanelGuide() {
      var gx = CX + PANEL_X * R, gy = CY + PANEL_Y * R;
      ctx.save();
      ctx.setLineDash([11, 9]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(11, 11, 13, 0.26)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, R * 0.47, R * 0.23, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(11, 11, 13, 0.32)';
      ctx.font = '600 26px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOUR LOGO HERE', gx, gy);
      ctx.restore();
    }

    function compose() {
      ctx.clearRect(0, 0, W, H);
      if (photoReady) { ctx.drawImage(photo, 0, 0, W, H); }
      if (photoReady && !logoData) { drawPanelGuide(); }
      if (logoData && photoReady) {
        ctx.save();
        ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.clip();
        /* Multiply so the leather's grain, shading and highlight come through
           the ink — printed on, not pasted on. */
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.94;
        ctx.drawImage(logoLayer, 0, 0);
        ctx.restore();
      }
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
      ink = next;
      for (var i = 0; i < swatchEls.length; i++) {
        var on = swatchEls[i].getAttribute('data-ink') === next;
        swatchEls[i].classList.toggle('is-active', on);
        swatchEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
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

          /* JPGs can't carry transparency, so a flat backdrop is a near
             certainty — key it out up front rather than making them find it. */
          knockout = /jpe?g/i.test(file.type || '');
          if (knockBox) { knockBox.checked = knockout; }

          /* Drop the mark straight into the cleared panel, scaled to fit
             between the seams, so a wide wordmark and a tall crest both land
             somewhere sensible before the size slider is ever touched. */
          posX = PANEL_X; posY = PANEL_Y;
          widthU = clamp(Math.min(0.8, 0.4 * (logoSrcW / logoSrcH)), 0.2, 1.3);
          if (sizeInput) { sizeInput.value = String(Math.round(widthU * 100)); }
          setInk('full');

          prepareLogo();
          /* prepareLogo has already explained why if it bailed — don't follow
             it with a "loaded" message and a panel of dead controls. */
          if (!logoData) { logoImg = null; return; }
          queueDraw();

          if (controls) { controls.hidden = false; }
          stage.classList.add('is-draggable');
          stage.setAttribute('tabindex', '0');
          if (hint) { hint.textContent = 'Drag the logo to place it. Focus the ball and nudge with the arrow keys.'; }
          say(knockout
            ? logoName + ' loaded — its background was removed for you.'
            : logoName + ' loaded.');
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
        queueDraw();
      });
    }

    for (var si = 0; si < swatchEls.length; si++) {
      swatchEls[si].addEventListener('click', function () {
        setInk(this.getAttribute('data-ink') || 'full');
        prepareLogo();
        queueDraw();
      });
    }

    if (knockBox) {
      knockBox.addEventListener('change', function () {
        knockout = knockBox.checked;
        prepareLogo();
        queueDraw();
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
      queueDraw();
    });

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
        var field = document.getElementById('ordersLogo');
        if (field) {
          field.value = 'Mocked up on site: ' + (logoName || 'team logo') +
            ' (' + INK_LABEL[ink] + (knockout ? ', background removed' : '') + ')';
        }
        var msg = ordersForm ? ordersForm.querySelector('textarea[name="message"]') : null;
        if (msg && msg.value.indexOf('custom logo') === -1) {
          msg.value = (msg.value ? msg.value.replace(/\s+$/, '') + '\n\n' : '') +
            'We’d like a quote on custom logo baseballs — I mocked ours up on the site.';
        }
        say('Added to your team order below. Download the mockup and attach it to your reply so we can match the artwork.');
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
        posX = PANEL_X; posY = PANEL_Y; widthU = 0.55;
        knockout = false;
        if (knockBox) { knockBox.checked = false; }
        if (sizeInput) { sizeInput.value = '55'; }
        setInk('full');
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
