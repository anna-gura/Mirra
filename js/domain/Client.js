import { SocialCatalog } from "./SocialCatalog.js";
import { PhoneNumber } from "./PhoneNumber.js";
import { NoteTags } from "./NoteTags.js";
import { Birthday } from "./Birthday.js";

/**
 * Client — one person, read out of one row.
 *
 * A thin reading layer over the row rather than a copy of it: the sheet
 * stays the single source of truth, and nothing here can drift out of
 * step with what is actually stored.
 *
 * Values are parsed lazily. A list of two hundred people only ever
 * needs their names; parsing everyone's social profiles to draw that
 * list would be work thrown away.
 */
export class Client {
  /** Where names with no usable first letter are collected. */
  static OTHER_LETTER = "#";

  #schema;
  #values;
  #rowNumber;
  #socials = null;
  #messengers = null;
  #phone = null;
  #searchText = null;
  #tags = null;
  #birthday = null;
  #searchDigits = null;

  /**
   * @param {object} params
   * @param {import("./ClientSchema.js").ClientSchema} params.schema
   * @param {string[]} params.values  the row as stored
   * @param {number} params.rowNumber 1-based row in the spreadsheet
   */
  constructor({ schema, values, rowNumber }) {
    this.#schema = schema;
    this.#values = values;
    this.#rowNumber = rowNumber;
  }

  /** @returns {number} */
  get rowNumber() {
    return this.#rowNumber;
  }

  /** @returns {string[]} the row as stored */
  get values() {
    return this.#values;
  }

  /** @returns {string} */
  get firstName() {
    return this.#schema.read(this.#values, "firstName");
  }

  /** @returns {string} */
  get lastName() {
    return this.#schema.read(this.#values, "lastName");
  }

  /** @returns {string} "Ім'я Прізвище", or whichever of the two exists */
  get displayName() {
    return [this.firstName, this.lastName].filter(Boolean).join(" ");
  }

  /** @returns {string} the number exactly as the sheet holds it */
  get phone() {
    return this.#schema.read(this.#values, "phone");
  }

  /** @returns {PhoneNumber} the same number, ready to show or dial */
  get phoneNumber() {
    this.#phone ??= new PhoneNumber(this.phone);
    return this.#phone;
  }

  /** @returns {string} */
  get birthday() {
    return this.#schema.read(this.#values, "birthday");
  }

  /**
   * Whether the birthday is today or near it.
   *
   * The date format matters when the day and month could be read either
   * way round, so it is passed in rather than assumed.
   *
   * @param {string} [dateFormat]
   * @returns {Birthday}
   */
  birthdayStatus(dateFormat) {
    this.#birthday ??= new Birthday(this.birthday, dateFormat);
    return this.#birthday;
  }

  /** @returns {string} */
  get lastVisit() {
    return this.#schema.read(this.#values, "lastVisit");
  }

  /** @returns {string} */
  get notes() {
    return this.#schema.read(this.#values, "notes");
  }

  /** @returns {import("./SocialCatalog.js").Profile[]} */
  get socials() {
    this.#socials ??= SocialCatalog.parse(this.#schema.read(this.#values, "socials"));
    return this.#socials;
  }

  /** @returns {import("./SocialCatalog.js").Profile[]} */
  get messengers() {
    this.#messengers ??= SocialCatalog.parse(this.#schema.read(this.#values, "messengers"));
    return this.#messengers;
  }

  /**
   * Hashtags found in the note, lowercased and without repeats.
   * @returns {string[]}
   */
  get tags() {
    this.#tags ??= NoteTags.parse(this.notes);
    return this.#tags;
  }

  /**
   * The note with its tags taken out, for showing the prose alone.
   * @returns {string}
   */
  get noteText() {
    return NoteTags.strip(this.notes);
  }

  /**
   * @param {string} query a tag, with or without its hash
   * @returns {boolean}
   */
  hasTag(query) {
    const wanted = query.trim().toLocaleLowerCase("uk");
    const normalised = wanted.startsWith("#") ? wanted : `#${wanted}`;

    /* Prefix rather than exact match, so the list narrows as the tag is
       typed instead of staying empty until the last character. */
    return this.tags.some(tag => tag.startsWith(normalised));
  }

  /**
   * The name lowercased for comparison, built once per client.
   *
   * toLocaleLowerCase with a locale rather than toLowerCase: the plain
   * version gets Turkish dotted i wrong, and being explicit costs
   * nothing while making the intent obvious.
   *
   * @returns {string}
   */
  get searchText() {
    this.#searchText ??= this.displayName.toLocaleLowerCase("uk");
    return this.#searchText;
  }

  /**
   * The phone reduced to digits, so a search for 203818 finds
   * 203-818-9876 however it happens to be punctuated.
   * @returns {string}
   */
  get searchDigits() {
    this.#searchDigits ??= this.phone.replace(/\D/g, "");
    return this.#searchDigits;
  }

  /**
   * @param {string} text lowercased query
   * @param {string} digits query reduced to digits, may be empty
   * @returns {boolean}
   */
  matches(text, digits) {
    /* A query starting with # is asking about tags and nothing else.
       Without this, searching #волосся would also return everyone whose
       note happens to contain the word — which is not what somebody
       typing a hash means. */
    if (text.startsWith("#")) return this.hasTag(text);

    if (text && this.searchText.includes(text)) return true;
    return Boolean(digits) && this.searchDigits.includes(digits);
  }

  /**
   * Everything the sheet holds that Mirra has no field for.
   * @returns {Array<{label: string, value: string}>}
   */
  get extras() {
    return this.#schema.extraColumns
      .map(column => ({ label: column.label, value: (this.#values[column.index] ?? "").trim() }))
      .filter(entry => entry.value);
  }

  /** @returns {boolean} true when the row holds no name at all */
  get isBlank() {
    return this.displayName === "";
  }

  /**
   * Grouping letter for the alphabet headings.
   *
   * Digits and punctuation would each become their own heading, so they
   * share one group that sorts last.
   * @returns {string}
   */
  get letter() {
    const character = this.displayName.charAt(0).toLocaleUpperCase("uk");
    return /\p{L}/u.test(character) ? character : Client.OTHER_LETTER;
  }
}
