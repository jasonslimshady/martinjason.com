/**
 * booking-glass.js — Liquid glass SVG filter for booking-popup.css
 * martinjason.com
 *
 * Injects the SVG displacement filter used by:
 *   backdrop-filter: brightness(1.05) blur(2px) url(#bp-glass)
 *
 * Technique from liquid-glass-vue / AppCard.vue:
 *   feTurbulence  → generates organic noise
 *   feDisplacementMap → warps the backdrop pixels using that noise
 *
 * ── Tuning ────────────────────────────────────────────────────────────
 *   baseFrequency  lower = smoother, larger warps  (try 0.005 – 0.025)
 *   numOctaves     more = finer detail, heavier    (2–3 is good)
 *   scale          higher = more dramatic warp     (20–60 for a popup)
 *   seed           any integer → different pattern
 *
 * Only runs in Chrome / Edge (the @supports guard in CSS ensures
 * Safari / Firefox use the standard frosted-glass fallback).
 */

;(function () {
  'use strict';

  function injectFilter() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'display:none;position:absolute;width:0;height:0;overflow:hidden;');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs>' +
        '<filter id="bp-glass"' +
                ' x="-10%" y="-10%" width="120%" height="120%"' +
                ' color-interpolation-filters="sRGB">' +

          /* Step 1: Generate turbulence noise                               *
           * baseFrequency="0.010" → large, fluid warps (same as AppCard)   *
           * Raise to 0.02+ for tighter, more granular distortion            */
          '<feTurbulence' +
            ' type="turbulence"' +
            ' baseFrequency="0.010"' +
            ' numOctaves="2"' +
            ' seed="5"' +
            ' result="turbulence"/>' +

          /* Step 2: Displace the backdrop using the noise                   *
           * scale="40" → noticeable but not overwhelming for a content popup*
           * AppCard.vue uses 200 for a purely decorative dock card          */
          '<feDisplacementMap' +
            ' in="SourceGraphic"' +
            ' in2="turbulence"' +
            ' scale="40"' +
            ' xChannelSelector="R"' +
            ' yChannelSelector="G"/>' +

        '</filter>' +
      '</defs>';

    document.body.appendChild(svg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFilter);
  } else {
    injectFilter();
  }

}());
