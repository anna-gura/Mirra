import { t, plural } from "../../locales/t.js";
import { Zone } from "../../domain/calendar/Zone.js";
import { Duration } from "../../domain/values/Duration.js";

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
  #pick = {};
  #gapMode = "on";
  #gapMinutes = 0;
  #onPickInput;

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

    const find = name => this.#root.querySelector(`[data-pick-${name}]`);

    this.#pick = {
      box:  this.#root.querySelector("[data-pick]"),
      who:  find("for"),
      from: find("from"),
      to:   find("to"),
      line: find("line"),
    };

    /* The line under the fields is the explanation. Typing with it in
       view is what makes "з проміжком" mean anything. */
    this.#onPickInput = () => this.#drawPickLine();
    this.#pick.from?.addEventListener("input", this.#onPickInput);
    this.#pick.to?.addEventListener("input", this.#onPickInput);

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
  show({ date, cards, counts, today = false, picking = null }) {
    const language = document.documentElement.lang || "uk";

    if (this.#title) this.#title.textContent = Zone.label(date, language);
    if (this.#count) this.#count.textContent = CalendarDayView.#countText(counts);
    if (this.#count) this.#count.dataset.state = counts?.state ?? "";
    this.#count?.toggleAttribute("data-beyond", Boolean(counts?.beyond));

    this.#root?.toggleAttribute("data-today", today);
    this.#showPicking(picking);

    if (this.#host) {
      this.#host.replaceChildren(...cards.map(card => this.#card(card, language)));
    }

    /* A fresh day starts at its top. Keeping the scroll position
       would land somebody in the middle of Tuesday after looking at
       the end of Monday. */
    if (this.#scroller) this.#scroller.scrollTop = 0;

    return this;
  }

  /**
   * The hour being chosen, as typed.
   *
   * @returns {{from: number, to: number, withGap: boolean}|null}
   */
  get picked() {
    const from = CalendarDayView.#minutes(this.#pick.from?.value);
    const to = CalendarDayView.#minutes(this.#pick.to?.value);

    if (from === null || to === null) return null;

    return { from, to, withGap: this.#gapMode === "on" };
  }

  /**
   * Switches what the two times mean.
   *
   * @param {"on"|"off"} mode
   */
  setGapMode(mode) {
    this.#gapMode = mode === "off" ? "off" : "on";

    for (const button of this.#root?.querySelectorAll("[data-pick-gap]") ?? []) {
      button.setAttribute("aria-pressed", String(button.dataset.pickGap === this.#gapMode));
    }

    this.#drawPickLine();
    return this;
  }

  /** Says a request is in flight, without blanking what is on screen. */
  busy(flag) {
    this.#root?.toggleAttribute("data-busy", flag);
    return this;
  }

  /* ---------------- choosing an hour ---------------- */

  /**
   * @param {object|null} picking
   * @param {string} [picking.name] who the time is being chosen for
   * @param {number} [picking.from] minutes
   * @param {number} [picking.to]   minutes, gap included
   * @param {number} [picking.gap]  minutes held after a visit
   */
  #showPicking(picking) {
    const box = this.#pick.box;
    this.#root?.toggleAttribute("data-picking", Boolean(picking));

    if (box) box.hidden = !picking;
    if (!picking) return;

    this.#gapMinutes = Number(picking.gap) || 0;

    if (this.#pick.who) {
      this.#pick.who.textContent = picking.name
        ? t("Обираємо час для: {}", picking.name)
        : t("Обираємо час");
    }

    if (this.#pick.from) this.#pick.from.value = CalendarDayView.#hhmm(picking.from);
    if (this.#pick.to) this.#pick.to.value = CalendarDayView.#hhmm(picking.to);

    this.setGapMode(this.#gapMode);
  }

  /**
   * What the two numbers above actually mean, in words.
   *
   * Both halves are shown at once — when the client leaves and when
   * the next one could arrive — because the difference between them
   * is the whole of what the switch does, and a switch whose effect
   * is invisible is a switch nobody dares touch.
   */
  #drawPickLine() {
    const line = this.#pick.line;
    if (!line) return;

    const picked = this.picked;
    const language = document.documentElement.lang || "uk";

    if (!picked) {
      line.textContent = t("Вкажіть початок і кінець.");
      return;
    }

    const visitEnd = picked.withGap ? picked.to - this.#gapMinutes : picked.to;
    const nextAt = picked.withGap ? picked.to : picked.to + this.#gapMinutes;

    if (visitEnd <= picked.from) {
      line.textContent = t("Кінець має бути пізніше за початок.");
      return;
    }

    line.textContent = t("візит {}–{} · наступний клієнт о {}",
      Zone.clock(picked.from, language),
      Zone.clock(visitEnd, language),
      Zone.clock(nextAt, language));
  }

  /** @param {number} minutes @returns {string} "09:05" for an input */
  static #hhmm(minutes) {
    const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(Number(minutes) || 0)));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  /** @param {string} value @returns {number|null} */
  static #minutes(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ""));
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
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
    button.className = "cday-edge";
    button.dataset.bookEdge = card.at;

    const plus = document.createElement("span");
    plus.className = "cday-plus";
    plus.textContent = "+";

    const label = document.createElement("span");
    label.textContent = card.at === "before" ? t("записати раніше") : t("записати пізніше");

    button.append(plus, label);
    return button;
  }

  static #now() {
    const line = document.createElement("div");
    line.className = "cday-now";

    const label = document.createElement("span");
    label.textContent = t("зараз");

    line.append(label);
    return line;
  }

  /** A day off with nothing in it: one offer, no hours attached. */
  static #open() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cday-card cday-open";
    button.dataset.bookEdge = "open";

    const name = document.createElement("span");
    name.className = "cday-name";
    name.textContent = t("Записати клієнта");

    const sub = document.createElement("span");
    sub.className = "cday-sub";
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
    button.className = "cday-card cday-slot";
    button.dataset.fit = card.fit;
    button.dataset.book = String(card.from);
    button.dataset.until = String(card.to);
    button.dataset.block = String(card.block ?? card.to);
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
    plus.className = "cday-plus";
    plus.textContent = "+";
    button.append(plus);

    /* Wrapped in a row only when there is something to stand beside
       it. A wrapper around every card is one more box for the layout
       to have an opinion about, and it showed: the slots sat further
       apart than the cards that had none. */
    if (!card.align) return button;

    const row = document.createElement("div");
    row.className = "cday-row";
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
    align.className = "cday-align";
    align.dataset.align = String(card.align);
    align.dataset.alignAt = String(card.from);
    align.setAttribute("aria-label", t("Додати перерву на {} хв", card.align));

    const minutes = document.createElement("span");
    minutes.className = "cday-align-n";
    minutes.textContent = `${card.align}`;

    const unit = document.createElement("span");
    unit.className = "cday-align-u";
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
    button.className = "cday-card cday-gap";
    button.dataset.book = String(card.from);
    button.dataset.until = String(card.to);
    button.dataset.block = String(card.block ?? card.to);
    if (card.past) button.dataset.past = "";

    const plus = document.createElement("span");
    plus.className = "cday-plus";
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
    button.className = "cday-card cday-break";
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
    button.className = "cday-card cday-visit";
    button.dataset.event = card.id;
    if (card.notch) button.dataset.notch = card.notch;
    if (card.past) button.dataset.past = "";

    const name = document.createElement("span");
    name.className = "cday-name";
    name.textContent = card.title || t("Без імені");

    button.append(
      CalendarDayView.#time(card.from, card.to, language),
      CalendarDayView.#sub(CalendarDayView.#visitLength(card)),
      name,
    );

    return button;
  }

  /**
   * How long an appointment holds the day: the visit, and the gap
   * after it when there is one.
   *
   * Both on one line rather than the visit here and the gap on a
   * strip of its own below the card. The strip said "проміжок 10
   * хв · до 16:00" — and the card underneath it already began at
   * 16:00, so half of it was repeating the next line of the screen
   * and the other half fitted on this one. A day of six clients was
   * drawn as twelve things.
   *
   * The range above still ends when the client leaves, because that
   * is the time anybody says out loud.
   */
  static #visitLength(card) {
    const length = CalendarDayView.#length(card.to - card.from);
    if (!card.after) return length;

    return t("{} + проміжок {}", length, Duration.words(card.after));
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
    box.className = "cday-card cday-clash";

    const head = document.createElement("span");
    head.className = "cday-name";
    head.textContent = t("Два записи на один час");
    box.append(head);

    for (const event of card.events ?? []) {
      const line = document.createElement("span");
      line.className = "cday-clash-line";
      line.textContent = `${Zone.clock(event.from, language)}–${Zone.clock(event.to, language)} · `
        + (event.title || t("Без імені"));
      box.append(line);
    }

    return box;
  }

  /* ---------------- pieces ---------------- */

  static #time(from, to, language) {
    const span = document.createElement("span");
    span.className = "cday-time";
    span.textContent = `${Zone.clock(from, language)}–${Zone.clock(to, language)}`;
    return span;
  }

  static #sub(text) {
    const span = document.createElement("span");
    span.className = "cday-sub";
    span.textContent = text;
    return span;
  }

  /**
   * The length of a card, and what is worth saying about it.
   *
   * The words themselves come from Duration, which the booking form
   * uses as well: the same visit is written the same way wherever it
   * is shown.
   */
  static #length(minutes, fit = "full") {
    const length = Duration.words(minutes);

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
