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

})();
