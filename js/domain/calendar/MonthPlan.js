import { Zone } from "./Zone.js";
import { DayPlan } from "./DayPlan.js";

/**
 * MonthPlan — a month as the grid of squares people recognise.
 *
 * Nothing new is decided here. Every square is one day run through
 * DayPlan, which is the only thing in the calendar that knows what a
 * free slot is — so the number in a square and the cards inside that
 * day can never disagree, however the rules change later.
 *
 * What this adds is the shape of a month: which square the first
 * falls in, how many rows that needs, and which day the week starts
 * on. That last one is not a detail. A Ukrainian calendar starts on
 * Monday, an American one on Sunday, and a grid that starts on the
 * wrong day is misread at a glance by everybody who looks at it.
 */
export class MonthPlan {
  /**
   * @param {object} input
   * @param {string} input.month "YYYY-MM"
   * @param {string} input.zone  the calendar's own time zone
   * @param {object} input.setup duration, gap, days, from, to
   * @param {object[]} [input.events] everything Google returned for the
   *        whole visible grid, untouched
   * @param {number} [input.weekStart] Google's own numbering: 0 Sunday,
   *        1 Monday, 6 Saturday
   * @param {string|null} [input.today] today's date in the calendar's
   *        zone, when the month being drawn contains it
   * @param {number|null} [input.now] minutes from midnight, for today
   * @param {string[]} [input.extra] dates made working one time only
   * @returns {{month: string, order: number[], weeks: object[][]}}
   */
  static of({ month, zone, setup, events = [], weekStart = 1, today = null, now = null, extra = [] }) {
    const first = `${month}-01`;
    const days = MonthPlan.#length(month);

    const order = MonthPlan.#order(weekStart);

    /* How many days of the previous month sit in the first row before
       the first falls into place. */
    const lead = order.indexOf(Zone.weekday(first));
    const rows = Math.ceil((lead + days) / 7);

    const working = new Set(setup?.days ?? []);
    const once = new Set(extra);

    const weeks = [];

    for (let row = 0; row < rows; row += 1) {
      const week = [];

      for (let column = 0; column < 7; column += 1) {
        const date = Zone.shift(first, row * 7 + column - lead);
        const isToday = date === today;

        /* A day that has gone by keeps the colour of what happened
           in it — a quiet Tuesday stays the colour of a day with
           room, a full one the colour of a full day. Only the
           brightness goes, because nothing can be added to it now.
           Wiping it to grey would throw away the one thing a month
           is read for: where the busy weeks were. */
        const gone = Boolean(today) && date < today;

        const live = DayPlan.of({
          setup,
          events: MonthPlan.#on(date, events, zone),
          working: working.has(Zone.weekday(date)) || once.has(date),
          now: isToday ? now : null,
        });

        /* "over" means today has no hours left in it. For the grid
           that is the same thing as a day gone by: show what the day
           held, quietly. */
        const over = live.counts.state === "over";

        const counts = over
          ? { ...live.counts, state: MonthPlan.#load(live.counts) }
          : live.counts;

        week.push({
          date,
          day: Number(date.slice(8)),
          weekday: Zone.weekday(date),
          inMonth: date.startsWith(`${month}-`),
          today: isToday,
          past: gone || over,
          counts,
        });
      }

      weeks.push(week);
    }

    return { month, order, weeks };
  }

  /**
   * The first and last dates the grid will show.
   *
   * Asked before the events are fetched, so one request covers the
   * whole screen — including the few days of the months either side,
   * which carry their own numbers and would otherwise be the only
   * squares that lie.
   *
   * @param {string} month "YYYY-MM"
   * @param {number} [weekStart]
   * @returns {{first: string, last: string}}
   */
  static range(month, weekStart = 1) {
    const first = `${month}-01`;
    const order = MonthPlan.#order(weekStart);
    const lead = order.indexOf(Zone.weekday(first));
    const rows = Math.ceil((lead + MonthPlan.#length(month)) / 7);

    return {
      first: Zone.shift(first, -lead),
      last: Zone.shift(first, rows * 7 - lead - 1),
    };
  }

  /* ---------------- private ---------------- */

  /**
   * What a finished day looked like, in one word.
   *
   * Asked only of days with no hours left, where "free" and "full"
   * can no longer mean "there is room" and "there is none" — here
   * they mean "there was room" and "there was none", which is what a
   * month is read for.
   */
  static #load(counts) {
    if (counts.capacity === 0) return "rest";
    return counts.booked >= counts.capacity ? "full" : "free";
  }

  /**
   * The seven weekday numbers in the order the columns run.
   *
   * ISO numbering throughout — 1 is Monday, 7 is Sunday — because
   * that is what the settings file uses for working days, and two
   * numbering schemes in one feature is how Sunday becomes Monday.
   */
  static #order(weekStart) {
    /* Google says 0 for Sunday; ISO says 7. */
    const start = weekStart === 0 ? 7 : weekStart === 6 ? 6 : 1;

    return Array.from({ length: 7 }, (_, index) => ((start - 1 + index) % 7) + 1);
  }

  /** @param {string} month "YYYY-MM" @returns {number} days in it */
  static #length(month) {
    const year = Number(month.slice(0, 4));
    const number = Number(month.slice(5, 7));

    /* Day zero of the next month is the last day of this one, and the
       rule for February answers for itself. */
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
  }

  /**
   * The events that fall on one date, in minutes from its midnight.
   *
   * An event is kept when it overlaps the day at all, so a visit that
   * runs past midnight is counted by both days it touches — which is
   * what somebody looking at either square expects to see.
   */
  static #on(date, events, zone) {
    const start = Zone.midnight(date, zone);
    const end = Zone.midnight(Zone.shift(date, 1), zone);

    const found = [];

    for (const event of events) {
      if (event.allDay) continue;

      const from = new Date(event.start).getTime();
      const to = new Date(event.end).getTime();
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      if (to <= start || from >= end) continue;

      found.push({
        id: event.id,
        title: event.title,
        kind: event.kind,
        allowOverlap: event.allowOverlap,
        from: Zone.minutesOn(event.start, date, zone),
        to: Zone.minutesOn(event.end, date, zone),
      });
    }

    return found;
  }
}
