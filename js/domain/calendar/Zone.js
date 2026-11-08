/**
 * Zone — the one place that knows whose midnight it is.
 *
 * Google answers in instants: 2026-11-07T14:30:00-05:00. A day,
 * though, is a civil thing — it starts when the clock on the wall says
 * midnight, in the time zone the calendar was set up with. Those two
 * ideas meet exactly here, and nowhere else: DayPlan works in minutes
 * from midnight, the screens work in those same minutes, and this file
 * is what turns one into the other.
 *
 * Kept separate because time zone arithmetic is where quiet, confident
 * mistakes live. The hour that happens twice in autumn and the hour
 * that never happens in spring are not edge cases to be handled later
 * — they happen to everybody twice a year, and a schedule that slips
 * by an hour on those days is a schedule nobody trusts afterwards.
 *
 * A date here is always the string "YYYY-MM-DD" — the calendar's own
 * date, not the device's. Somebody in Florida looking at a calendar
 * set to Kyiv is looking at a day that began seven hours before
 * theirs, and both of them should see the same appointments on it.
 */
export class Zone {
  /** Minutes in a day of ordinary length. */
  static DAY = 24 * 60;

  /**
   * The date it is right now, where the calendar lives.
   *
   * @param {string} zone IANA name
   * @param {Date} [at] the instant to ask about; now by default
   * @returns {string} "YYYY-MM-DD"
   */
  static today(zone, at = new Date()) {
    const parts = Zone.#parts(at.getTime(), zone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  /**
   * Minutes from midnight, right now, on that calendar's clock.
   *
   * @param {string} zone
   * @param {Date} [at]
   * @returns {number}
   */
  static nowMinutes(zone, at = new Date()) {
    const parts = Zone.#parts(at.getTime(), zone);
    return Number(parts.hour) * 60 + Number(parts.minute);
  }

  /**
   * The instant at which a date begins, and the one at which the next
   * one does — which is what Google's timeMin and timeMax want.
   *
   * @param {string} date "YYYY-MM-DD"
   * @param {string} zone
   * @returns {{from: string, to: string}} RFC3339 instants
   */
  static bounds(date, zone) {
    return {
      from: new Date(Zone.midnight(date, zone)).toISOString(),
      to: new Date(Zone.midnight(Zone.shift(date, 1), zone)).toISOString(),
    };
  }

  /**
   * Where an instant falls on a given day, in minutes from its
   * midnight.
   *
   * Clamped to the day on purpose: an appointment that starts at
   * eleven at night and ends after midnight is drawn as running to the
   * end of this day, and as starting at the beginning of the next.
   * Negative minutes would put it above the top of the screen, and
   * 1500 would put it past the bottom.
   *
   * @param {string|number|Date} instant
   * @param {string} date  the day being drawn
   * @param {string} zone
   * @returns {number|null} null when the instant is not a time at all
   */
  static minutesOn(instant, date, zone) {
    const ms = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
    if (!Number.isFinite(ms)) return null;

    const start = Zone.midnight(date, zone);
    const minutes = Math.round((ms - start) / 60000);

    return Math.max(0, Math.min(Zone.DAY, minutes));
  }

  /**
   * The instant of local midnight, in milliseconds.
   *
   * Two passes rather than one. The first guesses the offset by asking
   * what the zone was doing at the same wall time in UTC; the second
   * asks again at the instant that guess produced. The two differ only
   * around a clock change, which is exactly where one pass gets it
   * wrong — and the day the clocks go forward is a day somebody has
   * appointments.
   *
   * @param {string} date "YYYY-MM-DD"
   * @param {string} zone
   * @returns {number}
   */
  static midnight(date, zone) {
    const [year, month, day] = Zone.#split(date);
    const wall = Date.UTC(year, month - 1, day);

    const first = wall - Zone.#offset(wall, zone) * 60000;
    return wall - Zone.#offset(first, zone) * 60000;
  }

  /**
   * The date some days before or after another one.
   *
   * Plain civil arithmetic with no zone in sight: the day after the
   * seventh is the eighth everywhere on earth, however many hours that
   * took.
   *
   * @param {string} date
   * @param {number} days
   * @returns {string}
   */
  static shift(date, days) {
    const [year, month, day] = Zone.#split(date);
    const moved = new Date(Date.UTC(year, month - 1, day + days));

    return Zone.#iso(moved);
  }

  /**
   * ISO weekday: 1 is Monday, 7 is Sunday — the same numbers the
   * settings file uses for working days.
   *
   * @param {string} date
   * @returns {number}
   */
  static weekday(date) {
    const [year, month, day] = Zone.#split(date);
    const sunday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return ((sunday + 6) % 7) + 1;
  }

  /**
   * The date as a person reads it: "субота, 7 листопада".
   *
   * Formatted in UTC from the civil date rather than from an instant,
   * so the name of the day cannot drift by one with the zone — the
   * date string already is the answer, and all that is wanted here is
   * the language's way of saying it.
   *
   * @param {string} date
   * @param {string} language
   * @param {Intl.DateTimeFormatOptions} [options]
   * @returns {string}
   */
  static label(date, language, options = { weekday: "long", day: "numeric", month: "long" }) {
    const [year, month, day] = Zone.#split(date);
    const when = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat(language || "uk", { ...options, timeZone: "UTC" }).format(when);
  }

  /**
   * An hour on the clock, in the language of the person reading it:
   * 14:30 in Kyiv, 2:30 PM in Florida.
   *
   * @param {number} minutes from midnight
   * @param {string} language
   * @returns {string}
   */
  static clock(minutes, language) {
    const safe = Math.max(0, Math.min(Zone.DAY - 1, Math.round(minutes)));
    const when = new Date(Date.UTC(1970, 0, 1, Math.floor(safe / 60), safe % 60));

    /* Padding follows the clock the language keeps. On a 24-hour
       clock "09:00" is how it is written and "9:00" looks unfinished;
       on a 12-hour one "09:00 AM" looks like a timetable at a station.
       The locale itself says which it is. */
    const locale = language || "uk";
    const half = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12;

    return new Intl.DateTimeFormat(locale, {
      hour: half ? "numeric" : "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(when);
  }

  /**
   * Whether a time zone name is one this browser knows.
   *
   * @param {string} zone
   * @returns {boolean}
   */
  static known(zone) {
    if (!zone) return false;

    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }

  /* ---------------- private ---------------- */

  /**
   * How far ahead of UTC a zone was at a given instant, in minutes.
   *
   * Done by formatting the instant in that zone and reading the clock
   * back. There is no API that answers this directly, and the usual
   * shortcut — subtracting two Date objects — gets the clock changes
   * wrong in both directions.
   */
  static #offset(ms, zone) {
    const parts = Zone.#parts(ms, zone);

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );

    return Math.round((asUtc - ms) / 60000);
  }

  /** @returns {Record<string, string>} the clock in that zone, as digits */
  static #parts(ms, zone) {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: Zone.known(zone) ? zone : "UTC",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = {};
    for (const part of format.formatToParts(new Date(ms))) {
      if (part.type !== "literal") parts[part.type] = part.value;
    }

    return parts;
  }

  /** @param {string} date @returns {number[]} */
  static #split(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
    if (!match) {
      const today = new Date();
      return [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  /** @param {Date} date @returns {string} */
  static #iso(date) {
    const year = String(date.getUTCFullYear()).padStart(4, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
}
