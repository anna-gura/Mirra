import { ClientSchema } from "../domain/ClientSchema.js";
import { ClientId } from "../domain/ClientId.js";
import { config } from "../config.js";

/**
 * SchemaUpgrade — bringing a sheet up to what this version needs.
 *
 * Two things can be out of date, and they are checked separately
 * because they are repaired differently. Columns may be missing, which
 * needs the sheet widened. Rows may lack an id or share one with
 * another row, which needs values written.
 *
 * Neither is ever done to a sheet the user brought themselves without
 * asking first. That rule has not changed since it was written, and it
 * is the reason Mirra can be trusted with a file it did not create.
 */
export class SchemaUpgrade {
  #snapshot;
  #schema;

  /**
   * @param {import("./SheetsRepository.js").SheetSnapshot} snapshot
   */
  constructor(snapshot) {
    this.#snapshot = snapshot;
    this.#schema = new ClientSchema(snapshot.headers);
  }

  /** @returns {ClientSchema} */
  get schema() {
    return this.#schema;
  }

  /**
   * Columns this version expects and the sheet does not have.
   * @returns {string[]} field names
   */
  get missingColumns() {
    return this.#schema.missing();
  }

  /**
   * Rows whose id is absent or duplicated.
   *
   * Empty when there is no id column at all — nothing can be repaired
   * until the column exists, and reporting rows to fix that cannot be
   * fixed would only be noise.
   *
   * @returns {Map<number, string>} row index → the id it should have
   */
  get idFixes() {
    const column = this.#schema.indexOf("id");
    if (column < 0) return new Map();

    return ClientId.repair(this.#snapshot.rows.map(row => row[column] ?? ""));
  }

  /** @returns {boolean} whether anything at all needs doing */
  get isNeeded() {
    return this.needsColumns || this.needsRepair;
  }

  /** @returns {boolean} this version expects columns the sheet lacks */
  get needsColumns() {
    return this.missingColumns.length > 0;
  }

  /**
   * @returns {boolean} ids are missing or duplicated in a sheet that
   *          already has the column for them
   */
  get needsRepair() {
    return this.idFixes.size > 0;
  }

  /**
   * Two different things happen to a sheet and they are not the same
   * news.
   *
   * A sheet made by an older version is simply behind, and catching up
   * adds something new. A sheet whose ids were cleared or copied has
   * been damaged — by a hand edit, a pasted row, a column deleted in
   * Sheets — and repairing it puts back something that was there.
   *
   * Telling somebody their file needs "оновлення" when it actually
   * needs mending is both wrong and unhelpful: it hides that anything
   * went wrong, and it explains nothing about why.
   *
   * @returns {{title: string, message: string, note: string,
   *            confirmLabel: string, cancelLabel: string}}
   */
  question(version) {
    if (this.needsColumns) {
      return {
        title: `Оновити таблицю до версії ${version}?`,
        message: `Нові стовпці: ${this.missingColumns.map(ClientSchema.labelFor).join(", ")}`,
        note: "Наявні стовпці й дані залишаться на місці — нове додається "
            + "в кінець таблиці. Без цього нові можливості не працюватимуть.",
        confirmLabel: "Оновити",
        cancelLabel: "Не зараз",
      };
    }

    const count = this.idFixes.size;

    return {
      title: "Технічні позначки пошкоджено",
      message: `${count} ${SchemaUpgrade.pluraliseRows(count)} без правильної позначки`,
      note: "Стовпець ID містить службові позначки, за якими Mirra впізнає клієнтів "
          + "у зв'язках між ними. Схоже, їх змінили або видалили поза Mirra. "
          + "Відновити? Інші дані не зміняться, але зв'язки на пошкоджені записи "
          + "доведеться створити заново.",
      confirmLabel: "Відновити",
      cancelLabel: "Не чіпати",
    };
  }

  /**
   * Ukrainian needs three plural forms for rows.
   * @param {number} count
   * @returns {string}
   */
  static pluraliseRows(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;

    if (lastTwo > 10 && lastTwo < 20) return "записів";
    if (lastOne === 1) return "запис";
    if (lastOne >= 2 && lastOne <= 4) return "записи";
    return "записів";
  }

  /**
   * Performs the upgrade.
   *
   * Columns first, then ids: the ids have nowhere to go until the
   * column they live in exists, and the sheet has to be re-read in
   * between to learn where that column ended up.
   *
   * @param {import("./SheetsRepository.js").SheetsRepository} sheets
   * @param {object} saved the section as recorded in settings
   * @returns {Promise<object>} the sheet as it now stands
   */
  async apply(sheets, saved) {
    let snapshot = this.#snapshot;

    const missing = this.missingColumns;
    if (missing.length) {
      await sheets.addColumns(snapshot, missing.map(ClientSchema.labelFor));
      snapshot = await sheets.load(saved.spreadsheetId, saved.sheetTitle);

      /* Newly added, so nobody has had a chance to type in it yet — the
         warning is set now, before they do. */
      if (missing.includes("id")) {
        const column = new ClientSchema(snapshot.headers).indexOf("id");
        await sheets.protectColumn(snapshot, column).catch(error =>
          console.warn("Could not protect the id column", error));
      }
    }

    const fixes = new SchemaUpgrade(snapshot).idFixes;
    if (fixes.size) {
      const column = new ClientSchema(snapshot.headers).indexOf("id");
      await sheets.writeColumn(snapshot, column, fixes);
      snapshot = await sheets.load(saved.spreadsheetId, saved.sheetTitle);
    }

    return snapshot;
  }

  /**
   * @param {string} version the version that last touched this sheet
   * @returns {boolean} whether this build is newer
   */
  static isNewerThan(version) {
    const parse = text => String(text ?? "0")
      .split(".")
      .map(part => Number.parseInt(part, 10) || 0);

    const [a, b, c] = parse(config.VERSION);
    const [x, y, z] = parse(version);

    if (a !== x) return a > x;
    if (b !== y) return b > y;
    return c > z;
  }
}
