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

  /* Hero photo slideshow — cross-fades through the player photos.
     Slides load their image first; any that 404 are skipped, so the
     rotation only ever contains photos that actually exist. */
  var heroMedia = document.getElementById('heroSlides');
  if (heroMedia) {
    var slides = Array.prototype.slice.call(heroMedia.querySelectorAll('.hero__slide'));
    var pending = slides.length;

    var settle = function () {
      if (--pending > 0) return;
      startSlideshow();
    };

    slides.forEach(function (slide) {
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
      active.forEach(function (s, i) { s.classList.toggle('is-active', i === 0); });
      if (active.length <= 1) return; // nothing to rotate through

      var dotsWrap = document.getElementById('heroDots');
      var dots = [];
      var idx = 0;
      var timer = null;
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function go(n) {
        active[idx].classList.remove('is-active');
        if (dots[idx]) { dots[idx].classList.remove('is-active'); }
        idx = (n + active.length) % active.length;
        active[idx].classList.add('is-active');
        if (dots[idx]) { dots[idx].classList.add('is-active'); }
      }
      function start() { if (!reduce) { timer = window.setInterval(function () { go(idx + 1); }, 2000); } }
      function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
      function restart() { stop(); start(); }

      if (dotsWrap) {
        active.forEach(function (s, i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'hero__dot' + (i === 0 ? ' is-active' : '');
          b.setAttribute('aria-label', 'Show hero photo ' + (i + 1));
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
