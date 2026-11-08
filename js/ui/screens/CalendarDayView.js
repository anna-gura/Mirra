import { t, plural } from "../../locales/t.js";
import { Zone } from "../../domain/calendar/Zone.js";

/**
 * CalendarDayView — one day, drawn from a plan it did not make.
 *
 * Every decision about what the day holds was taken in DayPlan: which
 * slots exist, which of them are worth offering, where a clash is,
 * what is already over. This file turns that list into cards and
 * knows nothing else — no arithmetic about time, no idea what a gap
 * is for. When the two are mixed, the rules end up in two places and
 * the screen starts disagreeing with the counter above it.
 *
 * The cards are all one size. A two-hour visit and a half-hour one
 * look the same here, and the time on them says the difference. That
 * is a trade: proportional heights make a day readable at a glance on
 * a wide screen, and unreadable on a phone, where half the visits
 * would be thinner than a thumb.
 */
export class CalendarDayView {
  #root;
  #title;
  #count;
  #host;
  #scroller;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="calendar-day"]' } = {}) {
    this.#root = document.querySelector(selector);
  }

  init() {
    if (!this.#root) return this;

    this.#title = this.#root.querySelector("[data-day-title]");
    this.#count = this.#root.querySelector("[data-day-count]");
    this.#host = this.#root.querySelector("[data-day-cards]");
    this.#scroller = this.#root.querySelector("[data-scroll]");

    return this;
  }

  /**
   * Draws a day.
   *
   * @param {object} day
   * @param {string} day.date "YYYY-MM-DD"
   * @param {object[]} day.cards from DayPlan
   * @param {object} day.counts from DayPlan
   * @param {boolean} [day.today] whether this is the day it is now
   */
  show({ date, cards, counts, today = false }) {
    const language = document.documentElement.lang || "uk";

    if (this.#title) this.#title.textContent = Zone.label(date, language);
    if (this.#count) this.#count.textContent = CalendarDayView.#countText(counts);
    if (this.#count) this.#count.dataset.state = counts?.state ?? "";

    this.#root?.toggleAttribute("data-today", today);

    if (this.#host) {
      this.#host.replaceChildren(...cards.map(card => this.#card(card, language)));
    }

    /* A fresh day starts at its top. Keeping the scroll position
       would land somebody in the middle of Tuesday after looking at
       the end of Monday. */
    if (this.#scroller) this.#scroller.scrollTop = 0;

    return this;
  }

  /** Says a request is in flight, without blanking what is on screen. */
  busy(flag) {
    this.#root?.toggleAttribute("data-busy", flag);
    return this;
  }

  /* ---------------- cards ---------------- */

  #card(card, language) {
    switch (card.kind) {
      case "edge":  return CalendarDayView.#edge(card);
      case "now":   return CalendarDayView.#now();
      case "open":  return CalendarDayView.#open();
      case "slot":  return CalendarDayView.#slot(card, language);
      case "gap":   return CalendarDayView.#gap(card, language);
      case "break": return CalendarDayView.#brk(card, language);
      case "clash": return CalendarDayView.#clash(card, language);
      default:      return CalendarDayView.#visit(card, language);
    }
  }

  /**
   * The thin plus above and below the day.
   *
   * Deliberately not a card: these are for the exception — coming in
   * an hour early because somebody asked — and giving them the weight
   * of an offer would make every day look like it starts two hours
   * before it does.
   */
  static #edge(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-edge";
    button.dataset.bookEdge = card.at;

    const plus = document.createElement("span");
    plus.className = "cd-plus";
    plus.textContent = "+";

    const label = document.createElement("span");
    label.textContent = card.at === "before" ? t("записати раніше") : t("записати пізніше");

    button.append(plus, label);
    return button;
  }

  static #now() {
    const line = document.createElement("div");
    line.className = "cd-now";

    const label = document.createElement("span");
    label.textContent = t("зараз");

    line.append(label);
    return line;
  }

  /** A day off with nothing in it: one offer, no hours attached. */
  static #open() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-card cd-open";
    button.dataset.bookEdge = "open";

    const name = document.createElement("span");
    name.className = "cd-name";
    name.textContent = t("Записати");

    const sub = document.createElement("span");
    sub.className = "cd-sub";
    sub.textContent = t("Цей день не робочий");

    button.append(name, sub);
    return button;
  }

  /**
   * A free slot, and — when the day has drifted off the hour — the
   * small square beside it that offers to straighten it out.
   */
  static #slot(card, language) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-card cd-slot";
    button.dataset.fit = card.fit;
    button.dataset.book = String(card.from);
    button.dataset.until = String(card.to);
    if (card.past) button.dataset.past = "";

    /* Both lines measure the same stretch of the day. Showing the
       visit alone under an interval that includes the gap reads as
       ten minutes going missing somewhere. */
    const block = card.block ?? card.to;

    button.append(
      CalendarDayView.#time(card.from, block, language),
      CalendarDayView.#sub(CalendarDayView.#length(block - card.from, card.fit)),
    );

    const plus = document.createElement("span");
    plus.className = "cd-plus";
    plus.textContent = "+";
    button.append(plus);

    /* Wrapped in a row only when there is something to stand beside
       it. A wrapper around every card is one more box for the layout
       to have an opinion about, and it showed: the slots sat further
       apart than the cards that had none. */
    if (!card.align) return button;

    const row = document.createElement("div");
    row.className = "cd-row";
    row.append(button, CalendarDayView.#alignButton(card));

    return row;
  }

  /**
   * The small square that offers to put the day back on the hour
   * after a visit that finished early.
   */
  static #alignButton(card) {
    const align = document.createElement("button");
    align.type = "button";
    align.className = "cd-align";
    align.dataset.align = String(card.align);
    align.dataset.alignAt = String(card.from);
    align.setAttribute("aria-label", t("Додати перерву на {} хв", card.align));

    const minutes = document.createElement("span");
    minutes.className = "cd-align-n";
    minutes.textContent = `${card.align}`;

    const unit = document.createElement("span");
    unit.className = "cd-align-u";
    unit.textContent = t("хв");

    align.append(minutes, unit);
    return align;
  }

  /**
   * Free time that is shorter than a visit.
   *
   * Offered anyway, with a plus like any other: the person knows
   * their own work, and a fringe or a touch-up fits where a full
   * appointment does not. What it does not do is count towards the
   * day's free slots, so the number above stays honest.
   */
  static #gap(card, language) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-card cd-gap";
    button.dataset.book = String(card.from);
    button.dataset.until = String(card.to);
    if (card.past) button.dataset.past = "";

    const plus = document.createElement("span");
    plus.className = "cd-plus";
    plus.textContent = "+";

    button.append(
      CalendarDayView.#time(card.from, card.to, language),
      CalendarDayView.#sub(t("{} · замало для звичайного візиту",
        CalendarDayView.#length((card.block ?? card.to) - card.from))),
      plus,
    );

    return button;
  }

  /** A break somebody put there on purpose. */
  static #brk(card, language) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-card cd-break";
    button.dataset.event = card.id;
    if (card.past) button.dataset.past = "";

    button.append(
      CalendarDayView.#time(card.from, card.to, language),
      CalendarDayView.#sub(t("Перерва")),
    );

    return button;
  }

  static #visit(card, language) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cd-card cd-visit";
    button.dataset.event = card.id;
    if (card.notch) button.dataset.notch = card.notch;
    if (card.past) button.dataset.past = "";

    const name = document.createElement("span");
    name.className = "cd-name";
    name.textContent = card.title || t("Без імені");

    button.append(
      CalendarDayView.#time(card.from, card.to, language),
      CalendarDayView.#sub(CalendarDayView.#length(card.to - card.from)),
      name,
    );

    if (!card.after) return button;

    /* The card and its tail travel together, so the strip cannot end
       up beside the wrong appointment when the list is rebuilt. */
    const both = document.createDocumentFragment();
    both.append(button, CalendarDayView.#after(card, language));
    return both;
  }

  /**
   * The strip of time that belongs to the visit above it.
   *
   * Not a card of its own: nothing happens in it that anybody books,
   * and giving it the weight of a card would make a day of six
   * clients look like a day of twelve things.
   */
  static #after(card, language) {
    const strip = document.createElement("div");
    strip.className = "cd-after";
    if (card.past) strip.dataset.past = "";

    strip.textContent = t("проміжок {} · до {}",
      CalendarDayView.#length(card.after),
      Zone.clock(card.to + card.after, language));

    return strip;
  }

  /**
   * Two appointments in one hour, said plainly.
   *
   * Red, which nothing else on this screen is: a full day is not a
   * problem and should never be coloured like one, so the colour is
   * free to mean the thing that actually is.
   */
  static #clash(card, language) {
    const box = document.createElement("div");
    box.className = "cd-card cd-clash";

    const head = document.createElement("span");
    head.className = "cd-name";
    head.textContent = t("Два записи на один час");
    box.append(head);

    for (const event of card.events ?? []) {
      const line = document.createElement("span");
      line.className = "cd-clash-line";
      line.textContent = `${Zone.clock(event.from, language)}–${Zone.clock(event.to, language)} · `
        + (event.title || t("Без імені"));
      box.append(line);
    }

    return box;
  }

  /* ---------------- pieces ---------------- */

  static #time(from, to, language) {
    const span = document.createElement("span");
    span.className = "cd-time";
    span.textContent = `${Zone.clock(from, language)}–${Zone.clock(to, language)}`;
    return span;
  }

  static #sub(text) {
    const span = document.createElement("span");
    span.className = "cd-sub";
    span.textContent = text;
    return span;
  }

  /**
   * "1 год 50 хв" rather than "110 хв".
   *
   * Minutes are what the arithmetic runs on and hours are what people
   * keep in their heads; past an hour or so, a number of minutes has
   * to be divided before it means anything.
   */
  static #length(minutes, fit = "full") {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    const length = hours === 0
      ? t("{} хв", rest)
      : rest === 0 ? t("{} год", hours) : t("{} год {} хв", hours, rest);

    return fit === "tight" ? `${length} · ${t("менше звичайного")}` : length;
  }

  /**
   * "5 з 7", or a plain count when the day holds more than it was
   * planned for.
   */
  static #countText(counts) {
    if (!counts) return "";
    if (counts.state === "rest" && counts.booked === 0) return t("Вихідний");

    return counts.fraction
      ? t("{} з {}", counts.booked, counts.capacity)
      : t("{} {}", counts.booked, plural(counts.booked, ["візит", "візити", "візитів"]));
  }
}
