/**
 * Translator — the same interface in another language.
 *
 * Ukrainian is not loaded, because it is already in the markup. Every
 * heading, label and button on every screen is written in Ukrainian in
 * the templates, and for a Ukrainian-speaking user nothing is replaced
 * at all — there is no moment where the wrong text is on screen waiting
 * to be corrected.
 *
 * Any other language is a dictionary keyed by the Ukrainian text.
 * Unusual, and deliberate: keys like "clients.empty.title" are shorter
 * to type and impossible to read, and a missing one leaves a screen
 * showing its own identifier. Keyed by the sentence itself, a missing
 * translation simply leaves the Ukrainian in place — which is wrong but
 * legible, and legible is the difference between a bug and a disaster.
 */
export class Translator {
  /** Languages with a dictionary, in the order they are offered. */
  static AVAILABLE = Object.freeze([
    { code: "uk", label: "Українська" },
    { code: "en", label: "English" },
  ]);

  static DEFAULT = "uk";

  /**
   * Where a missing translation falls back to before giving up.
   *
   * English rather than Ukrainian, because somebody reading a Korean
   * interface has a far better chance with an English sentence than a
   * Ukrainian one. The cost is that English has to stay complete: it is
   * not merely a translation any more but the second reference, and a
   * gap in it ends the chain.
   */
  static FALLBACK = "en";

  static STORAGE_KEY = "mirra:lang";

  #code = Translator.DEFAULT;
  #dictionary = null;
  #fallback = null;
  #plurals = null;
  #fallbackPlurals = null;

  /** @returns {string} */
  get code() {
    return this.#code;
  }

  /** @returns {boolean} whether anything needs replacing at all */
  get isTranslating() {
    return this.#dictionary !== null;
  }

  /**
   * The language to start in.
   *
   * A choice already made wins over anything guessed. Beyond that the
   * browser's own language is the best guess available, and it is
   * usually right — somebody reading this in English has an English
   * browser.
   *
   * Read from localStorage rather than from settings, because settings
   * live on Drive and arrive after sign-in. The stored copy is what
   * makes the first screen correct; mirra.json is what makes the choice
   * follow the account onto a new device.
   *
   * @returns {string}
   */
  static preferred() {
    try {
      const saved = localStorage.getItem(Translator.STORAGE_KEY);
      if (saved && Translator.supports(saved)) return saved;
    } catch { /* private browsing; fall through to the browser */ }

    const browser = (navigator.language ?? "").slice(0, 2).toLowerCase();
    return Translator.supports(browser) ? browser : Translator.DEFAULT;
  }

  /**
   * @param {string} code
   * @returns {boolean}
   */
  static supports(code) {
    return Translator.AVAILABLE.some(language => language.code === code);
  }

  /**
   * Loads a language, or unloads back to Ukrainian.
   *
   * @param {string} code
   * @returns {Promise<this>}
   */
  async load(code) {
    this.#code = Translator.supports(code) ? code : Translator.DEFAULT;
    document.documentElement.lang = this.#code;

    if (this.#code === Translator.DEFAULT) {
      this.#dictionary = null;
      this.#fallback = null;
      this.#plurals = null;
      this.#fallbackPlurals = null;
      return this;
    }

    const loaded = await this.#module(this.#code);
    this.#dictionary = loaded?.dictionary ?? null;
    this.#plurals = loaded?.plurals ?? null;

    if (!this.#dictionary) {
      this.#code = Translator.DEFAULT;
      this.#fallback = null;
      return this;
    }

    /* Loaded alongside, unless English is the language being shown.
       Two small dictionaries cost less than one missing sentence. */
    if (this.#code === Translator.FALLBACK) {
      this.#fallback = null;
      this.#fallbackPlurals = null;
      return this;
    }

    const fallback = await this.#module(Translator.FALLBACK);
    this.#fallback = fallback?.dictionary ?? null;
    this.#fallbackPlurals = fallback?.plurals ?? null;

    return this;
  }

  /**
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  async #module(code) {
    try {
      /* Fetched only when it is needed, so a Ukrainian-speaking user
         never downloads a dictionary they will not read. */
      return await import(`./${code}.js`);
    } catch (error) {
      console.error(`Translator: could not load ${code}`, error);
      return null;
    }
  }

  /** Remembers the choice on this device. */
  remember() {
    try { localStorage.setItem(Translator.STORAGE_KEY, this.#code); }
    catch { /* it will be guessed again next time */ }
    return this;
  }

  /**
   * Ukrainian plural forms, by the rule the language actually uses.
   *
   * Kept here rather than in a dictionary because Ukrainian is what the
   * code is written in: the three forms are already at every call site,
   * and asking a translator to restate them would be asking them to
   * translate into the source language.
   *
   * @param {number} count
   * @param {[string, string, string]} forms one · few · many
   * @returns {string}
   */
  plural(count, forms) {
    const [one, few, many] = forms;

    if (this.#dictionary) {
      /* Other languages count differently — English has two forms, some
         have one — so the dictionary answers for itself, keyed by the
         Ukrainian singular. */
      const found = this.#plurals?.[one] ?? this.#fallbackPlurals?.[one];
      if (found) return found(count);
    }

    const lastTwo = count % 100;
    const lastOne = count % 10;

    if (lastTwo > 10 && lastTwo < 20) return many;
    if (lastOne === 1) return one;
    if (lastOne >= 2 && lastOne <= 4) return few;
    return many;
  }

  /**
   * @param {string} text the Ukrainian original
   * @param {...(string|number)} values substituted for {} in order
   * @returns {string}
   */
  t(text, ...values) {
    /* Ukrainian has no dictionary, but it still has placeholders: the
       markup is Ukrainian, and a sentence built from parts needs them
       filled whichever language it ends up in. Returning early here was
       a bug that left {} on screen for every Ukrainian-speaking user. */
    if (!this.#dictionary) return Translator.#fill(text, values);

    const key = text.trim();

    const found = this.#dictionary[key] ?? this.#fallback?.[key];

    if (found !== undefined) {
      /* Whitespace around the original is preserved, since it may be
         doing layout work in the markup. */
      return Translator.#fill(text.replace(key, found), values);
    }

    /* Loud in development, invisible in use: the Ukrainian shows, which
       is wrong but readable, and the console names what is missing so it
       can be added. */
    console.debug(`[i18n] ${this.#code}: не перекладено — ${JSON.stringify(key)}`);
    return Translator.#fill(text, values);
  }

  /**
   * Substitutes values for {} in order.
   *
   * Positional rather than named, because the alternative is asking
   * translators to keep {name} and {count} straight in a language whose
   * word order puts them elsewhere. Order is the one thing every
   * language agrees to renegotiate, so the sentence is theirs to
   * rearrange and the values follow.
   */
  static #fill(text, values) {
    if (!values.length) return text;

    let index = 0;
    return text.replace(/\{\}/g, () => String(values[index++] ?? ""));
  }
}
