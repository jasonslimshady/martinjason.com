/**
 * booking-glass.js — Progressive glass enhancement for booking-popup.js
 * martinjason.com
 *
 * Three tiers of progressive enhancement, each building on the last:
 *
 *   Tier 1 — Pure CSS (booking-popup.css)
 *             backdrop-filter + layered shadows + pseudo-element highlights
 *             Works everywhere, always active.
 *
 *   Tier 2 — SVG feTurbulence + feDisplacementMap
 *             Refractive distortion of the blurred backdrop.
 *             Kicks in when SVG filters are available (all modern browsers).
 *             Gives the glass that characteristic organic warp.
 *
 *   Tier 3 — WebGL fragment shader
 *             Physical-ish optical effects rendered as a transparent overlay:
 *             edge bevel glow, Phong specular, chromatic aberration at rims,
 *             and subtle animated caustic shimmer.
 *             Gracefully skipped when WebGL is unavailable.
 *
 * ─── Tunable constants ─────────────────────────────────────────────────────
 *
 *   CFG.blur            backdrop blur (px)          ← also in CSS --glass-blur
 *   CFG.refraction      SVG displacement scale (px)  ← start low (~8–14)
 *   CFG.turbFreqX/Y     SVG turbulence frequency     ← lower = larger warps
 *   CFG.bevelWidth      edge bevel fraction (0–0.5)  ← 0.05–0.10 is subtle
 *   CFG.specular        Phong specular strength       ← 0–1
 *   CFG.dispersion      chromatic edge split          ← 0–1, keep ≤ 0.5
 *   CFG.causticSpeed    animation speed multiplier    ← 0 = fully static
 *   CFG.webgl           set false to skip WebGL tier
 *
 * ─── Where to tweak realism vs. performance ────────────────────────────────
 *
 *   More realism   → raise CFG.refraction, lower CFG.turbFreqX/Y, add octaves
 *   More perf      → CFG.webgl = false  OR  raise CFG.turbFreqX/Y
 *   Less animation → CFG.causticSpeed = 0  (also auto-disabled for prefers-reduced-motion)
 *   Safer fallback → CFG.svgFilter = false  (disables Tier 2 entirely)
 */

;(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════════════════════════════════ */

  var CFG = {
    blur:         44,      // px — matches CSS --glass-blur
    refraction:   10,      // SVG displacement map scale (px)
    turbFreqX:    0.014,   // feTurbulence base frequency X (smaller = smoother warp)
    turbFreqY:    0.019,   // feTurbulence base frequency Y
    turbOctaves:  2,       // noise octaves; 2 is good perf/detail balance
    turbSeed:     7,       // different seeds give different warp patterns
    bevelWidth:   0.06,    // fraction of popup height used for bevel glow
    specular:     0.88,    // Phong specular intensity (0–1)
    dispersion:   0.36,    // chromatic aberration at edges (0–1)
    causticSpeed: 0.22,    // animation speed; 0 = static
    svgFilter:    true,    // set false to skip Tier 2
    webgl:        true,    // set false to skip Tier 3
  };

  /* Read overrides from CSS custom properties if present */
  function syncFromCSS(popup) {
    var cs = window.getComputedStyle(popup);
    function num(prop) {
      var v = cs.getPropertyValue(prop).trim();
      return v ? parseFloat(v) : null;
    }
    var blur = cs.getPropertyValue('--glass-blur').trim();
    if (blur) CFG.blur = parseFloat(blur);
    var ref = num('--glass-refraction'); if (ref !== null) CFG.refraction  = ref;
    var bev = num('--glass-bevel');      if (bev !== null) CFG.bevelWidth  = bev;
    var sp  = num('--glass-specular');   if (sp  !== null) CFG.specular    = sp;
    var dp  = num('--glass-dispersion'); if (dp  !== null) CFG.dispersion  = dp;
  }

  var _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══════════════════════════════════════════════════════════════════════
     TIER 2 — SVG DISPLACEMENT FILTER
  ══════════════════════════════════════════════════════════════════════ */

  var _svgInjected = false;

  /**
   * Injects a hidden <svg> with the glass refraction filter into <body>.
   * Called once; subsequent calls are no-ops.
   */
  function injectSVGDefs() {
    if (_svgInjected || !CFG.svgFilter) return;
    _svgInjected = true;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'display:none;position:absolute;width:0;height:0;overflow:hidden;');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs>' +
        // Extra filter region so displaced pixels aren't clipped at element edge
        '<filter id="bp-refract" x="-5%" y="-5%" width="110%" height="110%"' +
                ' color-interpolation-filters="sRGB">' +
          // Organic fractal noise — drives the displacement map
          '<feTurbulence type="fractalNoise"' +
            ' baseFrequency="' + CFG.turbFreqX + ' ' + CFG.turbFreqY + '"' +
            ' numOctaves="' + CFG.turbOctaves + '"' +
            ' seed="' + CFG.turbSeed + '"' +
            ' result="noise"/>' +
          // Displace source pixels using R-channel for X, G-channel for Y
          // scale = displacement strength in px; raise for more dramatic refraction
          '<feDisplacementMap in="SourceGraphic" in2="noise"' +
            ' scale="' + CFG.refraction + '"' +
            ' xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter>' +
      '</defs>';

    document.body.appendChild(svg);
  }

  /**
   * Apply (or remove) the SVG displacement filter to .bp-glass-backdrop.
   * Called after the backdrop element is inserted into the popup.
   */
  function applySVGFilter(backdropEl) {
    if (!CFG.svgFilter) return;
    // Verify the filter element actually exists before referencing it
    if (document.getElementById('bp-refract')) {
      backdropEl.style.filter = 'url(#bp-refract)';
      backdropEl.style.webkitFilter = 'url(#bp-refract)';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     TIER 3 — WEBGL OPTICAL EFFECTS
  ══════════════════════════════════════════════════════════════════════ */

  /* ── Vertex shader (trivial fullscreen quad) ──────────────────────── */
  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }',
  ].join('\n');

  /* ── Fragment shader ──────────────────────────────────────────────── */
  var FRAG = [
    'precision mediump float;',

    // Uniforms
    'uniform vec2  u_res;',          // canvas size (px)
    'uniform float u_time;',         // elapsed seconds (0 when reduced-motion)
    'uniform float u_bevel;',        // bevel fraction 0–0.5
    'uniform float u_spec;',         // specular strength
    'uniform float u_disp;',         // chromatic dispersion (0–1)

    // ── Helpers ──────────────────────────────────────────────────────

    // Edge factor: 0 at center, 1 at the bevel ring near the popup border.
    // The smoothstep creates a soft gradient rather than a hard edge.
    'float edgeFactor(vec2 uv) {',
    '  vec2 d = min(uv, 1.0 - uv);',      // distance to nearest edge, per axis
    '  float e = min(d.x, d.y);',          // closest edge overall
    '  return 1.0 - smoothstep(0.0, u_bevel, e);',
    '}',

    // Phong-style specular from a top-left light source.
    // Returns a scalar 0–1. Multiply by u_spec for final brightness.
    'float specular(vec2 uv) {',
    '  // Surface normal tilted toward a virtual light at top-left            ',
    '  vec3 n = normalize(vec3((uv.x - 0.5) * -0.7, (uv.y - 0.5) * 0.7, 1.0));',
    '  vec3 l = normalize(vec3(-0.45, 0.65, 0.80));',   // light direction
    '  vec3 v = vec3(0.0, 0.0, 1.0);',                   // view from front
    '  vec3 h = normalize(l + v);',                      // half-vector (Blinn-Phong)
    '  return pow(max(dot(n, h), 0.0), 88.0);',          // sharp highlight
    '}',

    // Caustic shimmer: overlapping sine waves create moving light pockets.
    // Very low amplitude — just barely visible as premium texture.
    'float caustic(vec2 uv, float t) {',
    '  vec2 p = uv * 3.8;',
    '  float c = sin(p.x * 2.9 + t) * cos(p.y * 2.4 + t * 0.65)',
    '           + sin(p.x * 1.55 - t * 0.4) * cos(p.y * 3.2 + t * 0.28);',
    '  return smoothstep(0.2, 0.8, c * 0.5 + 0.5) * 0.055;',  // very subtle
    '}',

    // ── Main ─────────────────────────────────────────────────────────
    'void main() {',
    '  vec2 uv  = gl_FragCoord.xy / u_res;',
    '  float e  = edgeFactor(uv);',
    '  float t  = u_time;',

    '  // ── Rim light: soft white glow that follows the bevel ring ──',
    '  float rim = pow(e, 1.6) * 0.38;',

    '  // ── Top-edge highlight: brighter at top (light from above) ──',
    '  float topGlow = smoothstep(0.84, 1.0, uv.y) * 0.32;',

    '  // ── Specular glint (top-left) ────────────────────────────── ',
    '  float sp = specular(uv) * u_spec;',

    '  // ── Caustic shimmer (static under reduced-motion) ─────────',
    '  float ca = caustic(uv, t);',

    '  // ── Chromatic aberration: R warms slightly, B cools ────────',
    '  // Only visible at the bevel edge, very subtle.               ',
    '  float rShift =  e * u_disp * 0.045;',
    '  float bShift =  e * u_disp * 0.028;',

    '  // ── Compose ──────────────────────────────────────────────── ',
    '  float base  = rim + topGlow + sp + ca;',
    '  float alpha = clamp(base, 0.0, 0.78);',

    '  vec3 col = vec3(',
    '    clamp(base + rShift, 0.0, 1.0),',   // R: slightly warm at edges
    '    clamp(base,          0.0, 1.0),',   // G: neutral
    '    clamp(base - bShift, 0.0, 1.0)',    // B: slightly cooler at edges
    '  );',

    '  gl_FragColor = vec4(col, alpha);',
    '}',
  ].join('\n');

  /* ── WebGL helpers ────────────────────────────────────────────────── */

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }

  function compileShader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[booking-glass] Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  /**
   * Build and return an object that owns a WebGL canvas and its render loop.
   * The canvas element is returned as .el for DOM insertion.
   * Call .resize(w, h) after inserting to set dimensions.
   * Call .destroy() to cancel the loop and remove the canvas.
   */
  function createGLPane() {
    var canvas = document.createElement('canvas');
    canvas.className = 'bp-glass-webgl';
    canvas.setAttribute('aria-hidden', 'true');

    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
          || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return null;

    // ── Build shader program ──────────────────────────────────────────
    var vs = compileShader(gl, gl.VERTEX_SHADER,   VERT);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[booking-glass] Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    // ── Fullscreen triangle strip ─────────────────────────────────────
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // ── Uniform locations ─────────────────────────────────────────────
    var uRes  = gl.getUniformLocation(prog, 'u_res');
    var uTime = gl.getUniformLocation(prog, 'u_time');
    var uBev  = gl.getUniformLocation(prog, 'u_bevel');
    var uSpec = gl.getUniformLocation(prog, 'u_spec');
    var uDisp = gl.getUniformLocation(prog, 'u_disp');

    // Set static uniforms now (won't change per-frame)
    gl.uniform1f(uBev,  CFG.bevelWidth);
    gl.uniform1f(uSpec, CFG.specular);
    gl.uniform1f(uDisp, CFG.dispersion);

    // ── Blending: src_alpha over destination ──────────────────────────
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Render loop ───────────────────────────────────────────────────
    var raf = null;
    var t0  = performance.now();
    var w   = 0;
    var h   = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!w || !h) return;

      var elapsed = _reducedMotion ? 0.0 : (now - t0) * 0.001 * CFG.causticSpeed;

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    raf = requestAnimationFrame(frame);

    return {
      el: canvas,

      resize: function (newW, newH) {
        w = newW; h = newH;
        canvas.width  = w;
        canvas.height = h;
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      },

      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PERSISTENT GLASS ELEMENTS
     booking-popup.js overwrites popup.innerHTML on every state change.
     We keep a single backdrop <div> and WebGL canvas alive and
     re-insert them after each innerHTML swap using a MutationObserver.
  ══════════════════════════════════════════════════════════════════════ */

  var _backdropEl = null;   // <div class="bp-glass-backdrop">
  var _glPane     = null;   // { el, resize, destroy }
  var _popup      = null;   // current .booking-popup element
  var _observer   = null;

  function getBackdropEl() {
    if (!_backdropEl) {
      _backdropEl = document.createElement('div');
      _backdropEl.className = 'bp-glass-backdrop';
      _backdropEl.setAttribute('aria-hidden', 'true');
      applySVGFilter(_backdropEl);
    }
    return _backdropEl;
  }

  /**
   * Insert backdrop + WebGL canvas into the popup if they aren't already there.
   * backdrop goes first (z-index 0, behind content).
   * WebGL canvas goes last (z-index 4, above content, pointer-events:none).
   */
  function reinsert() {
    if (!_popup) return;

    var bd = getBackdropEl();
    if (!_popup.contains(bd)) {
      _popup.insertBefore(bd, _popup.firstChild);
    }

    if (_glPane && !_popup.contains(_glPane.el)) {
      _popup.appendChild(_glPane.el);
      // Resize canvas to match visible popup area
      _glPane.resize(_popup.clientWidth, _popup.clientHeight);
    }
  }

  function watchPopup(popup) {
    if (_observer) { _observer.disconnect(); _observer = null; }
    _popup = popup;

    // Initial insert
    popup.dataset.glassReady = '1';
    reinsert();

    // Re-insert after every innerHTML swap
    _observer = new MutationObserver(function () {
      reinsert();
    });
    _observer.observe(popup, { childList: true });
  }

  function stopWatching() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    _popup = null;
  }

  /* ══════════════════════════════════════════════════════════════════════
     INIT — watch the overlay for popup open/close
  ══════════════════════════════════════════════════════════════════════ */

  function init() {
    // Inject SVG defs once
    injectSVGDefs();

    // Init WebGL pane once (canvas is reused across open/close)
    if (CFG.webgl && hasWebGL()) {
      _glPane = createGLPane();
      if (!_glPane) console.info('[booking-glass] WebGL unavailable — Tier 3 skipped.');
    }

    // Watch for .booking-overlay class changes (popup open/close)
    var overlayObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type !== 'attributes' || m.attributeName !== 'class') return;
        var overlay = m.target;
        var isOpen  = overlay.classList.contains('is-open');
        var popup   = overlay.querySelector('.booking-popup');

        if (isOpen && popup) {
          syncFromCSS(popup);
          watchPopup(popup);
          // Resize WebGL after open animation settles (popup transform ends at ~420ms)
          if (_glPane) {
            setTimeout(function () {
              if (_popup) _glPane.resize(_popup.clientWidth, _popup.clientHeight);
            }, 450);
          }
        } else {
          stopWatching();
        }
      });
    });

    // Observe all .booking-overlay elements (usually just one)
    document.querySelectorAll('.booking-overlay').forEach(function (el) {
      overlayObserver.observe(el, { attributes: true });
    });

    // Handle window resize: refit canvas
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (_glPane && _popup) _glPane.resize(_popup.clientWidth, _popup.clientHeight);
      }, 120);
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API (optional, for console tuning / future use) ────────── */
  window.BookingGlass = { config: CFG };

}());
