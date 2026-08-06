/**
 * ChooserView — the fork between an existing spreadsheet and a new one.
 *
 * It sits between signing in and working, because a first-time user
 * has nothing to pick: sending them straight to the Picker would show
 * an empty list and no way forward. Making both routes visible costs
 * one extra click and removes that dead end entirely.
 *
 * The view owns only its own field. Deciding what happens on each
 * button is the application's job, not this class's.
 */
export class ChooserView {
  #root;
  #input;
  #error;
  #onInput;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="chooser"]' } = {}) {
    this.#root  = document.querySelector(selector);
    this.#input = this.#root?.querySelector("[data-new-title]");
    this.#error = this.#root?.querySelector("[data-title-error]");

    /* The complaint disappears as soon as they start fixing it, rather
       than waiting for another attempt. Being told off while already
       doing the thing is what makes validation feel hostile. */
    this.#onInput = () => { if (this.#input.value.trim()) this.clearError(); };
  }

  init() {
    this.#input?.addEventListener("input", this.#onInput);
    return this;
  }

  /**
   * Name typed for the new spreadsheet.
   * @returns {string} empty when nothing was typed
   */
  get title() {
    return this.#input?.value.trim() ?? "";
  }

  /**
   * @returns {boolean} whether there is a name to create a sheet with
   */
  get isValid() {
    return this.title.length > 0;
  }

  /**
   * Marks the field and says what is missing. Returns focus to it, so
   * fixing the problem takes no aiming.
   */
  showError() {
    this.#input?.classList.add("is-invalid");
    if (this.#error) this.#error.hidden = false;
    this.#input?.focus();
    return this;
  }

  clearError() {
    this.#input?.classList.remove("is-invalid");
    if (this.#error) this.#error.hidden = true;
    return this;
  }

  /**
   * Empties the field. It starts blank rather than pre-filled: a field
   * that already holds a word looks finished, and people accept the
   * suggestion without noticing they were asked anything.
   */
  reset() {
    if (this.#input) this.#input.value = "";
    this.clearError();
    return this;
  }

  /** Puts the cursor in the field, so it is visibly waiting for input. */
  focus() {
    this.#input?.focus();
    return this;
  }

  destroy() {
    this.#input?.removeEventListener("input", this.#onInput);
  }
}
