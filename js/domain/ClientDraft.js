import { SocialCatalog } from "./SocialCatalog.js";
import { DateValue } from "./DateValue.js";
import { ClientLinks } from "./ClientLinks.js";

/**
 * ClientDraft — a client being edited.
 *
 * Separate from Client on purpose. Client reads a row that exists;
 * a draft is a set of intentions that may never be saved, and mixing
 * the two would mean a half-typed name showing up in the list.
 *
 * The row it produces starts as a copy of the original, so columns
 * Mirra knows nothing about survive editing untouched. Somebody's
 * spreadsheet is theirs, and a tool that quietly drops the columns it
 * did not recognise is a tool that cannot be trusted with it.
 */
export class ClientDraft {
  #schema;
  #original;
  #rowNumber;

  firstName = "";
  lastName = "";
  phone = "";
  birthday = "";         // ISO, as a date input speaks
  lastVisit = "";        // ISO, as a date input speaks
  notes = "";

  /** @type {Array<{id: string, handle: string}>} */
  socials = [];

  /** @type {Array<{id: string, handle: string}>} */
  messengers = [];

  /** @type {Array<{index: number, label: string, value: string}>} */
  extras = [];

  /** @type {import("./ClientLinks.js").Link[]} */
  links = [];

  /** The client's own id, kept so links can point back at it. */
  id = "";

  /** Text Mirra could not interpret, preserved verbatim. */
  #unknownSocials = [];
  #unknownMessengers = [];

  /**
   * @param {object} params
   * @param {import("./ClientSchema.js").ClientSchema} params.schema
   * @param {string[]} [params.values]    the row as stored
   * @param {number} [params.rowNumber]   absent for a client being added
   * @param {string} [params.dateFormat]
   */
  constructor({ schema, values = [], rowNumber = null, dateFormat }) {
    this.#schema = schema;
    this.#original = values;
    this.#rowNumber = rowNumber;
    this.#load(dateFormat);
  }

  /** @returns {number|null} */
  get rowNumber() {
    return this.#rowNumber;
  }

  /** @returns {boolean} true when this will become a new row */
  get isNew() {
    return this.#rowNumber === null;
  }

  /** @returns {import("./ClientSchema.js").ClientSchema} */
  get schema() {
    return this.#schema;
  }

  /** @returns {boolean} a client with no name is not worth saving */
  get isValid() {
    return Boolean(this.firstName.trim() || this.lastName.trim());
  }

  /**
   * Fields that hold something but have nowhere to go.
   *
   * A sheet the user brought themselves may have no birthday column,
   * and writing one silently drops what they typed. Naming them lets
   * the application ask before that happens, rather than losing it and
   * saying nothing.
   *
   * @returns {string[]}
   */
  get unwritableFields() {
    const filled = {
      links: this.links.length ? "1" : "",
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      phone: this.phone.trim(),
      birthday: this.birthday,
      lastVisit: this.lastVisit,
      notes: this.notes.trim(),
      socials: this.socials.some(entry => entry.handle.trim()) ? "1" : "",
      messengers: this.messengers.some(entry => entry.handle.trim()) ? "1" : "",
    };

    return Object.entries(filled)
      .filter(([field, value]) => value && !this.#schema.has(field))
      .map(([field]) => field);
  }

  /**
   * Builds the row to send to the sheet.
   * @param {string} [dateFormat]
   * @returns {string[]}
   */
  toRow(dateFormat = DateValue.DEFAULT_FORMAT) {
    /* Starting from the original row rather than an empty one is what
       keeps unrecognised columns intact. */
    const width = Math.max(this.#original.length, this.#schema.width);
    const row = Array.from({ length: width }, (_, index) => this.#original[index] ?? "");

    this.#write(row, "firstName", this.firstName.trim());
    this.#write(row, "lastName", this.lastName.trim());
    this.#write(row, "phone", this.phone.trim());
    this.#write(row, "notes", this.notes.trim());
    this.#write(row, "id", this.id);
    this.#write(row, "links", ClientLinks.stringify(this.links));

    this.#write(row, "socials", this.#stringify(this.socials, this.#unknownSocials));
    this.#write(row, "messengers", this.#stringify(this.messengers, this.#unknownMessengers));

    for (const field of ["birthday", "lastVisit"]) {
      this.#write(row, field, this.#formatDate(this[field], dateFormat));
    }

    for (const extra of this.extras) {
      row[extra.index] = extra.value.trim();
    }

    return row;
  }

  /* ---------------- private ---------------- */

  #load(dateFormat) {
    if (!this.#original.length) {
      this.extras = this.#schema.extraColumns.map(column => ({ ...column, value: "" }));
      return;
    }

    this.id = this.#schema.read(this.#original, "id");
    this.links = ClientLinks.parse(this.#schema.read(this.#original, "links"));

    this.firstName = this.#schema.read(this.#original, "firstName");
    this.lastName  = this.#schema.read(this.#original, "lastName");
    this.phone     = this.#schema.read(this.#original, "phone");
    this.notes     = this.#schema.read(this.#original, "notes");

    for (const field of ["birthday", "lastVisit"]) {
      this[field] = new DateValue(this.#schema.read(this.#original, field), dateFormat).iso;
    }

    const socials = SocialCatalog.parse(this.#schema.read(this.#original, "socials"));
    this.socials = socials.filter(p => p.network).map(p => ({ id: p.network.id, handle: p.handle }));
    this.#unknownSocials = socials.filter(p => !p.network).map(p => p.raw);

    const messengers = SocialCatalog.parse(this.#schema.read(this.#original, "messengers"));
    this.messengers = messengers.filter(p => p.network).map(p => ({ id: p.network.id, handle: p.handle }));
    this.#unknownMessengers = messengers.filter(p => !p.network).map(p => p.raw);

    this.extras = this.#schema.extraColumns.map(column => ({
      ...column,
      value: this.#original[column.index] ?? "",
    }));
  }

  /**
   * A date as the sheet should hold it.
   *
   * Dates are sent with USER_ENTERED so that Sheets stores a real date
   * rather than a string — which is what makes sorting and filtering
   * work for someone who opens the file directly.
   *
   * That same helpfulness ruins a date with no year: given "15/03",
   * Sheets decides the year must be this one and writes 15/03/2026,
   * inventing a fact nobody supplied. A leading apostrophe is the
   * spreadsheet's own way of saying "this is text, leave it alone" —
   * it is not stored and not displayed, and the cell reads exactly as
   * it was written.
   *
   * @param {string} iso
   * @param {string} dateFormat
   * @returns {string}
   */
  #formatDate(iso, dateFormat) {
    if (!iso) return "";

    const date = DateValue.fromIso(iso);
    const written = date.format(dateFormat);

    return date.hasYear ? written : `'${written}`;
  }

  #write(row, field, value) {
    const index = this.#schema.indexOf(field);
    if (index >= 0) row[index] = value;
  }

  /**
   * Entries Mirra recognised are written in canonical form; anything it
   * did not is appended exactly as it was found.
   */
  #stringify(entries, unknown) {
    const known = entries
      .filter(entry => entry.id && entry.handle.trim())
      .map(entry => ({
        network: SocialCatalog.find(entry.id),
        handle: entry.handle.trim(),
        raw: "",
      }))
      .filter(profile => profile.network);

    return [SocialCatalog.stringify(known), ...unknown].filter(Boolean).join(", ");
  }
}
