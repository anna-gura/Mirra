/**
 * DayPlan — one day, turned into the row of cards a person reads.
 *
 * Everything the calendar shows comes from here: the day itself, the
 * counters in the week and the month, the colour of a square in the
 * grid. Three views, one piece of arithmetic — which is why this file
 * knows nothing about the DOM, about Google, or about where the
 * numbers came from. It takes the working day as settings describe
 * it, the appointments as they actually are, and returns a list.
 *
 * Minutes from midnight throughout, in the calendar's own time zone.
 * No Date objects: a day that starts at 09:00 in Kyiv and a day that
 * starts at 09:00 in Florida are the same arithmetic, and the moment
 * a timestamp enters this file somebody has to decide whose midnight
 * it is. That decision belongs one layer up, where the time zone is
 * known, and it is made once rather than in every comparison here.
 *
 * The shape of the day
 * --------------------
 * Slots are not a grid laid over the day. They are chained from what
 * is already booked: a visit that ends at 14:30 makes the next slot
 * start at 14:30, not at the hour the grid would have preferred. A
 * schedule that pretends otherwise sends somebody to wait half an
 * hour for a chair that is free.
 *
 * Free time is filled from whichever side touches an appointment, so
 * the offered slot sits against the previous client rather than
 * leaving an awkward sliver next to them. Before the first
 * appointment of the day that means filling backwards; everywhere
 * else, forwards.
 *
 * What is left over at the far end is measured against one visit:
 * nine tenths or more and it is offered as a slot, three quarters and
 * up it is offered as a tight one, below that it is a break and
 * nobody is invited to squeeze a client into it.
 */
export class DayPlan {
  /** A leftover this long, measured in visits, is a slot like any other. */
  static FULL = 0.9;

  /** Below this, free time stops being an offer and becomes a break. */
  static TIGHT = 0.75;

  /**
   * How much two appointments may overlap before it is called a clash.
   *
   * A few minutes nearly always means the earlier visit ran over and
   * nobody went back to shorten it — worth drawing honestly, not
   * worth a red card. A third of a visit means two people were given
   * the same hour, and that is worth stopping for.
   */
  static CLASH = 0.25;

  /** Below this, offering to even out the day is noise. */
  static ALIGN_MIN = 10;

  /**
   * @typedef {object} DayEvent
   * @property {string} id
   * @property {number} from  minutes from midnight
   * @property {number} to    minutes from midnight
   * @property {string} [title]
   * @property {"visit"|"break"} [kind]
   * @property {boolean} [allowOverlap] the person was warned and said
   *           to keep it anyway
   */

  /**
   * @param {object} input
   * @param {DayEvent[]} [input.events] everything on the calendar that day
   * @param {object} input.setup  duration, gap, from, to — from settings
   * @param {boolean} input.working whether this date is a working day,
   *        the one-off exceptions already applied by the caller
   * @param {number|null} [input.now] minutes from midnight, when the
   *        day being planned is today; null on any other day
   * @returns {{cards: object[], counts: object}}
   */
  static of({ events = [], setup, working, now = null }) {
    const duration = DayPlan.#positive(setup?.duration, 60);
    const gap = DayPlan.#whole(setup?.gap, 15);
    const step = duration + gap;

    const open = DayPlan.#minutes(setup?.from, 9 * 60);
    const close = DayPlan.#minutes(setup?.to, 18 * 60);

    const busy = DayPlan.#clean(events);
    const clusters = DayPlan.#cluster(busy);

    const cards = working
      ? DayPlan.#workingDay({ clusters, open, close, duration, gap, step })
      : DayPlan.#restDay({ clusters, duration });

    DayPlan.#markPast(cards, now);

    return {
      cards: DayPlan.#withEdges(cards, now),
      counts: DayPlan.#counts({ cards, busy, working, open, close, step, duration, gap }),
    };
  }

  /* ---------------- the two kinds of day ---------------- */

  /**
   * A working day: slots everywhere the appointments leave room.
   *
   * The day's own hours are only the frame. An appointment that falls
   * outside them is still drawn — somebody who came in at eight is a
   * fact, not a setting — and the free time around it is treated the
   * same way as any other, so an early start does not leave a hole
   * nothing can be booked into.
   */
  static #workingDay({ clusters, open, close, duration, gap, step }) {
    const first = clusters[0]?.from ?? null;
    const last = clusters.at(-1)?.to ?? null;

    /* The frame stretches to hold whatever is already booked. */
    const start = first === null ? open : Math.min(open, first);
    const end = last === null ? close : Math.max(close, last);

    const cards = [];
    let cursor = start;

    for (const cluster of clusters) {
      if (cluster.from > cursor) {
        /* Free time before an appointment is filled from the
           appointment backwards, so the slot it offers sits against
           the client who is already coming. */
        const anchored = cards.length === 0 ? "end" : "start";
        cards.push(...DayPlan.#fill(cursor, cluster.from, { duration, gap, step, anchored }));
      }

      cards.push(...DayPlan.#cards(cluster));

      /* The time after a visit is part of that visit's hold on the
         day: nobody else can be in the chair during it. Carried on
         the card so the screen can show it as the tail of the
         appointment rather than as a mysterious hole. */
      if (gap > 0 && cards.at(-1).kind === "visit") cards.at(-1).after = gap;

      cursor = cluster.to + gap;

      /* An appointment that finished early leaves the rest of the day
         shifted off the hour. The next card carries the offer to even
         it out — one card, the one directly below, because an offer
         repeated down the whole day is noise. */
      const short = DayPlan.#shortfall(cluster, duration);
      if (short >= DayPlan.ALIGN_MIN) cards.at(-1).alignAfter = short;
    }

    if (cursor < end) {
      cards.push(...DayPlan.#fill(cursor, end, { duration, gap, step, anchored: "start" }));
    }

    DayPlan.#carryAlign(cards);
    return cards;
  }

  /**
   * A day off, with something already in it.
   *
   * No slots are offered: a day somebody marked as not working should
   * not fill with invitations because one client talked them into
   * coming. What is booked is drawn, and the thin pluses above and
   * below are enough to add another if the day turns into a working
   * one after all.
   */
  static #restDay({ clusters, duration }) {
    if (clusters.length === 0) {
      return [{ kind: "open", duration }];
    }

    const cards = [];
    for (const cluster of clusters) cards.push(...DayPlan.#cards(cluster));
    return cards;
  }

  /* ---------------- free time ---------------- */

  /**
   * Turns one free stretch into slots.
   *
   * Whole slots first, from whichever end the caller anchored to, and
   * then whatever remains is judged once against a single visit. The
   * leftover is where the thresholds live: everything before it is a
   * slot by definition, since a visit fits in it with room for the
   * gap that follows.
   *
   * @param {number} from
   * @param {number} to
   * @param {object} options
   * @param {"start"|"end"} options.anchored which end the slots are
   *        measured from — the end that touches an appointment
   */
  static #fill(from, to, { duration, gap, step, anchored }) {
    const room = to - from;
    if (room <= 0) return [];

    /* How many whole visits fit, counting the gap that each one needs
       after it except the last. */
    const whole = Math.max(0, Math.floor((room + gap) / step));
    const used = whole === 0 ? 0 : whole * step - gap;
    const left = room - used;

    const slots = [];

    for (let n = 0; n < whole; n += 1) {
      const at = anchored === "start"
        ? from + n * step
        : to - (whole - n) * step + gap;

      /* Two times, because people hold two different ones in their
         head. `to` is when the client leaves, and it is what gets
         said out loud. `block` is when the next client could start,
         gap included, and it is what the day is actually divided
         into. Showing only one of them means either promising time
         that is spoken for, or naming an hour nobody would say. */
      slots.push({
        kind: "slot",
        from: at,
        to: at + duration,
        block: Math.min(at + step, to),
        fit: "full",
      });
    }

    if (left > 0) {
      /* The leftover sits at the far end from the anchor: against the
         start of the day when the slots were measured backwards from
         an appointment, and at the end of the stretch otherwise. */
      const edge = anchored === "start"
        ? { from: to - left, to }
        : { from, to: from + left };

      /* Measured against the visit alone. The gap matters between two
         clients; it has nothing to do with whether one more client
         fits before the day ends. */
      const share = left / duration;

      if (share >= DayPlan.FULL) {
        slots.push({ kind: "slot", ...edge, block: edge.to, fit: "full" });
      } else if (share >= DayPlan.TIGHT) {
        slots.push({ kind: "slot", ...edge, block: edge.to, fit: "tight" });
      } else {
        slots.push({ kind: "gap", ...edge });
      }
    }

    return slots.sort((a, b) => a.from - b.from);
  }

  /* ---------------- appointments ---------------- */

  /**
   * One cluster of appointments, as cards.
   *
   * Two that overlap by a little are drawn as two, each with a bite
   * taken out of it where the other one runs: the earlier visit
   * almost certainly ran over, and redrawing that as an error would
   * cry wolf several times a week. Two that overlap in earnest become
   * a single red card, because somebody has been given a time that is
   * already taken and no amount of careful drawing fixes that.
   */
  static #cards(cluster) {
    const { events } = cluster;

    if (events.length === 1) {
      return [{ kind: events[0].kind === "break" ? "break" : "visit", ...events[0] }];
    }

    if (DayPlan.#tolerable(events)) {
      return events.map((event, index) => ({
        kind: event.kind === "break" ? "break" : "visit",
        ...event,
        /* The bite is on the side where the neighbour is: the earlier
           card gives up its bottom corner, the later one its top. */
        notch: index === 0 ? "bottom" : index === events.length - 1 ? "top" : "both",
      }));
    }

    return [{
      kind: "clash",
      from: cluster.from,
      to: cluster.to,
      events: events.map(event => ({ ...event })),
    }];
  }

  /**
   * Whether an overlap is small enough to draw rather than report.
   *
   * Measured against the shorter of the two: half an hour taken out of
   * a half-hour visit is the whole of it, and calling that a quarter
   * because the other visit was two hours long would be arithmetic
   * defending a mistake.
   */
  static #tolerable(events) {
    for (let i = 0; i < events.length - 1; i += 1) {
      for (let j = i + 1; j < events.length; j += 1) {
        const a = events[i];
        const b = events[j];

        const over = Math.min(a.to, b.to) - Math.max(a.from, b.from);
        if (over <= 0) continue;

        /* Said yes to it once already, with the clash in front of
           them. Asking again every time the day is drawn would train
           people to dismiss the question without reading it. */
        if (a.allowOverlap && b.allowOverlap) continue;

        const shorter = Math.min(a.to - a.from, b.to - b.from);
        if (shorter <= 0) continue;
        if (over / shorter > DayPlan.CLASH) return false;
      }
    }

    return true;
  }

  /**
   * How far short of a full visit this cluster stopped.
   *
   * Local arithmetic on purpose: the alternative is keeping an ideal
   * grid for the day and measuring drift against it, which breaks the
   * moment anything in the day moves. "This visit was half an hour
   * shorter than usual" is true however the day went before it.
   */
  static #shortfall(cluster, duration) {
    if (cluster.events.some(event => event.kind === "break")) return 0;
    if (cluster.events.length !== 1) return 0;

    const length = cluster.to - cluster.from;
    return length < duration ? duration - length : 0;
  }

  /**
   * Moves the offer onto the card below.
   *
   * #workingDay marks the appointment it belongs to, because that is
   * where the arithmetic is; the person needs it on the slot that
   * follows, which is the thing they would press.
   */
  static #carryAlign(cards) {
    for (let i = 0; i < cards.length; i += 1) {
      const minutes = cards[i].alignAfter;
      if (!minutes) continue;

      delete cards[i].alignAfter;

      const next = cards[i + 1];
      if (next && next.kind === "slot") next.align = minutes;
    }
  }

  /* ---------------- edges, now, counters ---------------- */

  /**
   * The thin pluses at the top and the bottom.
   *
   * Not slots: they carry no hours and no colour, because they are
   * for the exception — coming in an hour early for somebody who
   * asked nicely. A day with no cards at all still gets them, so a
   * day off is never a dead end.
   */
  static #withEdges(cards, now) {
    const before = { kind: "edge", at: "before" };
    const after = { kind: "edge", at: "after" };

    const out = [before, ...cards, after];

    if (now === null) return out;

    /* One divider rather than a line across the hours: without a
       ruler down the side, a line has nothing to point at. It goes
       where the day stops being history, which is what #markPast has
       just worked out — asking the question twice, in two different
       ways, is how the two answers drift apart. */
    const next = out.findIndex(card => card.from !== undefined && !card.past);
    if (next <= 0) return out;

    out.splice(next, 0, { kind: "now", at: now });
    return out;
  }

  /**
   * What has already gone by.
   *
   * An offer and a record of something that happened go past at
   * different moments. A visit is current until it ends — somebody is
   * in the chair. A slot is over the minute it begins: inviting
   * anyone to book half past eleven at noon is inviting them into
   * yesterday, and a plus sitting there is a plus that cannot be
   * pressed honestly.
   *
   * @param {object[]} cards
   * @param {number|null} now
   */
  static #markPast(cards, now) {
    if (now === null) return;

    for (const card of cards) {
      if (card.from === undefined) continue;

      const gone = card.kind === "slot" || card.kind === "gap"
        ? card.from < now
        : card.to <= now;

      if (gone) card.past = true;
    }
  }

  /**
   * The numbers under a square in the month, and the colour of it.
   *
   * The denominator is what the day could hold if nobody had booked
   * anything — a property of the schedule, not of the morning — so it
   * does not wobble as visits are added. When more visits are booked
   * than the schedule allows for, the fraction is dropped rather than
   * shown as 8/7: the day is busier than planned, which is a fact
   * about the day and not a failure of arithmetic.
   */
  static #counts({ cards, busy, working, open, close, step, duration, gap }) {
    const booked = busy.filter(event => event.kind !== "break").length;

    const room = Math.max(0, close - open);
    const capacity = working ? Math.max(0, Math.floor((room + gap) / step)) : 0;

    const slots = cards.filter(card => card.kind === "slot" && card.fit === "full");
    const free = slots.filter(card => !card.past).length;
    const clashes = cards.filter(card => card.kind === "clash").length;

    /* Evening on a half-empty day. Nothing can be booked, but nothing
       is full either, and painting it like a full day would tell
       somebody glancing at the month that Tuesday was busy when
       Tuesday was quiet. It gets no colour of its own — the day is
       simply behind us. */
    const over = slots.length > 0 && free === 0 && booked < capacity;

    return {
      booked,
      capacity,
      free,
      clashes,
      /* Four states, and none of them red for a full day: a day with
         every chair taken is a good day, not a problem. Red is kept
         for the one case that is actually wrong. A day off says so
         rather than reporting itself as full, which would paint half
         the month in the colour of a busy week. */
      state: clashes > 0 ? "clash"
        : !working ? "rest"
        : free > 0 ? "free"
        : over ? "over"
        : "full",
      /* Shown as "5/7" only while the fraction means something. */
      fraction: capacity > 0 && booked <= capacity,
    };
  }

  /* ---------------- tidying what comes in ---------------- */

  /**
   * Sorts, drops the impossible, and keeps only what a card needs.
   *
   * Google will return an event that starts and ends at the same
   * minute, and an all-day event has no minutes at all. Neither can be
   * drawn on a day, and letting either through turns into a division
   * by zero somewhere further down.
   */
  static #clean(events) {
    return events
      .filter(event => Number.isFinite(event?.from) && Number.isFinite(event?.to) && event.to > event.from)
      .map(event => ({
        id: event.id ?? "",
        from: Math.max(0, Math.round(event.from)),
        to: Math.min(24 * 60, Math.round(event.to)),
        title: event.title ?? "",
        kind: event.kind === "break" ? "break" : "visit",
        allowOverlap: event.allowOverlap === true,
      }))
      .sort((a, b) => a.from - b.from || a.to - b.to);
  }

  /**
   * Groups appointments that touch into one busy stretch.
   *
   * Slot arithmetic cares about occupied time, not about how many
   * people are in it; and overlapping visits have to be decided
   * together, since whether they are drawn as a clash depends on both.
   */
  static #cluster(events) {
    const clusters = [];

    for (const event of events) {
      const last = clusters.at(-1);

      if (last && event.from < last.to) {
        last.events.push(event);
        last.to = Math.max(last.to, event.to);
        continue;
      }

      clusters.push({ from: event.from, to: event.to, events: [event] });
    }

    return clusters;
  }

  /* ---------------- small readers ---------------- */

  /** @param {string} value "09:00" @param {number} fallback */
  static #minutes(value, fallback) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ""));
    if (!match) return fallback;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return fallback;

    return hours * 60 + minutes;
  }

  static #positive(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
  }

  static #whole(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
  }
}
