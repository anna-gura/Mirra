import { ScreenManager }        from "./core/ScreenManager.js";
import { ViewLoader }           from "./core/ViewLoader.js";
import { SiteMeta }             from "./core/SiteMeta.js";
import { AuthServiceFactory }   from "./services/AuthServiceFactory.js";
import { GoogleApiClient }      from "./services/GoogleApiClient.js";
import { DriveRepository }      from "./services/DriveRepository.js";
import { SheetsRepository }     from "./services/SheetsRepository.js";
import { SettingsService }      from "./services/SettingsService.js";
import { PickerService }        from "./services/PickerService.js";
import { InstallService }       from "./services/InstallService.js";
import { ThemeManager }         from "./ui/ThemeManager.js";
import { RevealController }     from "./ui/RevealController.js";
import { ChooserView }          from "./ui/ChooserView.js";
import { ClientListView }       from "./ui/ClientListView.js";
import { ClientCardView }       from "./ui/ClientCardView.js";
import { ClientFormView }       from "./ui/ClientFormView.js";
import { ClientDraft }          from "./domain/ClientDraft.js";
import { Notice }               from "./ui/Notice.js";
import { ConfirmDialog }        from "./ui/ConfirmDialog.js";
import { InstallPrompt }        from "./ui/InstallPrompt.js";
import { findMissingConfig }    from "./config.js";
import { AppError, ConfigError } from "./errors.js";

/**
 * MirraApp — composition root.
 *
 * Creates the parts, wires them together and owns the flow between
 * them. It holds no DOM building and no network code of its own: those
 * belong to the views and the services respectively.
 *
 * The flow it drives:
 *
 *   cover → sign in → (folder + settings) → hub
 *   hub → Клієнти → the remembered spreadsheet, or the chooser when
 *                   there is nothing remembered yet
 *   chooser → picked or created → recorded → client list
 *
 * Choosing a spreadsheet is a first-run step, not a daily one.
 */
class MirraApp {
  static CLIENTS_SECTION = "clients";
  static VIEWS = ["loading", "hub", "chooser", "clients", "client", "client-form"];

  #theme;
  #reveal;
  #screens;
  #views;
  #auth;
  #api;
  #drive;
  #sheets;
  #settings;
  #picker;
  #chooser;
  #clients;
  #card;
  #form;
  #snapshot = null;
  #formOrigin = null;
  #verifying = false;
  #notice;
  #confirm;
  #install;
  #installPrompt;

  /** @type {Map<string, (button: HTMLElement|null) => void>} */
  #actions = new Map();
  #onClick;

  constructor() {
    /* One listener for the whole app rather than one per button.
       Screens arrive from views/ after startup and are rebuilt as data
       changes, so binding to elements directly would mean rebinding
       every time — and quietly leaking the listeners that were missed. */
    this.#onClick = event => {
      for (const [attribute, handler] of this.#actions) {
        const trigger = event.target.closest(`[${attribute}]`);
        if (trigger && !trigger.disabled) {
          handler(trigger);
          return;
        }
      }
    };
  }

  /** Builds everything and puts the first screen on. */
  async start() {
    SiteMeta.apply();

    this.#notice  = new Notice();
    this.#confirm = new ConfirmDialog();
    this.#theme  = new ThemeManager().init();

    const stage = document.querySelector("[data-stage]");
    if (stage) this.#reveal = new RevealController({ stage }).init();

    this.#views = new ViewLoader();
    await this.#views.load(MirraApp.VIEWS);

    /* Everything below needs the markup to exist, so it waits. */
    this.#screens = new ScreenManager().init();
    this.#chooser = new ChooserView().init();
    this.#clients = new ClientListView().init();
    this.#card    = new ClientCardView().init();
    this.#form    = new ClientFormView().init();
    this.#theme.refresh();

    this.#auth     = AuthServiceFactory.create();
    this.#api      = new GoogleApiClient({ auth: this.#auth });
    this.#drive    = new DriveRepository({ api: this.#api });
    this.#sheets   = new SheetsRepository({ api: this.#api, drive: this.#drive });
    this.#settings = new SettingsService({ drive: this.#drive });
    this.#picker   = new PickerService();

    /* Built after the templates arrive, since the offer appears on the
       hub as well as the cover. */
    this.#install = new InstallService().init();
    this.#installPrompt = new InstallPrompt({ service: this.#install }).init();

    this.#auth.addEventListener("signin", () => this.#bootstrap());
    this.#clients.addEventListener("select", event => this.#openClient(event.detail.rowNumber));

    /* A tag tapped on a card returns to the list filtered by it. That is
       what tagging is for: seeing one client reminds you of a category,
       and the category should be one tap away rather than a search you
       have to retype. */
    this.#card.addEventListener("tag", event => this.#showTag(event.detail.tag));

    this.#bind();
    this.#checkConfig();

    /* Tries to pick the session back up before showing anything.
       Warming up the Google library is part of it: in popup mode the
       click that opens the window must not be spent waiting on a
       network request, and in redirect mode this is what reads the
       token back out of the URL. */
    this.#resume();
    MirraApp.registerWorker();

    return this;
  }

  /**
   * Registers the service worker.
   *
   * Not for offline cleverness — the app needs Google for anything
   * useful — but because no browser will offer to install a site
   * without one, and because the shell loading offline shows Mirra
   * saying it cannot reach Google rather than a browser error page
   * that looks like the app itself is broken.
   *
   * Failure is logged and stepped over: an app that will not start
   * because its cache would not register is worse than one that simply
   * cannot be installed.
   */
  static registerWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js")
        .catch(error => console.warn("Service worker did not register", error));
    });
  }

  /** @returns {ThemeManager} */
  get theme() { return this.#theme; }

  /** @returns {ScreenManager} */
  get screens() { return this.#screens; }

  /** @returns {SettingsService} */
  get settings() { return this.#settings; }

  /** @returns {ClientListView} */
  get clients() { return this.#clients; }

  /** @returns {ClientCardView} */
  get card() { return this.#card; }

  /** @returns {InstallService} */
  get install() { return this.#install; }

  destroy() {
    document.removeEventListener("click", this.#onClick);
    this.#theme?.destroy();
    this.#reveal?.destroy();
    this.#clients?.destroy();
    this.#chooser?.destroy();
    this.#card?.destroy();
    this.#form?.destroy();
    this.#installPrompt?.destroy();
    this.#install?.destroy();
  }

  /* ---------------- wiring ---------------- */

  #bind() {
    this.#actions
      .set("data-signin",        button => this.#signIn(button))
      .set("data-open-clients",  button => this.#openClients(button))
      .set("data-open-existing", button => this.#openExisting(button))
      .set("data-create-sheet",  button => this.#createNew(button))
      .set("data-reload",        button => this.#reload(button))
      .set("data-back-clients",  () => this.#backToList())
      .set("data-edit-client",   () => this.#editClient())
      .set("data-delete-client", button => this.#deleteClient(button))
      .set("data-add-client",    () => this.#addClient())
      .set("data-form-save",     button => this.#saveClient(button))
      .set("data-form-cancel",   () => this.#cancelForm())
      .set("data-open-hub",      () => this.#toHub())
      .set("data-pick-other",    () => this.#toChooser())
      .set("data-signout",       () => this.#signOut());

    document.addEventListener("click", this.#onClick);
  }

  /** Warns immediately rather than at the first click. */
  #checkConfig() {
    const missing = findMissingConfig();
    if (missing.length === 0) return;

    const error = new ConfigError(missing);
    console.error(error.message);
    this.#notice.alert(error.userMessage, { persist: true });
    document.querySelectorAll("[data-signin]").forEach(btn => { btn.disabled = true; });
  }

  /* ---------------- flow ---------------- */

  /** Cover screen. Moving on is left to the signin event. */
  async #signIn(button) {
    await this.#run(button, () => this.#auth.requestToken());
  }

  /**
   * Picks the session back up without asking, where that is possible.
   *
   * Somebody who opens Mirra six times a day should be asked to sign in
   * once, not six times. Google returns a token silently when they are
   * signed in to their account and have granted access before — which,
   * for anyone using this daily, is always.
   *
   * The cover screen shows only when that fails: they signed out of
   * Google, or withdrew the permission. Both are real reasons to ask
   * again; nothing else is.
   */
  async #resume() {
    try {
      const resumed = await this.#auth.resume();
      if (resumed) return this.#bootstrap();
    } catch (error) {
      console.warn("Could not resume the session", error);
    }

    /* Nothing to resume, so the cover stays where it is. Deliberately
       silent: being unable to continue a session that ended normally is
       not a failure worth reporting. */
  }

  /**
   * Runs once per session, as soon as a token exists: finds or creates
   * the Mirra folder and reads the settings out of it.
   */
  async #bootstrap() {
    if (this.#settings.isLoaded) return;

    this.#screens.show("loading");
    try {
      await this.#settings.load();
      this.#card.dateFormat = this.#settings.dateFormat;
      this.#screens.show("hub");
    } catch (error) {
      this.#report(error);
      this.#screens.show("landing");
    }
  }

  /**
   * Hub → the client list.
   *
   * Already-loaded data is shown as it was, scroll position and all.
   * Re-fetching on every visit would cost a round trip and lose the
   * reader's place, to show them what they were already looking at.
   */
  async #openClients(button) {
    const saved = this.#settings.section(MirraApp.CLIENTS_SECTION);
    if (!saved) return this.#toChooser();

    /* Already read once, so the list appears at once and the check runs
       behind it. Blocking on a request to show data that is already on
       hand would make every visit feel slower to catch a case that is
       rare — but the case still has to be caught, so it runs anyway. */
    if (this.#clients.list) {
      this.#screens.show("clients");

      /* Arriving from the hub starts at the top; coming back from a
         client returns to where they were. Both are "opening the
         list", but one is a fresh errand and the other is the middle
         of one already under way. */
      this.#clients.resetScroll();
      this.#verifyLater(saved);
      return;
    }

    await this.#run(button, async () => {
      const { snapshot, file } = await this.#fetchClients(saved);

      if (file.trashed) return this.#handleTrashed(saved, file, snapshot);
      this.#showClients(snapshot);
    });
  }

  /**
   * Reads the sheet and its Drive record together.
   *
   * Asked in parallel rather than one after the other: the check costs
   * nothing when it runs alongside the read it would otherwise delay.
   *
   * @param {object} saved the section as recorded in settings
   */
  async #fetchClients(saved) {
    const [snapshot, file] = await Promise.all([
      this.#sheets.load(saved.spreadsheetId, saved.sheetTitle),
      this.#drive.getFile(saved.spreadsheetId),
    ]);

    return { snapshot, file };
  }

  /**
   * Checks the bin without holding anything up.
   *
   * Failures are swallowed on purpose. This runs behind a screen the
   * user is already reading, and an offline moment should not produce
   * an error about a check nobody asked for.
   *
   * @param {object} saved
   */
  async #verifyLater(saved) {
    if (this.#verifying) return;
    this.#verifying = true;

    try {
      const file = await this.#drive.getFile(saved.spreadsheetId);

      /* They may have moved on while the request was in flight; a
         dialog about a screen nobody is looking at would be a jump
         scare rather than information. */
      if (file.trashed && this.#screens.current === "clients") {
        await this.#handleTrashed(saved, file);
      }
    } catch (error) {
      console.warn("Trash check failed", error);
    } finally {
      this.#verifying = false;
    }
  }

  /**
   * The spreadsheet is in the bin, and nothing about reading it says so.
   *
   * Sheets serves a trashed file exactly as it serves a live one, so
   * without this the app would go on showing clients from a spreadsheet
   * Drive will empty in thirty days — and the first anyone would know is
   * when it was gone.
   *
   * Two ways out and no third: put it back, or work with another sheet.
   * Deleting for good is not among them, and never will be from here.
   *
   * @param {object} saved     the section as recorded in settings
   * @param {object} file      Drive's record of it
   * @param {object} [snapshot] already read, so it can be shown if restored
   */
  async #handleTrashed(saved, file, snapshot = null) {
    const restore = await this.#confirm.ask({
      title: "Таблиця в кошику",
      message: file.name,
      note: "Ви перемістили її в кошик на Google Диску. Google видалить її остаточно приблизно за 30 днів.",
      confirmLabel: "Відновити",
      cancelLabel: "Інша таблиця",
    });

    if (!restore) {
      /* The list is dropped as well as left: keeping it would mean the
         next visit quietly serves a sheet they chose to walk away
         from. */
      this.#clients.clear();
      this.#snapshot = null;
      this.#toChooser();
      return;
    }

    try {
      await this.#drive.restore(saved.spreadsheetId);
      if (snapshot) this.#showClients(snapshot);
      this.#notice.done("Таблицю відновлено з кошика.");
    } catch (error) {
      this.#report(error);
    }
  }

  /** Chooser → Picker → list, remembering the choice. */
  async #openExisting(button) {
    await this.#run(button, async () => {
      const token = await this.#auth.getToken();
      const file = await this.#picker.open(token);
      const snapshot = await this.#sheets.load(file.id);
      await this.#remember(snapshot);
      this.#showClients(snapshot);
    });
  }

  /** Chooser → new spreadsheet in the Mirra folder → list. */
  async #createNew(button) {
    /* Checked before anything is sent: a sheet named after a default
       nobody chose is a sheet nobody recognises later. */
    if (!this.#chooser.isValid) {
      this.#chooser.showError();
      return;
    }

    await this.#run(button, async () => {
      const snapshot = await this.#sheets.create({
        folderId: this.#settings.folderId,
        title: this.#chooser.title,
      });
      await this.#remember(snapshot);
      this.#showClients(snapshot);
      this.#notice.done("Таблицю створено в теці Mirra на вашому Диску.");
    });
  }

  /** Fetches the sheet again, in case it was edited elsewhere. */
  async #reload(button) {
    const saved = this.#settings.section(MirraApp.CLIENTS_SECTION);
    if (!saved) return;

    await this.#run(button, async () => {
      const { snapshot, file } = await this.#fetchClients(saved);

      if (file.trashed) return this.#handleTrashed(saved, file, snapshot);

      this.#snapshot = snapshot;
      this.#clients.render(snapshot).resetScroll();
    });
  }

  /** An empty form, shaped by the sheet that is open. */
  #addClient() {
    if (!this.#snapshot) return;

    this.#clients.saveScroll();
    this.#openForm(new ClientDraft({
      schema: this.#clients.list.schema,
      dateFormat: this.#settings.dateFormat,
    }), "clients");
  }

  /**
   * A row in the list → that person's card.
   *
   * The list is left as it is rather than cleared, so coming back is
   * instant and lands on the same name the reader tapped.
   */
  #openClient(rowNumber) {
    const client = this.#clients.list?.findByRow(rowNumber);
    if (!client) return;

    this.#clients.saveScroll();
    this.#card.render(client);
    this.#screens.show("client");
  }

  /**
   * The same form, filled from the client on screen.
   *
   * The guards report rather than return quietly. A button that does
   * nothing at all is the hardest kind of fault to chase: it looks
   * identical whether the handler never ran, ran and found nothing, or
   * threw halfway through.
   */
  #editClient() {
    const client = this.#card.client;

    if (!client) {
      console.warn("MirraApp: no client on the card to edit");
      this.#notice.alert("Спочатку відкрийте картку клієнта.");
      return;
    }

    if (!this.#clients.list) {
      console.warn("MirraApp: the client list has not been loaded");
      this.#notice.alert("Спершу відкрийте таблицю клієнтів.");
      return;
    }

    this.#openForm(new ClientDraft({
      schema: this.#clients.list.schema,
      values: client.values,
      rowNumber: client.rowNumber,
      dateFormat: this.#settings.dateFormat,
    }), "client");
  }

  /**
   * @param {ClientDraft} draft
   * @param {string} origin the screen to return to on cancel
   *
   * Where to go back to is recorded on the way in rather than worked
   * out on the way out. The card holds whichever client was last
   * opened, so asking it would send someone who added a client from
   * the list to a card they never asked for.
   */
  /**
   * Removes a client, once they have said so plainly.
   *
   * The row is deleted rather than emptied, so the sheet does not
   * accumulate blank lines — which means every row below moves up by
   * one. The snapshot is spliced to match and the list rebuilt from it,
   * since row numbers are derived from position; leaving the old array
   * in place would point every later client at the wrong row.
   */
  async #deleteClient(button) {
    const client = this.#card.client;
    const saved = this.#settings.section(MirraApp.CLIENTS_SECTION);
    if (!client || !saved || !this.#snapshot) return;

    const agreed = await this.#confirm.ask({
      title: "Видалити клієнта?",
      message: client.displayName,
      note: "Запис буде видалено з таблиці. Цю дію не можна скасувати.",
      confirmLabel: "Видалити",
      danger: true,
    });

    if (!agreed) return;

    await this.#run(button, async () => {
      await this.#sheets.deleteRow(
        saved.spreadsheetId, this.#snapshot.sheetId, client.rowNumber
      );

      this.#snapshot.rows.splice(client.rowNumber - 2, 1);
      this.#card.clear();
      this.#clients.render(this.#snapshot);
      this.#backToList();
      this.#notice.done("Клієнта видалено.");
    });
  }

  #openForm(draft, origin) {
    if (!this.#screens.has("form")) {
      console.error("MirraApp: the form view is missing — is views/client-form.tpl in place?");
      this.#notice.alert("Форма не завантажилась. Спробуйте оновити сторінку.");
      return;
    }

    this.#formOrigin = origin;
    this.#form.render(draft);
    this.#screens.show("form");
  }

  /**
   * Writes the draft to the sheet, then updates what is on screen from
   * the same values rather than re-reading the file. The row that was
   * just sent is known to be correct, and a round trip to confirm it
   * would only add a pause.
   */
  async #saveClient(button) {
    const draft = this.#form.draft;
    const saved = this.#settings.section(MirraApp.CLIENTS_SECTION);
    if (!draft || !saved) return;

    if (!draft.isValid) {
      this.#notice.alert("Впишіть ім'я або прізвище, щоб зберегти.");
      return;
    }

    await this.#run(button, async () => {
      const values = draft.toRow(this.#settings.dateFormat);
      const isNew = draft.isNew;

      const rowNumber = isNew
        ? await this.#sheets.appendRow(saved.spreadsheetId, saved.sheetTitle, values)
        : (await this.#sheets.updateRow(
            saved.spreadsheetId, saved.sheetTitle, draft.rowNumber, values
          ), draft.rowNumber);

      this.#applyLocally(rowNumber, values);
      this.#notice.done(isNew ? "Клієнта додано." : "Зміни збережено.");
    });
  }

  /**
   * Folds a saved row back into the snapshot already in memory.
   *
   * Rows are stored in sheet order while the list is shown sorted, so
   * the snapshot is edited by row number and the list rebuilt from it —
   * which puts a renamed client in their new place without a reload.
   */
  #applyLocally(rowNumber, values) {
    this.#formOrigin = null;

    if (!rowNumber || !this.#snapshot) return this.#backToList();

    const index = rowNumber - 2;             // -1 for the header, -1 for 1-based rows
    this.#snapshot.rows[index] = values;

    /* Anything appended past the end leaves a gap when a sheet has
       trailing blank rows; filling it keeps indices honest. */
    for (let i = 0; i < this.#snapshot.rows.length; i += 1) {
      this.#snapshot.rows[i] ??= [];
    }

    this.#clients.render(this.#snapshot);
    this.#clients.ensureVisible(rowNumber);
    const client = this.#clients.list.findByRow(rowNumber);

    if (client) {
      this.#card.render(client);
      this.#screens.show("client");
    } else {
      this.#backToList();
    }
  }

  #cancelForm() {
    this.#form.clear();
    this.#leaveForm();
  }

  /** Returns to whichever screen the form was opened from. */
  #leaveForm() {
    const origin = this.#formOrigin;
    this.#formOrigin = null;

    if (origin === "client" && this.#card.client) {
      this.#screens.show("client");
      return;
    }

    this.#backToList();
  }

  /**
   * @param {string} tag
   */
  #showTag(tag) {
    this.#screens.show("clients");
    this.#clients.setQuery(tag).resetScroll();
  }

  #backToList() {
    this.#screens.show("clients");
    this.#clients.restoreScroll();
  }

  async #signOut() {
    await this.#auth.signOut();
    this.#settings.reset();
    this.#clients.clear();
    this.#card.clear();
    this.#form.clear();
    this.#snapshot = null;
    this.#formOrigin = null;
    this.#chooser.reset();
    this.#screens.show("landing");
  }

  /* ---------------- transitions ---------------- */

  #toHub() {
    if (this.#screens.current === "clients") this.#clients.saveScroll();
    this.#screens.show("hub");
  }

  #toChooser() {
    if (this.#screens.current === "clients") this.#clients.saveScroll();

    this.#chooser.reset();
    this.#screens.show("chooser");

    /* Focused after the screen is visible: an element that is still
       hidden cannot take focus, and the request is silently dropped.
       The cursor sitting in the field is what says it wants an answer. */
    requestAnimationFrame(() => this.#chooser.focus());
  }

  #showClients(snapshot) {
    this.#snapshot = snapshot;
    this.#clients.render(snapshot).resetScroll();
    this.#screens.show("clients");
  }

  /** Records the spreadsheet so the next visit skips this step. */
  #remember(snapshot) {
    return this.#settings.setSection(MirraApp.CLIENTS_SECTION, {
      spreadsheetId: snapshot.spreadsheetId,
      sheetTitle: snapshot.sheetTitle,
    });
  }

  /* ---------------- shared plumbing ---------------- */

  /**
   * Runs one user-triggered action: busy state on, errors reported,
   * busy state off however it ended.
   *
   * @param {HTMLElement|null} button
   * @param {() => Promise<void>} action
   */
  async #run(button, action) {
    this.#notice.hide();
    this.#setBusy(button, true);
    try {
      await action();
    } catch (error) {
      this.#report(error);
    } finally {
      this.#setBusy(button, false);
    }
  }

  /** Busy state lives on the button, not in a global spinner. */
  #setBusy(button, isBusy) {
    if (!button) return;
    button.disabled = isBusy;
    button.toggleAttribute("data-busy", isBusy);
  }

  /**
   * Backing out of the Picker or the sign-in window is a decision, not
   * a failure. Those errors carry an empty userMessage, and an empty
   * message shows nothing — so the rule is one line rather than a
   * growing list of classes to exclude.
   */
  #report(error) {
    console.error(error);
    this.#notice.alert(
      error instanceof AppError
        ? error.userMessage
        : "Щось пішло не так. Спробуйте ще раз."
    );
  }
}

const app = new MirraApp();
app.start().catch(error => console.error("Mirra failed to start", error));

/* handy from the console during development: mirra.theme.toggle() */
window.mirra = app;

export { MirraApp };
