import { t, plural } from "../../locales/t.js";
import { ClientSchema } from "./ClientSchema.js";
import { PhoneNumber } from "../values/PhoneNumber.js";
import { DateValue } from "../values/DateValue.js";

/**
 * SheetCheck — damage in the sheet that Mirra can see but has, until
 * now, only worked around.
 *
 * Sister to SchemaUpgrade, and deliberately shaped like it. That one
 * answers "is this sheet behind, or are its ids broken"; this one
 * answers "did something outside Mirra mangle the values". Both are
 * about a file Mirra does not own and cannot watch.
 *
 * The reason it exists is a gap worth naming. PhoneNumber already
 * repairs a number Sheets damaged — a leading zero eaten off a
 * Ukrainian mobile — but it repairs it *on the way out*, for display.
 * The cell keeps the broken value. For anybody using Mirra that is
 * invisible and fine; for anybody reading the spreadsheet itself, or
 * for an assistant writing into it, the sheet is simply wrong. Showing
 * the right number while storing the wrong one is a kindness with a
 * short shelf life.
 *
 * Checks come in two kinds. One runs on every column Mirra knows,
 * because a spreadsheet error value means the same thing wherever it
 * appears. The others know what their column is for: a phone has a
 * plausible number of digits, a date can be read as a date.
 *
 * The id column is not checked here. SchemaUpgrade already repairs
 * missing and duplicated ids, and two features reporting the same
 * damage would ask the same question twice.
 *
 * It runs over rows already in memory, so it costs no request. The
 * arithmetic is a few string tests per row: thousands of clients are
 * still single-digit milliseconds, which is why it can run on every
 * visit rather than only when something suggests it should.
 */
export class SheetCheck {
  /**
   * Columns worth looking at, and what each kind of value allows.
   *
   * id is absent on purpose — see the class comment.
   */
  static FIELDS = Object.freeze([
    "firstName", "lastName", "phone", "birthday",
    "links", "socials", "messengers", "lastVisit", "notes",
  ]);

  static PHONE_FIELDS = Object.freeze(["phone"]);
  static DATE_FIELDS  = Object.freeze(["birthday", "lastVisit"]);

  /**
   * Columns holding whatever somebody felt like writing.
   *
   * Exempt from the scientific-notation test, which elsewhere is proof
   * of damage. In a note it is not: "1.5E+10" could be a product code,
   * a lot number or a joke, and none of those are Mirra's business.
   */
  static FREE_TEXT_FIELDS = Object.freeze(["notes", "socials", "messengers", "links"]);

  /** How many names a message lists before it starts counting instead. */
  static NAMES_SHOWN = 2;

  /**
   * Every error a spreadsheet formula can leave behind.
   *
   * Listed rather than matched as "starts with #", because a note
   * beginning with # is a tag — the feature people use most — and
   * treating their tags as damage would be worse than missing an error.
   */
  static ERRORS = Object.freeze(new Set([
    "#ERROR!", "#REF!", "#NAME?", "#VALUE!", "#DIV/0!",
    "#N/A", "#NUM!", "#NULL!", "#SPILL!", "#GETTING_DATA",
  ]));

  /**
   * A number that reached the cell as a number and was too long to show
   * in full: 380671234567 comes back as 3.80671E+11. The digits past
   * the sixth are gone, not hidden — Sheets rounded them away — so
   * there is nothing to repair and nothing to be gained by pretending
   * otherwise.
   */
  static SCIENTIFIC = /^[+-]?\d(?:\.\d+)?e[+-]?\d+$/i;

  /**
   * What a telephone number can be.
   *
   * Fifteen is the most digits any number in the world has: E.164 fixes
   * it, and every network on earth follows that. Seven is the fewest
   * that can reach anybody. Outside those two there is no number to
   * dial, whatever the cell says — so it is reported rather than shown
   * as though a tap would ring somebody.
   */
  static PHONE_MAX_DIGITS = 15;
  static PHONE_MIN_DIGITS = 7;

  #snapshot;
  #schema;
  #dateFormat;
  #language;
  #phoneFixes = null;
  #damaged = null;

  /**
   * @param {import("../../services/SheetsRepository.js").SheetSnapshot} snapshot
   * @param {object} [options]
   * @param {ClientSchema} [options.schema] reused when the caller has one
   * @param {string} [options.dateFormat] decides day-first or month-first
   * @param {string} [options.language] what the column names are called
   */
  constructor(snapshot, {
    schema = null,
    dateFormat = DateValue.DEFAULT_FORMAT,
    language = ClientSchema.DEFAULT_LANGUAGE,
  } = {}) {
    this.#snapshot = snapshot;
    this.#schema = schema ?? new ClientSchema(snapshot.headers);
    this.#dateFormat = dateFormat;
    this.#language = language;
  }

  /**
   * Phone cells whose stored text has lost digits that can be put back.
   *
   * Shaped as SchemaUpgrade.idFixes is — row index to the value that
   * belongs there — so that SheetsRepository.writeColumn takes it
   * unchanged.
   *
   * @returns {Map<number, string>}
   */
  get phoneFixes() {
    if (!this.#phoneFixes) this.#examine();
    return this.#phoneFixes;
  }

  /**
   * Values that are damaged beyond reading, and where each one sits.
   *
   * Reported rather than repaired, and reported by name: "three numbers
   * are unreadable" tells somebody they have a problem, while "Олена's
   * and Тетяна's numbers are unreadable" tells them what to do next.
   *
   * The column's own name is carried rather than the field key, so that
   * grouping a message does not have to translate anything afterwards.
   *
   * @returns {Array<{row: number, column: number, label: string, name: string}>}
   */
  get damaged() {
    if (!this.#damaged) this.#examine();
    return this.#damaged;
  }

  /** @returns {boolean} something can be put back */
  get needsFixes() {
    return this.phoneFixes.size > 0;
  }

  /** @returns {boolean} something is broken and cannot be */
  get hasDamage() {
    return this.damaged.length > 0;
  }

  /** @returns {boolean} */
  get isNeeded() {
    return this.needsFixes || this.hasDamage;
  }

  /**
   * The row to open when somebody chooses to fix it by hand.
   * @returns {number} 1-based row number in the sheet, or 0
   */
  get firstDamagedRow() {
    const first = this.damaged[0];
    /* +2: one for the header, one because sheets count from one. */
    return first ? first.row + 2 : 0;
  }

  /**
   * Asks before writing into cells somebody else's edit left damaged.
   *
   * Always asked, even for a sheet Mirra made. Adding a column to its
   * own sheet is Mirra tidying after itself; overwriting a value is
   * Mirra disagreeing with whatever last wrote there. The second one
   * is not its call to make quietly — and the same rule already governs
   * repairing ids, for the same reason.
   *
   * @returns {{title: string, message: string, note: string,
   *            confirmLabel: string, cancelLabel: string}}
   */
  question() {
    const count = this.phoneFixes.size;

    /* Impersonal "пошкоджено" rather than a verb that agrees with the
       count: один номер пошкоджено, три номери пошкоджено, п'ять
       номерів пошкоджено. One form, every number, no conjugation table.
       SchemaUpgrade solves the same problem the same way. */
    const lines = [
      t("{} {} пошкоджено.", count, plural(count, ["номер", "номери", "номерів"])),
      /* What cannot be mended travels in the same dialog, not in a
         notice beside it. It was found in the same pass and it concerns
         the same sheet; splitting it across two containers means one of
         them is read and the other is not.

         It goes in the message rather than the note because the note is
         a single sentence the dialog translates as a whole, and a
         translated fragment spliced into it would leave the surrounding
         words in Ukrainian for an English reader. */
      this.warning(),
    ].filter(Boolean);

    return {
      title: "Відновити номери телефонів?",
      message: lines.join(" "),
      /* "Таблицю" as the subject, not "їх": the sentence then reads the
         same for one number and for twenty, with no agreement to get
         wrong. */
      note: "Схоже, таблицю редагували поза Mirra, і вона прочитала номер як "
          + "число — так зникає нуль на початку. Ті номери, які Mirra може "
          + "відновити, вона запише назад. Інші дані не зміняться. "
          + "Якщо не чіпати, Mirra не нагадає про це наступні 7 днів.",
      confirmLabel: "Відновити",
      cancelLabel: "Не чіпати",
    };
  }

  /** The answers report() offers. */
  static CLEAR  = "clear";
  static MANUAL = "manual";
  static QUIET  = "quiet";

  /**
   * The dialog for damage nothing can undo.
   *
   * Shown instead of question() when there is nothing to offer back:
   * the value is gone, so there is no repair to agree to. Three answers
   * rather than an acknowledgement, because "we found a problem you
   * cannot act on from here" is the kind of message that reappears
   * every visit and teaches people to click it away without reading.
   *
   * Each answer ends the matter in a different way. Clearing empties
   * the cells, so the field reads as blank rather than as rubbish.
   * Opening the card is for fixing it properly, by typing in what the
   * value actually was. Going quiet is for later — it is a real answer
   * and deserves a real button, not a dialog that keeps asking until it
   * gets the one it wants.
   *
   * @returns {{title: string, message: string, note: string,
   *            options: Array<{id: string, label: string}>,
   *            cancelLabel: string}}
   */
  report() {
    const first = this.damaged[0];

    return {
      title: "Частина даних не читається",
      message: this.warning(),
      note: "Схоже, таблицю редагували поза Mirra, і ці значення пошкодилися "
          + "так, що відновити їх неможливо. Mirra нічого не змінювала й не "
          + "змінить без вашої згоди.",
      options: [
        {
          id: SheetCheck.MANUAL,
          /* Named, because "open the card" invites the question "whose?"
             — and the answer is already known. */
          label: first
            ? t("Відкрити картку: {}", first.name)
            : t("Відкрити картку"),
        },
        { id: SheetCheck.CLEAR, label: t("Очистити пошкоджені клітинки") },
        { id: SheetCheck.QUIET, label: t("Не нагадувати 7 днів") },
      ],
      cancelLabel: "Закрити",
    };
  }

  /**
   * The extra question asked before anything is emptied.
   *
   * Clearing is the one action here that destroys something, and what
   * it destroys might have been readable to a person even though Mirra
   * could not parse it — a date written as "перед Великоднем" means
   * something to whoever wrote it. So it is asked twice, and the second
   * question says plainly that this is deletion.
   *
   * @returns {{title: string, message: string, note: string,
   *            confirmLabel: string, cancelLabel: string, danger: boolean}}
   */
  clearQuestion() {
    const count = this.damaged.length;

    return {
      title: "Очистити ці клітинки?",
      message: t("{} {} буде видалено.", count,
                 plural(count, ["значення", "значення", "значень"])),
      note: "Клітинки стануть порожніми, і поля в картці читатимуться як "
          + "незаповнені. Те, що там написано зараз, Mirra прочитати не може — "
          + "але ви, можливо, можете. Якщо там є щось зрозуміле вам, спершу "
          + "перепишіть це собі: скасувати видалення Mirra не вміє.",
      confirmLabel: "Видалити",
      cancelLabel: "Не видаляти",
      danger: true,
    };
  }

  /**
   * One line naming what could not be read.
   *
   * Empty when there is nothing to say, so the caller can use it
   * without checking twice.
   *
   * @returns {string}
   */
  warning() {
    if (!this.damaged.length) return "";

    /* Grouped by column, not listed flat, and names deduplicated within
       each group. One person with both a broken number and a broken date
       is one person — a flat list counts them twice and then reports
       more casualties than there are rows, which is alarming and wrong.
       Grouping also makes the message actionable: a lost number means
       asking them for it again, a lost date means looking it up, and
       those are different errands. */
    const groups = new Map();

    for (const { label, name } of this.damaged) {
      if (!groups.has(label)) groups.set(label, []);
      const names = groups.get(label);
      if (name && !names.includes(name)) names.push(name);
    }

    const parts = [...groups.entries()].map(([label, names]) => {
      const column = label.toLocaleLowerCase("uk");
      const shown = names.slice(0, SheetCheck.NAMES_SHOWN);
      const rest = names.length - shown.length;

      return rest > 0
        ? t("{} — {} і ще {}", column, shown.join(", "), rest)
        : t("{} — {}", column, shown.join(", "));
    });

    return t("Не вдалося прочитати: {}.", parts.join("; "));
  }

  /**
   * Writes the repairs back.
   *
   * One batched call for the whole column, as SchemaUpgrade does: two
   * hundred separate writes would be slow enough that somebody closes
   * the tab halfway and leaves the sheet half-mended.
   *
   * @param {import("../../services/SheetsRepository.js").SheetsRepository} sheets
   * @returns {Promise<Map<number, string>>} what was written
   */
  async apply(sheets) {
    const fixes = this.phoneFixes;
    if (!fixes.size) return fixes;

    const column = this.#schema.indexOf("phone");
    if (column < 0) return new Map();

    await sheets.writeColumn(this.#snapshot, column, fixes);
    return fixes;
  }

  /**
   * Empties the cells that cannot be read.
   *
   * One call per column rather than one per cell, and grouped here
   * rather than by the caller, so that the knowledge of which column
   * each finding came from stays in the class that found it.
   *
   * @param {import("../../services/SheetsRepository.js").SheetsRepository} sheets
   * @returns {Promise<Array<{column: number, rows: number[]}>>} what was
   *          emptied, so the caller can match its own copy of the rows
   */
  async clear(sheets) {
    const byColumn = new Map();

    for (const { row, column } of this.damaged) {
      if (!byColumn.has(column)) byColumn.set(column, new Set());
      byColumn.get(column).add(row);
    }

    const emptied = [];

    for (const [column, rows] of byColumn) {
      const list = [...rows];
      await sheets.clearCells(this.#snapshot, column, list);
      emptied.push({ column, rows: list });
    }

    return emptied;
  }

  /* ---------------- private ---------------- */

  #examine() {
    this.#phoneFixes = new Map();
    this.#damaged = [];

    for (const [row, values] of this.#snapshot.rows.entries()) {
      for (const field of SheetCheck.FIELDS) this.#checkField(values, field, row);
    }
  }

  #checkField(values, field, row) {
    const column = this.#schema.indexOf(field);
    if (column < 0) return;

    const raw = this.#schema.read(values, field);
    if (!raw) return;

    /* A formula error means the same thing in every column, so it is
       tested first and nothing else is asked about that cell. */
    if (SheetCheck.ERRORS.has(raw.toUpperCase())) {
      return this.#report(values, field, column, row);
    }

    if (!SheetCheck.FREE_TEXT_FIELDS.includes(field)
        && SheetCheck.SCIENTIFIC.test(raw)) {
      return this.#report(values, field, column, row);
    }

    if (SheetCheck.PHONE_FIELDS.includes(field)) {
      return this.#checkPhone(values, field, column, row, raw);
    }

    if (SheetCheck.DATE_FIELDS.includes(field)) {
      return this.#checkDate(values, field, column, row, raw);
    }
  }

  #checkPhone(values, field, column, row, raw) {
    const phone = new PhoneNumber(raw);
    const digits = phone.digits.length;

    /* Not a telephone number at all, whatever it is. Too many digits to
       dial anywhere, or too few to reach anybody. */
    if (digits > SheetCheck.PHONE_MAX_DIGITS || digits < SheetCheck.PHONE_MIN_DIGITS) {
      return this.#report(values, field, column, row);
    }

    /* PhoneNumber puts back a digit the sheet dropped. When what it
       ended up with differs from what the cell holds, the cell is the
       one Mirra already disbelieves — it has been showing the repaired
       number all along, so writing it back only makes the sheet agree
       with the screen.

       The repair rests on an assumption: nine digits opening with a
       Ukrainian mobile code were ten with a zero in front. A genuine
       nine-digit foreign number matching one of those sixteen prefixes
       would be rewritten wrongly. That is why this is never applied
       without asking, and why the question says plainly what it is
       about to do. */
    if (phone.digits === raw.replace(/\D/g, "")) return;

    /* No leading apostrophe here, and the reason matters. Elsewhere
       Mirra marks phones with one, because updateRow and appendRow send
       USER_ENTERED and the apostrophe is what stops Sheets reading the
       digits as a number. This goes out through writeColumn, which
       sends RAW — the string is stored exactly as given, unparsed — so
       the marker would survive as a visible apostrophe in the cell.
       See SheetsRepository.writeColumn before changing either. */
    this.#phoneFixes.set(row, phone.display);
  }

  #checkDate(values, field, column, row, raw) {
    if (!new DateValue(raw, this.#dateFormat).isValid) {
      this.#report(values, field, column, row);
    }
  }

  #report(values, field, column, row) {
    this.#damaged.push({
      row,
      column,
      label: ClientSchema.labelFor(field, this.#language),
      name: this.#nameIn(values, row),
    });
  }

  /**
   * How to refer to a row in a message.
   *
   * Normally the person's name. But the broken cell is sometimes the
   * name itself, and then "ім'я — #REF!" reads as though somebody is
   * called #REF! — so a damaged name is not used as a label for its own
   * damage. The row number takes over, which is what somebody needs
   * anyway to go and find it in the spreadsheet.
   */
  #nameIn(values, row) {
    const name = ["firstName", "lastName"]
      .map(field => this.#schema.read(values, field))
      .filter(value => value && !this.#isDamaged(value))
      .join(" ");

    /* +2 to match what the spreadsheet shows in its row headers: one
       for the header row, one because sheets count from one. */
    return name || t("рядок {}", row + 2);
  }

  #isDamaged(value) {
    return SheetCheck.ERRORS.has(value.toUpperCase())
        || SheetCheck.SCIENTIFIC.test(value);
  }
}
