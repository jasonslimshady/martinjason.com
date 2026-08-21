/* =====================================================================
   Jason Martin — martinjason.com
   script.js (v0.1)

   Minimal, framework-free JS:
     1. Reveal-on-scroll (Intersection Observer)
     3. Footer year
     4. Blog-featured slideshow
     5. Klaviyo newsletter signup
   ===================================================================== */


/* ---------------------------------------------------------------------
   1. Reveal on scroll
   Anything with class .reveal fades + lifts into view once.
   Add inline style="--reveal-delay: 120ms" for stagger.
   --------------------------------------------------------------------- */
(function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || els.length === 0) {
    // Graceful fallback: just show everything.
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -8% 0px',
  });
  els.forEach((el) => io.observe(el));
})();


/* ---------------------------------------------------------------------
   2. (removed) Background blobs are now fully static — no scroll
   parallax. A static blurred layer is painted once and cached by the
   compositor instead of being re-blurred on every scroll frame.
   --------------------------------------------------------------------- */


/* ---------------------------------------------------------------------
   3. Footer year
   --------------------------------------------------------------------- */
(function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
})();


/* ---------------------------------------------------------------------
   4. Blog-featured slideshow — auto-advances every 2.5 s
   --------------------------------------------------------------------- */
(function setupFeaturedSlideshow() {
  var slideshows = document.querySelectorAll('.blog-featured__slideshow');
  slideshows.forEach(function (wrap) {
    var slides = Array.prototype.slice.call(wrap.querySelectorAll('.blog-featured__image'));
    if (slides.length < 2) return;
    var current = 0;
    setInterval(function () {
      slides[current].classList.remove('is-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
    }, 2500);
  });
})();


/* ---------------------------------------------------------------------
   5. Klaviyo newsletter signup — Insights section
   --------------------------------------------------------------------- */
(function setupNewsletterForm() {
  const form    = document.getElementById('insights-form');
  const success = document.getElementById('insights-success');
  const error   = document.getElementById('insights-error');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email  = form.querySelector('input[type="email"]').value.trim();
    const btn    = form.querySelector('button[type="submit"]');
    const orig   = btn.textContent;

    btn.disabled    = true;
    btn.textContent = 'Wird gesendet …';
    error.hidden    = true;

    try {
      const res = await fetch(
        'https://a.klaviyo.com/client/subscriptions/?company_id=RVcS5i',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            revision: '2023-10-15',
          },
          body: JSON.stringify({
            data: {
              type: 'subscription',
              attributes: {
                profile: {
                  data: {
                    type: 'profile',
                    attributes: { email },
                  },
                },
              },
              relationships: {
                list: {
                  data: { type: 'list', id: 'WnGrcN' },
                },
              },
            },
          }),
        }
      );

      if (res.ok || res.status === 202) {
        form.hidden    = true;
        success.hidden = false;
      } else {
        throw new Error(res.status);
      }
    } catch (_) {
      error.hidden    = false;
      btn.disabled    = false;
      btn.textContent = orig;
    }
  });
})();


/* ---------------------------------------------------------------------
   6. Gallery slider — draggable carousel with dot pagination
   Markup: [data-gallery-slider] > [data-gallery-track] > .gallery-card*,
   with a sibling [data-gallery-dots] container for the indicator dots.
   Click-and-hold (pointer events) drag; dots are the only navigation —
   no arrows. Card count fully visible depends on the CSS breakpoint
   (peek of the next card on desktop/tablet, single card on mobile), so
   the number of dots is derived from measured card positions, not
   hardcoded.
   --------------------------------------------------------------------- */
(function setupGallerySlider() {
  var sliders = document.querySelectorAll('[data-gallery-slider]');

  sliders.forEach(function (slider) {
    var track = slider.querySelector('[data-gallery-track]');
    var dotsWrap = slider.parentNode && slider.parentNode.querySelector('[data-gallery-dots]');
    if (!track) return;
    var cards = Array.prototype.slice.call(track.children);
    if (!cards.length) return;

    var stops = [0];
    var current = 0;
    var offset = 0;
    var maxScroll = 0;

    function clampOffset(px) {
      return Math.min(0, Math.max(-maxScroll, px));
    }

    // Instant reposition (no transition) — used for measurement/resize.
    function jumpTo(px) {
      offset = clampOffset(px);
      track.classList.add('is-dragging');
      track.style.transform = 'translateX(' + offset + 'px)';
      void track.offsetWidth; // force reflow so the next transition is clean
      track.classList.remove('is-dragging');
    }

    // Animated reposition — relies on the CSS transition on .gallery-grid.
    function animateTo(px) {
      offset = clampOffset(px);
      track.style.transform = 'translateX(' + offset + 'px)';
    }

    function measure() {
      var trackRect = track.getBoundingClientRect();
      var viewport = trackRect.width;
      var lastRect = cards[cards.length - 1].getBoundingClientRect();
      var contentWidth = lastRect.right - trackRect.left;
      maxScroll = Math.max(0, contentWidth - viewport);

      var next = [];
      cards.forEach(function (card) {
        var r = card.getBoundingClientRect();
        var left = Math.min(Math.max(0, r.left - trackRect.left), maxScroll);
        if (!next.length || Math.abs(next[next.length - 1] - left) > 2) {
          next.push(left);
        }
      });
      stops = next.length ? next : [0];
      if (current > stops.length - 1) current = stops.length - 1;
      renderDots();
    }

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      stops.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'gallery-dot' + (i === current ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Galerie ' + (i + 1));
        dot.addEventListener('click', function () { goTo(i); });
        dotsWrap.appendChild(dot);
      });
    }

    function markActiveDot() {
      if (!dotsWrap) return;
      Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
        dot.classList.toggle('is-active', i === current);
      });
    }

    function goTo(index) {
      current = Math.max(0, Math.min(stops.length - 1, index));
      animateTo(-stops[current]);
      markActiveDot();
    }

    function nearestStopIndex(px) {
      var best = 0;
      var bestDist = Infinity;
      stops.forEach(function (s, i) {
        var d = Math.abs(-s - px);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    // --- Click-and-hold drag (pointer events cover mouse + touch + pen) ---
    var dragging = false;
    var startX = 0;
    var startOffset = 0;
    var moved = false;
    var pointerId = null;

    // Cards are links (<a>), which browsers make natively draggable —
    // that hijacks the gesture into an OS-level drag instead of our
    // pointermove stream, so suppress it explicitly.
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startOffset = offset;
      pointerId = e.pointerId;
      // Pointer capture is grabbed lazily (see pointermove) once a real
      // drag is confirmed — capturing immediately on pointerdown makes
      // some browsers skip the default click action on the underlying
      // <a>, breaking plain-click navigation.
    });

    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        track.classList.add('is-dragging');
        if (track.setPointerCapture) {
          try { track.setPointerCapture(pointerId); } catch (_) {}
        }
      }
      if (!moved) return;
      offset = clampOffset(startOffset + dx);
      track.style.transform = 'translateX(' + offset + 'px)';
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      current = nearestStopIndex(offset);
      animateTo(-stops[current]);
      markActiveDot();
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', function (e) {
      if (dragging && e.buttons === 0) endDrag();
    });

    // Swallow the click that follows a real drag so the card link isn't
    // triggered — a plain click (no movement) still navigates normally.
    track.addEventListener('click', function (e) {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    function remeasure() {
      measure();
      jumpTo(-stops[current]);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(remeasure, 150);
    });

    // Measure once layout has settled (fonts/images can still shift widths
    // right after the deferred script runs), then again on full load.
    measure();
    jumpTo(0);
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(remeasure); });
    }
    window.addEventListener('load', remeasure);
  });
})();
