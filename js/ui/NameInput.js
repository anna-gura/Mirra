/**
 * NameInput — keeps a name capitalised while it is being typed.
 *
 * Not cosmetic. Names are the column the list is sorted and grouped by,
 * and "анна" filed under А while "Анна" sits under А looks like two
 * different letters to a reader scanning a list — because the heading
 * takes its letter from the name as stored. Fixing it as it is typed
 * means the sheet never holds the untidy version at all.
 *
 * The rule is narrow on purpose: the first letter of each word, and
 * nothing else. Anything cleverer gets Ірина-Марія wrong, or O'Коннор,
 * or a surname somebody spells lowercase on purpose — and being
 * overruled by a text field is worse than a lowercase letter.
 */
export class NameInput {
  #input;
  #onInput;

  /**
   * @param {HTMLInputElement} input
   */
  constructor(input) {
    this.#input = input;
    this.#onInput = () => this.#apply();
  }

  init() {
    this.#input?.addEventListener("input", this.#onInput);
    return this;
  }

  destroy() {
    this.#input?.removeEventListener("input", this.#onInput);
  }

  /** Capitalises the current value, leaving the caret where it was. */
  #apply() {
    const before = this.#input.value;
    const after = NameInput.capitalise(before);
    if (after === before) return;

    /* Reading the caret and putting it back is what makes this usable.
       Assigning to value moves it to the end, so editing the middle of
       a name would throw the cursor away on every keystroke — and the
       length is unchanged here, so the old position is still correct. */
    const caret = this.#input.selectionStart;
    this.#input.value = after;
    this.#input.setSelectionRange(caret, caret);
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  static capitalise(value) {
    /* Split on the separators rather than on spaces alone, so
       double-barrelled names and initials each get their capital.
       toLocaleUpperCase with a locale rather than the plain version:
       the plain one gets Turkish dotted i wrong. */
    return value.replace(
      /(^|[\s'’\-–—])(\p{L})/gu,
      (whole, separator, letter) => separator + letter.toLocaleUpperCase("uk")
    );
  }
}
