/* =====================================================================
   Jason Martin — martinjason.com
   script.js (v0.1)

   Minimal, framework-free JS:
     1. Reveal-on-scroll (Intersection Observer)
     2. Hero parallax — blobs drift slightly with scroll
     3. Smooth focus on nav anchors
     4. Footer year
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
   2. Hero parallax — translate the bg blobs slightly on scroll.
   Throttled via requestAnimationFrame for smoothness.
   --------------------------------------------------------------------- */
(function setupParallax() {
  const blobs = document.querySelector('.bg-blobs');
  if (!blobs) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;

  function update() {
    // Read scrollY inside rAF — layout is clean here, no forced reflow.
    const y = window.scrollY;
    blobs.style.transform = `translate3d(0, ${y * -0.12}px, 0)`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    // Never read layout properties here — only schedule the rAF write pass.
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
})();


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
