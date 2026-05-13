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
