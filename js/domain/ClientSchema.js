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
  static HEADINGS = Object.freeze({
    firstName:  ["ім'я", "імя", "ім`я", "имя", "name", "first name", "firstname"],
    lastName:   ["прізвище", "прiзвище", "фамилия", "surname", "last name", "lastname"],
    phone:      ["телефон", "номер", "номер телефону", "phone", "mobile", "тел"],
    socials:    ["соцмережі", "соцмережи", "соцсети", "socials", "social"],
    messengers: ["месенджери", "мессенджеры", "messengers", "messenger"],
    birthday:   ["день народження", "днь народження", "день рождения", "birthday",
                 "дата народження", "др"],
    lastVisit:  ["останній візит", "останнiй вiзит", "последний визит", "дата візиту",
                 "last visit", "дата"],
    notes:      ["нотатки", "заметки", "примітки", "коментар", "notes", "note", "comment"],
  });

  /**
   * What a column is called when Mirra creates one.
   *
   * Only ever used for writing. Reading goes through HEADINGS above,
   * which accepts every spelling people actually use — so a sheet that
   * calls it "ДР" is understood, and a column Mirra adds is spelled out
   * in full.
   */
  static LABELS = Object.freeze({
    firstName:  "Ім'я",
    lastName:   "Прізвище",
    phone:      "Телефон",
    socials:    "Соцмережі",
    messengers: "Месенджери",
    birthday:   "День народження",
    lastVisit:  "Останній візит",
    notes:      "Нотатки",
  });

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
  static labelFor(field) {
    return ClientSchema.LABELS[field] ?? field;
  }

  /**
   * Known fields this sheet has no column for.
   *
   * @param {string[]} [fields] which to check; defaults to all of them
   * @returns {string[]}
   */
  missing(fields = Object.keys(ClientSchema.LABELS)) {
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
    const lower = this.#headers.map(header => header.trim().toLowerCase());

    for (const [field, headings] of Object.entries(ClientSchema.HEADINGS)) {
      this.#columns[field] = lower.findIndex(header => headings.includes(header));
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
