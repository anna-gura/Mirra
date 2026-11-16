import { t } from "../../locales/t.js";

/**
 * Duration — a length of time in the words people use for it.
 *
 * Minutes are what the arithmetic runs on; hours are what anybody
 * keeps in their head. Past an hour or so a number of minutes has to
 * be divided before it means anything, and "110 хв" is a sum, not an
 * answer.
 *
 * One place rather than one per screen, so the hour written on a card
 * in the day and the hour written in the booking form are the same
 * words. They are describing the same visit, and a screen that calls
 * it "1 год 50 хв" next to one that calls it "110 хв" makes somebody
 * stop and check whether the two are talking about the same thing.
 */
export class Duration {
  /**
   * @param {number} minutes
   * @returns {string} "1 год 50 хв", "2 год", "40 хв"
   */
  static words(minutes) {
    const whole = Math.max(0, Math.round(Number(minutes) || 0));

    const hours = Math.floor(whole / 60);
    const rest = whole % 60;

    if (hours === 0) return t("{} хв", rest);
    if (rest === 0) return t("{} год", hours);

    return t("{} год {} хв", hours, rest);
  }
}
