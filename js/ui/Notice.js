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
  static ALERT = "alert";

  /**
   * @param {string} message empty strings are ignored
   * @param {object} [options]
   * @param {string} [options.tone] Notice.INFO | SUCCESS | ALERT
   * @param {boolean} [options.persist] keep it on screen; use for
   *        conditions the user cannot fix by waiting, such as a
   *        missing configuration
   */
  show(message, { tone = Notice.INFO, persist = false } = {}) {
    if (!this.#element || !message) return this;

    clearTimeout(this.#timer);
    this.#element.textContent = message;
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
