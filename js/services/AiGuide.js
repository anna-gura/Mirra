import { t, translator } from "../locales/t.js";
import { PageLink } from "../locales/pageLink.js";
import { config } from "../config.js";
import { ClientSchema } from "../domain/client/ClientSchema.js";
import { DateValue } from "../domain/values/DateValue.js";

/**
 * AiGuide — the instructions Mirra leaves beside the data.
 *
 * People manage their records through assistants: they dictate a new
 * client to ChatGPT, give it the folder, and it writes the row. That
 * happens whether or not Mirra approves of it, and an assistant left to
 * work out the rules for itself gets them wrong in ways nobody notices
 * for months — a phone number stored as a number and rounded off, a row
 * deleted with a relationship still pointing at it, an id invented
 * twice.
 *
 * So the rules are written down, in the folder, next to the sheet they
 * describe.
 *
 * Three decisions are worth explaining.
 *
 * **On Drive, not on the site.** An assistant reading mirra.day would
 * be reading about the Mirra that was released, which is not
 * necessarily the one this person's sheet has been through: somebody
 * who has not opened the app since Friday has Friday's sheet, and the
 * file beside it says so. The copy that travels with the data is the
 * only one that can be checked against the data.
 *
 * **In English, whatever language the person uses.** The file is read
 * by machines and the instructions in it are precise; English is what
 * they handle most reliably, and a mistranslated rule is worse than a
 * foreign one. Only the notice at the top is translated, because only
 * the notice is addressed to a person. The file tells the assistant,
 * twice, to answer in whatever language it is being spoken to in.
 *
 * **Generated, not shipped.** Every sheet is different — its headings
 * may be in either language or in somebody's own shorthand, its date
 * format is a setting, its ids are its own — and a general description
 * of a Mirra sheet would be exactly the kind of nearly-right that leads
 * an assistant to write into the wrong column. What goes to Drive
 * describes this sheet and no other.
 *
 * Rewritten only when something it says has changed, which is checked
 * by comparing a readable line in mirra.json rather than by reading the
 * file back. Writing it on every visit would be a Drive request for
 * nothing, and a modification date that tells the person nothing.
 */
export class AiGuide {
  static SECTION = "clients";

  /** 16 May 1998: unambiguous in every order, so the example teaches. */
  static EXAMPLE_ISO = "1998-05-16";

  /**
   * A leading zero is the point of this example, not the country: it is
   * the digit that disappears when a number is stored as a number.
   */
  static PHONE_EXAMPLE = "0671234567";

  /**
   * A working copy writes the file every time; a release writes it when
   * something it says has changed.
   *
   * The stamp is made of what a release moves — the version, the
   * schema, the headings — and in a checkout none of those ever move:
   * VERSION stays 0.0.0-dev while the template is edited twenty times
   * in an afternoon, so nothing rewrites the file and the only wording
   * nobody can see is the wording being worked on. Every change to the
   * template reaches people through a release, and the version in the
   * stamp carries it, so production needs no such rule.
   *
   * @returns {boolean}
   */
  static get isDevelopment() {
    return String(config.VERSION).endsWith("-dev");
  }

  /**
   * What each column holds, said for the assistant rather than for the
   * person. Terse on purpose — the file explains the ones with rules of
   * their own in sections below, and a table that repeats them is a
   * table nobody reads to the end.
   */
  static MEANING = Object.freeze({
    id:         "Mirra's reference for this person. Never write it, never change it.",
    firstName:  "Given name.",
    lastName:   "Family name.",
    phone:      "One phone number, stored as text.",
    socials:    "Social accounts, written `Network: handle`.",
    messengers: "Messengers, written `Network: handle`.",
    birthday:   "Date of birth. The year is optional.",
    links:      "Who this person is related to. Mirra writes this one.",
    lastVisit:  "The date of their last visit.",
    notes:      "Free text, and `#tags` the person searches by.",
  });

  /** field → the placeholder standing for its heading in the template. */
  static PLACEHOLDER = Object.freeze({
    id:         "COL_ID",
    firstName:  "COL_FIRST_NAME",
    lastName:   "COL_LAST_NAME",
    phone:      "COL_PHONE",
    socials:    "COL_SOCIALS",
    messengers: "COL_MESSENGERS",
    birthday:   "COL_BIRTHDAY",
    links:      "COL_LINKS",
    lastVisit:  "COL_LAST_VISIT",
    notes:      "COL_NOTES",
  });

  #drive;
  #settings;

  /**
   * @param {object} deps
   * @param {import("./DriveRepository.js").DriveRepository} deps.drive
   * @param {import("./SettingsService.js").SettingsService} deps.settings
   */
  constructor({ drive, settings }) {
    this.#drive = drive;
    this.#settings = settings;
  }

  /**
   * Writes the file if it is missing or out of date, and otherwise does
   * nothing at all.
   *
   * @param {import("./SheetsRepository.js").SheetSnapshot} snapshot
   * @returns {Promise<boolean>} whether anything was written
   */
  async refresh(snapshot) {
    const folderId = this.#settings.folderId;
    if (!folderId || !snapshot?.headers) return false;

    const stamp = this.#stamp(snapshot);

    /* Looked for every time rather than trusted to the stamp: somebody
       who deleted the file meant to delete it, but somebody who deleted
       it and then asked an assistant to add a client is better served by
       having it back. One listing in the background is a small price. */
    const existing = await this.#drive.findInFolder(config.AI_GUIDE.fileName, folderId);
    if (existing && !AiGuide.isDevelopment && this.#isCurrent(stamp)) return false;

    const text = await this.#render(snapshot, folderId);

    if (existing) await this.#drive.updateText(existing.id, text);
    else await this.#drive.createText(config.AI_GUIDE.fileName, folderId, text);

    /* The number in mirra.json and the number inside the file are two
       halves of one write, in that order: a settings file claiming a
       schema the instructions have not caught up with would stop every
       assistant that checks, which is the failure this is here to
       prevent. */
    await this.#settings.setSchema(AiGuide.SECTION, config.SCHEMA.clients);
    await this.#settings.setGuide(stamp);

    return true;
  }

  /* ---------------- private ---------------- */

  /**
   * Everything the file says about this sheet, in one line a person can
   * read in mirra.json.
   *
   * A hash would compare just as well and tell them nothing. The point
   * of writing it out is that somebody wondering why ai.md changed
   * yesterday can see the answer rather than take it on faith.
   */
  #stamp(snapshot) {
    const columns = this.#columns(snapshot);
    const present = columns.filter(column => column.exists).map(column => column.heading);

    return {
      describes: [
        `guide ${config.AI_GUIDE.version}`,
        `schema ${config.SCHEMA.clients}`,
        `Mirra ${config.VERSION}`,
        translator.code,
        this.#settings.dateFormat,
        present.join(", "),
      ].join(" · "),
      sheet: snapshot.spreadsheetId,
      tab: snapshot.sheetTitle,
    };
  }

  /** @returns {boolean} whether the file on Drive still says all this */
  #isCurrent(stamp) {
    const saved = this.#settings.guide;

    return Boolean(saved)
      && saved.describes === stamp.describes
      && saved.sheet === stamp.sheet
      && saved.tab === stamp.tab;
  }

  /**
   * The known fields, each with the heading this sheet actually uses.
   *
   * In Mirra's own order rather than the sheet's, deliberately: the file
   * spends a paragraph telling the assistant to find columns by their
   * heading and never by their position, and a table in column order
   * would quietly undo that.
   *
   * @returns {Array<{field: string, heading: string, exists: boolean}>}
   */
  #columns(snapshot) {
    const schema = new ClientSchema(snapshot.headers);
    const language = schema.languageOf(translator.code);

    return config.NEW_SHEET.fields.map(field => {
      const index = schema.indexOf(field);

      return {
        field,
        /* A column that is not there still needs a name, because the
           rules below mention it. Mirra's own spelling stands in — it is
           what the column will be called if Mirra ever adds it. */
        heading: index >= 0
          ? snapshot.headers[index]
          : ClientSchema.labelFor(field, language),
        exists: index >= 0,
      };
    });
  }

  async #render(snapshot, folderId) {
    const template = await this.#template();
    const columns = this.#columns(snapshot);
    const schema = new ClientSchema(snapshot.headers);

    const values = {
      HUMAN_NOTICE: this.#notice(),

      LANGUAGE_NAME: this.#languageName(translator.code),
      LANGUAGE_CODE: translator.code,

      SCHEMA_VERSION: String(config.SCHEMA.clients),
      MIRRA_VERSION: config.VERSION,

      FOLDER_ID: folderId,
      CLIENTS_SHEET_ID: snapshot.spreadsheetId,
      CLIENTS_TAB: snapshot.sheetTitle,
      AI_PAGE_URL: this.#pageUrl(),

      DATE_FORMAT: this.#settings.dateFormat,
      DATE_EXAMPLE: DateValue.fromIso(AiGuide.EXAMPLE_ISO).format(this.#settings.dateFormat),
      DATE_EXAMPLE_DATE: this.#readableExample(),
      DATE_SHORT_EXAMPLE: this.#shortExample(),
      PHONE_EXAMPLE: AiGuide.PHONE_EXAMPLE,

      COLUMN_TABLE: this.#table(columns),
      MISSING_COLUMNS: this.#missing(columns),
      EXTRA_COLUMNS: this.#extra(schema),
    };

    for (const column of columns) {
      values[AiGuide.PLACEHOLDER[column.field]] = column.heading;
    }

    return this.#fill(template, values);
  }

  async #template() {
    const response = await fetch(config.AI_GUIDE.template);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  /**
   * Substitutes every placeholder, and refuses to produce a file with
   * one left in it.
   *
   * A stray {COL_PHONE} in the middle of a rule is not a cosmetic
   * problem: an assistant looking for a column by that name finds
   * nothing and either stops or guesses. Better no file than a file
   * that reads as authoritative and is not.
   */
  #fill(template, values) {
    const filled = template.replace(
      /\{([A-Z_]+)\}/g,
      (whole, name) => (name in values ? values[name] : whole)
    );

    const left = filled.match(/\{[A-Z_]+\}/g);
    if (left) throw new Error(`Unfilled placeholders: ${[...new Set(left)].join(", ")}`);

    /* Sections that turned out to have nothing to say leave their blank
       line behind. Harmless in markdown, untidy to read. */
    return `${filled.replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  /**
   * The one part of the file addressed to a person, and so the one part
   * in their language.
   *
   * Assembled from whole sentences rather than one long entry, because
   * a four-paragraph string in a dictionary is a four-paragraph string
   * somebody has to re-translate entirely to fix a comma in.
   */
  #notice() {
    const lines = [
      `**${t("Цей файл Мірра написала не для вас, а для штучного інтелекту.")}**`,
      t("Він англійською, бо такі інструкції помічники читають найточніше, і описує саме вашу таблицю: її заголовки, формат дат і де шукати файли. Якщо дати помічникові доступ до теки Mirra, він знайде цей файл сам."),
      t("Не редагуйте його: Мірра перезаписує файл, щойно в таблиці щось змінюється, і ваші правки зникнуть. Що помічник може зробити з вашими записами — і чого не може — описано тут: {}", this.#pageUrl()),
      t("Оновлено {} · Мірра {}", this.#today(), config.VERSION),
    ];

    return lines.map(line => `> ${line}`).join("\n>\n");
  }

  /**
   * Written out rather than left as an ISO timestamp: this line is for
   * the person, and the rest of the file already carries the versions
   * a machine would compare.
   */
  #today() {
    return new Intl.DateTimeFormat(DateValue.locale(), {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date());
  }

  /**
   * Where the page explaining all this lives.
   *
   * The site's own address, not the one the app is running at: this
   * link is read from a file on Drive, by somebody — or something —
   * that has never been to this page. See config.SITE_URL.
   */
  #pageUrl() {
    return `${config.SITE_URL}/${PageLink.to("ai.html")}`;
  }

  /** The example date as English prose, since the file is in English. */
  #readableExample() {
    const [year, month, day] = AiGuide.EXAMPLE_ISO.split("-").map(Number);

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  /** The same date with the year left off, as a birthday often is. */
  #shortExample() {
    const yearless = AiGuide.EXAMPLE_ISO.replace(/^\d{4}/, "0000");
    return new DateValue(yearless, "yyyy-mm-dd").format(this.#settings.dateFormat);
  }

  /** @param {string} code */
  #languageName(code) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
    } catch {
      /* Intl.DisplayNames is recent enough to be worth a fallback. The
         code on its own is still true, just less readable. */
      return code;
    }
  }

  #table(columns) {
    const rows = columns
      .filter(column => column.exists)
      .map(column => `| \`${column.heading}\` | ${AiGuide.MEANING[column.field]} |`);

    return ["| Heading in this sheet | What it holds |", "| --- | --- |", ...rows].join("\n");
  }

  /**
   * Fields this sheet has no column for.
   *
   * Said rather than passed over, because the alternative is an
   * assistant that was given a birthday, found nowhere to put it, and
   * added a column of its own — named something Mirra will not
   * recognise, so the data is in the file and invisible in the app.
   */
  #missing(columns) {
    const absent = columns.filter(column => !column.exists);
    if (!absent.length) return "";

    const names = absent.map(column => `\`${column.heading}\``).join(", ");

    return [
      `**This sheet has no column for ${names}.**`,
      "",
      "Do not add any of them. Mirra adds its own columns the next time the",
      "person opens their clients, spelled the way it will recognise",
      "afterwards — a column added by hand is a column the app cannot see,",
      "and the data in it is invisible from the phone they read it on.",
      "",
      "Until then, anything you are told for one of those fields has nowhere",
      "to go. Say so rather than putting it somewhere else.",
    ].join("\n");
  }

  /**
   * Columns belonging to the person rather than to Mirra.
   *
   * Named, so that an assistant asked to fill one in can find it. Mirra
   * does not read them and will not touch them; that is reason to leave
   * them alone, not reason to pretend they are not there.
   */
  #extra(schema) {
    const extra = schema.extraColumns
      .map(column => column.label)
      .filter(label => label.trim());

    if (!extra.length) return "";

    const names = extra.map(label => `\`${label}\``).join(", ");

    return [
      `This sheet also holds columns Mirra knows nothing about: ${names}. They`,
      "are the person's own. Mirra neither reads nor writes them, so nothing",
      "you put there will show up in the app — leave them alone unless you",
      "are asked about one by name.",
    ].join("\n");
  }
}
