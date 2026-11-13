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
    return esc(s);
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

  /* Browser frame whose tall screenshot scrolls on hover */
  function browser(m, label) {
    return '<figure class="cs-browser">' +
      (label ? '<figcaption class="cs-chip">' + esc(label) + '</figcaption>' : '') +
      '<div class="cs-browser__bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="cs-browser__screen"><div class="cs-scroll">' + media(m) + '</div></div>' +
      '</figure>';
  }
  function phone(m, scroll, extra) {
    return '<div class="cs-phone' + (extra ? ' ' + extra : '') + '"><div class="cs-phone__screen">' +
      (scroll ? '<div class="cs-scroll">' + media(m) + '</div>' : media(m, 'cs-fill')) +
      '</div></div>';
  }

  var ICON_ARROWS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>';
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
          '<div class="cs-compare__labels"><span class="cs-chip">' + esc(L.old) + '</span><span class="cs-chip">' + esc(L.new) + '</span></div>' +
          (m.fullGallery ? '<button type="button" class="cs-textbtn cs-gallery-open">View full gallery</button>' : '') +
        '</div>';
      var thumbs = '<div class="cs-thumbs">' + m.grid.map(function (g, i) {
        return '<button type="button" class="cs-thumb cs-sq' + (i ? '' : ' is-active') + '" aria-pressed="' + !i + '" data-old="' + esc(url(g.old)) + '" data-new="' + esc(url(g.new)) + '"' +
          ' data-alt="' + esc(g.alt || '') + '" data-ph="' + esc(g.label) + '" aria-label="Show ' + esc(g.alt || g.label) + ' in the large preview">' +
          '<img src="' + esc(url(g.new)) + '" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.parentNode.classList.add(\'is-missing\')" />' +
        '</button>';
      }).join('') + '</div>';
      var dialog = m.fullGallery
        ? '<dialog class="cs-dialog" aria-label="Full gallery">' +
            '<div class="cs-dialog__head"><h4>' + esc(c.title) + '</h4>' +
            '<button type="button" class="cs-dialog__close" aria-label="Close gallery">' + ICON_CLOSE + '</button></div>' +
            '<div class="cs-dialog__grid">' + m.fullGallery.map(function (g) { return media(g); }).join('') + '</div>' +
          '</dialog>'
        : '';
      return '<div class="cs-v-gallery">' + compare + thumbs + '</div>' + dialog;
    },

    /* Videos / Images tabs above a horizontal reel */
    ads: function (c) {
      function reel(items, name, hidden) {
        return '<div class="cs-reel" data-panel="' + name + '" role="tabpanel" tabindex="0" aria-label="Ad ' + name + ', scroll sideways"' + (hidden ? ' hidden' : '') + '>' +
          items.map(function (v) { return '<div class="cs-reel__item">' + media(v) + '</div>'; }).join('') + '</div>';
      }
      var hasImages = c.media.images && c.media.images.length;
      var tabs = hasImages
        ? '<div class="cs-tabs" role="tablist" aria-label="Ad format">' +
            '<button type="button" role="tab" class="cs-tab is-active" aria-selected="true" data-tab="videos">Videos</button>' +
            '<button type="button" role="tab" class="cs-tab" aria-selected="false" data-tab="images">Images</button>' +
          '</div>'
        : '';
      var chips = '<div class="cs-stats">' + (c.stats || []).map(function (s) {
        return '<div class="cs-stat"><span class="cs-stat__label">' + esc(s.label) + '</span>' +
               '<strong class="cs-stat__value">' + t(s.value) + '</strong></div>';
      }).join('') + '</div>';
      return tabs + reel(c.media.videos, 'videos', false) + (hasImages ? reel(c.media.images, 'images', true) : '') + chips;
    },

    /* 2×2 desktop browsers; the last one gets a phone overlapping its bottom-right */
    landing: function (c) {
      var d = c.media.desktops;
      return '<div class="cs-v-landing">' + d.map(function (m, i) {
        var last = i === d.length - 1 && c.media.mobile;
        return '<div class="cs-lp-item">' + browser(m) + (last ? phone(c.media.mobile, true, 'cs-phone--sm') : '') + '</div>';
      }).join('') + '</div>';
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
    var list = Array.isArray(h) ? h : [h];
    var long = list.length === 1 && String(list[0].value).replace('[PH]', '').trim().length > 6;
    return '<div class="case__hero' + (list.length > 1 ? ' case__hero--duo' : '') + (long ? ' case__hero--long' : '') + '">' +
      list.map(function (x) {
        return '<p><strong>' + t(x.value) + '</strong><span>' + t(x.label) + '</span></p>';
      }).join('') + '</div>';
  }

  function section(c, i) {
    var s = c.story || {};
    var meta = c.subtitle ? t(c.subtitle)
      : [c.client, c.role, c.timeframe].filter(Boolean).map(t).join(' <span aria-hidden="true">·</span> ');
    return '<article class="case case--' + esc(c.layout) + (i % 2 ? ' case--flip' : '') + '" id="' + esc(c.id) + '">' +
      '<div class="case__copy">' +
        '<ul class="case__tags">' + c.tags.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h3 class="case__title">' + t(c.title) + '</h3>' +
        (meta ? '<p class="case__meta">' + meta + '</p>' : '') +
        heroBlock(c.hero) +
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
          stopDemo();
          thumbs.forEach(function (x) { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b); });
          var my = ++token;
          /* swap both layers together once both are decoded → no half-swapped frame */
          Promise.all([preload(b.dataset.old), preload(b.dataset.new)]).then(function (ok) {
            if (my !== token) return;
            show(oldImg, b.dataset.old, ok[0]);
            show(newImg, b.dataset.new, ok[1]);
            newImg.alt = b.dataset.alt;
            setPos(50);
          });
        });
      });

      /* auto demo: middle → right (old) · 1s · → left (new) · 1s · → middle.
         Any interaction with the slider stops it. */
      var demo = null, touched = false;
      function stopDemo() { touched = true; if (demo) { demo.stopped = true; demo = null; } }
      function runDemo() {
        if (reduceMotion || touched) return;   /* user already took over → no demo */
        var d = demo = { stopped: false };
        var steps = [[50, 100, 900], [100, 100, 1000], [100, 0, 1500], [0, 0, 1000], [0, 50, 900]];
        var i = 0, start = null;
        function frame(ts) {
          if (d.stopped) return;
          if (start === null) start = ts;
          var st = steps[i], p = Math.min(1, (ts - start) / st[2]);
          setPos(+(st[0] + (st[1] - st[0]) * ease(p)).toFixed(2));
          if (p >= 1) { i++; start = ts; if (i >= steps.length) { demo = null; return; } }
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
          dlg.showModal(); document.documentElement.classList.add('cs-modal-open');
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
          vis.querySelectorAll('.cs-reel[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
          vis.querySelectorAll('[hidden] video').forEach(function (v) { v.pause(); });
        });
      });
    });
  }

  /* ── behaviour: screenshot auto-scroll (hover / in view), hold to pause ── */
  function wireScrollers() {
    var scrollers = [];
    root.querySelectorAll('.cs-scroll').forEach(function (el) {
      var s = { el: el, screen: el.parentNode, p: 0, dir: 0, dur: 7, paused: false };
      var img = el.querySelector('img');
      function setDur() {   /* ~1.4s per screen-height of screenshot, min 4s */
        var screens = el.offsetHeight / Math.max(1, s.screen.clientHeight);
        s.dur = Math.max(4, (screens - 1) * 1.4);
      }
      if (img) { if (img.complete && img.naturalHeight) setDur(); else img.addEventListener('load', setDur); }
      window.addEventListener('resize', setDur, { passive: true });
      scrollers.push(s);
    });
    if (!scrollers.length || reduceMotion) return;

    var running = false, last = null;
    function loop(ts) {
      var dt = last === null ? 0 : Math.min(0.1, (ts - last) / 1000); last = ts;
      var active = false;
      scrollers.forEach(function (s) {
        if (s.dir > 0 && !s.paused) s.p = Math.min(1, s.p + dt / s.dur);
        if (s.dir < 0) s.p = Math.max(0, s.p - dt / 0.6);
        var max = Math.max(0, s.el.offsetHeight - s.screen.clientHeight);
        s.el.style.transform = 'translate3d(0,' + (-s.p * max).toFixed(1) + 'px,0)';
        if ((s.dir > 0 && s.p < 1) || (s.dir < 0 && s.p > 0)) active = true;
      });
      if (active) requestAnimationFrame(loop); else { running = false; last = null; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
    function group(trigger) { return scrollers.filter(function (s) { return trigger.contains(s.el); }); }

    /* a trigger = landing tile (browser + phone scroll together), else each frame */
    var triggers = [];
    root.querySelectorAll('.cs-lp-item, .cs-browser, .cs-phone').forEach(function (el) {
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
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          if (!reduceMotion) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.4 });
    videos.forEach(function (v) { vio.observe(v); });
  }

  function render(data) {
    root.querySelector('.cases__eyebrow').textContent = data.eyebrow || '';
    root.querySelector('.cases__title').innerHTML = t(data.title || '');
    root.querySelector('.cases__list').innerHTML = data.cases.map(section).join('');
    wireDetails();
    wireGallery();
    wireTabs();
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
