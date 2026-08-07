import { DateValue } from "./DateValue.js";

/**
 * Birthday — whether one is close enough to say something about.
 *
 * Kept apart from DateValue because the question is not about dates: it
 * is about how far ahead is worth mentioning, and what to call the
 * days in between. Those are decisions about the interface, and they
 * change independently of arithmetic.
 *
 * Three days ahead, and no further. A week's notice sounds thoughtful
 * and is not: a badge that appears constantly stops being read, and
 * the whole value of this one is that it is unusual enough to notice.
 */
export class Birthday {
  /** How many days ahead is worth mentioning. */
  static HORIZON = 3;

  /**
   * @param {string} raw the birthday as the sheet holds it
   * @param {string} [dateFormat]
   * @param {Date} [today] overridable so the behaviour can be tested
   */
  constructor(raw, dateFormat, today = new Date()) {
    this.days = raw
      ? new DateValue(raw, dateFormat).daysUntilAnniversary(today)
      : null;
  }

  /** @returns {boolean} */
  get isToday() {
    return this.days === 0;
  }

  /** @returns {boolean} today or within the horizon */
  get isNear() {
    return this.days !== null && this.days <= Birthday.HORIZON;
  }

  /**
   * What to put on a client card, and what to fill it with.
   *
   * Returned as a template and its values rather than a finished
   * sentence, because a finished sentence cannot be translated: "за 3
   * дні" matches no dictionary entry, since the 3 is in the middle of
   * it. The caller translates the template and the numbers drop in
   * wherever that language puts them.
   *
   * Spelled out rather than left as an emoji alone: a cake read on its
   * own means nothing to somebody who opens a card once a month, and
   * the point of the line is to be understood immediately.
   *
   * @returns {{text: string, values: Array<string|number>,
   *            plural: [number, [string, string, string]]|null}|null}
   */
  get message() {
    if (!this.isNear) return null;

    /* The day itself is framed on both sides; the warnings are not.
       Symmetry reads as celebration, and a notice three days early is a
       reminder rather than an occasion — bracketing it the same way
       would promise more than is happening, and would flatten the one
       distinction the line exists to make. */
    switch (this.days) {
      case 0:
        return { text: "🎂 Сьогодні день народження 🎂", values: [], plural: null };
      case 1:
        return { text: "🎂 День народження завтра", values: [], plural: null };
      case 2:
        return { text: "🎂 День народження післязавтра", values: [], plural: null };
      default:
        return {
          text: "🎂 День народження за {} {}",
          values: [this.days],
          plural: [this.days, ["день", "дні", "днів"]],
        };
    }
  }
}
