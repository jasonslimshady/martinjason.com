(function CookieConsent() {
  'use strict';

  var CONSENT_KEY = 'cookie_consent';
  var GA_ID = 'G-VGBWRTMZW2';
  var CLARITY_ID = 'wkr32ce57m';

  /* ── Consent storage ─────────────────────────────────────────────── */

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }

  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
  }

  /* ── Analytics loading ───────────────────────────────────────────── */

  function loadGA() {
    if (document.getElementById('cc-ga-script')) return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.id = 'cc-ga-script';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function loadClarity() {
    if (window.clarity) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function loadAnalytics() {
    loadGA();
    loadClarity();
  }

  /* ── SVG glass filter injection ──────────────────────────────────── */

  function injectGlassFilter() {
    if (document.getElementById('cc-glass-svg')) return;
    try {
      if (!CSS.supports('backdrop-filter', 'url("#")')) return;
    } catch (e) { return; }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'cc-glass-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';

    var defs = document.createElementNS(svgNS, 'defs');
    var filter = document.createElementNS(svgNS, 'filter');
    filter.id = 'cc-glass';
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');

    var turb = document.createElementNS(svgNS, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.65 0.65');
    turb.setAttribute('numOctaves', '1');
    turb.setAttribute('seed', '2');
    turb.setAttribute('result', 'noise');

    var disp = document.createElementNS(svgNS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'noise');
    disp.setAttribute('scale', '8');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(turb);
    filter.appendChild(disp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  /* ── Popup DOM ───────────────────────────────────────────────────── */

  var overlay = null;

  function createPopup() {
    overlay = document.createElement('div');
    overlay.className = 'cookie-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Datenschutz-Einstellungen');

    var shell = document.createElement('div');
    shell.className = 'cookie-popup-shell';

    var popup = document.createElement('div');
    popup.className = 'cookie-popup';
    popup.innerHTML =
      '<div class="cp-header">' +
        '<div class="cp-icon" aria-hidden="true">🍪</div>' +
        '<div class="cp-heading">' +
          '<p class="cp-eyebrow">Cookies &amp; Datenschutz</p>' +
          '<h2 class="cp-title">Datenschutz-Einstellungen</h2>' +
        '</div>' +
      '</div>' +
      '<p class="cp-body">Wir verwenden Cookies für Webanalyse (Google Analytics 4) und Session-Aufzeichnungen (Microsoft Clarity), um unsere Website kontinuierlich zu verbessern. Deine Einwilligung kannst du jederzeit widerrufen.</p>' +
      '<a href="/datenschutz.html" class="cp-link">Datenschutzerklärung lesen →</a>' +
      '<div class="cp-actions">' +
        '<button class="cp-btn cp-btn--secondary" data-action="reject">Ablehnen</button>' +
        '<button class="cp-btn cp-btn--primary" data-action="accept">Alle akzeptieren</button>' +
      '</div>';

    shell.appendChild(popup);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    overlay.querySelector('[data-action="accept"]').addEventListener('click', onAccept);
    overlay.querySelector('[data-action="reject"]').addEventListener('click', onReject);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) {
        onReject();
      }
    });
  }

  function show() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      var btn = overlay.querySelector('[data-action="accept"]');
      if (btn) btn.focus();
    }, 120);
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ── Actions ─────────────────────────────────────────────────────── */

  function onAccept() {
    setConsent('accepted');
    try { localStorage.removeItem('ignore_analytics'); } catch (e) {}
    hide();
    loadAnalytics();
  }

  function onReject() {
    setConsent('rejected');
    try { localStorage.setItem('ignore_analytics', 'true'); } catch (e) {}
    hide();
  }

  /* ── Init ────────────────────────────────────────────────────────── */

  function init() {
    var consent = getConsent();

    /* Migrate legacy ignore_analytics flag */
    if (!consent && localStorage.getItem('ignore_analytics') === 'true') {
      setConsent('rejected');
      consent = 'rejected';
    }

    if (consent === 'accepted') {
      loadAnalytics();
      return;
    }
    if (consent === 'rejected') {
      return;
    }

    /* No decision yet — show the banner */
    function showBanner() {
      injectGlassFilter();
      createPopup();
      setTimeout(show, 300);
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(showBanner, { timeout: 2000 });
    } else {
      setTimeout(showBanner, 500);
    }
  }

  /* ── Public API (for Datenschutz page) ───────────────────────────── */

  window.CookieConsent = {
    open: function () {
      if (!overlay) {
        injectGlassFilter();
        createPopup();
      }
      show();
    },
    revoke: function () {
      try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
      try { localStorage.removeItem('ignore_analytics'); } catch (e) {}
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
