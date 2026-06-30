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
