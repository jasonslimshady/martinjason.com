/* =====================================================================
   Case studies — renders /portfolio/case-studies.json into #cases.
   All content lives in the JSON file; this script is layout only.

   Media item: { "src": "", "label": "...", "ratio": "9/16", "alt": "" }
     - src empty      → neutral grey placeholder box showing "label"
     - src .mp4/.webm → lazy video (muted, loop, plays while visible)
     - any other src  → lazy image (use .avif / .webp)
   Text starting with "[PH]" is shown with a small PH flag until replaced.
   "hero" can be one { value, label } or an array of two (two columns).
   "subtitle" (one line under the title) replaces client · role · timeframe.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('cases');
  if (!root) return;
  var DATA_URL = '/portfolio/case-studies.json';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover)').matches;

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
    return esc(s).replace(/\n/g, '<br>');   /* "\n" in the JSON = line break */
  }
  function ratio(r) { return r ? ' style="aspect-ratio:' + esc(r) + '"' : ''; }
  function url(src) { return String(src || '').replace(/ /g, '%20'); }
  function isVideo(src) { return /\.(mp4|webm|mov)(\?|$)/i.test(src || ''); }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

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
           '<img src="' + esc(url(m.src)) + '" alt="' + esc(m.alt || '') + '" loading="lazy" decoding="async" draggable="false" /></div>';
  }

  /* A+ content: stacked modules; a list of images = horizontal slider row */
  function aplus(m) {
    function im(x) {
      return '<img src="' + esc(url(x.src)) + '" alt="" loading="lazy" decoding="async" draggable="false"' +
        (x.w ? ' width="' + x.w + '" height="' + x.h + '"' : '') + ' />';
    }
    return '<div class="cs-aplus" role="img" aria-label="' + esc(m.alt || m.label || '') + '">' + m.modules.map(function (row) {
      if (!Array.isArray(row)) return im(row);
      return '<div class="cs-aplus__car" data-count="' + row.length + '" style="aspect-ratio:' + row[0].w + '/' + row[0].h + '">' +
        '<div class="cs-aplus__strip" style="width:' + row.length * 100 + '%">' + row.map(im).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /* Browser frame whose tall screenshot scrolls on hover */
  function browser(m, label) {
    return '<figure class="cs-browser">' +
      (label ? '<figcaption class="cs-chip">' + esc(label) + '</figcaption>' : '') +
      '<div class="cs-browser__bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="cs-browser__screen' + (m.modules ? ' cs-browser__screen--aplus' : '') + '"><div class="cs-scroll">' + (m.modules ? aplus(m) : media(m)) + '</div></div>' +
      '</figure>';
  }
  /* E-mail client frame: toolbar + sender header, then the campaign scrolls on hover */
  var MAIL_ICONS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M20 20v-5a6 6 0 0 0-6-6H4"/></svg>';
  function mail(m) {
    var from = m.from || '';
    return '<figure class="cs-mailapp">' +
      '<div class="cs-mailapp__bar" aria-hidden="true">' + MAIL_ICONS + '</div>' +
      '<div class="cs-mailapp__head">' +
        '<span class="cs-mailapp__avatar" aria-hidden="true">' + esc(from.charAt(0).toUpperCase()) + '</span>' +
        '<span class="cs-mailapp__meta"><strong>' + esc(from) + '</strong><span>' + (m.subject ? esc(m.subject) : 'to me') + '</span></span>' +
        '<time class="cs-mailapp__time">' + esc(m.time || '') + '</time>' +
      '</div>' +
      '<div class="cs-browser__screen cs-mailapp__screen"><div class="cs-scroll">' + media(m) + '</div></div>' +
      '</figure>';
  }
  function phone(m, scroll, extra) {
    return '<div class="cs-phone' + (extra ? ' ' + extra : '') + '"><div class="cs-phone__screen">' +
      (scroll ? '<div class="cs-scroll">' + media(m) + '</div>' : media(m, 'cs-fill')) +
      '</div></div>';
  }

  var ICON_ARROWS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>';
  var ICON_CHEV_R = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var ICON_CHEV_L = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ── layout-specific visuals ─────────────────────────────────────── */
  var VISUALS = {
    /* Big 1:1 old/new compare + 6 square thumbs (show the "-new" image).
       Clicking a thumb loads its old/new pair into the big compare.
       A missing file shows a grey box with its label instead. */
    gallery: function (c) {
      var m = c.media, main = m.grid[0];   /* thumb #1 is shown big first */
      var L = m.compareLabels || { old: 'Old', new: 'New' };
      function img(src, cls, alt) {
        return '<img class="' + cls + '" src="' + esc(url(src)) + '" alt="' + esc(alt || '') + '" decoding="async" draggable="false" onerror="this.parentNode.classList.add(\'is-missing\')" />';
      }
      var compare =
        '<div class="cs-compare-wrap">' +
          '<div class="cs-compare" style="--pos:50%">' +
            '<div class="cs-compare__layer cs-sq" data-ph="Old image">' + img(main.old, 'cs-compare__old', 'Original image') + '</div>' +
            '<div class="cs-compare__layer cs-compare__after cs-sq" data-ph="New image">' + img(main.new, 'cs-compare__new', main.alt) + '</div>' +
            '<span class="cs-compare__handle" aria-hidden="true"><span class="cs-compare__knob">' + ICON_ARROWS + '</span></span>' +
            '<input class="cs-compare__range" type="range" min="0" max="100" step="0.1" value="50" aria-label="Drag to compare old and new image" />' +
          '</div>' +
          '<div class="cs-compare__labels"><span class="cs-chip cs-tag-old">' + esc(L.old) + '</span>' +
            '<button type="button" class="cs-textbtn cs-gallery-open">View full gallery</button>' +
            '<span class="cs-chip cs-tag-new">' + esc(L.new) + '</span></div>' +
        '</div>';
      var thumbs = '<div class="cs-thumbs">' + m.grid.map(function (g, i) {
        return '<button type="button" class="cs-thumb cs-sq' + (i ? '' : ' is-active') + '" aria-pressed="' + !i + '" data-old="' + esc(url(g.old)) + '" data-new="' + esc(url(g.new)) + '"' +
          ' data-alt="' + esc(g.alt || '') + '" data-ph="' + esc(g.label) + '"' +
          ' data-gallery="' + esc(JSON.stringify((g.gallery || []).map(url))) + '" data-title="' + esc(g.galleryTitle || '') + '" aria-label="Show ' + esc(g.alt || g.label) + ' in the large preview">' +
          '<img src="' + esc(url(g.new)) + '" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.parentNode.classList.add(\'is-missing\')" />' +
        '</button>';
      }).join('') + '</div>';
      /* popup — filled on open with the gallery of the selected thumb */
      var dialog = '<dialog class="cs-dialog" aria-label="Full gallery">' +
            '<div class="cs-dialog__head"><h4>Full gallery</h4>' +
            '<button type="button" class="cs-dialog__close" aria-label="Close gallery">' + ICON_CLOSE + '</button></div>' +
            '<div class="cs-dialog__grid"></div>' +
          '</dialog>';
      return '<div class="cs-v-gallery">' + compare + thumbs + '</div>' + dialog;
    },

    /* Videos / Images tabs above a 2-row slider (row 1 = items 1–8, row 2 = 9–16).
       Arrow buttons move one column at a time; media load lazily, always one column ahead. */
    ads: function (c) {
      function slider(items, name, hidden) {
        var cols = Math.ceil(items.length / 2);
        return '<div class="cs-slider' + (c.shadow ? ' cs-slider--shadow' : '') + '" data-panel="' + name + '"' + (tabbed ? ' role="tabpanel"' : '') + ' aria-label="' + esc(c.title) + ' ' + name + '"' + (hidden ? ' hidden' : '') + '>' +
          '<div class="cs-slider__track" style="--cols:' + cols + '">' +
            items.map(function (v, i) {
              var place = ' style="grid-row:' + (i < cols ? 1 : 2) + ';grid-column:' + (i % cols + 1) + '"';
              var inner = isVideo(v.src)
                ? '<video class="cs-video" data-src="' + esc(url(v.src)) + '" muted loop playsinline preload="none" aria-label="' + esc(v.label) + '"></video>'
                : v.src ? '<img data-src="' + esc(url(v.src)) + '" alt="' + esc(v.alt || '') + '" decoding="async" draggable="false" />'
                : '<span class="cs-ph">' + esc(v.label) + '</span>';
              var grow = !isVideo(v.src) ? ' cs-slide--grow' : '';   /* images grow in place on hover */
              return '<div class="cs-slide' + grow + '" data-col="' + (i % cols) + '"' + place + '><div class="cs-media"' + ratio(v.ratio) + '>' + inner + '</div></div>';
            }).join('') +
          '</div>' +
          '<button type="button" class="cs-arrow cs-arrow--prev" aria-label="Previous" hidden>' + ICON_CHEV_L + '</button>' +
          '<button type="button" class="cs-arrow cs-arrow--next" aria-label="Next">' + ICON_CHEV_R + '</button>' +
        '</div>';
      }
      /* "videos" + "images" → two tabs; "items" alone → a single slider (e.g. 3D renders) */
      var first = c.media.videos || c.media.items || [];
      var hasImages = !!(c.media.videos && c.media.images && c.media.images.length);
      var tabbed = hasImages;
      var tabs = hasImages
        ? '<div class="cs-tabs" role="tablist" aria-label="Ad format">' +
            '<button type="button" role="tab" class="cs-tab is-active" aria-selected="true" data-tab="videos">Videos</button>' +
            '<button type="button" role="tab" class="cs-tab" aria-selected="false" data-tab="images">Images</button>' +
          '</div>'
        : '';
      return tabs + slider(first, c.media.videos ? 'videos' : 'items', false) + (hasImages ? slider(c.media.images, 'images', true) : '');
    },

    /* 2×2 desktop browsers; the last one gets a phone overlapping its bottom-right */
    landing: function (c) {
      var d = c.media.desktops;
      return '<div class="cs-v-landing">' + d.map(function (m, i) {
        var last = i === d.length - 1 && c.media.mobile;
        return '<div class="cs-lp-item">' + browser(m) + (last ? phone(c.media.mobile, true, 'cs-phone--sm') : '') + '</div>';
      }).join('') + '</div>';
    },

    /* 2×2 campaign screenshots inside e-mail client frames (grow + scroll like landing pages) */
    email: function (c) {
      return '<div class="cs-v-landing cs-v-mail">' + c.media.emails.map(function (m) {
        return '<div class="cs-lp-item">' + mail(m) + '</div>';
      }).join('') + '</div>';
    },

    app: function (c) {
      var phones = '<div class="cs-phones">' + c.media.screens.map(function (s) { return phone(s, false); }).join('') + '</div>';
      var ICON_WEB = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
      var badges = '<div class="cs-badges">' + (c.badges || []).map(function (b) {
        var ph = !b.href || isPH(b.href);
        var attrs = ph ? ' href="#' + esc(c.id) + '" aria-disabled="true"' : ' href="' + esc(b.href) + '" target="_blank" rel="noopener"';
        if (b.image) {   /* official store badge artwork */
          return '<a class="cs-store"' + attrs + '><img src="' + esc(url(b.image)) + '" alt="' + esc(b.alt || b.type) + '" width="150" height="50" loading="lazy" /></a>';
        }
        return '<a class="cs-badge' + (ph ? ' is-ph' : '') + '"' + attrs + '>' + ICON_WEB +
          esc(b.label || 'Website') + (ph ? '<span class="ph-flag">PH</span>' : '') + '</a>';
      }).join('') + '</div>';
      return phones + badges;
    },

    shop: function (c) {
      return '<div class="cs-v-shop">' + browser(c.media.desktop) + phone(c.media.mobile, true) + '</div>';
    }
  };

  /* ── one section ─────────────────────────────────────────────────── */
  function heroBlock(h) {
    if (!h) return '';
    var list = Array.isArray(h) ? h : [h];
    var long = list.length === 1 && String(list[0].value).replace('[PH]', '').trim().length > 6;
    return '<div class="case__hero' + (list.length > 1 ? ' case__hero--duo' : '') + (long ? ' case__hero--long' : '') + '">' +
      list.map(function (x) {
        var trend = x.trend === 'up'
          ? '<svg class="case__trend" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="increase"><path d="M12 20V5M5 11l7-7 7 7"/></svg>'
          : '';
        return '<p><strong>' + t(x.value) + trend + '</strong><span>' + t(x.label) + '</span></p>';
      }).join('') + '</div>';
  }

  function section(c, i) {
    var s = c.story || {};
    var meta = c.subtitle ? t(c.subtitle)
      : [c.client, c.role, c.timeframe].filter(Boolean).map(t).join(' <span aria-hidden="true">·</span> ');
    var flip = typeof c.flip === 'boolean' ? c.flip : i % 2 === 1;   /* "flip": true → copy left, visual right */
    return '<article class="case case--' + esc(c.layout) + (flip ? ' case--flip' : '') + '" id="' + esc(c.id) + '">' +
      '<div class="case__copy">' +
        '<ul class="case__tags">' + c.tags.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h3 class="case__title">' + t(c.title) + '</h3>' +
        (meta ? '<p class="case__meta">' + meta + '</p>' : '') +
        heroBlock(c.hero) +
        (c.stats && c.stats.length ? '<div class="cs-stats">' + c.stats.map(function (x) {
          return '<div class="cs-stat"><span class="cs-stat__label">' + esc(x.label) + '</span>' +
                 '<strong class="cs-stat__value">' + t(x.value) + '</strong></div>';
        }).join('') + '</div>' : '') +
        '<details class="case__how"><summary>How I did it<span class="case__how-icon" aria-hidden="true"></span></summary>' +
          '<div class="case__how-body"><dl>' +
            '<div><dt>Problem</dt><dd>' + t(s.problem) + '</dd></div>' +
            '<div><dt>What I did</dt><dd>' + t(s.action) + '</dd></div>' +
            '<div><dt>Result</dt><dd>' + t(s.result) + '</dd></div>' +
          '</dl></div>' +
        '</details>' +
      '</div>' +
      '<div class="case__visual">' + (VISUALS[c.layout] ? VISUALS[c.layout](c) : '') + '</div>' +
      '</article>';
  }

  /* ── behaviour: "How I did it" slides open/closed ────────────────── */
  function wireDetails() {
    root.querySelectorAll('.case__how').forEach(function (d) {
      var summary = d.querySelector('summary'), body = d.querySelector('.case__how-body');
      var anim = null;
      summary.addEventListener('click', function (e) {
        if (reduceMotion || !body.animate) return;          /* native jump */
        e.preventDefault();
        if (anim) anim.cancel();
        var opening = !d.open;
        if (opening) d.open = true;
        d.classList.toggle('is-open', opening);
        var h = body.scrollHeight;
        anim = body.animate(
          opening ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }]
                  : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
          { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        anim.onfinish = function () { anim = null; if (!opening) d.open = false; };
      });
      d.addEventListener('toggle', function () { d.classList.toggle('is-open', d.open); });
    });
  }

  /* ── behaviour: gallery compare, thumbs, auto demo, popup ────────── */
  function wireGallery() {
    root.querySelectorAll('.case--gallery').forEach(function (sec) {
      var g = sec.querySelector('.cs-v-gallery');
      var box = g.querySelector('.cs-compare');
      var range = box.querySelector('.cs-compare__range');
      var oldImg = box.querySelector('.cs-compare__old'), newImg = box.querySelector('.cs-compare__new');
      var thumbs = g.querySelectorAll('.cs-thumb');

      function setPos(v) { range.value = v; box.style.setProperty('--pos', v + '%'); }
      range.addEventListener('input', function () { box.style.setProperty('--pos', range.value + '%'); });

      /* preload every old/new pair once the gallery is near the screen */
      var cache = {};
      function preload(src) {
        if (cache[src]) return cache[src];
        var im = new Image(); im.decoding = 'async'; im.src = src;
        cache[src] = (im.decode ? im.decode() : Promise.resolve()).then(function () { return true; }, function () { return false; });
        cache[src].img = im;   /* keep a reference so it stays decoded */
        return cache[src];
      }
      function preloadAll() { thumbs.forEach(function (b) { preload(b.dataset.old); preload(b.dataset.new); }); }
      if ('IntersectionObserver' in window) {
        var pio = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { preloadAll(); pio.disconnect(); } }, { rootMargin: '800px 0px' });
        pio.observe(g);
      } else { preloadAll(); }

      function show(el, src, ok) {
        el.parentNode.classList.toggle('is-missing', !ok);
        el.src = src;
      }
      var token = 0;
      thumbs.forEach(function (b) {
        b.addEventListener('click', function () {
          if (demo) { demo.stopped = true; demo = null; } tags(null);
          thumbs.forEach(function (x) { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b); });
          var my = ++token;
          /* swap both layers together once both are decoded → no half-swapped frame */
          Promise.all([preload(b.dataset.old), preload(b.dataset.new)]).then(function (ok) {
            if (my !== token) return;
            show(oldImg, b.dataset.old, ok[0]);
            show(newImg, b.dataset.new, ok[1]);
            newImg.alt = b.dataset.alt;
            setPos(50);
            runDemo(true);   /* replay the intro animation for the new pair */
          });
        });
      });

      /* auto demo: middle → right (old) · 1s · → left (new) · 1s · → middle.
         Any interaction with the slider stops it. */
      var demo = null, touched = false;
      var tagOld = sec.querySelector('.cs-tag-old'), tagNew = sec.querySelector('.cs-tag-new');
      function tags(which) {   /* 'old' | 'new' | null → which tag is highlighted */
        if (tagOld) tagOld.classList.toggle('is-on', which === 'old');
        if (tagNew) tagNew.classList.toggle('is-on', which === 'new');
      }
      function stopDemo() { touched = true; tags(null); if (demo) { demo.stopped = true; demo = null; } }
      function runDemo(force) {
        if (reduceMotion || (touched && !force)) return;   /* user already took over → no demo */
        if (demo) demo.stopped = true;
        var d = demo = { stopped: false };
        /* [from, to, ms, highlighted tag] */
        var steps = [[50, 100, 900, 'old'], [100, 100, 1000, 'old'], [100, 0, 1500, 'new'], [0, 0, 1000, 'new'], [0, 50, 900, null]];
        var i = 0, start = null;
        tags('old');
        function frame(ts) {
          if (d.stopped) return;
          if (start === null) start = ts;
          var st = steps[i], p = Math.min(1, (ts - start) / st[2]);
          setPos(+(st[0] + (st[1] - st[0]) * ease(p)).toFixed(2));
          if (p >= 1) {
            i++; start = ts;
            if (i >= steps.length) { demo = null; return; }
            tags(steps[i][3]);
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        range.addEventListener(ev, stopDemo, { passive: true });
      });
      if ('IntersectionObserver' in window) {
        var dio = new IntersectionObserver(function (e) {
          if (e[0].isIntersecting) { dio.disconnect(); setTimeout(runDemo, 300); }
        }, { threshold: 0.6 });
        dio.observe(box);
      }

      /* full gallery popup */
      var dlg = sec.querySelector('.cs-dialog'), openBtn = sec.querySelector('.cs-gallery-open');
      if (dlg && openBtn && dlg.showModal) {
        openBtn.addEventListener('click', function () {
          var active = g.querySelector('.cs-thumb.is-active') || thumbs[0];
          var list = []; try { list = JSON.parse(active.dataset.gallery || '[]'); } catch (e) {}
          var n = Array.prototype.indexOf.call(thumbs, active) + 1;
          dlg.querySelector('h4').textContent = active.dataset.title || ('Gallery ' + n);
          dlg.querySelector('.cs-dialog__grid').innerHTML = list.map(function (src, i) {
            return '<div class="cs-media" style="aspect-ratio:1/1"><img src="' + esc(src) + '" alt="Gallery ' + n + ', image ' + (i + 1) + '" decoding="async" draggable="false" /></div>';
          }).join('');
          dlg.showModal(); dlg.scrollTop = 0; document.documentElement.classList.add('cs-modal-open');
        });
        dlg.querySelector('.cs-dialog__close').addEventListener('click', function () { dlg.close(); });
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   /* backdrop */
        dlg.addEventListener('close', function () { document.documentElement.classList.remove('cs-modal-open'); });
      } else if (openBtn) { openBtn.hidden = true; }
    });
  }

  /* ── behaviour: ads Videos / Images tabs ─────────────────────────── */
  function wireTabs() {
    root.querySelectorAll('.cs-tabs').forEach(function (tabs) {
      var vis = tabs.parentNode;
      tabs.querySelectorAll('.cs-tab').forEach(function (b) {
        b.addEventListener('click', function () {
          tabs.querySelectorAll('.cs-tab').forEach(function (x) {
            var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', on);
          });
          vis.querySelectorAll('[data-panel]').forEach(function (p) {
            p.hidden = p.dataset.panel !== b.dataset.tab;
            if (!p.hidden && p._update) p._update();
          });
          vis.querySelectorAll('[hidden] video').forEach(function (v) { v.pause(); });
        });
      });
    });
  }

  /* ── behaviour: ad sliders (arrows, one column per click, load one column ahead) ── */
  function wireSliders() {
    root.querySelectorAll('.cs-slider').forEach(function (sl) {
      var track = sl.querySelector('.cs-slider__track');
      var prev = sl.querySelector('.cs-arrow--prev'), next = sl.querySelector('.cs-arrow--next');
      var slides = Array.prototype.slice.call(sl.querySelectorAll('.cs-slide'));
      var near = false;
      function colW() {
        var a = slides[0], b = slides.filter(function (x) { return x.dataset.col === '1'; })[0];
        return b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
      }
      function load(slide) {
        var m = slide.querySelector('[data-src]');
        if (!m) return;
        m.src = m.dataset.src; m.removeAttribute('data-src');
        if (m.tagName === 'VIDEO') { m.preload = 'auto'; m.load(); }
      }
      function update() {
        if (sl.hidden) return;
        var w = colW() || 1, x = track.scrollLeft;
        var first = Math.floor(x / w), last = Math.ceil((x + track.clientWidth) / w) - 1;
        if (near) slides.forEach(function (s) { if (+s.dataset.col <= last + 1) load(s); });   /* visible + next column */
        var end = x + track.clientWidth >= track.scrollWidth - 2;
        next.hidden = end;
        prev.hidden = x <= 2;   /* back at the first column → hide "<" again */
      }
      sl._update = update;
      next.addEventListener('click', function () {
        track.scrollBy({ left: colW(), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -colW(), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
      window.addEventListener('resize', update, { passive: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) { if (e[0].isIntersecting) { near = true; update(); } }, { rootMargin: '600px 0px' }).observe(sl.closest('.case'));
      } else { near = true; }
      update();
    });
  }

  /* ── behaviour: image slides zoom from their centre ────────────────
     A fixed overlay (outside the slider's clip) is laid out at the final,
     larger size and animated small→large with transform, so the resting
     state is rendered at full resolution instead of an upscaled bitmap. */
  /* true when el is not cut off by its slider window or by the viewport */
  function fullyVisible(el) {
    var r = el.getBoundingClientRect(), tr = el.closest('.cs-slider__track');
    var box = tr ? tr.getBoundingClientRect() : { left: -1e9, right: 1e9 };
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    return r.left >= Math.max(0, box.left) - 1 && r.right <= Math.min(vw, box.right) + 1 && r.top >= -1 && r.bottom <= vh + 1;
  }

  function wireGrow() {
    var tiles = root.querySelectorAll('.cs-slide--grow');
    if (!tiles.length || !canHover) return;
    var z = document.createElement('div');
    z.className = 'cs-zoom'; z.setAttribute('aria-hidden', 'true');
    z.innerHTML = '<img alt="" decoding="async" />';
    document.body.appendChild(z);
    var zi = z.querySelector('img'), current = null, anim = null;
    var SCALE = 1.8, PAD = 16;

    function off() { current = null; if (anim) { anim.cancel(); anim = null; } z.classList.remove('is-on'); }
    function hide() {
      if (!current) return;
      var from = current._zoomFrom; current = null;
      if (anim) anim.cancel();
      anim = z.animate([{ transform: 'none' }, { transform: from }],
        { duration: reduceMotion ? 0 : 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      anim.onfinish = function () { anim = null; if (!current) z.classList.remove('is-on'); };
    }
    function show(tile) {
      var img = tile.querySelector('img');
      if (!img || !img.getAttribute('src') || !fullyVisible(tile)) return;
      if (anim) anim.cancel();
      current = tile;
      var r = tile.querySelector('.cs-media').getBoundingClientRect();
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var sc = Math.max(1, Math.min(SCALE, (vw - PAD * 2) / r.width, (vh - PAD * 2) / r.height));
      var w = r.width * sc, h = r.height * sc;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;            /* grow from the tile centre … */
      var left = Math.min(Math.max(PAD, cx - w / 2), vw - PAD - w);        /* … nudged to stay on screen */
      var top = Math.min(Math.max(PAD, cy - h / 2), vh - PAD - h);
      z.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px;';
      zi.src = img.currentSrc || img.src; zi.alt = img.alt || '';
      var dx = cx - (left + w / 2), dy = cy - (top + h / 2);
      tile._zoomFrom = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + (1 / sc).toFixed(4) + ')';
      z.classList.add('is-on');
      anim = z.animate([{ transform: tile._zoomFrom }, { transform: 'none' }],
        { duration: reduceMotion ? 0 : 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      anim.onfinish = function () { anim = null; };
    }
    tiles.forEach(function (t) {
      t.addEventListener('mouseenter', function () { show(t); });
      t.addEventListener('mouseleave', function () { if (current === t) hide(); });
    });
    window.addEventListener('scroll', off, { passive: true });
    root.querySelectorAll('.cs-slider__track').forEach(function (tr) { tr.addEventListener('scroll', off, { passive: true }); });
  }

  /* ── behaviour: click an ad video → grows into a popup, plays with sound ── */
  function wireVideoPopup() {
    var vids = root.querySelectorAll('.cs-slider .cs-video');
    if (!vids.length) return;
    var dlg = document.createElement('dialog');
    dlg.className = 'cs-vpop';
    dlg.setAttribute('aria-label', 'Ad video');
    dlg.innerHTML = '<div class="cs-vpop__box"><video playsinline loop></video>' +
      '<button type="button" class="cs-vpop__close" aria-label="Close video">' + ICON_CLOSE + '</button></div>';
    document.body.appendChild(dlg);
    var box = dlg.querySelector('.cs-vpop__box'), pv = dlg.querySelector('video');
    var origin = null;

    function close() {
      if (!dlg.open) return;
      var finish = function () { pv.pause(); pv.removeAttribute('src'); pv.load(); dlg.close(); };
      if (reduceMotion || !box.animate) return finish();
      var a = box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.92)' }], { duration: 180, easing: 'ease-in' });
      a.onfinish = finish;
    }
    dlg.querySelector('.cs-vpop__close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });   /* backdrop */
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });             /* Esc */
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('cs-modal-open'); });

    vids.forEach(function (v) {
      var slide = v.closest('.cs-slide');
      slide.classList.add('is-clickable');
      slide.setAttribute('role', 'button'); slide.setAttribute('tabindex', '0');
      slide.setAttribute('aria-label', 'Play ' + (v.getAttribute('aria-label') || 'video') + ' with sound');
      function open() {
        origin = v.getBoundingClientRect();
        pv.src = v.getAttribute('src') || v.dataset.src;
        pv.muted = false; pv.currentTime = 0;
        dlg.showModal(); document.documentElement.classList.add('cs-modal-open');
        var pr = pv.play(); if (pr && pr.catch) pr.catch(function () { pv.muted = true; pv.play(); });
        if (reduceMotion || !box.animate) return;
        var end = box.getBoundingClientRect();   /* grow from the clicked card */
        var sx = origin.width / end.width, sy = origin.height / end.height;
        var dx = origin.left + origin.width / 2 - (end.left + end.width / 2);
        var dy = origin.top + origin.height / 2 - (end.top + end.height / 2);
        box.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', borderRadius: '14px' },
                     { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
      slide.addEventListener('click', open);
      slide.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  /* ── behaviour: screenshot auto-scroll (hover / in view), hold to pause ── */
  function wireScrollers() {
    /* Each frame plays a timeline of segments:
         { v: [fromY, toY] }      vertical scroll of the screenshot
         { h: rowEl, n: count }   an A+ slider row, moved sideways image by image
       Speed: ~1.4s per frame-height vertically, 1.2s per image sideways. */
    var V_SPEED = 1.4, H_SPEED = 1.2;
    var scrollers = [];
    root.querySelectorAll('.cs-scroll').forEach(function (el) {
      var s = { el: el, screen: el.parentNode, t: 0, dir: 0, paused: false, segs: null, T: 0 };
      s.build = function () {
        var frameH = s.screen.clientHeight, total = el.offsetHeight;
        var maxY = Math.max(0, total - frameH), segs = [], y = 0, T = 0;
        function vseg(to) { var d = (to - y) / frameH * V_SPEED; segs.push({ v: [y, to], d: d }); T += d; y = to; }
        el.querySelectorAll('.cs-aplus__car').forEach(function (car) {
          var stopY = Math.min(maxY, Math.max(0, car.offsetTop + car.offsetHeight - frameH));   /* row fully visible */
          if (stopY > y) vseg(stopY);
          var n = +car.dataset.count, d = (n - 1) * H_SPEED;
          segs.push({ h: car, n: n, d: d }); T += d;
        });
        if (maxY > y) vseg(maxY);
        if (segs.length === 1 && segs[0].v) { segs[0].d = Math.max(4, segs[0].d); T = segs[0].d; }   /* plain screenshot: min 4s */
        s.segs = segs; s.T = Math.max(T, 0.001);
        if (s.t > s.T) s.t = s.T;
      };
      s.apply = function () {
        var left = s.t, y = 0;
        s.segs.forEach(function (g) {
          var p = Math.max(0, Math.min(1, left / g.d)); left -= g.d;
          if (g.v) { if (p > 0) y = g.v[0] + (g.v[1] - g.v[0]) * (s.segs.length === 1 ? p : ease(p)); }
          else g.h.firstChild.style.transform = 'translate3d(' + (-ease(p) * (g.n - 1) * 100 / g.n).toFixed(3) + '%,0,0)';
        });
        el.style.transform = 'translate3d(0,' + (-y).toFixed(1) + 'px,0)';
      };
      el.querySelectorAll('img').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { s.segs = null; }); });
      window.addEventListener('resize', function () { s.segs = null; }, { passive: true });
      /* wheel / trackpad: scroll the frame by hand — takes over from the animation.
         Moving down walks the same timeline, so A+ slider rows move sideways in between. */
      s.screen.addEventListener('wheel', function (e) {
        if (!s.segs) s.build();
        var pxPerSec = s.screen.clientHeight / V_SPEED;
        var delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? s.screen.clientHeight : 1);
        var next = Math.max(0, Math.min(s.T, s.t + delta / pxPerSec));
        if (next === s.t) return;            /* at the top / bottom → let the page scroll */
        e.preventDefault();
        s.dir = 0; s.t = next; s.apply();
      }, { passive: false });
      scrollers.push(s);
    });
    if (!scrollers.length || reduceMotion) return;

    var running = false, last = null;
    function loop(ts) {
      var dt = last === null ? 0 : Math.min(0.1, (ts - last) / 1000); last = ts;
      var active = false;
      scrollers.forEach(function (s) {
        if (!s.dir && !s.t) return;
        if (!s.segs) s.build();
        if (s.dir > 0 && !s.paused) s.t = Math.min(s.T, s.t + dt);
        if (s.dir < 0) s.t = Math.max(0, s.t - dt * s.T / 0.6);          /* quick rewind */
        s.apply();
        if ((s.dir > 0 && s.t < s.T) || (s.dir < 0 && s.t > 0)) active = true;
      });
      if (active) requestAnimationFrame(loop); else { running = false; last = null; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
    function group(trigger) { return scrollers.filter(function (s) { return trigger.contains(s.el); }); }

    /* a trigger = landing tile (browser + phone scroll together), else each frame */
    var triggers = [];
    root.querySelectorAll('.cs-lp-item, .cs-browser, .cs-phone, .cs-mailapp').forEach(function (el) {
      if (el.closest('.cs-lp-item') && !el.classList.contains('cs-lp-item')) return;
      if (group(el).length) triggers.push(el);
    });

    triggers.forEach(function (tr) {
      var g = group(tr);
      function go(dir) { g.forEach(function (s) { s.dir = dir; if (dir < 0) s.paused = false; }); kick(); }
      function pause(on) { g.forEach(function (s) { s.paused = on; }); kick(); }
      if (canHover) {
        tr.addEventListener('mouseenter', function () { go(1); });
        tr.addEventListener('mouseleave', function () { go(-1); });
      }
      /* click / touch and hold → pause, release → continue */
      tr.addEventListener('pointerdown', function () { pause(true); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { tr.addEventListener(ev, function () { pause(false); }); });
      tr.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
    window.addEventListener('pointerup', function () { scrollers.forEach(function (s) { s.paused = false; }); kick(); });

    /* touch devices: scroll while the frame is in view */
    if (!canHover && 'IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          group(e.target).forEach(function (s) { s.dir = e.isIntersecting ? 1 : -1; });
        });
        kick();
      }, { threshold: 0.6 });
      triggers.forEach(function (tr) { sio.observe(tr); });
    }
  }

  /* ── behaviour: reveal + videos ──────────────────────────────────── */
  function wireVisibility() {
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
        if (e.isIntersecting && !v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.removeAttribute('data-src'); }
        if (e.intersectionRatio >= 0.98) {   /* only fully visible videos play (not ones cut off by the slider) */
          if (!reduceMotion) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else {
          v.pause();
        }
      });
    }, { threshold: [0, 0.98, 1] });
    videos.forEach(function (v) { vio.observe(v); });
  }

  function render(data) {
    root.querySelector('.cases__eyebrow').textContent = data.eyebrow || '';
    root.querySelector('.cases__title').innerHTML = t(data.title || '');
    root.querySelector('.cases__list').innerHTML = data.cases.map(section).join('');
    wireDetails();
    wireGallery();
    wireTabs();
    wireSliders();
    wireVideoPopup();
    wireGrow();
    wireScrollers();
    wireVisibility();
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
