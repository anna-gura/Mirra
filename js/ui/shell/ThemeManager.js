/**
 * ThemeManager — owns the light/dark switch.
 *
 * The attribute data-theme on <html> is the single source of truth.
 * Until the user picks a theme by hand the app follows the system
 * setting and reacts to it changing live. Once they choose, their
 * choice wins and survives a reload.
 */
export class ThemeManager {
  static LIGHT = "light";
  static DARK  = "dark";
  static STORAGE_KEY = "mirra:theme";

  #root;
  #media;
  #toggleSelector;
  #toggles = [];
  #isManual = false;
  #onSystemChange;
  #onToggleClick;

  /**
   * @param {object}      [options]
   * @param {HTMLElement} [options.root]           element carrying data-theme
   * @param {string}      [options.toggleSelector] selector for toggle buttons
   */
  constructor({ root = document.documentElement,
                toggleSelector = "[data-theme-toggle]" } = {}) {
    this.#root = root;
    this.#toggleSelector = toggleSelector;
    this.#media = window.matchMedia("(prefers-color-scheme: dark)");

    this.#onSystemChange = event => {
      if (!this.#isManual) {
        this.#apply(event.matches ? ThemeManager.DARK : ThemeManager.LIGHT);
      }
    };
    this.#onToggleClick = () => this.toggle();
  }

  /** Applies the stored or system theme and starts listening. */
  init() {
    this.#toggles = Array.from(document.querySelectorAll(this.#toggleSelector));
    this.#toggles.forEach(btn => btn.addEventListener("click", this.#onToggleClick));

    const saved = this.#read();
    this.#isManual = saved !== null;
    this.#apply(saved ?? this.systemTheme);

    this.#media.addEventListener("change", this.#onSystemChange);
    return this;
  }

  /**
   * Picks up toggle buttons that appeared after init().
   *
   * Screens are fetched from views/ once the app has started, so their
   * toggles do not exist when init() runs. Rescanning is cheaper and
   * harder to get wrong than deferring the whole theme until the markup
   * settles — the theme itself is already applied to <html> by then.
   */
  refresh() {
    const found = Array.from(document.querySelectorAll(this.#toggleSelector));

    for (const button of found) {
      if (this.#toggles.includes(button)) continue;
      button.addEventListener("click", this.#onToggleClick);
      this.#toggles.push(button);
    }

    this.#apply(this.current);
    return this;
  }

  /** @returns {string} the theme currently applied */
  get current() {
    return this.#root.dataset.theme === ThemeManager.DARK
      ? ThemeManager.DARK
      : ThemeManager.LIGHT;
  }

  /** @returns {boolean} */
  get isDark() {
    return this.current === ThemeManager.DARK;
  }

  /** @returns {string} what the operating system is asking for */
  get systemTheme() {
    return this.#media.matches ? ThemeManager.DARK : ThemeManager.LIGHT;
  }

  /**
   * Sets the theme as a deliberate user choice.
   * @param {string} theme ThemeManager.LIGHT | ThemeManager.DARK
   */
  set(theme) {
    const next = theme === ThemeManager.DARK ? ThemeManager.DARK : ThemeManager.LIGHT;
    this.#isManual = true;
    this.#write(next);
    this.#apply(next);
    return this;
  }

  /** Flips to the opposite theme. */
  toggle() {
    return this.set(this.isDark ? ThemeManager.LIGHT : ThemeManager.DARK);
  }

  /** Forgets the manual choice and follows the system again. */
  reset() {
    this.#isManual = false;
    this.#erase();
    this.#apply(this.systemTheme);
    return this;
  }

  /** Removes every listener this instance added. */
  destroy() {
    this.#media.removeEventListener("change", this.#onSystemChange);
    this.#toggles.forEach(btn => btn.removeEventListener("click", this.#onToggleClick));
    this.#toggles = [];
  }

  /* ---------------- private ---------------- */

  #apply(theme) {
    this.#root.dataset.theme = theme;
    const label = theme === ThemeManager.DARK
      ? "Увімкнути світлу тему"
      : "Увімкнути темну тему";
    this.#toggles.forEach(btn => btn.setAttribute("aria-label", label));
  }

  /* localStorage throws in Safari private mode, so every access is guarded */
  #read() {
    try { return localStorage.getItem(ThemeManager.STORAGE_KEY); }
    catch { return null; }
  }

  #write(value) {
    try { localStorage.setItem(ThemeManager.STORAGE_KEY, value); }
    catch { /* the theme simply will not survive a reload */ }
  }

  #erase() {
    try { localStorage.removeItem(ThemeManager.STORAGE_KEY); }
    catch { /* nothing to worry about */ }
  }
}
