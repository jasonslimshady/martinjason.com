/* =====================================================================
   shared-components.js
   Injects the global header and footer into every page.
   Edit this file once → changes propagate to all pages.
   ===================================================================== */
(function () {

  // NOTE: HEADER_HTML / FOOTER_HTML below are also baked statically into
  // every page's <header class="nav-wrap"> and <footer class="footer">
  // markup (server-rendered, no JS required) so crawlers that don't execute
  // JavaScript (Bing, LinkedIn, most LLM bots) still see real nav/footer
  // links. Keep the two copies in sync when editing links here — see
  // /work on the homepage (id="work") and /#loesung, /booking as targets.
  var HEADER_HTML =
    '<nav class="nav glass" aria-label="Hauptnavigation">' +
    '  <a class="nav__brand" href="/" aria-label="Jason Martin — Startseite">' +
    '    <img class="nav__brand-mark" src="/images/favicon.png" alt="Jason Martin" width="32" height="32" />' +
    '    <span class="nav__brand-name">Martin, Jason</span>' +
    '  </a>' +
    '  <ul class="nav__links">' +
    '    <li><a href="/#work">Galerien</a></li>' +
    '    <li><a href="/#problem">Problem</a></li>' +
    '    <li><a href="/#loesung">Lösung</a></li>' +
    '    <li><a href="/#prozess">Prozess</a></li>' +
    '    <li><a href="/#faq">FAQ</a></li>' +
    '    <li><a href="/#about">Über mich</a></li>' +
    '    <li><a href="/blog">Blog</a></li>' +
    '  </ul>' +
    '  <a class="btn btn--primary glass-btn nav__cta" href="/booking" data-booking>Audit buchen</a>' +
    '</nav>';

  var FOOTER_HTML =
    '<div class="container footer__inner">' +
    '  <div class="footer__brand">' +
    '    <picture>' +
    '      <source srcset="/images/pacific-origins-logo-256x85.avif" type="image/avif" />' +
    '      <img src="/images/pacific-origins-logo-256x85.png" alt="Pacific Origins" class="footer__pacific-logo" width="256" height="85" />' +
    '    </picture>' +
    '    <span class="footer__logo">Jason Martin</span>' +
    '    <p>AI Product Gallery Design</p>' +
    '  </div>' +
    '  <div class="footer__links">' +
    '    <a href="/#loesung">Leistungen</a>' +
    '    <a href="/#work">Galerien</a>' +
    '    <a href="/blog">Blog</a>' +
    '    <a href="/#about">Über mich</a>' +
    '    <a href="/booking">Kontakt</a>' +
    '  </div>' +
    '  <div class="footer__legal">' +
    '    <a href="/impressum">Impressum</a>' +
    '    <a href="/datenschutz">Datenschutz</a>' +
    '    <span>© <span id="year"></span> Jason Martin</span>' +
    '  </div>' +
    '</div>';

  // Guard: header/footer markup is now server-rendered statically in the
  // HTML (see comment above), so only inject here if that markup is
  // somehow missing — avoids double-rendering the nav/footer.
  var header = document.querySelector('header.nav-wrap');
  if (header && !header.innerHTML.trim()) header.innerHTML = HEADER_HTML;

  var footer = document.querySelector('footer.footer');
  if (footer && !footer.innerHTML.trim()) footer.innerHTML = FOOTER_HTML;

  // ── Global article sections ──────────────────────────────────────────
  // Injected into every blog article page via slot divs.

  var ARTICLE_FEATURED_PROMO_HTML =
    '<div class="article-featured-promo">' +
    '  <a class="blog-featured blog-featured--vsl reveal" href="/?playvsl=1#video">' +
    '    <div class="blog-featured__copy">' +
    '      <div class="blog-featured__meta">' +
    '        <span class="blog-card__tag">Training</span>' +
    '      </div>' +
    '      <h2 class="blog-featured__title">Wie du die Conversion deiner Produktseite steigerst &amp; mehr Bestellungen bekommst ohne weitere Kosten.</h2>' +
    '      <p class="blog-featured__excerpt">' +
    '        Erfahre wie profitable DTC-Marken den gleichen Traffic in mehr Umsatz verwandeln.' +
    '      </p>' +
    '      <span class="blog-card__read">Jetzt ansehen →</span>' +
    '    </div>' +
    '    <div class="blog-featured__image-wrap blog-featured__vsl-media" aria-hidden="true">' +
    '      <video class="blog-featured__vsl-bg" autoplay muted loop playsinline preload="auto" width="1280" height="720" disablePictureInPicture disableRemotePlayback tabindex="-1">' +
    '        <source src="/videos/vsl.mp4" type="video/mp4">' +
    '      </video>' +
    '      <span class="vsl__play">' +
    '        <span class="vsl__play-ring">' +
    '          <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '            <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z"/>' +
    '          </svg>' +
    '        </span>' +
    '        <span class="vsl__speed" data-speed="1.25">' +
    '          <span class="vsl__speed-top">' +
    '            <svg class="vsl__speed-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '              <path d="m12 14 4-4"/>' +
    '              <path d="M3.34 19a10 10 0 1 1 17.32 0"/>' +
    '            </svg>' +
    '            <span class="vsl__speed-value">1.25×</span>' +
    '          </span>' +
    '          <span class="vsl__speed-divider"></span>' +
    '          <span class="vsl__speed-bottom">' +
    '            <span class="vsl__speed-original">30 min</span>' +
    '            <svg class="vsl__speed-bolt" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>' +
    '            </svg>' +
    '            <span class="vsl__speed-fast">24 min</span>' +
    '          </span>' +
    '        </span>' +
    '      </span>' +
    '    </div>' +
    '  </a>' +
    '</div>';

  var ARTICLE_CTA_HTML =
    '<div class="article-cta reveal">' +
    '  <div class="article-cta__image-wrap">' +
    '    <img src="/images/Blog/fuerdichumgesetzt.avif" alt="" width="1159" height="652" loading="lazy" decoding="async" />' +
    '  </div>' +
    '  <a class="btn btn--primary glass-btn nav__cta" href="/booking" data-booking>Audit buchen</a>' +
    '</div>';

  var ARTICLE_AUTHOR_HTML =
    '<section class="author-section reveal" aria-label="Über den Autor">' +
    '  <p class="author-section__eyebrow">Über den Autor</p>' +
    '  <div class="author-card" itemscope itemtype="https://schema.org/Person">' +
    '    <img' +
    '      class="author-card__avatar"' +
    '      src="/images/jason-martin-128x128.avif"' +
    '      alt="Jason Martin — AI Product Gallery Designer"' +
    '      width="72"' +
    '      height="72"' +
    '      itemprop="image"' +
    '      loading="lazy"' +
    '    />' +
    '    <div class="author-card__info">' +
    '      <p class="author-card__name" itemprop="name">Jason Martin</p>' +
    '      <p class="author-card__role" itemprop="jobTitle">Performance Marketing Designer für DTC Marken</p>' +
    '      <p class="author-card__bio" itemprop="description">' +
    '        Ich bin Jason &amp; habe 7+ Jahre Erfahrung im Media Buying, Ad Creative &amp; mehr als 3 Million' +
    '        Euro für Brands in Ad Spend ausgegeben. Dabei habe ich gelernt, welches Bild wirklich' +
    '        verkauft, und welches nur schön aussieht.' +
    '        <br><br>' +
    '        Heute baue ich Produktgalerien für E-Commerce-Shops, die nicht nur gut aussehen –' +
    '        sondern Besucher besser zu Kunden machen als es jeder Fotograf kann.' +
    '        <br><br>' +
    '        Das Ganze passiert in Tagen, nicht Wochen. Ohne ein weiteres fünfstelliges' +
    '        Fotoshooting, sondern mit individuell generierten KI-Bildern die von echten nicht' +
    '        zu unterscheiden sind.' +
    '      </p>' +
    '      <div class="author-card__links">' +
    '        <a class="author-card__link" href="/" itemprop="url">→ Mehr über mich</a>' +
    '        <a class="author-card__link" href="/blog">→ Alle Artikel</a>' +
    '      </div>' +
    '      <div class="author-card__cta">' +
    '        <a class="btn btn--primary glass-btn" href="/booking" data-booking>Audit buchen</a>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</section>';

  var ctaSlot = document.querySelector('.article-global-cta-slot');
  if (ctaSlot) {
    ctaSlot.innerHTML = ARTICLE_FEATURED_PROMO_HTML + ARTICLE_CTA_HTML;
  }

  var authorSlot = document.querySelector('.article-global-author-slot');
  if (authorSlot) {
    authorSlot.innerHTML = ARTICLE_AUTHOR_HTML;
  }

})();
