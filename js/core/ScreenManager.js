/**
 * ScreenManager — decides which top-level view is on screen.
 *
 * Views are siblings that all sit at inset:0; exactly one carries
 * the visible class at any moment. Hidden views also become inert,
 * so keyboard and screen readers cannot wander into them.
 */
export class ScreenManager {
  static VISIBLE_CLASS = "is-visible";

  /** @type {Map<string, HTMLElement>} */
  #views = new Map();
  #current = null;

  /**
   * @param {object} [options]
   * @param {string} [options.selector] selector matching every view
   */
  constructor({ selector = "[data-view]" } = {}) {
    document.querySelectorAll(selector).forEach(el => {
      this.#views.set(el.dataset.view, el);
    });
  }

  init() {
    for (const [name, el] of this.#views) {
      if (el.classList.contains(ScreenManager.VISIBLE_CLASS)) this.#current = name;
    }
    this.#sync();
    return this;
  }

  /** @returns {string|null} name of the visible view */
  get current() {
    return this.#current;
  }

  /**
   * @param {string} name
   * @returns {boolean} whether that view's markup ever arrived
   */
  has(name) {
    return this.#views.has(name);
  }

  /**
   * @param {string} name value of the data-view attribute
   */
  show(name) {
    if (!this.#views.has(name)) {
      console.error(`ScreenManager: unknown view "${name}"`);
      return this;
    }
    if (this.#current === name) return this;

    this.#current = name;
    this.#sync();
    return this;
  }

  /* ---------------- private ---------------- */

  #sync() {
    for (const [name, el] of this.#views) {
      const isCurrent = name === this.#current;
      el.classList.toggle(ScreenManager.VISIBLE_CLASS, isCurrent);
      el.inert = !isCurrent;
    }
  }
}
