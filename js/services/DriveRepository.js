/**
 * DriveRepository — the folder Mirra keeps its things in.
 *
 * Everything the app creates lives in one visible folder on the user's
 * Drive, under its real name, next to their own files. Nothing hidden.
 * If someone stops using Mirra they are left with a folder of ordinary
 * Google files they can open, move or delete themselves.
 *
 * Google offers a hidden per-app storage area for exactly this purpose.
 * It was not used deliberately: a settings file nobody can see is also
 * a settings file nobody can inspect when something goes wrong.
 *
 * The drive.file scope is enough for all of this. It grants access to
 * files the app opened *or created*, and listing returns those same
 * files — so the folder made on the first visit is findable on every
 * visit after, with no involvement from the user.
 */
export class DriveRepository {
  static API    = "https://www.googleapis.com/drive/v3/files";
  static UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  static FOLDER_MIME = "application/vnd.google-apps.folder";

  #api;

  /**
   * @param {object} deps
   * @param {import("./GoogleApiClient.js").GoogleApiClient} deps.api
   */
  constructor({ api }) {
    this.#api = api;
  }

  /**
   * Returns the folder, creating it the first time.
   * @param {string} name
   * @returns {Promise<{id: string, name: string}>}
   */
  async ensureFolder(name) {
    return (await this.findFolder(name)) ?? this.createFolder(name);
  }

  /**
   * @param {string} name
   * @returns {Promise<{id: string, name: string}|null>}
   */
  async findFolder(name) {
    const found = await this.#list(
      `mimeType='${DriveRepository.FOLDER_MIME}' and name='${this.#escape(name)}' and trashed=false`
    );
    return found[0] ?? null;
  }

  /**
   * @param {string} name
   * @returns {Promise<{id: string, name: string}>}
   */
  createFolder(name) {
    return this.#api.post(`${DriveRepository.API}?fields=id,name`, {
      name,
      mimeType: DriveRepository.FOLDER_MIME,
    });
  }

  /**
   * @param {string} name
   * @param {string} folderId
   * @returns {Promise<{id: string, name: string}|null>}
   */
  async findInFolder(name, folderId) {
    const found = await this.#list(
      `name='${this.#escape(name)}' and '${folderId}' in parents and trashed=false`
    );
    return found[0] ?? null;
  }

  /**
   * Reads a file's own record, not its contents.
   *
   * Worth having because the Sheets API happily reads a spreadsheet
   * that is sitting in the bin: nothing about the data it returns says
   * the file is on its way out. Only Drive knows, and only if asked.
   *
   * @param {string} fileId
   * @returns {Promise<{id: string, name: string, trashed: boolean}>}
   */
  getFile(fileId) {
    return this.#api.get(`${DriveRepository.API}/${fileId}?fields=id,name,trashed`);
  }

  /**
   * Takes a file back out of the bin.
   *
   * Undoing a deletion, never performing one: Mirra has no way to put a
   * spreadsheet in the bin and no way to empty it. Losing a client list
   * should require Drive itself, deliberately, twice.
   *
   * @param {string} fileId
   */
  restore(fileId) {
    return this.#api.patch(`${DriveRepository.API}/${fileId}?fields=id`, { trashed: false });
  }

  /**
   * @param {string} fileId
   * @returns {Promise<object>} the parsed file contents
   */
  readJson(fileId) {
    return this.#api.get(`${DriveRepository.API}/${fileId}?alt=media`);
  }

  /**
   * Creates a JSON file inside a folder.
   *
   * Drive wants metadata and content in one multipart body; sending
   * them as two requests would leave a moment where an empty file
   * exists.
   *
   * @param {string} name
   * @param {string} folderId
   * @param {object} data
   * @returns {Promise<{id: string}>}
   */
  createJson(name, folderId, data) {
    const boundary = `mirra-${crypto.randomUUID()}`;
    const metadata = { name, parents: [folderId], mimeType: "application/json" };

    const body =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(data, null, 2)}\r\n` +
      `--${boundary}--`;

    return this.#api.request("POST", `${DriveRepository.UPLOAD}?uploadType=multipart&fields=id`, {
      rawBody: body,
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    });
  }

  /**
   * Replaces the contents of an existing JSON file.
   * @param {string} fileId
   * @param {object} data
   */
  updateJson(fileId, data) {
    return this.#api.request("PATCH", `${DriveRepository.UPLOAD}/${fileId}?uploadType=media`, {
      rawBody: JSON.stringify(data, null, 2),
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    });
  }

  /**
   * Moves a file into the folder, detaching it from wherever it was.
   *
   * Spreadsheets created through the Sheets API land in the root of My
   * Drive, so without this step the folder would stay empty while files
   * piled up outside it — the opposite of what it is for.
   *
   * @param {string} fileId
   * @param {string} folderId
   */
  async moveToFolder(fileId, folderId) {
    const { parents = [] } = await this.#api.get(`${DriveRepository.API}/${fileId}?fields=parents`);
    if (parents.includes(folderId)) return;

    const query = new URLSearchParams({ addParents: folderId, fields: "id" });
    if (parents.length) query.set("removeParents", parents.join(","));

    return this.#api.patch(`${DriveRepository.API}/${fileId}?${query}`);
  }

  /* ---------------- private ---------------- */

  /**
   * @param {string} q
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async #list(q) {
    const query = new URLSearchParams({
      q,
      spaces: "drive",
      fields: "files(id,name)",
      pageSize: "10",
    });
    const { files = [] } = await this.#api.get(`${DriveRepository.API}?${query}`);
    return files;
  }

  /** Drive query strings are single-quoted, so quotes must be escaped. */
  #escape(value) {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
}
