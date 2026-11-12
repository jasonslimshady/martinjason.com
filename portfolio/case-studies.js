/* =====================================================================
   Case studies — renders /portfolio/case-studies.json into #cases.
   All content lives in the JSON file; this script is layout only.

   Media item: { "src": "", "label": "...", "ratio": "9/16", "alt": "" }
     - src empty      → neutral grey placeholder box showing "label"
     - src .mp4/.webm → lazy video (muted, loop, plays while visible)
     - any other src  → lazy image (use .avif / .webp)
   Text starting with "[PH]" is shown with a small PH flag until replaced.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('cases');
  if (!root) return;
  var DATA_URL = '/portfolio/case-studies.json';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── helpers ─────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isPH(s) { return typeof s === 'string' && s.indexOf('[PH]') === 0; }
  /* Text with an optional "[PH]" prefix → flagged span */
  function t(s) {
    if (isPH(s)) return '<span class="ph-flag" title="Placeholder">PH</span>' + esc(s.slice(4).trim());
    return esc(s);
  }
  function ratio(r) { return r ? ' style="aspect-ratio:' + esc(r) + '"' : ''; }
  function url(src) { return String(src || '').replace(/ /g, '%20'); }
  function isVideo(src) { return /\.(mp4|webm|mov)(\?|$)/i.test(src || ''); }

  /* One media slot: placeholder, image or video */
  function media(m, extraClass) {
    m = m || {};
    var cls = 'cs-media' + (extraClass ? ' ' + extraClass : '');
    if (!m.src) {
      return '<div class="' + cls + ' cs-ph"' + ratio(m.ratio) + ' role="img" aria-label="' + esc(m.label) + '">' +
             '<span>' + esc(m.label) + '</span></div>';
    }
    if (isVideo(m.src)) {
      return '<div class="' + cls + '"' + ratio(m.ratio) + '>' +
             '<video class="cs-video" data-src="' + esc(url(m.src)) + '"' +
             (m.poster ? ' poster="' + esc(url(m.poster)) + '"' : '') +
             ' muted loop playsinline preload="none" aria-label="' + esc(m.label) + '"></video></div>';
    }
    return '<div class="' + cls + '"' + ratio(m.ratio) + '>' +
           '<img src="' + esc(url(m.src)) + '" alt=""' + esc(m.alt || '') + '" loading="lazy" decoding="async" /></div>';
  }

  /* Browser frame whose tall screenshot scrolls on hover */
  function browser(m, label) {
    return '<figure class="cs-browser">' +
      (label ? '<figcaption class="cs-chip">' + esc(label) + '</figcaption>' : '') +
      '<div class="cs-browser__bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="cs-browser__screen"><div class="cs-scroll">' + media(m) + '</div></div>' +
      '</figure>';
  }
  function phone(m, scroll) {
    return '<div class="cs-phone"><div class="cs-phone__screen">' +
      (scroll ? '<div class="cs-scroll">' + media(m) + '</div>' : media(m, 'cs-fill')) +
      '</div></div>';
  }

  /* ── layout-specific visuals ─────────────────────────────────────── */
  var VISUALS = {
    /* Big 1:1 old/new compare + 6 square thumbs (show the "-new" image).
       Clicking a thumb loads its old/new pair into the big compare.
       A missing file shows a grey box with its label instead. */
    gallery: function (c) {
      var m = c.media, main = m.main;
      function img(src, cls, alt) {
        return '<img class="' + cls + '" src="' + esc(url(src)) + '" alt="' + esc(alt || '') + '" decoding="async" onerror="this.parentNode.classList.add(\'is-missing\')" />';
      }
      var compare =
        '<div class="cs-compare" style="--pos:50%">' +
          '<div class="cs-compare__layer cs-sq" data-ph="Original photo">' + img(main.old, 'cs-compare__old', 'Original photo') + '</div>' +
          '<div class="cs-compare__layer cs-compare__after cs-sq" data-ph="AI image">' + img(main.new, 'cs-compare__new', main.alt) + '</div>' +
          '<span class="cs-chip cs-compare__tag cs-compare__tag--l">Photo</span>' +
          '<span class="cs-chip cs-compare__tag cs-compare__tag--r">AI</span>' +
          '<span class="cs-compare__handle" aria-hidden="true"></span>' +
          '<input class="cs-compare__range" type="range" min="0" max="100" value="50" aria-label="Drag to compare photo and AI image" />' +
        '</div>';
      var thumbs = '<div class="cs-thumbs">' + m.grid.map(function (g) {
        return '<button type="button" class="cs-thumb cs-sq" data-old="' + esc(url(g.old)) + '" data-new="' + esc(url(g.new)) + '"' +
          ' data-alt="' + esc(g.alt || '') + '" data-ph="' + esc(g.label) + '" aria-label="Show ' + esc(g.alt || g.label) + ' in the large preview">' +
          '<img src="' + esc(url(g.new)) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'is-missing\')" />' +
        '</button>';
      }).join('') + '</div>';
      return '<div class="cs-v-gallery">' + compare + thumbs + '</div>';
    },

    ads: function (c) {
      var row = '<div class="cs-reel" tabindex="0" aria-label="Ad creatives, scroll sideways">' +
        c.media.videos.map(function (v) { return '<div class="cs-reel__item">' + media(v) + '</div>'; }).join('') +
        '</div>';
      var chips = '<div class="cs-stats">' + (c.stats || []).map(function (s) {
        return '<div class="cs-stat"><span class="cs-stat__label">' + esc(s.label) + '</span>' +
               '<strong class="cs-stat__value">' + t(s.value) + '</strong></div>';
      }).join('') + '</div>';
      return row + chips;
    },

    redesign: function (c) {
      return '<div class="cs-v-pair">' +
        browser(c.media.before, 'Before') +
        browser(c.media.after, 'After') +
        '</div>';
    },

    email: function (c) {
      var flow = '<ol class="cs-flow">' + c.flow.map(function (n, i) {
        return (i ? '<li class="cs-flow__arrow" aria-hidden="true">→</li>' : '') +
          '<li class="cs-flow__node"><span class="cs-flow__name">' + esc(n.name) + '</span>' +
          '<strong class="cs-flow__share">' + t(n.share) + '</strong>' +
          '<span class="cs-flow__sub">of revenue</span></li>';
      }).join('') + '</ol>';
      var mails = '<div class="cs-mails">' + c.media.emails.map(function (e) {
        return '<div class="cs-mail">' + media(e, 'cs-fill') + '</div>';
      }).join('') + '</div>';
      return flow + mails;
    },

    app: function (c) {
      var phones = '<div class="cs-phones">' + c.media.screens.map(function (s) { return phone(s, false); }).join('') + '</div>';
      var NAMES = { appstore: 'App Store', googleplay: 'Google Play', web: 'Web app' };
      var ICONS = {
        appstore: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
        googleplay: '<path d="M6 3l13 9-13 9z"/>',
        web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
      };
      var badges = '<div class="cs-badges">' + (c.badges || []).map(function (b) {
        var ph = !b.href || isPH(b.href);
        return '<a class="cs-badge' + (ph ? ' is-ph' : '') + '" href="' + (ph ? '#' + esc(c.id) : esc(b.href)) + '"' +
          (ph ? ' aria-disabled="true"' : ' target="_blank" rel="noopener"') + '>' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[b.type] + '</svg>' +
          esc(NAMES[b.type] || b.type) + (ph ? '<span class="ph-flag">PH</span>' : '') + '</a>';
      }).join('') + '</div>';
      return phones + badges;
    },

    shop: function (c) {
      return '<div class="cs-v-shop">' + browser(c.media.desktop) + phone(c.media.mobile, true) + '</div>';
    }
  };

  /* ── one section ─────────────────────────────────────────────────── */
  function section(c, i) {
    var s = c.story || {};
    var meta = [c.client, c.role, c.timeframe].filter(Boolean).map(t).join(' <span aria-hidden="true">·</span> ');
    return '<article class="case case--' + esc(c.layout) + (i % 2 ? ' case--flip' : '') + '" id="' + esc(c.id) + '">' +
      '<div class="case__copy">' +
        '<ul class="case__tags">' + c.tags.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h3 class="case__title">' + t(c.title) + '</h3>' +
        '<p class="case__meta">' + meta + '</p>' +
        '<p class="case__hero' + (String(c.hero.value).replace('[PH]', '').trim().length > 6 ? ' case__hero--long' : '') + '">' +
          '<strong>' + t(c.hero.value) + '</strong><span>' + t(c.hero.label) + '</span></p>' +
        '<details class="case__how"><summary>How I did it</summary><dl>' +
          '<div><dt>Problem</dt><dd>' + t(s.problem) + '</dd></div>' +
          '<div><dt>What I did</dt><dd>' + t(s.action) + '</dd></div>' +
          '<div><dt>Result</dt><dd>' + t(s.result) + '</dd></div>' +
        '</dl></details>' +
      '</div>' +
      '<div class="case__visual">' + (VISUALS[c.layout] ? VISUALS[c.layout](c) : '') + '</div>' +
      '</article>';
  }

  /* ── behaviour ───────────────────────────────────────────────────── */
  function wire() {
    /* before/after slider */
    root.querySelectorAll('.cs-compare').forEach(function (box) {
      var r = box.querySelector('.cs-compare__range');
      r.addEventListener('input', function () { box.style.setProperty('--pos', r.value + '%'); });
    });

    /* gallery thumbs → load that old/new pair into the big compare */
    root.querySelectorAll('.cs-v-gallery').forEach(function (g) {
      var box = g.querySelector('.cs-compare');
      var oldImg = box.querySelector('.cs-compare__old'), newImg = box.querySelector('.cs-compare__new');
      var range = box.querySelector('.cs-compare__range');
      function load(el, src) { el.parentNode.classList.remove('is-missing'); el.src = src; }
      g.querySelectorAll('.cs-thumb').forEach(function (b) {
        b.addEventListener('click', function () {
          g.querySelectorAll('.cs-thumb').forEach(function (x) { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b); });
          load(oldImg, b.dataset.old);
          load(newImg, b.dataset.new);
          newImg.alt = b.dataset.alt;
          range.value = 50; box.style.setProperty('--pos', '50%');
        });
      });
    });

    /* scroll-in reveal + videos play only while visible */
    var cases = root.querySelectorAll('.case');
    var videos = root.querySelectorAll('.cs-video');
    if (!('IntersectionObserver' in window)) {
      cases.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    cases.forEach(function (el) { io.observe(el); });

    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          if (!reduceMotion) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.4 });
    videos.forEach(function (v) { vio.observe(v); });

    /* touch devices: auto-scroll screenshots once their frame is in view */
    if (!window.matchMedia('(hover: hover)').matches) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.classList.toggle('is-scrolling', e.isIntersecting); });
      }, { threshold: 0.6 });
      root.querySelectorAll('.cs-browser__screen, .cs-phone__screen').forEach(function (el) { sio.observe(el); });
    }
  }

  function render(data) {
    root.querySelector('.cases__eyebrow').textContent = data.eyebrow || '';
    root.querySelector('.cases__title').innerHTML = t(data.title || '');
    root.querySelector('.cases__list').innerHTML = data.cases.map(section).join('');
    wire();
    /* arrived with a #case-… hash → jump there now that it exists */
    if (location.hash && location.hash.indexOf('#case-') === 0) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function (err) {
      root.hidden = true;
      if (window.console) console.warn('Case studies failed to load:', err);
    });
})();
