import { config } from "../config.js";
import { SheetsError } from "../errors.js";

/**
 * @typedef {object} SheetSnapshot
 * @property {string}     spreadsheetId
 * @property {string}     title       name of the file
 * @property {string}     sheetTitle  name of the tab that was read
 * @property {number}     sheetId     numeric id of that tab, used for edits
 * @property {number}     columnCount how wide the grid is, data or not
 * @property {string[]}   headers     first row, blanks filled in
 * @property {string[][]} rows        everything below the first row
 * @property {number}     width       widest row, in columns
 */

/**
 * SheetsRepository — the only place that talks to the Sheets API.
 *
 * Everything above this layer works with a SheetSnapshot and never sees
 * a URL, a token or a raw response. Transport and token renewal belong
 * to GoogleApiClient; placing files in the right folder belongs to
 * DriveRepository. What is left here is spreadsheets themselves.
 */
export class SheetsRepository {
  #api;
  #drive;

  /**
   * @param {object} deps
   * @param {import("./GoogleApiClient.js").GoogleApiClient} deps.api
   * @param {import("./DriveRepository.js").DriveRepository} deps.drive
   */
  constructor({ api, drive }) {
    this.#api = api;
    this.#drive = drive;
  }

  /**
   * Reads one tab of a spreadsheet.
   * @param {string} spreadsheetId
   * @param {string} [sheetTitle] defaults to the first tab
   * @returns {Promise<SheetSnapshot>}
   */
  async load(spreadsheetId, sheetTitle) {
    const meta = await this.#api.get(
      `${config.SHEETS_API}/${spreadsheetId}` +
      "?fields=properties.title,sheets.properties(title,sheetId,gridProperties.columnCount)"
    );

    const tabs = meta.sheets?.map(sheet => sheet.properties) ?? [];
    if (!tabs.length) throw new SheetsError(404, "The spreadsheet contains no sheets");

    /* A tab remembered in settings can be renamed or removed between
       visits, so a stale name falls back to the first tab instead of
       failing. */
    const tab = tabs.find(properties => properties.title === sheetTitle) ?? tabs[0];

    const values = await this.#api.get(
      `${config.SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tab.title)}` +
      "?majorDimension=ROWS"
    );

    return this.#toSnapshot(
      spreadsheetId, meta.properties.title, tab.title, tab.sheetId,
      tab.gridProperties?.columnCount ?? 26, values.values ?? []
    );
  }

  /**
   * Creates a spreadsheet and files it in the Mirra folder.
   *
   * Headers, bold formatting and the frozen top row all travel inside
   * the create call, so no half-built spreadsheet ever exists. The move
   * has to be separate: the Sheets API drops new files in the root of
   * My Drive and offers no way to say otherwise.
   *
   * @param {object} options
   * @param {string} options.folderId  where the file belongs
   * @param {string} [options.title]
   * @param {string} [options.tabTitle]
   * @param {string[]} [options.headers]
   * @returns {Promise<SheetSnapshot>}
   */
  async create({
    folderId,
    title    = config.NEW_SHEET.title,
    tabTitle = config.NEW_SHEET.tabTitle,
    headers  = config.NEW_SHEET.headers,
  }) {
    const created = await this.#api.post(config.SHEETS_API, {
      properties: { title },
      sheets: [{
        properties: {
          title: tabTitle,
          gridProperties: { frozenRowCount: 1, columnCount: headers.length },
        },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: headers.map(label => ({
              userEnteredValue:  { stringValue: label },
              userEnteredFormat: { textFormat: { bold: true } },
            })),
          }],
        }],
      }],
    });

    await this.#applyDateValidation(created, headers);
    await this.#protectIdColumn(created, headers);

    if (folderId) {
      await this.#drive.moveToFolder(created.spreadsheetId, folderId);
    }

    return this.#toSnapshot(
      created.spreadsheetId,
      created.properties.title,
      created.sheets[0].properties.title,
      created.sheets[0].properties.sheetId,
      created.sheets[0].properties.gridProperties?.columnCount ?? headers.length,
      [Array.from(headers)]
    );
  }

  /**
   * Turns the date column into a date field in Sheets itself.
   *
   * Mirra will offer a picker of its own, but the file is an ordinary
   * spreadsheet that someone may well open directly — and there, a
   * column of dates typed six different ways is a column that cannot
   * be sorted. The rule is non-strict on purpose: it warns and offers
   * a calendar rather than rejecting what someone typed.
   *
   * Failure here is not fatal. A spreadsheet without a date picker is
   * still a working spreadsheet, so a refusal is logged and stepped
   * over rather than losing the file that was just created.
   */
  async #applyDateValidation(created, headers) {
    const sheetId = created.sheets?.[0]?.properties?.sheetId;
    if (sheetId === undefined) return;

    const requests = config.NEW_SHEET.dateColumns
      .map(name => ({ name, column: headers.indexOf(name) }))
      .filter(({ column }) => column >= 0)
      .map(({ name, column }) => ({
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: column,
            endColumnIndex: column + 1,
          },
          rule: {
            condition: { type: "DATE_IS_VALID" },
            inputMessage: name,
            strict: false,
            showCustomUi: true,
          },
        },
      }));

    if (!requests.length) return;

    try {
      await this.#api.post(`${config.SHEETS_API}/${created.spreadsheetId}:batchUpdate`, { requests });
    } catch (error) {
      console.warn("Date validation could not be applied", error);
    }
  }

  /**
   * Replaces one row.
   *
   * The whole row goes at once rather than cell by cell: a single call
   * cannot leave a client half-updated, and it is one round trip
   * instead of seven.
   *
   * USER_ENTERED rather than RAW so that a date reaches the sheet as a
   * date and a number as a number — the same values someone would get
   * by typing them in, which keeps the file usable in Sheets itself.
   *
   * @param {string} spreadsheetId
   * @param {string} sheetTitle
   * @param {number} rowNumber 1-based
   * @param {string[]} values
   */
  updateRow(spreadsheetId, sheetTitle, rowNumber, values) {
    const range = `${sheetTitle}!A${rowNumber}:${SheetsRepository.columnLetter(values.length)}${rowNumber}`;

    return this.#api.put(
      `${config.SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
      "?valueInputOption=USER_ENTERED",
      { values: [values] }
    );
  }

  /**
   * Appends a row and reports where it landed.
   *
   * The row number comes back from the API rather than being worked
   * out locally, because the sheet may have grown since it was read.
   *
   * @param {string} spreadsheetId
   * @param {string} sheetTitle
   * @param {string[]} values
   * @returns {Promise<number>} the new row number
   */
  async appendRow(spreadsheetId, sheetTitle, values) {
    const response = await this.#api.post(
      `${config.SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}:append` +
      "?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
      { values: [values] }
    );

    const range = response?.updates?.updatedRange ?? "";
    const match = range.match(/!\D+(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  /**
   * Writes values into one column, at the rows given.
   *
   * Sent as a batch rather than a request per row: filling in ids for
   * two hundred clients is one call, and two hundred calls would be
   * slow enough that somebody would close the tab halfway through and
   * leave the sheet half-repaired.
   *
   * @param {object} snapshot
   * @param {number} column zero-based
   * @param {Map<number, string>} values row index → value
   */
  async writeColumn(snapshot, column, values) {
    if (column < 0 || !values.size) return;

    const letter = SheetsRepository.columnLetter(column + 1);

    const data = [...values.entries()].map(([index, value]) => ({
      /* +2: one for the header row, one because sheets count from 1. */
      range: `${snapshot.sheetTitle}!${letter}${index + 2}`,
      values: [[value]],
    }));

    await this.#api.post(
      `${config.SHEETS_API}/${snapshot.spreadsheetId}/values:batchUpdate`,
      { valueInputOption: "RAW", data }
    );
  }

  /**
   * Marks a column as not to be edited by hand.
   *
   * Sheets shows a warning when somebody types into it, which they can
   * dismiss — the point is not to forbid but to interrupt. The id
   * column looks like noise to anybody who did not put it there, and
   * clearing it would quietly break every link pointing at that row.
   *
   * warningOnly rather than a locked range: locking would keep the
   * owner out of their own file, which is not Mirra's decision to make.
   *
   * @param {object} snapshot
   * @param {number} column zero-based
   */
  async protectColumn(snapshot, column) {
    if (column < 0) return;

    await this.#api.post(`${config.SHEETS_API}/${snapshot.spreadsheetId}:batchUpdate`, {
      requests: [{
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: snapshot.sheetId,
              startColumnIndex: column,
              endColumnIndex: column + 1,
            },
            description: "Службовий стовпець Mirra — не редагуйте вручну",
            warningOnly: true,
          },
        },
      }],
    });
  }

  /**
   * Adds columns to the right-hand end of a sheet.
   *
   * Always to the right, and never anywhere else. Columns a user added
   * themselves keep their positions, formulas that reference them keep
   * pointing at the same cells, and a sheet edited by an older version
   * of Mirra keeps working — because nothing that was there has moved.
   *
   * This is the whole compatibility story in one rule: features may add
   * columns, and that is all they may do.
   *
   * @param {import("./SheetsRepository.js").SheetSnapshot} snapshot
   * @param {string[]} names headings to append
   * @returns {Promise<void>}
   */
  async addColumns(snapshot, names) {
    if (!names.length) return;

    const at = snapshot.width;                    // zero-based, past the last column
    const needed = at + names.length;

    /* The grid can be wider than the data — a new sheet has 26 columns
       whatever is written in them — so it is only extended when the new
       headings would fall outside it. */
    if (needed > snapshot.columnCount) {
      await this.#api.post(`${config.SHEETS_API}/${snapshot.spreadsheetId}:batchUpdate`, {
        requests: [{
          appendDimension: {
            sheetId: snapshot.sheetId,
            dimension: "COLUMNS",
            length: needed - snapshot.columnCount,
          },
        }],
      });
    }

    const from = SheetsRepository.columnLetter(at + 1);
    const to = SheetsRepository.columnLetter(needed);
    const range = `${snapshot.sheetTitle}!${from}1:${to}1`;

    await this.#api.put(
      `${config.SHEETS_API}/${snapshot.spreadsheetId}/values/${encodeURIComponent(range)}` +
      "?valueInputOption=USER_ENTERED",
      { values: [names] }
    );
  }

  /**
   * Removes a row from the sheet.
   *
   * deleteDimension rather than clearing the values: clearing leaves an
   * empty row where the client was, and a file that collects blank rows
   * every time someone is removed stops being pleasant to open in
   * Sheets. Deleting closes the gap, and everything below shifts up —
   * which is why the caller has to renumber afterwards.
   *
   * @param {string} spreadsheetId
   * @param {number} sheetId  numeric tab id, not its title
   * @param {number} rowNumber 1-based
   */
  deleteRow(spreadsheetId, sheetId, rowNumber) {
    return this.#api.post(`${config.SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNumber - 1,   // the API counts from zero
            endIndex: rowNumber,
          },
        },
      }],
    });
  }

  /**
   * Column index to spreadsheet letter: 1 → A, 27 → AA.
   * @param {number} count
   * @returns {string}
   */
  static columnLetter(count) {
    let letters = "";
    let index = Math.max(1, count);

    while (index > 0) {
      const remainder = (index - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      index = Math.floor((index - 1) / 26);
    }

    return letters;
  }

  /**
   * Guards the id column of a freshly made sheet.
   *
   * Failure is logged rather than raised: a sheet without the warning
   * still works, and refusing to create one over a missing guard rail
   * would be the wrong trade.
   */
  async #protectIdColumn(created, headers) {
    const column = headers.indexOf(config.NEW_SHEET.protectedColumn);
    const sheetId = created.sheets?.[0]?.properties?.sheetId;

    if (column < 0 || sheetId === undefined) return;

    try {
      await this.#api.post(`${config.SHEETS_API}/${created.spreadsheetId}:batchUpdate`, {
        requests: [{
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startColumnIndex: column, endColumnIndex: column + 1 },
              description: "Службовий стовпець Mirra — не редагуйте вручну",
              warningOnly: true,
            },
          },
        }],
      });
    } catch (error) {
      console.warn("Could not protect the id column", error);
    }
  }

  /* ---------------- private ---------------- */

  /**
   * Normalises the ragged array the API returns.
   *
   * Sheets truncates trailing empty cells, so rows come back with
   * different lengths and the header row may be shorter than the data
   * below it. Padding everything to one width here means the grid never
   * has to guess.
   */
  #toSnapshot(spreadsheetId, title, sheetTitle, sheetId, columnCount, values) {
    const width = values.reduce((widest, row) => Math.max(widest, row.length), 0);

    const headers = Array.from({ length: width }, (_, index) => {
      const label = (values[0]?.[index] ?? "").trim();
      return label || `Стовпець ${index + 1}`;
    });

    const rows = values.slice(1).map(row =>
      Array.from({ length: width }, (_, index) => row[index] ?? "")
    );

    return { spreadsheetId, title, sheetTitle, sheetId, columnCount, headers, rows, width };
  }
}
