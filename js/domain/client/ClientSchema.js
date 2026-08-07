/**
 * ClientSchema — works out what each column of a sheet holds.
 *
 * Two kinds of spreadsheet have to work. One Mirra created, with known
 * headings. And one the user has kept for years, whose headings are
 * whatever they felt like at the time. The second is not asked to
 * change: a tool that demands you reformat your data before it will
 * help you is not much help.
 *
 * When headings say nothing useful, position decides: first column is
 * the name, second the phone, third the notes. That is how such sheets
 * are almost always laid out, and being wrong here costs nothing —
 * the values are still shown, just under a heading Mirra guessed.
 */
export class ClientSchema {
  /** Recognised headings, lowercase, by field. */
  /**
   * Column headings Mirra recognises, in every language it speaks.
   *
   * Reading and writing are deliberately asymmetric. A sheet is
   * understood whatever language its headings are in — somebody may
   * have made it in Ukrainian and now be using Mirra in English, or
   * received the file from a colleague — while writing follows the
   * sheet, or the interface when the sheet has nothing to follow.
   *
   * The alternative is a tool that stops recognising a file the moment
   * its owner changes a setting, which would be an absurd thing for a
   * setting to do.
   */
  static HEADINGS = Object.freeze({
    id:         ["id", "ідентифікатор"],
    firstName:  ["ім'я", "имя", "name", "first name", "firstname"],
    lastName:   ["прізвище", "фамилия", "surname", "last name", "lastname"],
    phone:      ["телефон", "номер", "номер телефону", "phone", "mobile", "тел"],
    birthday:   ["день народження", "днь народження", "день рождения", "birthday",
                 "дата народження", "др", "date of birth", "dob"],
    links:      ["зв'язки", "связи", "родина", "links", "relations", "пов'язані",
                 "related", "relationships"],
    socials:    ["соцмережі", "соцсети", "socials", "social", "social media"],
    messengers: ["месенджери", "мессенджеры", "messengers", "messenger"],
    lastVisit:  ["останній візит", "последний визит", "дата візиту",
                 "last visit", "дата", "date"],
    notes:      ["нотатки", "заметки", "примітки", "коментар", "notes", "note",
                 "comment", "comments"],
  });

  /**
   * Which language a heading belongs to, for the ones that differ.
   *
   * Only the words Mirra itself writes are listed. Anything else a
   * person invented is nobody's language in particular and counts for
   * neither side.
   */
  static LANGUAGE_OF = Object.freeze({
    uk: ["ім'я", "прізвище", "телефон", "день народження", "зв'язки",
         "соцмережі", "месенджери", "останній візит", "нотатки"],
    en: ["name", "surname", "phone", "birthday", "links",
         "socials", "messengers", "last visit", "notes"],
  });

  /**
   * Reduces a heading to what it means, so that spelling does not
   * decide whether a column is found.
   *
   * "Ім'я", "імя", "Імя " and "ІМ'Я" are one word to everybody who
   * types them, and treating them as four is Mirra's problem rather
   * than the user's. Apostrophes in their several forms, the Latin
   * і that looks identical to the Cyrillic one, doubled spaces and a
   * trailing space left by a phone keyboard — all of it is typography,
   * none of it is meaning.
   *
   * Comparison happens on the whole heading, never on a part of it, so
   * a column called "Дата народження дитини" is not mistaken for the
   * birthday column.
   *
   * @param {string} heading
   * @returns {string}
   */
  static normalise(heading) {
    return (heading ?? "")
      .trim()
      .toLocaleLowerCase("uk")
      /* Every apostrophe anybody's keyboard produces, plus none at all:
         "ім'я" and "імя" must land on the same string. */
      .replace(/[\u0027\u2018\u2019\u02BC\u02BB\u0060\u00B4]/g, "")
      /* Latin letters that are indistinguishable from Cyrillic ones and
         get typed by accident on a mixed layout. */
      .replace(/i/g, "і")
      .replace(/e/g, "е")
      .replace(/o/g, "о")
      .replace(/a/g, "а")
      .replace(/c/g, "с")
      .replace(/p/g, "р")
      .replace(/x/g, "х")
      .replace(/y/g, "у")
      .replace(/\s+/g, " ");
  }

  /**
   * What a column is called when Mirra creates one.
   *
   * Only ever used for writing. Reading goes through HEADINGS above,
   * which accepts every spelling people actually use — so a sheet that
   * calls it "ДР" is understood, and a column Mirra adds is spelled out
   * in full.
   */
  /**
   * What a column is called when Mirra creates one, per language.
   *
   * Only ever used for writing. Reading goes through HEADINGS above,
   * which accepts every spelling people actually use — so a sheet that
   * calls it "ДР" is understood, and a column Mirra adds is spelled out
   * in full.
   */
  static LABELS = Object.freeze({
    uk: {
      id:         "ID",
      firstName:  "Ім'я",
      lastName:   "Прізвище",
      phone:      "Телефон",
      birthday:   "День народження",
      links:      "Зв'язки",
      socials:    "Соцмережі",
      messengers: "Месенджери",
      lastVisit:  "Останній візит",
      notes:      "Нотатки",
    },
    en: {
      id:         "ID",
      firstName:  "Name",
      lastName:   "Surname",
      phone:      "Phone",
      birthday:   "Birthday",
      links:      "Links",
      socials:    "Socials",
      messengers: "Messengers",
      lastVisit:  "Last visit",
      notes:      "Notes",
    },
  });

  /** Used when a sheet says nothing about which language it is in. */
  static DEFAULT_LANGUAGE = "uk";

  /** @type {Record<string, number>} field → column index, -1 when absent */
  #columns = {};
  #headers;
  #guessed = false;

  /**
   * @param {string[]} headers the first row of the sheet
   */
  constructor(headers) {
    this.#headers = headers;
    this.#resolve();
  }

  /** @returns {number} how many columns the sheet has */
  get width() {
    return this.#headers.length;
  }

  /** @returns {boolean} true when position was used instead of headings */
  get isGuessed() {
    return this.#guessed;
  }

  /**
   * @param {string} field
   * @returns {number} column index, or -1
   */
  indexOf(field) {
    return this.#columns[field] ?? -1;
  }

  /**
   * @param {string} field
   * @returns {boolean}
   */
  has(field) {
    return this.indexOf(field) >= 0;
  }

  /**
   * Reads one field out of a row.
   * @param {string[]} values
   * @param {string} field
   * @returns {string}
   */
  read(values, field) {
    const index = this.indexOf(field);
    return index >= 0 ? (values[index] ?? "").trim() : "";
  }

  /**
   * @param {string} field
   * @returns {string} the heading Mirra would write for it
   */
  /**
   * @param {string} field
   * @param {string} [language]
   * @returns {string} the heading Mirra would write for it
   */
  static labelFor(field, language = ClientSchema.DEFAULT_LANGUAGE) {
    const labels = ClientSchema.LABELS[language] ?? ClientSchema.LABELS[ClientSchema.DEFAULT_LANGUAGE];
    return labels[field] ?? field;
  }

  /**
   * The language a sheet is written in, judged by its headings.
   *
   * A clear majority wins. Anything closer than that is a sheet with no
   * opinion of its own — half in each language, or a couple of columns
   * nobody recognises — and then the interface language decides, since
   * whoever is adding a column now is the one who will read it.
   *
   * One stray English heading among nine Ukrainian ones is not a mixed
   * sheet; it is a Ukrainian sheet with a stray heading.
   *
   * @param {string} fallback the interface language
   * @returns {string}
   */
  languageOf(fallback = ClientSchema.DEFAULT_LANGUAGE) {
    const counts = {};

    for (const header of this.#headers) {
      const normalised = ClientSchema.normalise(header);

      for (const [language, words] of Object.entries(ClientSchema.LANGUAGE_OF)) {
        if (words.some(word => ClientSchema.normalise(word) === normalised)) {
          counts[language] = (counts[language] ?? 0) + 1;
        }
      }
    }

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return fallback;

    const [[winner, top]] = ranked;
    const runnerUp = ranked[1]?.[1] ?? 0;

    /* Twice as many, or it is not a majority worth acting on. */
    return top >= runnerUp * 2 ? winner : fallback;
  }

  /**
   * Known fields this sheet has no column for.
   *
   * @param {string[]} [fields] which to check; defaults to all of them
   * @returns {string[]}
   */
  missing(fields = Object.keys(ClientSchema.LABELS[ClientSchema.DEFAULT_LANGUAGE])) {
    return fields.filter(field => !this.has(field));
  }

  /**
   * Columns not claimed by any known field. These are what the extra
   * screen shows: a sheet may carry anything, and Mirra should not
   * hide what it did not expect.
   * @returns {Array<{label: string, index: number}>}
   */
  get extraColumns() {
    const claimed = new Set(Object.values(this.#columns).filter(index => index >= 0));

    return this.#headers
      .map((label, index) => ({ label, index }))
      .filter(column => !claimed.has(column.index));
  }

  /* ---------------- private ---------------- */

  #resolve() {
    const found = this.#headers.map(ClientSchema.normalise);

    for (const [field, headings] of Object.entries(ClientSchema.HEADINGS)) {
      const wanted = headings.map(ClientSchema.normalise);
      this.#columns[field] = found.findIndex(header => wanted.includes(header));
    }

    const foundNothing = this.#columns.firstName < 0 && this.#columns.lastName < 0;
    if (!foundNothing) return;

    /* Nothing recognisable, so fall back to position. Assignments are
       only made where a column actually exists, so a two-column sheet
       does not end up claiming a notes column that is not there. */
    this.#guessed = true;
    this.#columns.firstName = this.#headers.length > 0 ? 0 : -1;
    if (this.#columns.phone < 0) this.#columns.phone = this.#headers.length > 1 ? 1 : -1;
    if (this.#columns.notes < 0) this.#columns.notes = this.#headers.length > 2 ? 2 : -1;
  }
}
