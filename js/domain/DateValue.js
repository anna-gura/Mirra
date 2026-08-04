/**
 * DateValue — a date as the sheet holds it, and as a person reads it.
 *
 * Dates in a spreadsheet are whatever someone typed: 03.03, 3/3/2026,
 * 2026-03-03. Rather than reject anything unfamiliar, this reads what
 * is there and writes back in one chosen shape, so a column that grew
 * messy becomes consistent as rows are edited.
 *
 * Day-first and month-first orders cannot be told apart from the
 * digits alone — 03/04 is the third of April to most of the world and
 * the fourth of March in the United States. Where the numbers do not
 * settle it, the user's chosen format decides. That is the only honest
 * answer: the alternative is guessing, and a silently wrong date is
 * worse than one entered by hand.
 */
export class DateValue {
  /** Recognised output shapes. The key is what mirra.json stores. */
  static FORMATS = Object.freeze({
    "dd/mm/yyyy": { label: "31/12/2026", order: "dmy", separator: "/" },
    "dd.mm.yyyy": { label: "31.12.2026", order: "dmy", separator: "." },
    "mm/dd/yyyy": { label: "12/31/2026", order: "mdy", separator: "/" },
    "yyyy-mm-dd": { label: "2026-12-31", order: "ymd", separator: "-" },
  });

  static DEFAULT_FORMAT = "dd/mm/yyyy";

  /**
   * The year written when there is no year.
   *
   * A birthday is often recorded as 15.03 and nothing more, which is
   * perfectly useful for remembering to send a message. ISO dates have
   * no way to say "no year", and an <input type="date"> cannot hold
   * one — so year zero stands in for it. Nothing real falls on it, and
   * it survives being passed through anything expecting an ISO string.
   */
  static NO_YEAR = 0;

  #raw;
  #year = null;
  #month = null;
  #day = null;
  #hasYear = true;

  /**
   * @param {string} raw as stored in the sheet
   * @param {string} [format] used only to resolve an ambiguous order
   */
  constructor(raw, format = DateValue.DEFAULT_FORMAT) {
    this.#raw = (raw ?? "").trim();
    this.#parse(format);
  }

  /**
   * Builds a value from what an <input type="date"> returns.
   * @param {string} iso yyyy-mm-dd
   * @returns {DateValue}
   */
  static fromIso(iso) {
    return new DateValue(iso, "yyyy-mm-dd");
  }

  /** @returns {boolean} */
  get isValid() {
    return this.#year !== null;
  }

  /** @returns {string} exactly what the sheet holds */
  get raw() {
    return this.#raw;
  }

  /**
   * @returns {string} yyyy-mm-dd, which is what a date input expects,
   *          or an empty string when there is no usable date
   */
  get iso() {
    if (!this.isValid) return "";

    const year = this.#hasYear ? this.#year : DateValue.NO_YEAR;
    return `${String(year).padStart(4, "0")}-${this.#pad(this.#month)}-${this.#pad(this.#day)}`;
  }

  /**
   * @param {string} [format] key from DateValue.FORMATS
   * @returns {string} the date written out, or the original text when
   *          it could not be read
   */
  format(format = DateValue.DEFAULT_FORMAT) {
    if (!this.isValid) return this.#raw;

    const shape = DateValue.FORMATS[format] ?? DateValue.FORMATS[DateValue.DEFAULT_FORMAT];
    const day = this.#pad(this.#day);
    const month = this.#pad(this.#month);
    const year = String(this.#year);

    /* Written back exactly as short as it was given: a birthday entered
       as 15.03 must not come out of the sheet as 15.03.2026, which would
       be a year nobody chose. */
    if (!this.#hasYear) {
      return shape.order === "mdy"
        ? [month, day].join(shape.separator)
        : [day, month].join(shape.separator);
    }

    const parts = shape.order === "ymd" ? [year, month, day]
                : shape.order === "mdy" ? [month, day, year]
                : [day, month, year];

    return parts.join(shape.separator);
  }

  /**
   * The date broken up for reading rather than for storage.
   *
   * "16 липня (четвер) 2026" tells someone what they actually want to
   * know — which day of the week the last visit was — where 16/07/2026
   * makes them work it out. The year comes back separately because it
   * is the least useful part: last visits are nearly always this year
   * or last, and it can be set smaller rather than dropped.
   *
   * Month names come from Intl, which declines them properly: липня,
   * not липень. A hand-written list of months would get that wrong in
   * every language but the one it was written for.
   *
   * @param {string} [locale]
   * @returns {{dayMonth: string, weekday: string, year: string}|null}
   */
  parts(locale = "uk-UA") {
    if (!this.isValid) return null;

    /* A leap year stands in when none was given, so the 29th of
       February survives being formatted. */
    const year = this.#hasYear ? this.#year : 2000;
    const date = new Date(Date.UTC(year, this.#month - 1, this.#day));
    const shape = { timeZone: "UTC" };

    return {
      dayMonth: new Intl.DateTimeFormat(locale, { ...shape, day: "numeric", month: "long" }).format(date),
      /* Meaningless without a year: the 15th of March fell on a
         different weekday in every year there has been. */
      weekday:  this.#hasYear
        ? new Intl.DateTimeFormat(locale, { ...shape, weekday: "long" }).format(date)
        : "",
      year:     this.#hasYear ? String(this.#year) : "",
    };
  }

  /** @returns {boolean} whether a year was actually written */
  get hasYear() {
    return this.isValid && this.#hasYear;
  }

  /**
   * Whole years since this date, or null when there is no year to
   * count from.
   *
   * Returned rather than displayed, so the caller decides what to do
   * with an unknown age. A birthday written as "15.03" is perfectly
   * useful for remembering to send a message; it simply cannot say how
   * old anyone is, and inventing a number would be worse than saying
   * nothing.
   *
   * @returns {number|null}
   */
  get age() {
    if (!this.hasYear) return null;

    const today = new Date();
    let age = today.getFullYear() - this.#year;

    /* The birthday has not come round yet this year, so a year is
       subtracted — otherwise everyone born in December is a year older
       for eleven months. */
    const hadBirthday =
      today.getMonth() + 1 > this.#month ||
      (today.getMonth() + 1 === this.#month && today.getDate() >= this.#day);

    if (!hadBirthday) age -= 1;

    return age >= 0 && age < 130 ? age : null;
  }

  /**
   * Ukrainian needs three plural forms for years.
   * 1 рік · 2–4 роки · 5–20 років, then it repeats by last digit.
   *
   * @param {number} age
   * @returns {string}
   */
  static pluraliseYears(age) {
    const lastTwo = age % 100;
    const lastOne = age % 10;

    if (lastTwo > 10 && lastTwo < 20) return "років";
    if (lastOne === 1) return "рік";
    if (lastOne >= 2 && lastOne <= 4) return "роки";
    return "років";
  }

  /**
   * Days until this date comes round again, ignoring the year.
   *
   * A birthday is an anniversary rather than a moment: the year it
   * happened is a fact about the person, and the day and month are what
   * recur. So the comparison drops the year entirely, which is also why
   * this works for a date recorded as 15.03 with no year at all.
   *
   * The 29th of February falls back to the 1st of March in ordinary
   * years — the same answer a calendar app gives, and the same one most
   * people give when asked.
   *
   * @param {Date} [today] overridable so the behaviour can be tested
   * @returns {number|null} 0 today, 1 tomorrow, null when there is no date
   */
  daysUntilAnniversary(today = new Date()) {
    if (!this.isValid) return null;

    const start = new Date(Date.UTC(
      today.getFullYear(), today.getMonth(), today.getDate()
    ));

    for (let year = start.getUTCFullYear(); year <= start.getUTCFullYear() + 1; year += 1) {
      const target = DateValue.#anniversaryIn(year, this.#month, this.#day);
      const days = Math.round((target - start) / 86400000);
      if (days >= 0) return days;
    }

    return null;
  }

  /**
   * The date this anniversary falls on in a given year.
   *
   * February the 29th does not exist three years in four; Date rolls it
   * over to the 1st of March, which is where it is usually observed.
   */
  static #anniversaryIn(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date;
  }

  /** @returns {string} */
  toString() {
    return this.format();
  }

  /* ---------------- private ---------------- */

  #parse(format) {
    if (!this.#raw) return;

    const numbers = this.#raw.match(/\d+/g);
    if (!numbers || numbers.length < 2) return;

    const values = numbers.map(Number);

    /* A four-digit group is unmistakably the year, wherever it sits. */
    const yearIndex = numbers.findIndex(part => part.length === 4);

    if (yearIndex >= 0 && values[yearIndex] === DateValue.NO_YEAR) {
      this.#hasYear = false;
    }

    if (yearIndex === 0) {
      this.#assign(values[0], values[1], values[2]);
      return;
    }

    if (yearIndex > 0) {
      const [a, b] = values;
      const { day, month } = this.#resolveOrder(a, b, format);
      this.#assign(values[yearIndex], month, day);
      return;
    }

    /* No year at all — "03.03" and the like. The current year is
       assumed so the date is usable, but the absence is recorded:
       a birthday written without a year gives no age, and guessing one
       would be worse than showing none. */
    const [a, b] = values;
    const { day, month } = this.#resolveOrder(a, b, format);
    this.#hasYear = false;
    this.#assign(values[2] ?? new Date().getFullYear(), month, day);
  }

  /**
   * Decides which of two numbers is the day.
   *
   * Anything above twelve can only be a day, and that settles most
   * real dates without reference to any convention. The rest fall back
   * to the format the user picked.
   */
  #resolveOrder(a, b, format) {
    if (a > 12) return { day: a, month: b };
    if (b > 12) return { day: b, month: a };

    const shape = DateValue.FORMATS[format] ?? DateValue.FORMATS[DateValue.DEFAULT_FORMAT];
    return shape.order === "mdy" ? { day: b, month: a } : { day: a, month: b };
  }

  #assign(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return;
    if (month < 1 || month > 12 || day < 1 || day > 31) return;

    if (year === DateValue.NO_YEAR) this.#hasYear = false;

    /* Round-tripping through Date catches the 31st of February and
       friends: the constructor rolls them over, so a mismatch means the
       date was never real. A leap year is used when none was given, so
       the 29th of February is not rejected for want of one. */
    const probeYear = this.#hasYear ? year : 2000;
    const probe = new Date(Date.UTC(probeYear, month - 1, day));
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return;

    this.#year = this.#hasYear ? year : DateValue.NO_YEAR;
    this.#month = month;
    this.#day = day;
  }

  #pad(value) {
    return String(value).padStart(2, "0");
  }
}
