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

  /**
   * The shape of this file. Raised to 2 when `schema` became an object
   * holding a number per sheet, and `ai` arrived beside it.
   */
  static VERSION     = 2;
  static SECTIONS    = Object.freeze(["clients", "bookings", "other"]);

  /** Values idColumn may hold. See the accessor below. */
  static ID_OWNERS   = Object.freeze(["mirra", "theirs"]);

  /**
   * How many spreadsheets Mirra keeps notes on besides the one in use.
   *
   * Ten is more than anybody switches between and few enough that the
   * file stays readable. The notes are tiny — a number, a date, two
   * flags — and losing the oldest costs one question, once. */
  static REMEMBERED_SHEETS = 10;

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

    /* What Mirra had learnt about the sheet being left is kept rather
       than dropped, because it is true about that sheet and will still
       be true if somebody comes back to it. Switching between two
       spreadsheets used to make each of them forget: which appearance
       it had been offered, how long it was asked to stay quiet, whose
       the ID column is — all of it lived in a record that held one
       sheet at a time. */
    const leaving = this.#data.sections[name];
    if (leaving?.spreadsheetId && leaving.spreadsheetId !== config?.spreadsheetId) {
      this.#archive(leaving);
    }

    this.#data.sections[name] = config;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * Records which appearance this sheet has been offered.
   *
   * Written whether the answer was yes or no, and that is the whole
   * mechanism: the question is asked again only when Mirra's own look
   * moves past the number stored here. "Not now" therefore means "not
   * until there is something new to show me", which is what somebody
   * declining a cosmetic change almost always means.
   *
   * @param {string} name one of SettingsService.SECTIONS
   * @param {number} version
   */
  async setLookVersion(name, version) {
    const section = this.#data?.sections?.[name];
    if (!section || section.lookVersion === version) return this;

    section.lookVersion = version;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * What Mirra knew about a spreadsheet it is no longer looking at.
   *
   * @param {string} spreadsheetId
   * @returns {object|null}
   */
  sheetMemory(spreadsheetId) {
    return this.#data?.sheets?.[spreadsheetId] ?? null;
  }

  /**
   * Who writes the ID column of a sheet.
   *
   * "mirra" — Mirra made the sheet, or added the column to it with
   * permission, so filling an empty cell there needs no further
   * asking: it is Mirra's own bookkeeping and no other value depends
   * on it.
   *
   * "theirs" — the sheet already had a column Mirra reads as an id
   * when it was first chosen. It may be a client number, an invoice
   * reference, anything; Mirra has no business writing into it
   * unasked.
   *
   * Empty — unknown, which is the honest answer for every sheet
   * remembered before this was recorded. Treated as Mirra's, because
   * the alternative is asking everybody about a column nobody can
   * tell them anything useful about.
   *
   * @param {string} name one of SettingsService.SECTIONS
   * @returns {string} "mirra", "theirs" or ""
   */
  idColumn(name) {
    return this.#data?.sections?.[name]?.idColumn ?? "";
  }

  /**
   * @param {string} name
   * @param {string} owner "mirra" or "theirs"
   */
  async setIdColumn(name, owner) {
    const section = this.#data?.sections?.[name];
    if (!section || section.idColumn === owner) return this;
    if (!SettingsService.ID_OWNERS.includes(owner)) return this;

    section.idColumn = owner;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * The schema version recorded for one kind of sheet.
   *
   * @param {string} name one of SettingsService.SECTIONS
   * @returns {number} 0 when nothing has been recorded yet
   */
  schemaOf(name) {
    return Number(this.#data?.schema?.[name]) || 0;
  }

  /**
   * Records which schema version a sheet is at.
   *
   * Written together with the instructions on Drive and by nothing
   * else, so the number in mirra.json and the number inside ai.md are
   * always two halves of the same write. An assistant that finds them
   * differing has learnt something true: Mirra has moved on since those
   * instructions were written, and it should stop rather than guess.
   *
   * @param {string} name one of SettingsService.SECTIONS
   * @param {number} version
   */
  async setSchema(name, version) {
    if (!this.#data || !SettingsService.SECTIONS.includes(name)) return this;
    if (this.#data.schema[name] === version) return this;

    this.#data.schema[name] = version;
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * What the instructions on Drive were last written for.
   *
   * Kept as readable text rather than as a hash on purpose: somebody
   * opening mirra.json and wondering why ai.md changed yesterday
   * should be able to read the answer, not identify it.
   *
   * @returns {{describes: string, sheet: string, tab: string}|null}
   */
  get guide() {
    return this.#data?.ai ?? null;
  }

  /**
   * @param {{describes: string, sheet: string, tab: string}} stamp
   */
  async setGuide(stamp) {
    if (!this.#data) return this;

    this.#data.ai = {
      file: config.AI_GUIDE.fileName,
      ...stamp,
      updatedAt: new Date().toISOString(),
    };
    this.#data.updatedAt = this.#data.ai.updatedAt;
    await this.save();
    return this;
  }

  /**
   * Stops the value check mentioning this sheet for a while.
   *
   * "Not now" is a real answer to a problem somebody cannot fix this
   * minute, and a tool that asks again every single visit is one people
   * learn to dismiss without reading — which costs the warning its whole
   * purpose on the day it finally matters.
   *
   * Dated rather than counted, and stored here rather than in the
   * browser, so that silencing it on a laptop also silences it on the
   * phone. It is the same sheet and the same person.
   *
   * @param {string} name one of SettingsService.SECTIONS
   * @param {number} days
   */
  async silence(name, days) {
    const section = this.#data?.sections?.[name];
    if (!section) return this;

    section.quietUntil = new Date(Date.now() + days * 86_400_000).toISOString();
    this.#data.updatedAt = new Date().toISOString();
    await this.save();
    return this;
  }

  /**
   * @param {string} name
   * @returns {boolean} whether the check should stay quiet for now
   */
  isSilenced(name) {
    const until = this.#data?.sections?.[name]?.quietUntil;
    if (!until) return false;

    const date = new Date(until);
    /* An unparseable date means a hand-edited file, and the cautious
       reading of nonsense is "not silenced": a warning shown once too
       often is a smaller harm than one never shown at all. */
    return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
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
      /* The shape of this file, and the shape of each sheet. All of
         them are separate numbers because they move independently:
         this file changes far less often than Mirra does, and a sheet
         of bookings arriving changes nothing about a client row.

         file is the one Mirra keeps for itself. The rest are there for
         whatever assistant the person works through — see config.SCHEMA
         and ai.md. */
      schema: { file: SettingsService.VERSION },
      version: "",
      language: "",
      dateFormat: config.DEFAULT_DATE_FORMAT,
      sections: Object.fromEntries(SettingsService.SECTIONS.map(name => [name, null])),
      /* What Mirra knows about spreadsheets other than the one in use:
         see setSection, which fills this in, and #archive. */
      sheets: {},
      /* What the instructions on Drive were written for. Absent until
         they have been written once. */
      ai: null,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Files the kept records: one small entry per spreadsheet, the most
   * recently left last.
   *
   * Capped, and oldest first out. Somebody who has tried a dozen
   * spreadsheets does not need Mirra carrying notes on all of them,
   * and a settings file that grows without limit is one nobody can
   * read — which would cost more than the question it saves.
   */
  #archive(section) {
    const sheets = this.#data.sheets;

    /* Deleted before being written so the key moves to the end: object
       keys keep their insertion order, and that order is the only
       record of which was used last. */
    delete sheets[section.spreadsheetId];

    sheets[section.spreadsheetId] = {
      sheetTitle: section.sheetTitle ?? "",
      managed: section.managed === true,
      lookVersion: Number(section.lookVersion) || 0,
      quietUntil: typeof section.quietUntil === "string" ? section.quietUntil : "",
      idColumn: SettingsService.ID_OWNERS.includes(section.idColumn) ? section.idColumn : "",
    };

    for (const id of Object.keys(sheets).slice(0, -SettingsService.REMEMBERED_SHEETS)) {
      delete sheets[id];
    }
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

    /* Files written before version 2 hold a bare number here: the shape
       of this file and nothing else. There is nothing to carry over —
       the file is about to be written in the new shape, and the number
       replacing it means something different. */
    if (raw.schema && typeof raw.schema === "object") {
      for (const name of SettingsService.SECTIONS) {
        const version = Number(raw.schema[name]);
        if (version > 0) safe.schema[name] = version;
      }
    }

    /* Kept notes about other spreadsheets. Read with the same suspicion
       as everything else here — anybody can edit this file — and
       trimmed to the cap, oldest first, in case it was edited into
       something enormous. */
    if (raw.sheets && typeof raw.sheets === "object") {
      const ids = Object.keys(raw.sheets).slice(-SettingsService.REMEMBERED_SHEETS);

      for (const id of ids) {
        const value = raw.sheets[id];
        if (!value || typeof value !== "object") continue;

        safe.sheets[id] = {
          sheetTitle: typeof value.sheetTitle === "string" ? value.sheetTitle : "",
          managed: value.managed === true,
          lookVersion: Number(value.lookVersion) || 0,
          quietUntil: typeof value.quietUntil === "string" ? value.quietUntil : "",
          idColumn: SettingsService.ID_OWNERS.includes(value.idColumn) ? value.idColumn : "",
        };
      }
    }

    /* Only the fields Mirra put there, and all of them text: this one
       is written for a person to read and for a string comparison, so
       anything that arrived in it by hand can be dropped without
       losing information Mirra needs. */
    if (raw.ai && typeof raw.ai === "object") {
      safe.ai = {
        file: config.AI_GUIDE.fileName,
        describes: String(raw.ai.describes ?? ""),
        sheet: String(raw.ai.sheet ?? ""),
        tab: String(raw.ai.tab ?? ""),
        updatedAt: String(raw.ai.updatedAt ?? ""),
      };
    }

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
          /* Until when the value check keeps quiet about this sheet.
             Kept per sheet rather than globally: silencing one sheet
             says nothing about another, and there will be more of them
             once bookings and finances arrive. */
          quietUntil: typeof value.quietUntil === "string" ? value.quietUntil : "",
          /* The appearance this sheet has been offered, whether or not
             the offer was taken. Absent means never asked, which is
             right for every sheet made before the question existed. */
          lookVersion: Number(value.lookVersion) || 0,
          /* Whose the ID column is — see the idColumn accessor. An
             unrecognised value is dropped rather than trusted: this
             one decides whether Mirra writes without asking. */
          idColumn: SettingsService.ID_OWNERS.includes(value.idColumn)
            ? value.idColumn
            : "",
        };
      }
    }

    return safe;
  }
}
