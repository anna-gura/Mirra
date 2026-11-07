import { t, plural } from "../locales/t.js";
import { ClientSchema } from "../domain/client/ClientSchema.js";
import { ClientId } from "../domain/client/ClientId.js";
import { ClientLinks } from "../domain/links/ClientLinks.js";
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

    const fixes = ClientId.repair(this.#snapshot.rows.map(row => row[column] ?? ""));

    /* A row somebody emptied in Sheets is not a client waiting for a
       reference. Writing one into it would turn a blank line into a
       person with no name, who then has to be deleted in Mirra to get
       rid of — and who was never there in the first place. */
    for (const index of fixes.keys()) {
      if (this.#isBlankRow(index)) fixes.delete(index);
    }

    return fixes;
  }

  /**
   * Rows that have a mark and it is wrong — cleared, overwritten, or
   * shared with another row after a copy and paste.
   *
   * Told apart from rows that simply never had one, because they are
   * not the same news. A missing mark on a new row is routine: a person
   * typed the row into Sheets on their laptop, or dictated it to an
   * assistant, and ai.md tells assistants to leave that cell empty for
   * exactly this reason. A mark that is present and wrong means
   * something happened to a row that already existed, and that is worth
   * saying out loud.
   *
   * @returns {number[]} row indexes
   */
  get damagedRows() {
    const column = this.#schema.indexOf("id");
    if (column < 0) return [];

    return [...this.idFixes.keys()]
      .filter(index => String(this.#snapshot.rows[index]?.[column] ?? "").trim());
  }

  /**
   * Ids that something in the sheet points at and that are no longer
   * there.
   *
   * This is what tells a cleared ID column apart from a sheet that
   * never had one. An id means nothing by itself — it is Mirra's
   * bookkeeping, and a fresh one does the same job as the one it
   * replaces. What makes losing them a loss is that relationships
   * between clients are written down by id, so a link pointing at an
   * id that has gone is a connection nobody can follow.
   *
   * Names survive in the link cell beside the ids, which is why this
   * is worth reporting rather than repairing silently: the person can
   * see who was connected to whom and make the links again.
   *
   * @returns {string[]}
   */
  get lostLinks() {
    const idColumn = this.#schema.indexOf("id");
    const linkColumn = this.#schema.indexOf("links");
    if (idColumn < 0 || linkColumn < 0) return [];

    const present = new Set(
      this.#snapshot.rows
        .map(row => String(row[idColumn] ?? "").trim())
        .filter(Boolean)
    );

    const lost = new Set();

    for (const row of this.#snapshot.rows) {
      for (const link of ClientLinks.parse(row[linkColumn] ?? "")) {
        if (link.id && !present.has(link.id)) lost.add(link.id);
      }
    }

    return [...lost];
  }

  /**
   * Whether the ID column holds Mirra's own ids. See ClientId.areOurs,
   * which says why this is asked of the contents and not of the file.
   *
   * @returns {boolean|null} null when there is nothing to judge by —
   *          no column, or no values in it
   */
  get idsAreOurs() {
    const column = this.#schema.indexOf("id");
    if (column < 0) return null;

    return ClientId.areOurs(this.#snapshot.rows.map(row => row[column]));
  }

  /**
   * @returns {boolean} whether anything suggests ids were lost rather
   *          than simply never written
   */
  get isDamaged() {
    if (this.damagedRows.length) return true;
    if (!this.lostLinks.length) return false;

    /* A link pointing nowhere is not by itself a reason to stop: old
       sheets collect them — a row deleted by hand months ago leaves
       one, and it stays dangling whether or not a new row gets its
       mark today. It becomes news when it coincides with most of the
       sheet having no mark at all, which is what a cleared column
       looks like and what no amount of adding clients ever does. */
    return this.idFixes.size * 2 > this.#snapshot.rows.length;
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
  question(version, language = ClientSchema.DEFAULT_LANGUAGE) {
    if (this.needsColumns) {
      const names = this.missingColumns
        .map(field => ClientSchema.labelFor(field, this.#schema.languageOf(language)));

      return {
        title: t("Оновити таблицю до версії {}?", version),
        message: t("Нові стовпці: {}", names.join(", ")),
        note: "Наявні стовпці й дані залишаться на місці — нове додається "
            + "в кінець таблиці. Без цього нові можливості не працюватимуть.",
        confirmLabel: "Оновити",
        cancelLabel: "Не зараз",
      };
    }

    const count = this.idFixes.size;

    /* Nothing was damaged: these rows arrived without a mark, which is
       what a row added outside Mirra looks like. Mirra fills those in
       by itself — this question is only ever asked about a column that
       is not Mirra's to write in, where the cells may have been left
       empty on purpose. */
    if (!this.isDamaged) {
      return {
        title: "Дописати позначки у стовпець ID?",
        message: t("{} {} без позначки", count,
                    plural(count, ["запис", "записи", "записів"])),
        note: "Стовпець ID у цій таблиці з'явився не з Mirra, тож вона не пише в "
            + "нього без дозволу. Це службовий стовпець: за ним Mirra впізнає людину "
            + "у зв'язках між клієнтами, і на решту даних він не впливає — ні на "
            + "імена, ні на телефони, ні на нотатки. Заповнені клітинки не "
            + "змінюються, позначки з'являться лише в порожніх.",
        confirmLabel: "Дописати",
        cancelLabel: "Не чіпати",
      };
    }

    return {
      title: "Технічні позначки пошкоджено",
      message: t("{} {} без правильної позначки", count,
                  plural(count, ["запис", "записи", "записів"])),
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
  async apply(sheets, saved, interfaceLanguage = ClientSchema.DEFAULT_LANGUAGE) {
    let snapshot = this.#snapshot;

    /* The sheet's own language, so a column added to a Ukrainian sheet
       matches the ones beside it whatever the interface is showing. */
    const language = this.#schema.languageOf(interfaceLanguage);

    const missing = this.missingColumns;
    if (missing.length) {
      await sheets.addColumns(
        snapshot,
        missing.map(field => ClientSchema.labelFor(field, language))
      );
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

  /* ---------------- private ---------------- */

  /** @param {number} index into snapshot.rows */
  #isBlankRow(index) {
    return (this.#snapshot.rows[index] ?? []).every(cell => !String(cell ?? "").trim());
  }
}
