/**
 * booking-popup.js — martinjason.com
 * Vanilla JS booking popup. Zero external dependencies.
 *
 * Intercepts all booking CTAs → opens popup → fetches available
 * slots from the Vercel backend → lets the user pick a time,
 * enter their details, and confirm the booking.
 *
 * Timezone-aware: slots are fetched from the API and displayed
 * in the visitor's local timezone. The host timezone (Bali) is
 * shown as a secondary label when the visitor is elsewhere.
 */

(function BookingPopup() {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────────────── */

  // Set your Vercel API URL here after deployment.
  // window.BOOKING_API_BASE can be set before this script loads.
  var API_BASE = (window.BOOKING_API_BASE || '').replace(/\/$/, '');

  var USER_TZ  = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var HOST_TZ  = 'Asia/Makassar'; // Bali (WITA, UTC+8)

  // Text that identifies a "booking" button (DE + possible EN variants)
  var BOOKING_PHRASES = [
    'Termin buchen',
    'Kostenloses Erstgespräch',
    'Sprint anfragen',
    'Launch besprechen',
    'Slot prüfen',
    'Book a call',
  ];

  /* ─── State ──────────────────────────────────────────────────────── */

  var state = {
    phase: 'closed',         // closed|loading|calendar|times|form|submitting|success|error
    slots: [],               // raw [{start,end}] from API
    slotsByDate: {},         // keyed by local "YYYY-MM-DD"
    visibleMonth: null,      // Date (1st of displayed month)
    selectedDate: null,      // "YYYY-MM-DD" in visitor tz
    selectedSlot: null,      // {start,end}
    bookingContext: null,     // which button text triggered the popup
    form: { name: '', email: '', description: '' },
    errorMsg: ''
  };

  /* ─── DOM refs ───────────────────────────────────────────────────── */

  var overlay, popup;

  /* ═══════════════════════════════════════════════════════════════════
     TIMEZONE HELPERS
  ════════════════════════════════════════════════════════════════════ */

  function fmtDate(iso) {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: USER_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  function fmtTime(iso, tz) {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: tz || USER_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  }

  /** Returns "YYYY-MM-DD" for a UTC instant interpreted in USER_TZ */
  function localDateKey(iso) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: USER_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(iso));
    var p = {};
    parts.forEach(function(x){ p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }

  /** "YYYY-MM-DD" for today in visitor tz */
  function todayKey() {
    return localDateKey(new Date().toISOString());
  }

  /* ═══════════════════════════════════════════════════════════════════
     SLOT INDEXING
  ════════════════════════════════════════════════════════════════════ */

  function indexSlots(slots) {
    var byDate = {};
    slots.forEach(function(slot) {
      var key = localDateKey(slot.start);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(slot);
    });
    return byDate;
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDERING
  ════════════════════════════════════════════════════════════════════ */

  function render() {
    if (!popup) return;
    switch (state.phase) {
      case 'loading':    popup.innerHTML = tplLoading();    break;
      case 'calendar':   popup.innerHTML = tplCalendar();   break;
      case 'times':      popup.innerHTML = tplTimes();      break;
      case 'form':       popup.innerHTML = tplForm();       break;
      case 'submitting': popup.innerHTML = tplSubmitting(); break;
      case 'success':    popup.innerHTML = tplSuccess();    break;
      case 'error':      popup.innerHTML = tplError();      break;
    }
    bindHandlers();
  }

  /* ── Templates ──────────────────────────────────────────────────── */

  function tplLoading() {
    return '<div class="bp-header">' +
             '<div><p class="bp-eyebrow">Termin buchen</p>' +
             '<h2 class="bp-title">Verfügbarkeit laden…</h2></div>' +
             btnClose() +
           '</div>' +
           '<div class="bp-loading">' +
             '<div class="bp-spinner"></div>' +
             '<p>Freie Termine werden gesucht…</p>' +
           '</div>';
  }

  function tplCalendar() {
    var m      = state.visibleMonth;
    var year   = m.getFullYear();
    var month  = m.getMonth();
    var first  = new Date(year, month, 1);
    var last   = new Date(year, month + 1, 0);

    var monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(m);
    monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    var startDow = (first.getDay() + 6) % 7; // Mon = 0
    var today    = todayKey();
    var available = state.slotsByDate;

    var cells = '';
    for (var i = 0; i < startDow; i++) {
      cells += '<div class="bp-cal-cell bp-cal-cell--empty"></div>';
    }
    for (var d = 1; d <= last.getDate(); d++) {
      var dateKey = year + '-' + pad2(month + 1) + '-' + pad2(d);
      var isPast  = dateKey < today;
      var hasSlots = !!available[dateKey];
      var isSelected = dateKey === state.selectedDate;
      var isToday = dateKey === today;

      var cls = 'bp-cal-cell';
      if (isPast || !hasSlots)      cls += ' bp-cal-cell--disabled';
      if (hasSlots && !isPast)       cls += ' bp-cal-cell--available';
      if (isSelected)                cls += ' bp-cal-cell--selected';
      if (isToday && !isPast)        cls += ' bp-cal-cell--today';

      var clickable = hasSlots && !isPast;
      cells += '<div class="' + cls + '"' +
               (clickable ? ' data-date="' + dateKey + '" role="button" tabindex="0"' : '') + '>' +
               d +
               (hasSlots && !isPast ? '<span class="bp-cal-dot"></span>' : '') +
               '</div>';
    }

    // Can we go to the previous month?
    var nowFirst = new Date();
    nowFirst.setDate(1); nowFirst.setHours(0,0,0,0);
    var canPrev = m > nowFirst;

    return '<div class="bp-header">' +
             '<div><p class="bp-eyebrow">Termin buchen</p>' +
             '<h2 class="bp-title">Datum wählen</h2></div>' +
             btnClose() +
           '</div>' +
           '<p class="bp-tz-note">Deine Zeitzone: <strong>' + esc(USER_TZ) + '</strong></p>' +
           '<div class="bp-calendar">' +
             '<div class="bp-cal-nav">' +
               '<button class="bp-cal-nav-btn" data-action="prev-month"' + (canPrev ? '' : ' disabled') + '>' +
                 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
               '</button>' +
               '<span class="bp-cal-month">' + monthLabel + '</span>' +
               '<button class="bp-cal-nav-btn" data-action="next-month">' +
                 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
               '</button>' +
             '</div>' +
             '<div class="bp-cal-days">' +
               '<div class="bp-cal-dow">Mo</div>' +
               '<div class="bp-cal-dow">Di</div>' +
               '<div class="bp-cal-dow">Mi</div>' +
               '<div class="bp-cal-dow">Do</div>' +
               '<div class="bp-cal-dow">Fr</div>' +
               '<div class="bp-cal-dow">Sa</div>' +
               '<div class="bp-cal-dow">So</div>' +
               cells +
             '</div>' +
           '</div>';
  }

  function tplTimes() {
    var dateSlots = state.slotsByDate[state.selectedDate] || [];
    var displayDate = dateSlots.length ? fmtDate(dateSlots[0].start) : state.selectedDate;

    var slotBtns = dateSlots.map(function(slot) {
      var localTime = fmtTime(slot.start);
      var baliTime  = fmtTime(slot.start, HOST_TZ);
      var encoded   = esc(encodeURIComponent(JSON.stringify({ start: slot.start, end: slot.end })));
      var secondary = (USER_TZ !== HOST_TZ)
        ? '<span class="bp-time-bali">' + baliTime + ' Bali</span>' : '';
      return '<button class="bp-time-slot" data-slot="' + encoded + '">' +
               '<span class="bp-time-local">' + localTime + '</span>' + secondary +
             '</button>';
    }).join('');

    return '<div class="bp-header">' +
             '<div><p class="bp-eyebrow">Termin buchen</p>' +
             '<h2 class="bp-title">Uhrzeit wählen</h2></div>' +
             btnClose() +
           '</div>' +
           '<button class="bp-back" data-action="back-to-calendar">' +
             '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
             esc(displayDate) +
           '</button>' +
           '<p class="bp-tz-note">Deine Zeitzone: <strong>' + esc(USER_TZ) + '</strong></p>' +
           '<div class="bp-times">' +
             (slotBtns || '<p class="bp-no-slots">Keine freien Zeiten an diesem Tag.</p>') +
           '</div>';
  }

  function tplForm() {
    var slot     = state.selectedSlot;
    var dateStr  = fmtDate(slot.start);
    var timeStr  = fmtTime(slot.start) + ' – ' + fmtTime(slot.end);

    return '<div class="bp-header">' +
             '<div><p class="bp-eyebrow">Termin buchen</p>' +
             '<h2 class="bp-title">Deine Details</h2></div>' +
             btnClose() +
           '</div>' +
           '<button class="bp-back" data-action="back-to-times">' +
             '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
             esc(dateStr) +
           '</button>' +
           '<div class="bp-slot-preview">' +
             '<span class="bp-slot-preview-time">' + esc(timeStr) + '</span>' +
             '<span class="bp-slot-preview-tz">' + esc(USER_TZ) + '</span>' +
           '</div>' +
           '<form class="bp-form" id="bp-booking-form" novalidate>' +
             '<div class="bp-field">' +
               '<label class="bp-label" for="bp-name">Name</label>' +
               '<input class="bp-input" id="bp-name" name="name" type="text" ' +
                      'placeholder="Dein Name" required autocomplete="name" ' +
                      'value="' + esc(state.form.name) + '" />' +
             '</div>' +
             '<div class="bp-field">' +
               '<label class="bp-label" for="bp-email">E-Mail</label>' +
               '<input class="bp-input" id="bp-email" name="email" type="email" ' +
                      'placeholder="deine@email.com" required autocomplete="email" ' +
                      'value="' + esc(state.form.email) + '" />' +
             '</div>' +
             '<div class="bp-field">' +
               '<label class="bp-label" for="bp-desc">Worum geht\'s? <span class="bp-optional">(optional)</span></label>' +
               '<textarea class="bp-textarea" id="bp-desc" name="description" rows="3" ' +
                         'placeholder="Kurz beschreiben, was wir besprechen sollten…">' +
                 esc(state.form.description) +
               '</textarea>' +
             '</div>' +
             '<button class="bp-submit" type="submit">Termin bestätigen</button>' +
             '<p class="bp-privacy">Deine Daten werden nur für die Terminbuchung verwendet. DSGVO-konform.</p>' +
           '</form>';
  }

  function tplSubmitting() {
    return '<div class="bp-header"><h2 class="bp-title">Termin wird gebucht…</h2></div>' +
           '<div class="bp-loading">' +
             '<div class="bp-spinner"></div>' +
             '<p>Dein Termin wird eingetragen…</p>' +
           '</div>';
  }

  function tplSuccess() {
    var slot = state.selectedSlot;
    var dateStr = fmtDate(slot.start);
    var timeStr = fmtTime(slot.start) + ' – ' + fmtTime(slot.end);

    return '<div class="bp-success">' +
             '<div class="bp-success-icon">' +
               '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
             '</div>' +
             '<h2 class="bp-success-title">Termin bestätigt!</h2>' +
             '<p class="bp-success-sub">Du erhältst gleich eine Bestätigungsmail.</p>' +
             '<div class="bp-success-details">' +
               '<p><strong>' + esc(dateStr) + '</strong></p>' +
               '<p>' + esc(timeStr) + ' <span class="bp-tz-badge">' + esc(USER_TZ) + '</span></p>' +
             '</div>' +
             '<button class="bp-success-close" data-action="close">Schließen</button>' +
           '</div>';
  }

  function tplError() {
    var msg = state.errorMsg || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
    return '<div class="bp-header"><h2 class="bp-title">Fehler</h2>' + btnClose() + '</div>' +
           '<div class="bp-error">' +
             '<p>' + esc(msg) + '</p>' +
             '<button class="bp-success-close" data-action="retry">Erneut versuchen</button>' +
           '</div>';
  }

  function btnClose() {
    return '<button class="bp-close" data-action="close" aria-label="Schließen">✕</button>';
  }

  /* ═══════════════════════════════════════════════════════════════════
     EVENT BINDING
  ════════════════════════════════════════════════════════════════════ */

  function bindHandlers() {
    // --- close / retry ---
    qsa('[data-action="close"]').forEach(function(el) {
      el.addEventListener('click', closePopup);
    });
    var retryEl = qs('[data-action="retry"]');
    if (retryEl) retryEl.addEventListener('click', function() { openPopup(state.bookingContext); });

    // --- calendar navigation ---
    var prevBtn = qs('[data-action="prev-month"]');
    var nextBtn = qs('[data-action="next-month"]');
    if (prevBtn) prevBtn.addEventListener('click', function() {
      var m = state.visibleMonth;
      setState({ visibleMonth: new Date(m.getFullYear(), m.getMonth() - 1, 1) });
    });
    if (nextBtn) nextBtn.addEventListener('click', function() {
      var m = state.visibleMonth;
      setState({ visibleMonth: new Date(m.getFullYear(), m.getMonth() + 1, 1) });
    });

    // --- date cells ---
    qsa('.bp-cal-cell--available').forEach(function(el) {
      el.addEventListener('click', function() {
        var d = el.dataset.date;
        if (d) { state.selectedDate = d; setState({ phase: 'times' }); }
      });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    // --- back buttons ---
    var backCal = qs('[data-action="back-to-calendar"]');
    if (backCal) backCal.addEventListener('click', function() { setState({ phase: 'calendar' }); });

    var backTimes = qs('[data-action="back-to-times"]');
    if (backTimes) backTimes.addEventListener('click', function() { setState({ phase: 'times' }); });

    // --- time slots ---
    qsa('.bp-time-slot').forEach(function(el) {
      el.addEventListener('click', function() {
        try {
          var slot = JSON.parse(decodeURIComponent(el.dataset.slot));
          state.selectedSlot = slot;
          setState({ phase: 'form' });
        } catch(e) { console.error('Bad slot data', e); }
      });
    });

    // --- form live sync + submit ---
    var form = qs('#bp-booking-form');
    if (form) {
      form.querySelectorAll('input, textarea').forEach(function(inp) {
        inp.addEventListener('input', function() {
          state.form[inp.name] = inp.value;
        });
      });
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        // Basic client-side validation
        var name  = form.querySelector('#bp-name');
        var email = form.querySelector('#bp-email');
        if (!name.value.trim() || !email.value.trim() || !email.value.includes('@')) {
          name.reportValidity(); email.reportValidity(); return;
        }
        submitBooking();
      });
    }
  }

  /* ─── scoped query helpers ──────────────────────────────────────── */
  function qs(sel)  { return popup.querySelector(sel); }
  function qsa(sel) { return popup.querySelectorAll(sel); }

  /* ═══════════════════════════════════════════════════════════════════
     API CALLS
  ════════════════════════════════════════════════════════════════════ */

  function fetchAvailability() {
    setState({ phase: 'loading' });

    if (!API_BASE) {
      state.errorMsg = 'Booking API not configured. Please set window.BOOKING_API_BASE.';
      setState({ phase: 'error' });
      return;
    }

    fetch(API_BASE + '/api/availability?timezone=' + encodeURIComponent(USER_TZ))
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        state.slots = data.slots || [];
        state.slotsByDate = indexSlots(state.slots);

        // Set calendar to first month with available slots (or current month)
        if (state.slots.length) {
          var firstKey = localDateKey(state.slots[0].start);
          var parts = firstKey.split('-');
          state.visibleMonth = new Date(+parts[0], +parts[1] - 1, 1);
        } else {
          var n = new Date();
          state.visibleMonth = new Date(n.getFullYear(), n.getMonth(), 1);
        }

        setState({ phase: 'calendar' });
      })
      .catch(function(err) {
        console.error('[booking-popup] availability fetch failed:', err);
        state.errorMsg = 'Verfügbarkeit konnte nicht geladen werden. Bitte versuche es erneut.';
        setState({ phase: 'error' });
      });
  }

  function submitBooking() {
    setState({ phase: 'submitting' });

    fetch(API_BASE + '/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot:        state.selectedSlot,
        name:        state.form.name.trim(),
        email:       state.form.email.trim(),
        description: state.form.description.trim(),
        timezone:    USER_TZ,
      }),
    })
      .then(function(r) {
        if (!r.ok) return r.json().then(function(d){ throw new Error(d.message || 'HTTP ' + r.status); });
        return r.json();
      })
      .then(function() {
        setState({ phase: 'success' });
      })
      .catch(function(err) {
        console.error('[booking-popup] booking failed:', err);
        state.errorMsg = err.message || 'Buchung fehlgeschlagen. Bitte versuche es erneut.';
        setState({ phase: 'error' });
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATE & LIFECYCLE
  ════════════════════════════════════════════════════════════════════ */

  function setState(updates) {
    Object.assign(state, updates);
    render();
  }

  function openPopup(context) {
    state.bookingContext = context || null;
    state.selectedDate   = null;
    state.selectedSlot   = null;
    state.form           = { name: '', email: '', description: '' };
    state.errorMsg       = '';

    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Focus first interactive element after animation
    setTimeout(function() {
      var first = popup.querySelector('button, input, textarea, [tabindex="0"]');
      if (first) first.focus();
    }, 120);

    fetchAvailability();
  }

  function closePopup() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    // Reset phase after transition ends
    setTimeout(function() { state.phase = 'closed'; }, 400);
  }

  /* ═══════════════════════════════════════════════════════════════════
     INITIALISATION
  ════════════════════════════════════════════════════════════════════ */

  function init() {
    // Build overlay + popup DOM
    overlay = document.createElement('div');
    overlay.className = 'booking-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Termin buchen');
    overlay.setAttribute('aria-live', 'polite');

    popup = document.createElement('div');
    popup.className = 'booking-popup';

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close on overlay-backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closePopup();
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closePopup();
    });

    // Wire up every booking CTA
    document.querySelectorAll('a[href="#contact"], [data-booking]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        var text = (el.textContent || el.innerText || '').trim();
        var isBookingCTA = BOOKING_PHRASES.some(function(phrase) {
          return text.indexOf(phrase) !== -1;
        });
        if (isBookingCTA) {
          e.preventDefault();
          openPopup(text);
        }
      });
    });
  }

  /* ─── Utilities ─────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* ─── Bootstrap ─────────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
