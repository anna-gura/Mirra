import { t } from "../../locales/t.js";

/**
 * Notice — one transient message pinned to the top of the screen.
 *
 * Kept deliberately small: a single slot, last message wins. The
 * element is aria-live, so a screen reader announces failures that a
 * sighted user sees appear.
 */
export class Notice {
  #element;
  #timer = null;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   * @param {number} [options.duration] milliseconds on screen
   */
  constructor({ selector = "[data-notice]", duration = 6000 } = {}) {
    this.#element = document.querySelector(selector);
    this.duration = duration;
  }

  /** Tones a message can carry. */
  static INFO = "info";
  static SUCCESS = "success";
  static WARN = "warn";
  static ALERT = "alert";

  /**
   * @param {string} message empty strings are ignored
   * @param {object} [options]
   * @param {string} [options.tone] Notice.INFO | SUCCESS | WARN | ALERT
   * @param {boolean} [options.persist] keep it on screen; use for
   *        conditions the user cannot fix by waiting, such as a
   *        missing configuration
   */
  show(message, { tone = Notice.INFO, persist = false } = {}) {
    if (!this.#element || !message) return this;

    clearTimeout(this.#timer);

    /* Translated here rather than at every call site. Sixteen places
       raise a notice, and asking each of them to remember would mean
       fifteen that do and one that does not. */
    this.#element.textContent = t(message);
    this.#element.dataset.tone = tone;
    this.#element.hidden = false;

    if (!persist) this.#timer = setTimeout(() => this.hide(), this.duration);
    return this;
  }

  /**
   * Reports a failure. A separate method rather than a tone argument at
   * every call site: the one thing worth never getting wrong is which
   * messages look alarming, and a named method is harder to forget than
   * an option.
   *
   * @param {string} message
   * @param {object} [options]
   */
  alert(message, options = {}) {
    return this.show(message, { ...options, tone: Notice.ALERT });
  }

  /**
   * Says something worth knowing that is nobody's mistake.
   *
   * The line between this and alert() is who is at fault, not how
   * important it is. A calendar somebody deleted on purpose, a
   * permission they chose not to give, a field they left empty — all
   * of those went exactly as asked, and dressing them in the colour
   * of failure teaches people that the colour means nothing.
   *
   * @param {string} message
   * @param {object} [options]
   */
  warn(message, options = {}) {
    return this.show(message, { ...options, tone: Notice.WARN });
  }

  /**
   * Confirms that something worked.
   * @param {string} message
   * @param {object} [options]
   */
  done(message, options = {}) {
    return this.show(message, { ...options, tone: Notice.SUCCESS });
  }

  hide() {
    if (!this.#element) return this;
    clearTimeout(this.#timer);
    this.#element.hidden = true;
    return this;
  }
}
