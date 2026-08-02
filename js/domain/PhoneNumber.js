/**
 * PhoneNumber — a phone number as typed, shown the way people read it.
 *
 * Numbers arrive from a spreadsheet, so they arrive in every shape a
 * person might type: with spaces, with dashes, with or without a
 * country code. Rather than demand one format, this reads what is
 * there and presents it in the grouping a reader of that country
 * expects — 203-818-9876 rather than 2038189876.
 *
 * Two countries are handled properly because those are the two that
 * matter here; anything else is grouped sensibly and left alone. The
 * original is never modified: what was typed stays in the sheet, and
 * only the display changes.
 */
export class PhoneNumber {
  #raw;
  #digits;
  #hadPlus;

  /**
   * @param {string} raw as stored in the sheet
   */
  constructor(raw) {
    this.#raw = (raw ?? "").trim();
    this.#hadPlus = this.#raw.startsWith("+");
    this.#digits = this.#raw.replace(/\D/g, "");
  }

  /** @returns {boolean} true when there is something dialable */
  get isValid() {
    return this.#digits.length >= 7;
  }

  /** @returns {string} exactly what the sheet holds */
  get raw() {
    return this.#raw;
  }

  /**
   * The number grouped for reading.
   * @returns {string}
   */
  get display() {
    if (!this.isValid) return this.#raw;

    const ua = this.#asUkrainian();
    if (ua) return ua;

    const us = this.#asAmerican();
    if (us) return us;

    return this.#asGeneric();
  }

  /**
   * International form, when it can be worked out with confidence.
   * @returns {string|null}
   */
  get e164() {
    if (!this.isValid) return null;

    if (this.#hadPlus) return `+${this.#digits}`;

    const digits = this.#digits;

    /* A country code is only assumed where the shape of the number
       makes it unambiguous. Guessing wrong turns a working number into
       one that silently fails to connect, which is worse than dialling
       it exactly as written. */
    if (digits.length === 12 && digits.startsWith("380")) return `+${digits}`;
    if (digits.length === 10 && digits.startsWith("0"))  return `+380${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith("1"))  return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;

    return null;
  }

  /** @returns {string} address that starts a call */
  get dialUri() {
    return `tel:${this.e164 ?? this.#digits}`;
  }

  /** @returns {string} address that opens a new message */
  get smsUri() {
    return `sms:${this.e164 ?? this.#digits}`;
  }

  /** @returns {string} */
  toString() {
    return this.display;
  }

  /* ================================================================
     Live masking, used while someone is typing
     ================================================================ */

  /**
   * Shapes a number is written in. `#` stands for one digit.
   *
   * Which one applies is decided from the first characters, the way a
   * reader would: a leading + means international, a leading zero
   * means a Ukrainian local number, and everything else is treated as
   * the ten-digit form used here.
   */
  static PATTERNS = Object.freeze({
    usLocal:  "###-###-####",
    usIntl:   "+# ###-###-####",
    uaLocal:  "### ### ## ##",
    uaIntl:   "+### ## ### ## ##",
    generic:  "+### ### ### ####",
  });

  /**
   * Picks the shape that fits what has been typed so far.
   * @param {string} raw
   * @returns {string}
   */
  static patternFor(raw) {
    const text = (raw ?? "").trim();
    const digits = text.replace(/\D/g, "");
    const { PATTERNS } = PhoneNumber;

    if (text.startsWith("+")) {
      if (digits.startsWith("380")) return PATTERNS.uaIntl;
      if (digits.startsWith("1")) return PATTERNS.usIntl;
      return PATTERNS.generic;
    }

    if (digits.startsWith("0")) return PATTERNS.uaLocal;
    return PATTERNS.usLocal;
  }

  /**
   * Splits a half-typed number into what is there and what is not.
   *
   * The remainder is returned rather than merged in, so the two can be
   * drawn differently: a missing digit is only noticeable if it looks
   * different from an entered one. Somebody reading back a number over
   * the phone drops a digit often enough that the gap needs to be
   * visible while they are still looking at the field.
   *
   * @param {string} raw what the field holds
   * @returns {{text: string, hint: string, isComplete: boolean}}
   */
  static mask(raw) {
    const pattern = PhoneNumber.patternFor(raw);
    const digits = (raw ?? "").replace(/\D/g, "");

    let text = "";
    let hint = "";
    let used = 0;

    /* A typed + belongs to the entered part even before any digit
       follows it; left to the loop it would fall into the hint and the
       character would appear to vanish as it was typed. */
    let slots = pattern;
    if (pattern.startsWith("+") && (raw ?? "").trim().startsWith("+")) {
      text = "+";
      slots = pattern.slice(1);
    }

    for (const slot of slots) {
      const isDigitSlot = slot === "#";

      if (used < digits.length) {
        /* Separators before the next digit belong with the typed part;
           otherwise a trailing dash would sit in the wrong colour. */
        text += isDigitSlot ? digits[used] : slot;
        if (isDigitSlot) used += 1;
        continue;
      }

      hint += isDigitSlot ? "0" : slot;
    }

    /* More digits than the shape expects: kept rather than truncated,
       since an unusual number is still the number they meant. */
    if (used < digits.length) {
      text += digits.slice(used);
      hint = "";
    }

    return { text, hint, isComplete: hint === "" };
  }

  /* ---------------- private ---------------- */

  /** +380 67 123 45 67 · 067 123 45 67 */
  #asUkrainian() {
    const digits = this.#digits;

    if (digits.length === 12 && digits.startsWith("380")) {
      const local = digits.slice(3);
      return `+380 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
    }

    if (digits.length === 10 && digits.startsWith("0")) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
    }

    return null;
  }

  /** 203-818-9876 · +1 203-818-9876 */
  #asAmerican() {
    const digits = this.#digits;

    if (digits.length === 10 && !digits.startsWith("0")) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    if (digits.length === 11 && digits.startsWith("1")) {
      const local = digits.slice(1);
      return `+1 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
    }

    return null;
  }

  /** Anything else: kept as typed rather than forced into a shape. */
  #asGeneric() {
    return this.#raw;
  }
}
