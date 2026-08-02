import { PhoneNumber } from "../domain/PhoneNumber.js";

/**
 * PhoneInput — formats a number as it is typed, and shows what is
 * still missing.
 *
 * The hint is the point. Numbers are usually entered while reading
 * them off something else or hearing them over the phone, and a
 * dropped digit is invisible in a field that just shows what was
 * typed: 203-818-987 looks like a number. Drawing the absent digits in
 * grey makes the gap something to notice while the field is still in
 * front of you, rather than a week later when the call fails.
 *
 * A grey remainder cannot live inside an <input>, which has one colour
 * for all its text. So the hint is a layer underneath: an invisible
 * copy of what was typed reserves exactly the right width, and the
 * remainder follows it. The two only line up if they share a font and
 * padding exactly, which is why the ghost is styled from the input
 * rather than given its own rules.
 */
export class PhoneInput extends EventTarget {
  #input;
  #typed;
  #rest;
  #onInput;
  #onBeforeInput;
  #deleting = false;

  /**
   * @param {object} params
   * @param {HTMLInputElement} params.input
   * @param {HTMLElement} params.ghost   holds the two hint spans
   */
  constructor({ input, ghost }) {
    super();
    this.#input = input;

    this.#typed = document.createElement("span");
    this.#typed.className = "fm-phone-typed";

    this.#rest = document.createElement("span");
    this.#rest.className = "fm-phone-rest";

    ghost.replaceChildren(this.#typed, this.#rest);

    /* Backspace over a separator has to eat the digit before it too,
       or the character reappears the moment the value is reformatted
       and the key seems to do nothing. */
    this.#onBeforeInput = event => {
      this.#deleting = event.inputType?.startsWith("delete") ?? false;
    };

    this.#onInput = () => this.#reformat();
  }

  init() {
    this.#input.addEventListener("beforeinput", this.#onBeforeInput);
    this.#input.addEventListener("input", this.#onInput);
    return this;
  }

  destroy() {
    this.#input.removeEventListener("beforeinput", this.#onBeforeInput);
    this.#input.removeEventListener("input", this.#onInput);
  }

  /** @returns {string} the formatted number */
  get value() {
    return this.#input.value;
  }

  /** @param {string} next */
  set value(next) {
    const { text } = PhoneNumber.mask(next ?? "");
    this.#input.value = next ? text : "";
    this.#paintHint();
  }

  /* ---------------- private ---------------- */

  #reformat() {
    const before = this.#input.value;
    const caret = this.#input.selectionStart ?? before.length;

    let digitsBefore = PhoneInput.#countDigits(before.slice(0, caret));

    /* Nothing was actually removed, so the key landed on a separator:
       drop the digit in front of it instead. */
    if (this.#deleting && digitsBefore > 0 && !/\d/.test(before.slice(caret - 1, caret))) {
      digitsBefore -= 1;
    }

    const digits = before.replace(/\D/g, "");
    const kept = this.#deleting && digitsBefore < PhoneInput.#countDigits(before)
      ? PhoneInput.#removeAt(digits, digitsBefore)
      : digits;

    const source = before.trimStart().startsWith("+") ? `+${kept}` : kept;
    const { text } = PhoneNumber.mask(source);

    this.#input.value = text;
    this.#restoreCaret(text, digitsBefore);
    this.#paintHint();
    this.#deleting = false;

    this.dispatchEvent(new CustomEvent("change", { detail: { value: text } }));
  }

  /**
   * Puts the caret back after the same digit it was after before.
   *
   * Counting digits rather than characters is what survives the
   * separators moving: inserting a dash shifts every position after it,
   * and a caret restored by index would drift a little on every
   * keystroke until it was in the wrong place entirely.
   */
  #restoreCaret(text, digitsBefore) {
    if (document.activeElement !== this.#input) return;

    let seen = 0;
    let position = text.length;

    for (let index = 0; index < text.length; index += 1) {
      if (/\d/.test(text[index])) {
        seen += 1;
        if (seen === digitsBefore) { position = index + 1; break; }
      }
    }

    if (digitsBefore === 0) position = text.startsWith("+") ? 1 : 0;
    this.#input.setSelectionRange(position, position);
  }

  #paintHint() {
    const { text, hint } = PhoneNumber.mask(this.#input.value);

    /* Hidden rather than absent: it holds the width that pushes the
       remainder into place. */
    this.#typed.textContent = text;
    this.#rest.textContent = this.#input.value ? hint : "";
  }

  static #countDigits(text) {
    return (text.match(/\d/g) ?? []).length;
  }

  static #removeAt(digits, index) {
    return digits.slice(0, index) + digits.slice(index + 1);
  }
}
