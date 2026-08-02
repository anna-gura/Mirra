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

  #raw;
  #year = null;
  #month = null;
  #day = null;

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
    return `${this.#year}-${this.#pad(this.#month)}-${this.#pad(this.#day)}`;
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

    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const shape = { timeZone: "UTC" };

    return {
      dayMonth: new Intl.DateTimeFormat(locale, { ...shape, day: "numeric", month: "long" }).format(date),
      weekday:  new Intl.DateTimeFormat(locale, { ...shape, weekday: "long" }).format(date),
      year:     String(this.#year),
    };
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

    /* No year at all — "03.03" and the like. Assuming the current year
       is a guess, but it is the one the writer almost certainly meant,
       and leaving the date unreadable helps nobody. */
    const [a, b] = values;
    const { day, month } = this.#resolveOrder(a, b, format);
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

    /* Round-tripping through Date catches the 31st of February and
       friends: the constructor rolls them over, so a mismatch means
       the date was never real. */
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return;

    this.#year = year;
    this.#month = month;
    this.#day = day;
  }

  #pad(value) {
    return String(value).padStart(2, "0");
  }
}
