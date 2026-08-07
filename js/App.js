import { ScreenManager }        from "./core/ScreenManager.js";
import { ViewLoader }           from "./core/ViewLoader.js";
import { SiteMeta }             from "./core/SiteMeta.js";
import { Translator }           from "./locales/Translator.js";
import { translator, t }        from "./locales/t.js";
import { PageLink }             from "./locales/pageLink.js";
import { DomTranslator }        from "./locales/DomTranslator.js";
import { AuthServiceFactory }   from "./services/auth/AuthServiceFactory.js";
import { GoogleApiClient }      from "./services/GoogleApiClient.js";
import { DriveRepository }      from "./services/DriveRepository.js";
import { SheetsRepository }     from "./services/SheetsRepository.js";
import { SettingsService }      from "./services/SettingsService.js";
import { PickerService }        from "./services/PickerService.js";
import { InstallService }       from "./services/InstallService.js";
import { ThemeManager }         from "./ui/shell/ThemeManager.js";
import { RevealController }     from "./ui/shell/RevealController.js";
import { ChooserView }          from "./ui/screens/ChooserView.js";
import { ClientListView }       from "./ui/screens/ClientListView.js";
import { ClientCardView }       from "./ui/screens/ClientCardView.js";
import { ClientFormView }       from "./ui/screens/ClientFormView.js";
import { ClientDraft }          from "./domain/client/ClientDraft.js";
import { ClientSchema }         from "./domain/client/ClientSchema.js";
import { ClientList }           from "./domain/client/ClientList.js";
import { ClientLinks }          from "./domain/links/ClientLinks.js";
import { LinkSync }             from "./domain/links/LinkSync.js";
import { SchemaUpgrade }        from "./services/SchemaUpgrade.js";
import { ClientId }             from "./domain/client/ClientId.js";
import { Notice }               from "./ui/shell/Notice.js";
import { ConfirmDialog }        from "./ui/dialogs/ConfirmDialog.js";
import { InstallPrompt }        from "./ui/shell/InstallPrompt.js";
import { PeoplePicker }         from "./ui/dialogs/PeoplePicker.js";
import { config, findMissingConfig } from "./config.js";
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

  /** Long enough for the save notice to be read first. */
  static LINK_NOTICE_DELAY = 2200;
  static VIEWS = ["loading", "hub", "chooser", "clients", "client", "client-form"];

  #theme;
  #translator;
  #dom;
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
  #people;
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

    /* Loaded before the templates, so the screens arriving from views/
       are translated on their way in rather than visibly afterwards. */
    this.#translator = translator;
    await this.#translator.load(Translator.preferred());
    this.#dom = new DomTranslator(this.#translator);
    this.#dom.apply();
    PageLink.apply();

    this.#notice  = new Notice();
    this.#confirm = new ConfirmDialog();
    this.#people  = new PeoplePicker();
    this.#theme  = new ThemeManager().init();

    const stage = document.querySelector("[data-stage]");
    if (stage) this.#reveal = new RevealController({ stage }).init();

    this.#views = new ViewLoader();
    await this.#views.load(MirraApp.VIEWS);
    this.#dom.apply();
    PageLink.apply();

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
    this.#card.addEventListener("open-link", event => this.#openLink(event.detail));
    this.#form.addEventListener("pick-person", event => this.#pickPerson(event.detail.index));

    this.#syncLanguageLabel();
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

  /**
   * Applies the language recorded on Drive, when it differs.
   *
   * The local copy decides what the first screen looks like; this
   * decides what happens on a device that has never seen this account.
   * Written back when there is nothing there yet, so the first choice
   * anybody makes starts travelling with them.
   */
  async #adoptSavedLanguage() {
    const saved = this.#settings.language;

    if (!saved) {
      this.#settings.setLanguage(this.#translator.code);
      return;
    }

    if (saved === this.#translator.code) return;

    await this.#translator.load(saved);
    this.#translator.remember();
    this.#retranslate();
  }

  /** Moves to the next available language. */
  async #toggleLanguage() {
    const codes = Translator.AVAILABLE.map(language => language.code);
    const next = codes[(codes.indexOf(this.#translator.code) + 1) % codes.length];

    await this.#translator.load(next);
    this.#translator.remember();
    this.#settings.setLanguage(next);

    this.#retranslate();
  }

  /**
   * Rebuilds every screen in the new language.
   *
   * The templates are fetched again rather than translated in place:
   * translation replaces the Ukrainian, and once replaced there is
   * nothing left to translate from. Reloading is one request from cache
   * and leaves no room for that to go wrong.
   */
  #retranslate() {
    this.#syncLanguageLabel();

    /* Screens hold rendered data, so they are redrawn from the snapshot
       rather than restored from markup. */
    this.#dom.reset();
    this.#dom.apply(document.body, { force: true });

    /* The document pages are separate files per language, so the links
       to them move rather than translate. */
    PageLink.apply();

    if (this.#snapshot) this.#clients.render(this.#snapshot);
    if (this.#card.client) this.#card.render(this.#card.client);
  }

  /** Shows which language is current, in two letters. */
  #syncLanguageLabel() {
    const label = this.#translator.code === "uk" ? "UA" : this.#translator.code.toUpperCase();

    document.querySelectorAll("[data-lang-label]").forEach(element => {
      element.textContent = label;
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
      .set("data-lang-toggle",   () => this.#toggleLanguage())
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
      await this.#adoptSavedLanguage();
      this.#card.dateFormat = this.#settings.dateFormat;
      this.#clients.dateFormat = this.#settings.dateFormat;
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
    const [loaded, file] = await Promise.all([
      this.#sheets.load(saved.spreadsheetId, saved.sheetTitle),
      this.#drive.getFile(saved.spreadsheetId),
    ]);

    const snapshot = file.trashed ? loaded : await this.#catchUp(saved, loaded);
    return { snapshot, file };
  }

  /**
   * Brings a Mirra-made sheet up to date with the current version.
   *
   * New releases add fields, and a sheet created by an older one has no
   * column for them. Since Mirra made this sheet, it may fix that
   * quietly — appending the missing headings on the right, where they
   * disturb nothing that is already there.
   *
   * Sheets the user brought themselves are never touched. Their layout
   * is their business, and a tool that rearranges a file it was merely
   * shown is a tool nobody should trust with one.
   *
   * @param {object} saved
   * @param {object} snapshot
   * @returns {Promise<object>} the snapshot, re-read if columns were added
   */
  async #catchUp(saved, snapshot) {
    const upgrade = new SchemaUpgrade(snapshot);
    if (!upgrade.isNeeded) return this.#rememberVersion(snapshot);

    /* A sheet Mirra made is brought up to date without asking: the
       columns are Mirra's own, and stopping to ask about them every
       release would be a toll on people who never chose to pay it.

       A sheet the user brought is asked about, every time, because its
       shape is theirs. */
    /* Adding columns to a sheet Mirra made needs no permission — they
       are its own. Repairing ids does: something happened to that file
       outside Mirra, and whoever did it deserves to hear about it
       before anything is written back over the top. */
    const mustAsk = !saved.managed || upgrade.needsRepair;
    if (mustAsk && !await this.#askToUpgrade(upgrade)) return snapshot;

    try {
      const updated = await upgrade.apply(this.#sheets, saved, this.#translator.code);

      if (upgrade.needsRepair) this.#notice.done("Технічні позначки відновлено.");
      else if (!saved.managed) this.#notice.done("Таблицю оновлено.");

      return this.#rememberVersion(updated);
    } catch (error) {
      /* A sheet one column short still works — every field Mirra cannot
         write simply does not appear. Failing to widen it is not a
         reason to refuse to open it. */
      console.warn("Could not bring the sheet up to date", error);
      return snapshot;
    }
  }

  /**
   * Asks before touching a sheet somebody else laid out.
   *
   * The version is named and linked, so that "оновити" is not a leap of
   * faith: whoever wants to know what changed can read it before
   * agreeing.
   *
   * @param {SchemaUpgrade} upgrade
   * @returns {Promise<boolean>}
   */
  #askToUpgrade(upgrade) {
    return this.#confirm.ask(upgrade.question(config.VERSION, this.#translator.code));
  }

  /**
   * Notes which version last worked with this sheet.
   *
   * Kept for the person reading mirra.json rather than for the code:
   * whether an upgrade is needed is decided by looking at the columns,
   * which stays true even when somebody edits the sheet by hand.
   */
  #rememberVersion(snapshot) {
    if (this.#settings.version !== config.VERSION) {
      this.#settings.setVersion(config.VERSION);
    }
    return snapshot;
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

      /* Picked rather than created, so it is theirs: Mirra reads it,
         works with whatever columns it has, and adds nothing without
         being asked. */
      await this.#remember(snapshot, false);
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
        /* A sheet made while the interface is in English should open in
           Google Sheets reading in English. A file whose columns its
           owner cannot read is not much of a possession. */
        language: this.#translator.code,
      });
      await this.#remember(snapshot, true);
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

    const draft = new ClientDraft({
      schema: this.#clients.list.schema,
      dateFormat: this.#settings.dateFormat,
    });

    /* Given now rather than on save, so that a link made in this very
       form has something to point at. */
    draft.id = ClientId.create();

    this.#openForm(draft, "clients");
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
    this.#dom.apply();
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

    const draft = new ClientDraft({
      schema: this.#clients.list.schema,
      values: client.values,
      rowNumber: client.rowNumber,
      dateFormat: this.#settings.dateFormat,
    });

    /* An existing client from a sheet that predates ids has none, and
       cannot be linked to until they do. */
    if (!draft.id) draft.id = ClientId.create();

    this.#openForm(draft, "client");
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

    /* Rows built while rendering carry Ukrainian labels from the code;
       the pass picks them up. Anything already done is skipped, so this
       costs a walk and no work. */
    this.#dom.apply();
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

    if (!draft) {
      console.error("MirraApp: save requested with no draft");
      this.#notice.alert("Форма не готова. Спробуйте оновити сторінку.");
      return;
    }

    if (!draft.isValid) {
      this.#notice.alert("Впишіть ім'я або прізвище, щоб зберегти.");
      return;
    }

    if (!saved) {
      this.#notice.alert("Таблиця не відкрита. Спробуйте оновити сторінку.");
      return;
    }

    /* Anything typed into a field the sheet has no column for would be
       dropped on the way out, so the offer to add one comes before the
       write rather than after the loss. */
    const widened = await this.#offerColumns(draft, saved);
    if (widened === null) {
      /* Either they declined the column, or adding it failed and was
         already reported. Either way the save stops here, and saying so
         is the difference between a decision and a broken button. */
      return;
    }

    const target = widened ?? draft;

    /* Asked before anything is written. "дитина" tells us the other
       person is a parent but not which one, and guessing from a name is
       exactly the sort of inference this app has no business making. */
    if (!await this.#askInverseRoles(target)) return;

    await this.#run(button, async () => {
      const values = target.toRow(this.#settings.dateFormat);
      const isNew = target.isNew;

      const rowNumber = isNew
        ? await this.#sheets.appendRow(saved.spreadsheetId, saved.sheetTitle, values)
        : (await this.#sheets.updateRow(
            saved.spreadsheetId, saved.sheetTitle, target.rowNumber, values
          ), target.rowNumber);

      await this.#syncLinks(target, rowNumber, saved);

      /* Redrawn from the widened snapshot when columns were added, so
         the list and the card agree about how many there are. */
      if (widened) this.#clients.render(this.#snapshot);

      this.#applyLocally(rowNumber, values);
      this.#notice.done(isNew ? "Клієнта додано." : "Зміни збережено.");
    });
  }

  /**
   * Offers to add columns for anything the sheet cannot hold.
   *
   * Only ever reached with a sheet the user brought themselves — one
   * Mirra made is widened on load without asking. Here the sheet is
   * theirs, so the choice is theirs too, and both answers are
   * reasonable: add the column, or save the rest and let this field go.
   *
   * @param {ClientDraft} draft
   * @param {object} saved
   * @returns {Promise<ClientDraft|null|undefined>}
   *   a rebuilt draft when columns were added, undefined to save as is,
   *   null to abandon the save entirely
   */
  async #offerColumns(draft, saved) {
    const missing = draft.unwritableFields;
    if (!missing.length) return undefined;

    const list = this.#clients.list;

    /* In the sheet's own language rather than the interface's: a column
       added to a Ukrainian sheet should match the ones beside it, even
       if the person adding it is reading English today. */
    const language = list.schema.languageOf(this.#translator.code);
    const labels = missing.map(field => ClientSchema.labelFor(field, language));

    const add = await this.#confirm.ask({
      title: labels.length === 1 ? "Немає потрібного стовпця" : "Немає потрібних стовпців",
      message: labels.join(", "),
      note: "У вашій таблиці немає такого стовпця, тож ці дані нікуди записати. "
          + "Додати його в кінець таблиці? Наявні стовпці залишаться на місці. "
          + "Якщо відмовитись, зміни не збережуться.",
      confirmLabel: "Додати стовпець",
      cancelLabel: "Нічого не змінювати",
    });

    /* Refusing abandons the save entirely rather than writing some of
       the fields. A partial save is the worst of the three outcomes: it
       reports success, changes the sheet, and quietly drops whatever had
       nowhere to go. */
    if (!add) {
      this.#notice.show("Нічого не збережено.");
      return null;
    }

    try {
      await this.#sheets.addColumns(this.#snapshot, labels);
      const snapshot = await this.#sheets.load(saved.spreadsheetId, saved.sheetTitle);
      this.#snapshot = snapshot;

      /* Rebuilt against the widened sheet: the draft holds column
         positions from the schema it was made with, and those have just
         changed. */
      const rebuilt = new ClientDraft({
        schema: new ClientList(snapshot).schema,
        values: draft.isNew ? [] : snapshot.rows[draft.rowNumber - 2] ?? [],
        rowNumber: draft.rowNumber,
        dateFormat: this.#settings.dateFormat,
      });

      Object.assign(rebuilt, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        birthday: draft.birthday,
        lastVisit: draft.lastVisit,
        notes: draft.notes,
        socials: draft.socials,
        messengers: draft.messengers,
      });

      return rebuilt;
    } catch (error) {
      this.#report(error);
      return null;
    }
  }

  /**
   * Asks what the other person is, where it cannot be worked out.
   *
   * @param {ClientDraft} draft
   * @returns {Promise<boolean>} false when the save should stop
   */
  async #askInverseRoles(draft) {
    const list = this.#clients.list;
    if (!list) return true;

    const before = draft.isNew
      ? []
      : list.findByRow(draft.rowNumber)?.links ?? [];

    for (const link of LinkSync.needingInverse(draft.links, before, list, draft.id)) {
      const role = await this.#askRole(draft, link, list);

      /* null is a deliberate cancel and stops the save. undefined means
         the question could not be asked at all — a missing dialog — and
         that is Mirra's problem, not the user's: the link is recorded
         with a role of "інше" and the save goes on. Losing what somebody
         typed because a piece of markup is out of date would be the
         worse of the two failures by far. */
      if (role === null) {
        this.#notice.show("Збереження скасовано.");
        return false;
      }

      if (role === undefined) {
        console.warn("Inverse role could not be asked; defaulting to «інше»");
        continue;
      }

      link.inverseRole = role;
    }

    return true;
  }


  /**
   * One question: who is this client to the person they just linked?
   *
   * Phrased with both names in it. "Ким Олена доводиться Ігорю?" is
   * answerable without thinking; "виберіть зворотну роль" is not.
   */
  /**
   * One question, even when a role is being replaced.
   *
   * An earlier version asked twice: once for the new role, then again
   * for permission to overwrite the old one on the other card. Both
   * questions have the same answer, and the second only made it
   * possible to give two contradictory ones.
   *
   * What was worth keeping from the second is the fact it carried — the
   * other person currently says something else — so that goes into the
   * note here.
   */
  async #askRole(draft, link, list) {
    const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "цей клієнт";

    /* Only the answers that make sense. A child's counterpart is a
       parent of some kind, and offering all eight roles asks somebody
       to find three among five they will never choose. */
    const options = ClientLinks.inverseChoicesFor(link.roleId)
      .map(id => ({ id, label: ClientLinks.labelFor(id) }));

    const back = list?.findById(link.id)?.links.find(entry => entry.id === draft.id);
    const current = back?.roleId && back.roleId !== "other"
      ? t("Зараз у картці «{}» записано «{}». Відповідь замінить її.",
            link.name, t(ClientLinks.labelFor(back.roleId)))
      : "";

    return this.#confirm.choose({
      title: t("Ким {} доводиться цій людині?", name),
      message: link.name,
      note: current,
      options,
      cancelLabel: "Скасувати",
    });
  }

  /**
   * Writes the other half of every relationship that changed.
   *
   * Done after the client's own row, and separately: if this fails, the
   * client is still saved. A half-written link is a nuisance; a lost
   * client is not.
   */
  async #syncLinks(draft, rowNumber, saved) {
    const list = this.#clients.list;
    if (!list || !draft.id) return;

    const previous = list.findByRow(draft.rowNumber);
    const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ");

    const plan = LinkSync.plan({
      id: draft.id,
      name,
      previousName: previous?.displayName ?? name,
      links: draft.links,
      before: previous?.links ?? [],
      list,
    });

    if (!plan.length) return;

    const column = list.schema.indexOf("links");
    if (column < 0) return;

    /* Roles go into the sheet, so they follow it rather than the
       interface — the same rule as column headings. */
    const language = list.schema.languageOf(this.#translator.code);

    try {
      const edits = new Map(plan.map(edit =>
        [edit.rowNumber - 2, ClientLinks.stringify(edit.links, language)]));

      await this.#sheets.writeColumn(this.#snapshot, column, edits);

      /* The snapshot in memory is edited to match, so the list and the
         cards agree without another read. */
      for (const [index, value] of edits) {
        if (this.#snapshot.rows[index]) this.#snapshot.rows[index][column] = value;
      }

      this.#reportLinkChanges(plan);
    } catch (error) {
      console.warn("Could not update the other side of the links", error);
      this.#notice.alert("Клієнта збережено, але пов'язані картки оновити не вдалося.");
    }
  }

  /**
   * Says what changed on the other people's cards.
   *
   * Those edits are correct and invisible: somebody's role is rewritten
   * on a card nobody is looking at, and without this they would never
   * find out. A quiet line after the fact keeps the change honest
   * without turning it into another question to answer.
   *
   * Renames are left out — the name following its owner is bookkeeping,
   * not news, and mentioning it would bury the line worth reading.
   */
  #reportLinkChanges(plan) {
    const changed = plan.filter(edit => edit.changes);
    if (!changed.length) return;

    const message = changed.length === 1
      ? t("У картці «{}»: {}.", changed[0].name, changed[0].changes)
      : t("Оновлено пов'язані картки: {}.", changed.map(edit => edit.name).join(", "));

    /* Delayed so it follows "Зміни збережено" rather than replacing it:
       one notice at a time, and the save is the more important of the
       two. */
    setTimeout(() => this.#notice.done(message), MirraApp.LINK_NOTICE_DELAY);
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

  /**
   * A related person, opened from a card.
   *
   * By id, falling back to the name written beside it. The fallback
   * matters: a link made before ids existed, or one whose id was lost
   * to a hand edit, still leads somewhere.
   *
   * @param {{id: string, name: string}} link
   */
  #openLink(link) {
    const list = this.#clients.list;
    if (!list) return;

    const target = list.resolve(link);

    if (!target) {
      this.#notice.alert(t("{} не знайдено в таблиці.", link.name || t("Цього клієнта")));
      return;
    }

    this.#card.render(target);
  }

  /**
   * Opens the dialog for choosing who to link to.
   * @param {number} index -1 to append a link, otherwise the row to change
   */
  async #pickPerson(index) {
    const list = this.#clients.list;
    const draft = this.#form.draft;
    if (!list || !draft) return;

    /* The client being edited may not be in the list yet — a new one
       has no row — so a stand-in carries the fields the ordering needs. */
    const client = draft.isNew
      ? { id: draft.id, lastName: draft.lastName, links: draft.links }
      : list.findByRow(draft.rowNumber) ?? { id: draft.id, lastName: draft.lastName, links: [] };

    const taken = index < 0
      ? this.#form.linkedIds
      : this.#form.linkedIds.filter(id => id !== draft.links[index]?.id);

    const chosen = await this.#people.open({ list, client, taken });
    if (chosen) this.#form.applyPerson(index, chosen);
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
    this.#dom.apply();
  }

  /** Records the spreadsheet so the next visit skips this step. */
  /**
   * @param {object} snapshot
   * @param {boolean} managed whether Mirra created this sheet
   */
  #remember(snapshot, managed) {
    return this.#settings.setSection(MirraApp.CLIENTS_SECTION, {
      spreadsheetId: snapshot.spreadsheetId,
      sheetTitle: snapshot.sheetTitle,
      managed,
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
