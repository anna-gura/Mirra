import { DriveRepository } from "./DriveRepository.js";
import { config } from "../config.js";
import { DateValue } from "../domain/values/DateValue.js";

/**
 * @typedef {object} SectionConfig
 * @property {string} spreadsheetId
 * @property {string} sheetTitle
 */

/**
 * SettingsService — what Mirra remembers between visits.
 *
 * Kept as a plain JSON file inside the visible Mirra folder rather than
 * in browser storage, and that is the point: the settings follow the
 * account, not the device. Open Mirra on a phone after setting it up on
 * a laptop and everything is already in place.
 *
 * It exists to remove repeated work. Without it every visit begins with
 * choosing a spreadsheet again — a click that carries no information,
 * since the answer is the same every time.
 *
 * Reading is deliberately forgiving. A settings file that cannot be
 * parsed must never stop someone from using the app; the defaults take
 * over and the next save repairs the file.
 */
export class SettingsService {
  static FOLDER_NAME = "Mirra";
  static FILE_NAME   = "mirra.json";
  static VERSION     = 1;
  static SECTIONS    = Object.freeze(["clients", "bookings", "other"]);

  #drive;
  #folder = null;
  #fileId = null;
  #data = null;
  #writing = Promise.resolve();   // serialises saves so they cannot interleave

  /**
   * @param {object} deps
   * @param {DriveRepository} deps.drive
   */
  constructor({ drive }) {
    this.#drive = drive;
  }

  /**
   * Prepares the folder and the settings file, creating either if this
   * is the first visit.
   * @returns {Promise<this>}
   */
  async load() {
    this.#folder = await this.#drive.ensureFolder(SettingsService.FOLDER_NAME);

    const existing = await this.#drive.findInFolder(SettingsService.FILE_NAME, this.#folder.id);

    if (existing) {
      this.#fileId = existing.id;
      this.#data = this.#sanitise(await this.#readSafely(existing.id));
    } else {
      this.#data = this.#defaults();
      const created = await this.#drive.createJson(
        SettingsService.FILE_NAME, this.#folder.id, this.#data
      );
      this.#fileId = created.id;
    }

    return this;
  }

  /**
   * How dates are written into sheets.
   *
   * Stored rather than assumed, because the same digits mean different
   * days in different places. Keeping it in mirra.json means the
   * preference follows the account, and offering a choice later needs
   * no migration.
   *
   * @returns {string}
   */
  get dateFormat() {
    return this.#data?.dateFormat ?? config.DEFAULT_DATE_FORMAT;
  }

  /**
   * @param {string} format key from DateValue.FORMATS
   */
  async setDateFormat(format) {
    if (!this.#data || !DateValue.FORMATS[format]) return this;

    this.#data.dateFormat = format;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * The version of Mirra that last worked with these settings.
   *
   * Recorded for whoever opens mirra.json and wonders what wrote it.
   * Nothing depends on it: whether a sheet needs upgrading is answered
   * by looking at its columns, which stays true even after somebody
   * edits the file by hand.
   *
   * @returns {string}
   */
  get version() {
    return this.#data?.version ?? "";
  }

  /**
   * @param {string} version
   */
  setVersion(version) {
    if (!this.#data || this.#data.version === version) return this;

    this.#data.version = version;
    this.#data.updatedAt = new Date().toISOString();
    this.save();
    return this;
  }

  /**
   * The interface language, as chosen on any device.
   *
   * Kept here as well as in localStorage, and the two do different
   * jobs: the local copy makes the first screen correct before anything
   * is fetched, and this one carries the choice onto a new phone.
   *
   * @returns {string}
   */
  get language() {
    return this.#data?.language ?? "";
  }

  /**
   * @param {string} language
   */
  setLanguage(language) {
    if (!this.#data || this.#data.language === language) return this;

    this.#data.language = language;
    this.#data.updatedAt = new Date().toISOString();
    this.save();
    return this;
  }

  /** @returns {string|null} id of the Mirra folder */
  get folderId() {
    return this.#folder?.id ?? null;
  }

  /** @returns {boolean} */
  get isLoaded() {
    return this.#data !== null;
  }

  /**
   * @param {string} name one of SettingsService.SECTIONS
   * @returns {SectionConfig|null}
   */
  section(name) {
    return this.#data?.sections?.[name] ?? null;
  }

  /**
   * Points a menu section at a spreadsheet and records it.
   * @param {string} name
   * @param {SectionConfig|null} config
   */
  async setSection(name, config) {
    if (!this.#data) return this;

    this.#data.sections[name] = config;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * Writes the file. Saves are chained rather than fired in parallel:
   * two overlapping writes to the same file would race, and the loser
   * would silently undo the winner.
   */
  save() {
    this.#writing = this.#writing
      .then(() => this.#drive.updateJson(this.#fileId, this.#data))
      .catch(error => console.error("Settings could not be saved", error));
    return this.#writing;
  }

  /** Forgets everything held in memory. The file on Drive is untouched. */
  reset() {
    this.#folder = null;
    this.#fileId = null;
    this.#data = null;
  }

  /* ---------------- private ---------------- */

  #defaults() {
    return {
      /* The shape of this file, not the app. They are separate numbers
         because the file changes far less often than Mirra does. */
      schema: SettingsService.VERSION,
      version: "",
      language: "",
      dateFormat: config.DEFAULT_DATE_FORMAT,
      sections: Object.fromEntries(SettingsService.SECTIONS.map(name => [name, null])),
      updatedAt: new Date().toISOString(),
    };
  }

  async #readSafely(fileId) {
    try {
      return await this.#drive.readJson(fileId);
    } catch (error) {
      console.warn("Settings file could not be read, falling back to defaults", error);
      return null;
    }
  }

  /**
   * Accepts whatever was in the file and returns something the rest of
   * the app can rely on. Anyone can open mirra.json and edit it — that
   * is the price of keeping it visible, and it is worth paying, but it
   * means nothing read from it may be trusted unchecked.
   */
  #sanitise(raw) {
    const safe = this.#defaults();
    if (!raw || typeof raw !== "object") return safe;

    if (typeof raw.dateFormat === "string" && DateValue.FORMATS[raw.dateFormat]) {
      safe.dateFormat = raw.dateFormat;
    }

    if (typeof raw.version === "string") safe.version = raw.version;
    if (typeof raw.language === "string") safe.language = raw.language;

    for (const name of SettingsService.SECTIONS) {
      const value = raw.sections?.[name];
      if (value && typeof value.spreadsheetId === "string" && value.spreadsheetId) {
        safe.sections[name] = {
          spreadsheetId: value.spreadsheetId,
          sheetTitle: typeof value.sheetTitle === "string" ? value.sheetTitle : "",
          /* Whether Mirra made this sheet, and may therefore add columns
             to it without asking. Absent in files written by earlier
             versions, and absent means no — the cautious answer, and the
             right one for a sheet somebody brought themselves. */
          managed: value.managed === true,
        };
      }
    }

    return safe;
  }
}
