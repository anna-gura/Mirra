import { t } from "../locales/t.js";
import { config } from "../config.js";
import { ColumnOrder } from "../domain/client/ColumnOrder.js";

/**
 * SheetLook — offering to bring an older sheet up to how Mirra now
 * makes them.
 *
 * Third sibling to SchemaUpgrade and SheetCheck. That one asks whether
 * the sheet has the columns this version needs; the second whether its
 * values are still readable; this one whether it still looks the way
 * Mirra would make it today. None of the three is about the data being
 * wrong — they are about a file Mirra does not own drifting away from
 * what Mirra would have built.
 *
 * What is offered depends on whose sheet it is, and the line is drawn
 * at what can be taken back.
 *
 * Row colours and a frozen heading go to every sheet. They are added
 * rather than overwritten, and anybody who dislikes them can lift them
 * from Sheets' own menu in two clicks — so there is nothing to protect
 * somebody from. A sheet Mirra made also gets its heading row set in
 * bold and in Mirra's ink, which a brought sheet does not: that one
 * writes over whatever formatting was there, and theirs does not come
 * back.
 *
 * Moving columns is only ever offered for a sheet Mirra created. A
 * formula somewhere pointing at a cell in somebody's own spreadsheet
 * cannot be found again once the column under it has moved, and that
 * is not a risk to take on their behalf for the sake of tidiness.
 * There is no option to force it; the question is simply never asked.
 *
 * Remembered by version rather than by a date. "Not now" means not
 * until the look actually changes again — so a release that leaves the
 * appearance alone asks nothing, and the person who declined once is
 * not asked a hundred times about the same thing. That is a different
 * rule from the seven-day silence on SheetCheck, deliberately: there,
 * the damage is still there and still worth mentioning later; here,
 * there is nothing new to say until Mirra itself changes its mind.
 */
export class SheetLook {
  #snapshot;
  #saved;
  #order = null;

  /**
   * @param {import("./SheetsRepository.js").SheetSnapshot} snapshot
   * @param {object} options
   * @param {object} options.saved the section as recorded in settings
   */
  constructor(snapshot, { saved }) {
    this.#snapshot = snapshot;
    this.#saved = saved ?? {};
  }

  /** @returns {number} the look this build would apply */
  static get version() {
    return config.SHEET_LOOK.version;
  }

  /**
   * @returns {boolean} whether to offer anything at all
   */
  get isNeeded() {
    return SheetLook.version > (Number(this.#saved.lookVersion) || 0);
  }

  /** @returns {boolean} whether this is a sheet Mirra made */
  get isOwn() {
    return this.#saved.managed === true;
  }

  /**
   * What moving the columns would do, worked out once.
   * @returns {{moves: Array<{from: number, to: number}>, headers: string[], isNeeded: boolean}}
   */
  get order() {
    this.#order ??= ColumnOrder.plan(this.#snapshot.headers, config.NEW_SHEET.fields);
    return this.#order;
  }

  /** @returns {boolean} whether any column would change position */
  get movesColumns() {
    return this.isOwn && this.order.isNeeded;
  }

  /**
   * The question, naming everything it is about to do.
   *
   * Columns are the part that needs a warning, and it is given plainly
   * rather than softened. Mirra finds its columns by name and does not
   * care where they sit — so moving them buys tidiness and nothing
   * else, and anybody who has a formula pointing at a cell deserves to
   * weigh that trade themselves rather than discover it afterwards.
   *
   * @returns {{title: string, message: string, note: string,
   *            confirmLabel: string, cancelLabel: string}}
   */
  question() {
    const changes = [t("кольори рядків"), t("закріплений заголовок")];
    if (this.movesColumns) changes.push(t("порядок стовпців"));

    return {
      title: "Оновити вигляд таблиці?",
      message: t("Зміниться: {}.", changes.join(", ")),
      note: this.#noteFor(),
      confirmLabel: "Оновити вигляд",
      cancelLabel: "Не зараз",
    };
  }

  /**
   * Three situations, three whole sentences.
   *
   * Written out in full rather than assembled from fragments: the
   * dialog translates a note as one string, so a sentence stitched
   * together from pieces would come out half in Ukrainian for anybody
   * reading in English.
   */
  #noteFor() {
    if (this.movesColumns) {
      return "Таблиця читатиметься так, як Mirra робить їх тепер. Стовпці, які "
           + "ви додали самі, не рухаються. Але якщо десь — в іншому аркуші, у "
           + "діаграмі, у фільтрі чи в умовному форматуванні — є посилання на "
           + "конкретну клітинку цієї таблиці, воно може зламатися, бо стовпці "
           + "Mirra поміняються місцями. Дані не зміняться. Якщо відмовитися, "
           + "Mirra не спитає знову, доки вигляд не зміниться в новому випуску.";
    }

    if (this.isOwn) {
      return "Таблиця читатиметься так, як Mirra робить їх тепер. Дані не "
           + "зміняться. Якщо відмовитися, Mirra не спитає знову, доки вигляд "
           + "не зміниться в новому випуску.";
    }

    /* Somebody else's sheet. The promise that this can be undone is the
       whole reason it is acceptable to offer at all, so it is said
       rather than implied. */
    return "Цю таблицю створили не в Mirra, тож змінюються лише кольори рядків "
         + "і закріплення заголовка. Ні дані, ні порядок стовпців, ні ваше "
         + "оформлення не чіпаються, а самі кольори ви можете прибрати в Google "
         + "Таблицях: Формат → Чергові кольори → Видалити. Якщо відмовитися, "
         + "Mirra не спитає знову, доки вигляд не зміниться в новому випуску.";
  }

  /**
   * Moves the columns, then paints.
   *
   * In that order, and the order matters: painting first would style
   * the sheet as it stands and then shuffle the columns underneath the
   * heading row.
   *
   * @param {import("./SheetsRepository.js").SheetsRepository} sheets
   * @returns {Promise<import("./SheetsRepository.js").SheetSnapshot>}
   *          the sheet as it now stands, re-read if anything moved
   */
  async apply(sheets) {
    let snapshot = this.#snapshot;

    if (this.movesColumns) {
      await sheets.moveColumns(snapshot, this.order.moves);
      /* Read back rather than patched locally: moving a column also
         moves the protected range on the id column and the date
         validation on the date columns, and only the sheet itself knows
         where those ended up. */
      snapshot = await sheets.load(this.#saved.spreadsheetId, this.#saved.sheetTitle);
    }

    await sheets.applyLook(snapshot, { styleHeading: this.isOwn });

    return snapshot;
  }
}
