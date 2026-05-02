/**
 * lib/slots.js
 * Generates all theoretically available 30-minute booking slots
 * for Jason's schedule (Bali time, UTC+8) and filters out busy periods.
 *
 * Schedule:
 *   Monday, Wednesday, Thursday  → 13:00–19:00 Bali
 *   Tuesday, Friday              → 13:00–15:30 and 16:30–19:00 Bali
 *
 * All times are stored and returned as UTC ISO 8601 strings.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const BALI_OFFSET_HOURS = 8; // UTC+8
const SLOT_DURATION_MINS = 30;
const LOOKAHEAD_DAYS = 62;   // ~2 months ahead

/**
 * Working periods per JS day-of-week (0=Sun, 1=Mon … 6=Sat)
 * Times are [hour, minute] in Bali local time.
 */
const WORKING_HOURS_BALI = {
  1: [{ s: [13, 0], e: [19, 0] }],                                 // Monday
  2: [{ s: [13, 0], e: [15, 30] }, { s: [16, 30], e: [19, 0] }],  // Tuesday
  3: [{ s: [13, 0], e: [19, 0] }],                                 // Wednesday
  4: [{ s: [13, 0], e: [19, 0] }],                                 // Thursday
  5: [{ s: [13, 0], e: [15, 30] }, { s: [16, 30], e: [19, 0] }],  // Friday
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a Bali local datetime to a UTC Date object.
 * year/month are JS-style (month 0-indexed).
 */
function baliToUtc(year, month, day, hour, minute) {
  return new Date(
    Date.UTC(year, month, day, hour - BALI_OFFSET_HOURS, minute)
  );
}

/**
 * Given a UTC Date, return its date components in Bali local time.
 * Returns { year, month (0-indexed), day, dayOfWeek }.
 */
function utcToBaliComponents(utcDate) {
  const baliMs = utcDate.getTime() + BALI_OFFSET_HOURS * 3_600_000;
  const d = new Date(baliMs);
  return {
    year:       d.getUTCFullYear(),
    month:      d.getUTCMonth(),
    day:        d.getUTCDate(),
    dayOfWeek:  d.getUTCDay(),
  };
}

// ─── Slot generation ──────────────────────────────────────────────────────────

/**
 * Returns an array of all possible slots starting from `fromUtc` (defaults to now).
 * Each slot is { start: ISO string, end: ISO string }.
 *
 * Slots at least 2 hours in the future are included (prevent same-day booking).
 */
export function generatePossibleSlots(fromUtc = new Date()) {
  const slots = [];

  // Minimum booking time: 2 hours from now, rounded up to next slot boundary
  const minTime = new Date(fromUtc.getTime() + 2 * 3_600_000);
  const roundedMin = new Date(
    Math.ceil(minTime.getTime() / (SLOT_DURATION_MINS * 60_000)) * (SLOT_DURATION_MINS * 60_000)
  );

  const maxTime = new Date(fromUtc.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  // Start iterating from the beginning of today in Bali time
  const todayBali = utcToBaliComponents(fromUtc);
  let cursor = baliToUtc(todayBali.year, todayBali.month, todayBali.day, 0, 0);

  while (cursor < maxTime) {
    const bali = utcToBaliComponents(cursor);
    const periods = WORKING_HOURS_BALI[bali.dayOfWeek];

    if (periods) {
      for (const { s, e } of periods) {
        const periodStart = baliToUtc(bali.year, bali.month, bali.day, s[0], s[1]);
        const periodEnd   = baliToUtc(bali.year, bali.month, bali.day, e[0], e[1]);

        let slotStart = new Date(periodStart);
        while (slotStart < periodEnd) {
          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINS * 60_000);
          if (slotEnd <= periodEnd && slotStart >= roundedMin) {
            slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
          }
          slotStart = new Date(slotStart.getTime() + SLOT_DURATION_MINS * 60_000);
        }
      }
    }

    // Advance to next Bali calendar day
    cursor = baliToUtc(bali.year, bali.month, bali.day + 1, 0, 0);
  }

  return slots;
}

// ─── Conflict filtering ───────────────────────────────────────────────────────

/**
 * Given a list of possible slots and a list of busy periods from Google Calendar,
 * returns only the slots that don't overlap with any busy period.
 *
 * busyPeriods: [{ start: ISO, end: ISO }, ...]
 */
export function filterAvailableSlots(possibleSlots, busyPeriods) {
  return possibleSlots.filter(slot => {
    const slotStart = new Date(slot.start).getTime();
    const slotEnd   = new Date(slot.end).getTime();

    return !busyPeriods.some(busy => {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd   = new Date(busy.end).getTime();
      // Overlap: slot starts before busy ends AND slot ends after busy starts
      return slotStart < busyEnd && slotEnd > busyStart;
    });
  });
}
