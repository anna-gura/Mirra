import { t } from "../../locales/t.js";
import { config } from "../../config.js";
import { DayPlan } from "../../domain/calendar/DayPlan.js";
import { Zone } from "../../domain/calendar/Zone.js";

/**
 * CalendarSettingsView — the screen that makes the calendar, and the
 * screen that changes it afterwards.
 *
 * The same six questions either way, so the same screen answers them.
 * What differs is one heading and one button label, which is not a
 * reason for a second screen: two forms holding the same fields drift
 * apart, and the drift is always found by a user rather than by
 * whoever wrote them.
 *
 * The view owns its fields and nothing else. It does not know how to
 * make a calendar, what Google is, or where anything is saved — it
 * reads the form and reports what is in it, and the application does
 * the rest.
 */
export class CalendarSettingsView {
  #root;
  #fields = {};
  #days = [];

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="calendar-settings"]' } = {}) {
    this.#root = document.querySelector(selector);
  }

  init() {
    if (!this.#root) return this;

    const find = name => this.#root.querySelector(`[data-calendar-${name}]`);

    this.#fields = {
      title:    find("title"),
      lead:     find("lead"),
      name:     find("name"),
      zone:     find("zone"),
      from:     find("from"),
      to:       find("to"),
      duration: find("duration"),
      gap:      find("gap"),
      days:     find("days"),
      state:    find("state"),
      example:  find("example"),
    };

    this.#fields.save = this.#root.querySelector("[data-save-calendar]");
    this.#fields.create = this.#root.querySelector("[data-create-calendar]");

    this.#buildDays();
    this.#buildZones();

    /* The example under the two numbers is the explanation: nothing
       describes what a gap does as well as watching the slots move
       while you change it. */
    for (const field of ["duration", "gap", "from", "to"]) {
      this.#fields[field]?.addEventListener("input", () => this.#example());
    }

    return this;
  }

  /**
   * Fills the form.
   *
   * @param {object|null} calendar as recorded in settings, or null when
   *        there is none yet and this is the screen that makes one
   * @param {string} [presence] what Google says about the account's own
   *        list of calendars: "listed", "hidden", "unlisted",
   *        "unknown" or "missing". Defaults to the honest answer for a
   *        caller that does not know: nothing is claimed either way.
   */
  show(calendar, presence = "unknown") {
    const values = calendar ?? {
      summary: "",
      timeZone: CalendarSettingsView.here,
      duration: config.CALENDAR.duration,
      gap: config.CALENDAR.gap,
      days: [...config.CALENDAR.days],
      from: config.CALENDAR.from,
      to: config.CALENDAR.to,
    };

    const { name, zone, from, to, duration, gap, lead } = this.#fields;

    if (name) name.value = values.summary || this.#suggestedName();
    if (from) from.value = values.from;
    if (to) to.value = values.to;
    if (duration) duration.value = String(values.duration);
    if (gap) gap.value = String(values.gap);

    this.#selectZone(values.timeZone);
    this.#showDays(values.days);

    const isNew = !calendar;

    this.state(calendar, presence);

    this.#example();

    if (lead) {
      lead.textContent = isNew
        ? t("Mirra створить у вашому Google Календарі окремий календар і бачитиме тільки його. Усе інше у вашому календарі лишиться їй невидимим.")
        : t("Цей календар створила Mirra. Вона бачить тільки його — решта вашого Google Календаря їй невидима.");
    }

    return this;
  }

  /**
   * Rebuilds what Intl wrote, after the language has changed.
   *
   * The weekday chips and the example under the fields are the two
   * things on this screen that no dictionary can translate — they
   * are built from the browser's own idea of what Tuesday is called
   * and what half past nine looks like on a clock. Everything a
   * person has typed or chosen is kept.
   *
   * @returns {this}
   */
  relabel() {
    const chosen = this.#days
      .filter(day => day.getAttribute("aria-pressed") === "true")
      .map(day => Number(day.dataset.day));

    this.#buildDays();
    this.#showDays(chosen);
    this.#example();

    return this;
  }

  /**
   * Where things stand with Google, without touching the form.
   *
   * Separate from show() because the two happen at different moments.
   * show() fills the fields, and refilling them would throw away
   * whatever somebody has typed and not yet saved; this says what
   * Google answered a second ago. Every lookup calls it, so the line
   * on the screen can never be older than the last question asked —
   * which it was: the screen went on saying "connected" while the
   * console had already reported the calendar gone.
   *
   * @param {object|null} calendar
   * @param {string} [presence] see show()
   * @returns {this}
   */
  state(calendar, presence = "unknown") {
    const { save, state } = this.#fields;
    const isNew = !calendar;

    /* Saving is offered only when there is something to save to. The
       button is not hidden, because a screen whose buttons come and go
       is harder to learn than one where a button is plainly not
       available yet. */
    if (save) save.disabled = isNew;

    /* Said on the screen and left there. The notice that reports a
       calendar's disappearance is gone in six seconds, and somebody
       who looks away for longer than that comes back to a screen that
       tells them nothing about which state they are in. */
    if (state) {
      state.textContent = CalendarSettingsView.#stateText(calendar, presence);

      /* Marked as a problem in two cases, not one. A calendar nobody
         can see is as good as absent to the person looking for it,
         and a line in the ordinary colour would say the opposite. */
      state.toggleAttribute("data-missing", isNew || presence === "unlisted");
    }

    /* The identifier used to be shown here, from the week it took to
       find out that a calendar can exist and be absent from somebody's
       list. It told that story and nothing else: a person cannot act
       on forty characters of hexadecimal, and the one screen that
       needs it — Google's own "subscribe by id" — is not reachable
       from here anyway. The console still prints it when something
       goes wrong, which is who it was ever for.
    */

    return this;
  }

  /**
   * Everything the form holds, cleaned up enough to save.
   *
   * Nothing here decides whether the values make sense together; that
   * is the application's business, and SettingsService checks them
   * again before they reach the file.
   *
   * @returns {{summary: string, timeZone: string, from: string,
   *            to: string, duration: number, gap: number, days: number[]}}
   */
  get values() {
    const { name, zone, from, to, duration, gap } = this.#fields;

    return {
      summary: (name?.value ?? "").trim() || this.#suggestedName(),
      timeZone: zone?.value || CalendarSettingsView.here,
      from: from?.value || config.CALENDAR.from,
      to: to?.value || config.CALENDAR.to,
      duration: Number(duration?.value) || config.CALENDAR.duration,
      gap: Number.isFinite(Number(gap?.value)) ? Number(gap.value) : config.CALENDAR.gap,
      days: this.#days
        .filter(day => day.getAttribute("aria-pressed") === "true")
        .map(day => Number(day.dataset.day)),
    };
  }

  /** @returns {string} the browser's own time zone, or UTC */
  static get here() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  /* ---------------- private ---------------- */

  /**
   * What the day will actually look like, in four times.
   *
   * Built through DayPlan rather than by multiplying here, so the
   * preview cannot disagree with the day it is previewing — which is
   * the whole point of showing it.
   */
  #example() {
    const host = this.#fields.example;
    if (!host) return;

    const language = document.documentElement.lang || "uk";

    const { cards } = DayPlan.of({ setup: this.values, events: [], working: true });
    const starts = cards
      .filter(card => card.kind === "slot" && card.fit === "full")
      .slice(0, 4)
      .map(card => Zone.clock(card.from, language));

    host.textContent = starts.length
      ? t("Слоти виходитимуть такі: {}…", starts.join(", "))
      : t("За таких налаштувань у дні не вміщається жоден візит.");
  }

  /**
   * The one line that says where things stand.
   *
   * Four states rather than two, because "connected" turned out to be
   * three different things: on the list, on the list but hidden, and
   * existing while on no list at all. The last of those looked
   * exactly like the first from inside Mirra, which is how somebody
   * spent an evening deleting a calendar that was never on screen.
   *
   * @param {object|null} calendar
   * @param {string} presence
   * @returns {string}
   */
  static #stateText(calendar, presence) {
    if (!calendar) return t("Календаря ще немає");

    if (presence === "unlisted") {
      return t("Існує в Google, але не у вашому переліку календарів: {}", calendar.summary);
    }

    if (presence === "hidden") {
      return t("Прихований у вашому Google Календарі: {}", calendar.summary);
    }

    return t("Підключено: {}", calendar.summary);
  }

  /** What a calendar is called before anybody renames it. */
  #suggestedName() {
    const language = document.documentElement.lang || "uk";
    return config.CALENDAR.title[language] ?? config.CALENDAR.title.uk;
  }

  /**
   * Seven toggles, named by the browser rather than by Mirra.
   *
   * Intl declines and abbreviates weekdays correctly in every language
   * it knows, which a hand-written list does for one and gets subtly
   * wrong in the next. The week starts on Monday because these are
   * working days and ISO numbering starts there; nothing here depends
   * on where a calendar grid chooses to start its own week.
   */
  #buildDays() {
    const host = this.#fields.days;
    if (!host) return;

    const locale = document.documentElement.lang || "uk";
    const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });

    host.replaceChildren();
    this.#days = [];

    for (let iso = 1; iso <= 7; iso += 1) {
      /* 5 January 1970 was a Monday, so this walks Monday to Sunday
         without any arithmetic about today. */
      const date = new Date(Date.UTC(1970, 0, 4 + iso));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cs-day";
      button.dataset.day = String(iso);
      button.setAttribute("aria-pressed", "false");
      button.textContent = format.format(date);

      button.addEventListener("click", () => {
        const pressed = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", pressed ? "false" : "true");
      });

      host.append(button);
      this.#days.push(button);
    }
  }

  /** @param {number[]} days ISO numbers */
  #showDays(days) {
    const wanted = new Set(days);

    for (const button of this.#days) {
      button.setAttribute("aria-pressed", wanted.has(Number(button.dataset.day)) ? "true" : "false");
    }
  }

  /**
   * Fills the time-zone list.
   *
   * Every zone the browser knows, which is the only honest list: Mirra
   * cannot keep its own up to date, and zones change by government
   * decree more often than anyone expects. Where the browser will not
   * produce one — older Safari — the field falls back to holding the
   * single zone it is set to, which is right far more often than not.
   */
  #buildZones() {
    const select = this.#fields.zone;
    if (!select) return;

    let zones = [];
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      zones = [];
    }

    if (!zones.includes(CalendarSettingsView.here)) {
      zones = [CalendarSettingsView.here, ...zones];
    }

    select.replaceChildren();

    for (const zone of zones) {
      const option = document.createElement("option");
      option.value = zone;
      /* Underscores are in the identifier, not in the place name. */
      option.textContent = zone.replace(/_/g, " ");
      select.append(option);
    }
  }

  /** @param {string} zone */
  #selectZone(zone) {
    const select = this.#fields.zone;
    if (!select) return;

    const wanted = zone || CalendarSettingsView.here;

    if (![...select.options].some(option => option.value === wanted)) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent = wanted.replace(/_/g, " ");
      select.prepend(option);
    }

    select.value = wanted;
  }
}
