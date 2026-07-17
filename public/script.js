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
      level: 'Level of play', quantity: 'Approx. # of baseballs', message: 'Message'
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
})();
