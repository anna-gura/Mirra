import { t, plural } from "../../locales/t.js";
import { Zone } from "../../domain/calendar/Zone.js";

/**
 * CalendarMonthView — the month as a grid of squares.
 *
 * Each square says two things: which day it is, and how full it is.
 * The second one is a fraction rather than dots or stripes, because
 * "5 of 7" answers the question somebody actually has — is there room
 * on Thursday — and three dots do not.
 *
 * Colour carries the same answer a second time, which is deliberate:
 * green for a day with room, amber for one that is full, red only for
 * a day with two people booked into the same hour. Nobody has to tell
 * the colours apart to use the screen, since the number is right
 * there; the colour is what makes a free Saturday visible without
 * reading thirty squares.
 */
export class CalendarMonthView {
  #root;
  #title;
  #weekdays;
  #grid;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="calendar-month"]' } = {}) {
    this.#root = document.querySelector(selector);
  }

  init() {
    if (!this.#root) return this;

    this.#title = this.#root.querySelector("[data-month-title]");
    this.#weekdays = this.#root.querySelector("[data-month-weekdays]");
    this.#grid = this.#root.querySelector("[data-month-grid]");

    return this;
  }

  /**
   * @param {object} plan
   * @param {string} plan.month "YYYY-MM"
   * @param {number[]} plan.order ISO weekday numbers, in column order
   * @param {object[][]} plan.weeks
   * @param {boolean} [plan.current] whether this month holds today
   */
  show({ month, order, weeks, current = false }) {
    const language = document.documentElement.lang || "uk";

    if (this.#title) {
      this.#title.textContent = Zone.label(`${month}-01`, language, { month: "long", year: "numeric" });
    }

    this.#root?.toggleAttribute("data-today", current);

    if (this.#weekdays) {
      this.#weekdays.replaceChildren(...order.map(iso => CalendarMonthView.#weekday(iso, language)));
    }

    if (this.#grid) {
      this.#grid.replaceChildren(...weeks.flat().map(cell => CalendarMonthView.#cell(cell, language)));
    }

    return this;
  }

  busy(flag) {
    this.#root?.toggleAttribute("data-busy", flag);
    return this;
  }

  /* ---------------- private ---------------- */

  /**
   * The short name of a weekday, from the browser rather than from a
   * list here: every language abbreviates differently, and Ukrainian
   * declines.
   */
  static #weekday(iso, language) {
    /* 5 January 1970 was a Monday, so day 4 + iso is the weekday
       wanted without any arithmetic about today. */
    const when = new Date(Date.UTC(1970, 0, 4 + iso));

    const span = document.createElement("span");
    span.className = "cm-wd";
    span.textContent = new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" })
      .format(when);

    return span;
  }

  static #cell(cell, language) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-day";
    button.dataset.date = cell.date;
    button.dataset.state = cell.counts?.state ?? "rest";

    if (!cell.inMonth) button.dataset.outside = "";
    if (cell.today) button.dataset.now = "";
    if (cell.past) button.dataset.past = "";

    button.setAttribute("aria-label", CalendarMonthView.#spoken(cell, language));

    const number = document.createElement("span");
    number.className = "cm-n";
    number.textContent = String(cell.day);

    button.append(number, CalendarMonthView.#load(cell));
    return button;
  }

  /**
   * The fraction under the number, or nothing at all.
   *
   * A day off with nobody in it says nothing rather than "0 of 0":
   * the square is already quiet, and a zero invites the eye to stop
   * at something that holds no news.
   */
  static #load(cell) {
    const counts = cell.counts ?? {};
    const span = document.createElement("span");
    span.className = "cm-load";

    /* Nothing to say about an empty day off, and nothing to say
       about an empty day that has already gone by: both are quiet,
       and a grid of zeroes is noise that hides the squares which do
       carry news. */
    if (counts.booked === 0 && (counts.state === "rest" || cell.past)) {
      span.textContent = "";
      return span;
    }

    /* A fraction answers "is there room", which is a question about
       a day that has not happened yet. For one that has, the useful
       number is simply how many people came. */
    span.textContent = cell.past
      ? t("{} {}", counts.booked, plural(counts.booked, ["клієнт", "клієнти", "клієнтів"]))
      : counts.fraction
        ? `${counts.booked}/${counts.capacity}`
        : String(counts.booked);

    return span;
  }

  /** What a screen reader says instead of reading "9 5/7" aloud. */
  static #spoken(cell, language) {
    const date = Zone.label(cell.date, language);
    const counts = cell.counts ?? {};

    if (counts.state === "clash") return `${date}, ${t("Два записи на один час")}`;
    if (counts.state === "rest" && counts.booked === 0) return `${date}, ${t("Вихідний")}`;

    if (cell.past) {
      return `${date}, ${t("{} {}", counts.booked, plural(counts.booked, ["клієнт", "клієнти", "клієнтів"]))}`;
    }

    if (counts.fraction) return `${date}, ${t("{} з {}", counts.booked, counts.capacity)}`;

    return `${date}, ${t("{} з {}", counts.booked, counts.booked)}`;
  }
}
