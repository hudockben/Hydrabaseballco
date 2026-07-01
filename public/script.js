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
      function start() { if (!reduce) { timer = window.setInterval(function () { go(idx + 1); }, 3000); } }
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

  /* Team Orders form — compose a mailto so inquiries actually reach us */
  var ordersForm = document.getElementById('ordersForm');
  if (ordersForm) {
    ordersForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var data = new FormData(ordersForm);
      var name = (data.get('name') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var team = (data.get('team') || '').toString().trim();

      var subject = 'Team Order Inquiry' + (team ? ' — ' + team : '');
      var bodyLines = [
        'Name: ' + (name || '(not provided)'),
        'Email: ' + (email || '(not provided)'),
        'Team / organization: ' + (team || '(not provided)'),
        '',
        'Tell us about your order (quantity, level of play, timeline):',
        ''
      ];
      var href =
        'mailto:info@hydrabaseball.co' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(bodyLines.join('\n'));

      window.location.href = href;

      var btn = ordersForm.querySelector('button');
      if (btn) { btn.textContent = 'Opening your email…'; }
    });
  }
})();
