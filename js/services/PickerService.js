import { t } from "../locales/t.js";
import { translator } from "../locales/t.js";
import { ScriptLoader } from "../core/ScriptLoader.js";
import { config } from "../config.js";
import { PickerCancelledError } from "../errors.js";

/**
 * PickerService — lets the user hand one spreadsheet to the app.
 *
 * With the drive.file scope the Picker is not a convenience, it is the
 * access mechanism: the app can only touch files the user selected
 * here. That is also why setAppId matters — without the project number
 * Google has nothing to grant the file to.
 */
export class PickerService {
  #ready = false;

  /** Loads gapi and the picker module. */
  async init() {
    if (this.#ready) return this;

    await ScriptLoader.load(config.GAPI_SRC);
    await ScriptLoader.waitFor(() => Boolean(window.gapi?.load));
    await new Promise(resolve => gapi.load("picker", resolve));

    this.#ready = true;
    return this;
  }

  /**
   * Opens the chooser and waits for a decision.
   * @param {string} accessToken a currently valid token
   * @returns {Promise<{id: string, name: string}>}
   * @throws {PickerCancelledError} when the user closes it empty-handed
   */
  async open(accessToken) {
    await this.init();

    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMode(google.picker.DocsViewMode.LIST)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new google.picker.PickerBuilder()
        .setAppId(config.APP_ID)
        .setDeveloperKey(config.API_KEY)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setLocale(translator.code)
        .setTitle(t("Виберіть таблицю"))
        .addView(view)
        .setCallback(data => this.#handle(data, resolve, reject, picker))
        .build();

      /* Shown, then taken away entirely rather than hidden again.
         Google shows and hides this dialog by setting a style on it
         directly, which the content policy refuses — so css/picker.css
         shows it instead, and dispose() removes it from the page when a
         decision has been made. Hiding something that no longer exists
         is not a problem anybody has. */
      picker.setVisible(true);
    });
  }

  /* ---------------- private ---------------- */

  #handle(data, resolve, reject, picker) {
    const { Action, Response, Document } = google.picker;

    switch (data[Response.ACTION]) {
      case Action.PICKED: {
        const doc = data[Response.DOCUMENTS][0];
        picker?.dispose();
        resolve({ id: doc[Document.ID], name: doc[Document.NAME] });
        break;
      }
      case Action.CANCEL:
        picker?.dispose();
        reject(new PickerCancelledError());
        break;
      default:
        // LOADED and other intermediate actions are not decisions
        break;
    }
  }
}
