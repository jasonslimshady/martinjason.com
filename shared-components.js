/* =====================================================================
   shared-components.js
   Injects the global header and footer into every page.
   Edit this file once → changes propagate to all pages.
   ===================================================================== */
(function () {

  var HEADER_HTML =
    '<nav class="nav glass" aria-label="Hauptnavigation">' +
    '  <a class="nav__brand" href="/" aria-label="Jason Martin — Startseite">' +
    '    <img class="nav__brand-mark" src="/images/jason-martin-128x128.avif" alt="Jason Martin" width="32" height="32" />' +
    '    <span class="nav__brand-name">Martin, Jason</span>' +
    '  </a>' +
    '  <ul class="nav__links">' +
    '    <li><a href="/#services">Leistungen</a></li>' +
    '    <li><a href="/#work">Galerien</a></li>' +
    '    <li><a href="/#insights">Insights</a></li>' +
    '    <li><a href="/blog">Blog</a></li>' +
    '    <li><a href="/#about">Über mich</a></li>' +
    '  </ul>' +
    '  <a class="btn btn--primary glass-btn nav__cta" href="/#contact">Termin buchen</a>' +
    '</nav>';

  var FOOTER_HTML =
    '<div class="container footer__inner">' +
    '  <div class="footer__brand">' +
    '    <img src="/images/pacific-origins-logo-256x85.avif" alt="Pacific Origins" class="footer__pacific-logo" width="256" height="85" />' +
    '    <span class="footer__logo">Jason Martin</span>' +
    '    <p>AI Product Gallery Design</p>' +
    '  </div>' +
    '  <div class="footer__links">' +
    '    <a href="/#services">Leistungen</a>' +
    '    <a href="/#work">Galerien</a>' +
    '    <a href="/blog">Blog</a>' +
    '    <a href="/#about">Über mich</a>' +
    '    <a href="/#contact">Kontakt</a>' +
    '  </div>' +
    '  <div class="footer__legal">' +
    '    <a href="/impressum">Impressum</a>' +
    '    <a href="/datenschutz">Datenschutz</a>' +
    '    <span>© <span id="year"></span> Jason Martin</span>' +
    '  </div>' +
    '</div>';

  var header = document.querySelector('header.nav-wrap');
  if (header) header.innerHTML = HEADER_HTML;

  var footer = document.querySelector('footer.footer');
  if (footer) footer.innerHTML = FOOTER_HTML;

  // ── Global article sections ──────────────────────────────────────────
  // Injected into every blog article page via slot divs.
  // The Clarity Labs featured promo is omitted on the Clarity Labs page itself.

  var ARTICLE_FEATURED_PROMO_HTML =
    '<section class="article-featured-promo reveal" aria-label="Featured Case Study">' +
    '  <p class="eyebrow">Featured · Case Study</p>' +
    '  <a class="blog-featured" href="/clarity-labs-case-study">' +
    '    <div class="blog-featured__copy">' +
    '      <div class="blog-featured__meta">' +
    '        <span class="blog-card__tag">Case Study</span>' +
    '        <span class="blog-card__date">Juni 2026</span>' +
    '      </div>' +
    '      <h2 class="blog-featured__title">Wie man KI-Produktgalerien erstellt, die konvertieren: <em>Clarity Labs Case Study</em></h2>' +
    '      <p class="blog-featured__excerpt">' +
    '        Wie wir für Clarity Labs eine vollständige KI-Produktgalerie entwickelt haben — von der ersten Bildstrategie bis zur finalen Umsetzung. Mit konkreten Zahlen, ehrlichen Fehlern und Learnings, die du direkt anwenden kannst.' +
    '      </p>' +
    '      <span class="blog-card__read">Jetzt lesen →</span>' +
    '    </div>' +
    '    <div class="blog-featured__image-wrap">' +
    '      <img' +
    '        class="blog-featured__image"' +
    '        src="/images/Blog/Anatomie einer Produktgalerie die wirklich verkauft.avif"' +
    '        alt="Clarity Labs Case Study — KI-Produktgalerie die konvertiert"' +
    '        loading="lazy"' +
    '      />' +
    '    </div>' +
    '  </a>' +
    '</section>';

  var ARTICLE_CTA_HTML =
    '<div class="article-cta reveal">' +
    '  <div class="article-cta__image-wrap">' +
    '    <img src="/images/Blog/fuerdichumgesetzt.avif" alt="" />' +
    '  </div>' +
    '  <a class="btn btn--primary glass-btn nav__cta" href="#contact" data-booking>Projekt besprechen</a>' +
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
    '      <p class="author-card__role" itemprop="jobTitle">AI Product Gallery Designer · DACH · DTC</p>' +
    '      <p class="author-card__bio" itemprop="description">' +
    '        Ich entwerfe KI-Produktgalerien für E-Commerce-Shops im DACH-Raum — von der ersten' +
    '        Referenz bis zum finalen Bildpaket, fertig zur Verwendung. Über 5 Jahre Erfahrung' +
    '        in Performance Creative, zuletzt als Inhaber einer Media-Buying-Agentur bei Meta.' +
    '        Heute spezialisiert auf DTC-Brands, die Studioqualität ohne Fotostudio wollen.' +
    '      </p>' +
    '      <div class="author-card__links">' +
    '        <a class="author-card__link" href="/" itemprop="url">→ Mehr über mich</a>' +
    '        <a class="author-card__link" href="/#contact">→ Projekt anfragen</a>' +
    '        <a class="author-card__link" href="/blog.html">→ Alle Artikel</a>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</section>';

  var ctaSlot = document.querySelector('.article-global-cta-slot');
  if (ctaSlot) {
    var isClarity = window.location.pathname.indexOf('clarity-labs-case-study') !== -1;
    ctaSlot.innerHTML = (isClarity ? '' : ARTICLE_FEATURED_PROMO_HTML) + ARTICLE_CTA_HTML;
  }

  var authorSlot = document.querySelector('.article-global-author-slot');
  if (authorSlot) {
    authorSlot.innerHTML = ARTICLE_AUTHOR_HTML;
  }

})();
