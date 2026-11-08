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
import { CalendarRepository }   from "./services/CalendarRepository.js";
import { DayPlan }              from "./domain/calendar/DayPlan.js";
import { MonthPlan }            from "./domain/calendar/MonthPlan.js";
import { Zone }                 from "./domain/calendar/Zone.js";
import { SettingsService }      from "./services/SettingsService.js";
import { PickerService }        from "./services/PickerService.js";
import { InstallService }       from "./services/InstallService.js";
import { ThemeManager }         from "./ui/shell/ThemeManager.js";
import { RevealController }     from "./ui/shell/RevealController.js";
import { ChooserView }          from "./ui/screens/ChooserView.js";
import { ClientListView }       from "./ui/screens/ClientListView.js";
import { ClientCardView }       from "./ui/screens/ClientCardView.js";
import { ClientFormView }       from "./ui/screens/ClientFormView.js";
import { CalendarSettingsView } from "./ui/screens/CalendarSettingsView.js";
import { CalendarDayView }      from "./ui/screens/CalendarDayView.js";
import { CalendarMonthView }    from "./ui/screens/CalendarMonthView.js";
import { ClientDraft }          from "./domain/client/ClientDraft.js";
import { ClientSchema }         from "./domain/client/ClientSchema.js";
import { ClientList }           from "./domain/client/ClientList.js";
import { DuplicateFinder }      from "./domain/client/DuplicateFinder.js";
import { ClientLinks }          from "./domain/links/ClientLinks.js";
import { LinkSync }             from "./domain/links/LinkSync.js";
import { SchemaUpgrade }        from "./services/SchemaUpgrade.js";
import { AiGuide }              from "./services/AiGuide.js";
import { SheetCheck }           from "./domain/client/SheetCheck.js";
import { SheetLook }            from "./services/SheetLook.js";
import { ClientId }             from "./domain/client/ClientId.js";
import { Notice }               from "./ui/shell/Notice.js";
import { ConfirmDialog }        from "./ui/dialogs/ConfirmDialog.js";
import { InstallPrompt }        from "./ui/shell/InstallPrompt.js";
import { PeoplePicker }         from "./ui/dialogs/PeoplePicker.js";
import { config, findMissingConfig } from "./config.js";
import { AccessDeniedError, AppError, ConfigError } from "./errors.js";

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

  /**
   * How long the sheet check stays quiet once somebody declines it.
   *
   * A week, because that is long enough to stop being nagging and short
   * enough that a sheet does not sit damaged for a month. Nothing is
   * forgotten in the meantime — the damage is still there and will be
   * reported again afterwards.
   */
  static QUIET_DAYS = 7;
  static VIEWS = ["loading", "hub", "chooser", "clients", "client", "client-form",
                  "calendar-settings", "calendar-day", "calendar-month"];

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
  #calendars;
  #calendarSettings;
  #calendarDay;
  #calendarMonth;
  #day = "";
  #month = "";
  #weekStart = null;
  #calendarOrigin = "hub";
  #dayDrawn = null;
  #monthDrawn = null;
  #presenceSeen = "unknown";
  #settings;
  #guide;
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
    this.#calendarSettings = new CalendarSettingsView().init();
    this.#calendarDay = new CalendarDayView().init();
    this.#calendarMonth = new CalendarMonthView().init();
    this.#theme.refresh();

    this.#auth     = AuthServiceFactory.create();
    this.#api      = new GoogleApiClient({ auth: this.#auth });
    this.#drive    = new DriveRepository({ api: this.#api });
    this.#sheets   = new SheetsRepository({ api: this.#api, drive: this.#drive });
    this.#calendars = new CalendarRepository({ api: this.#api });
    this.#settings = new SettingsService({ drive: this.#drive });
    this.#guide    = new AiGuide({ drive: this.#drive, settings: this.#settings });
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

    this.#retranslateCalendar();
  }

  /**
   * The calendar in the other language.
   *
   * Its words do not come from the templates: the name of the month,
   * the column headings, "субота, 9 листопада" and whether half past
   * two is written 14:30 or 2:30 PM all come from Intl at the moment
   * of drawing. Re-translating the markup leaves every one of them
   * in the language they were drawn in — which is the whole reason
   * the language button is on these screens at all.
   *
   * Drawn again from what was already fetched rather than asked of
   * Google a second time: nothing about the day has changed, only
   * the words for it.
   */
  #retranslateCalendar() {
    const screen = this.#screens?.current;

    if (screen === "calendar-month" && this.#monthDrawn) {
      this.#calendarMonth.show(this.#monthDrawn);
      return;
    }

    if (screen === "calendar-day" && this.#dayDrawn) {
      this.#calendarDay.show(this.#dayDrawn);
      return;
    }

    if (screen === "calendar-settings") {
      /* The weekday chips are built by Intl once, when the screen is
         created, so they need building again rather than redrawing. */
      this.#calendarSettings.relabel().state(this.#settings.calendar, this.#presenceSeen);
    }
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

  /**
   * One month forward or back, as "YYYY-MM".
   *
   * Done on the numbers rather than through a Date, which would need
   * a day of the month to exist — and the thirty-first of January
   * plus one month is a question with no good answer.
   *
   * @param {string} month
   * @param {number} step
   * @returns {string}
   */
  static #shiftMonth(month, step) {
    const year = Number(month.slice(0, 4));
    const number = Number(month.slice(5, 7)) + step;

    const moved = new Date(Date.UTC(year, number - 1, 1));
    return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`;
  }

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
      .set("data-open-calendar", button => this.#openCalendar(button))
      .set("data-save-calendar", button => this.#saveCalendar(button))
      .set("data-create-calendar", button => this.#createCalendar(button))
      .set("data-check-calendar", button => this.#checkCalendar(button))
      .set("data-calendar-settings", button => this.#openCalendarSettings(button))
      .set("data-calendar-back", () => this.#leaveCalendarSettings())
      .set("data-month-prev",    () => this.#stepMonth(-1))
      .set("data-month-next",    () => this.#stepMonth(1))
      .set("data-month-today",   () => this.#stepMonth(0))
      .set("data-open-month",    () => this.#backToMonth())
      .set("data-date",          button => this.#openDay(button.dataset.date))
      .set("data-day-prev",      () => this.#stepDay(-1))
      .set("data-day-next",      () => this.#stepDay(1))
      .set("data-day-today",     () => this.#stepDay(0))
      .set("data-book",          () => this.#bookingSoon())
      .set("data-book-edge",     () => this.#bookingSoon())
      .set("data-align",         () => this.#bookingSoon())
      .set("data-event",         () => this.#bookingSoon())
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
      this.#afterLoad(snapshot);
    });
  }

  /**
   * Hub → the calendar.
   *
   * The permission is asked for here rather than at sign-in, and that
   * is the whole reason this is not two lines. Somebody who keeps a
   * client list and books nobody should never be handed a consent
   * screen about calendars; somebody who taps "Календар" has the
   * reason for the question on the screen behind it.
   *
   * Until the month grid arrives, this lands on the calendar's own
   * settings — which is also the screen that creates it.
   *
   * @param {HTMLElement|null} button
   */
  async #openCalendar(button) {
    await this.#run(button, async () => {
      try {
        await this.#auth.grant(config.CALENDAR_SCOPES);
      } catch (error) {
        /* Declining is an answer, not a fault, and it deserves to be
           answered in its own words: the standing message is about
           files, and being told the sheet needs permission after
           saying no to a calendar is the kind of small wrongness that
           makes people stop trusting what an app tells them. */
        if (error instanceof AccessDeniedError) {
          this.#notice.warn("Без дозволу на календар записи вести не вийде. Усе інше в Mirra працює як раніше.");
          return;
        }
        throw error;
      }

      const { calendar, presence } = await this.#findCalendar();

      /* No calendar yet, so the only useful screen is the one that
         makes one. Once there is one, the hub leads to the day —
         settings are a thing you visit twice a year, and putting
         them in the way of the calendar every time would be like
         opening a notebook at the inside cover. */
      if (!calendar?.id) {
        this.#presenceSeen = presence;
        this.#calendarSettings.show(calendar, presence);
        this.#screens.show("calendar-settings");
        this.#dom.apply();
        return;
      }

      await this.#goToMonth(Zone.today(this.#zone()).slice(0, 7));
    });
  }

  /**
   * The gear on the day screen.
   *
   * Asks Google about the calendar on the way in, like every other
   * path to these settings: arriving at a screen that says "connected"
   * about a calendar deleted an hour ago is the bug this whole step
   * was spent on.
   *
   * @param {HTMLElement|null} button
   */
  async #openCalendarSettings(button) {
    await this.#run(button, async () => {
      const { calendar, presence } = await this.#findCalendar();

      this.#presenceSeen = presence;
      this.#calendarSettings.show(calendar, presence);
      this.#screens.show("calendar-settings");
      this.#dom.apply();
    });
  }

  /**
   * Out of the settings, back to whatever was on screen before them.
   *
   * And redrawn rather than restored: the hours, the working days or
   * the length of a visit may have just changed, and a day rebuilt
   * from the old numbers would be wrong in exactly the way somebody
   * had just finished correcting.
   */
  #leaveCalendarSettings() {
    if (this.#calendarOrigin === "calendar-day" && this.#day) {
      this.#goToDay(this.#day).catch(error => this.#report(error));
      return;
    }

    if (this.#calendarOrigin === "calendar-month" && this.#month) {
      this.#goToMonth(this.#month).catch(error => this.#report(error));
      return;
    }

    this.#toHub();
  }

  /**
   * The calendar's own time zone, or the device's when it has none.
   *
   * Everything about a day is measured in it: which date it is now,
   * when the day begins, where an appointment falls. Reading it from
   * the device instead would put somebody travelling an ocean away
   * into a different day from their own calendar.
   *
   * @returns {string}
   */
  #zone() {
    const saved = this.#settings.calendar?.timeZone;
    if (Zone.known(saved)) return saved;

    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  /**
   * Shows a month, and reads it from Google.
   *
   * @param {string} month "YYYY-MM"
   */
  async #goToMonth(month) {
    this.#month = month;
    this.#calendarOrigin = "calendar-month";

    this.#screens.show("calendar-month");
    this.#dom.apply();

    await this.#drawMonth();
  }

  /** @param {number} months 0 for the month it is now */
  #stepMonth(months) {
    const zone = this.#zone();

    const month = months === 0
      ? Zone.today(zone).slice(0, 7)
      : MirraApp.#shiftMonth(this.#month, months);

    this.#goToMonth(month).catch(error => this.#report(error));
  }

  /** Back from a day to the month it belongs to. */
  #backToMonth() {
    const month = (this.#day || Zone.today(this.#zone())).slice(0, 7);
    this.#goToMonth(month).catch(error => this.#report(error));
  }

  /** A square in the month grid. @param {string} date */
  #openDay(date) {
    if (!date) return;
    this.#goToDay(date).catch(error => this.#report(error));
  }

  /**
   * Draws the month, counters and all.
   *
   * One request covers the whole grid, the few days of the
   * neighbouring months included: those squares carry numbers like
   * any other, and a number with nothing behind it is the kind of
   * small lie that is noticed on the first of the month.
   */
  async #drawMonth() {
    const calendar = this.#settings.calendar;
    if (!calendar?.id || !this.#month) return;

    const zone = this.#zone();
    const today = Zone.today(zone);

    this.#calendarMonth.busy(true);

    try {
      const weekStart = await this.#weekStartValue();
      const { first, last } = MonthPlan.range(this.#month, weekStart);

      const events = await this.#calendars.events({
        calendarId: calendar.id,
        from: Zone.bounds(first, zone).from,
        to: Zone.bounds(last, zone).to,
      });

      const plan = MonthPlan.of({
        month: this.#month,
        zone,
        setup: calendar,
        events,
        weekStart,
        today,
        now: Zone.nowMinutes(zone),
      });

      this.#monthDrawn = { ...plan, current: today.startsWith(`${this.#month}-`) };
      this.#calendarMonth.show(this.#monthDrawn);
      this.#dom.apply();
    } catch (error) {
      this.#report(error);
    } finally {
      this.#calendarMonth.busy(false);
    }
  }

  /**
   * Which day the week starts on, asked once and kept.
   *
   * It is a preference somebody set years ago, not a thing that
   * changes while an app is open, so asking Google on every month
   * would be a request spent on nothing. Monday stands in until the
   * answer arrives, and if it never does, Monday stays.
   *
   * @returns {Promise<number>}
   */
  async #weekStartValue() {
    if (this.#weekStart !== null) return this.#weekStart;

    this.#weekStart = (await this.#calendars.weekStart()) ?? 1;
    return this.#weekStart;
  }

  /**
   * Shows a date, and reads it from Google.
   *
   * @param {string} date "YYYY-MM-DD"
   */
  async #goToDay(date) {
    this.#day = date;
    this.#calendarOrigin = "calendar-day";

    this.#screens.show("calendar-day");
    this.#dom.apply();

    await this.#drawDay();
  }

  /**
   * One step forward, one back, or home to today.
   *
   * Not through #run: the arrows have no spinner of their own, and
   * the list dims while the answer is on its way, which says the same
   * thing without a button that freezes.
   *
   * @param {number} days 0 for today
   */
  #stepDay(days) {
    const zone = this.#zone();
    const date = days === 0 ? Zone.today(zone) : Zone.shift(this.#day, days);

    this.#goToDay(date).catch(error => this.#report(error));
  }

  /**
   * Reads the day from Google and hands it to the planner.
   *
   * Every visit to a date asks again rather than keeping what it saw
   * last time. A calendar is the one thing in Mirra that somebody
   * else — a phone, a husband, an assistant — changes while the app
   * is open, and a day drawn from memory is a day that is quietly
   * wrong.
   */
  async #drawDay() {
    const calendar = this.#settings.calendar;
    if (!calendar?.id || !this.#day) return;

    const zone = this.#zone();
    const today = Zone.today(zone);
    const { from, to } = Zone.bounds(this.#day, zone);

    this.#calendarDay.busy(true);

    try {
      const events = await this.#calendars.events({ calendarId: calendar.id, from, to });

      const plan = DayPlan.of({
        setup: calendar,
        working: (calendar.days ?? []).includes(Zone.weekday(this.#day)),
        /* The line that says where the day has got to belongs only on
           the day it is. On any other date there is no "now" to draw. */
        now: this.#day === today ? Zone.nowMinutes(zone) : null,
        events: events
          /* An all-day entry — a birthday, a holiday, a note to
             self — has no hours to occupy and must not block a slot.
             Its place is above the day, which comes with the holidays. */
          .filter(event => !event.allDay)
          .map(event => ({
            id: event.id,
            title: event.title,
            kind: event.kind,
            allowOverlap: event.allowOverlap,
            from: Zone.minutesOn(event.start, this.#day, zone),
            to: Zone.minutesOn(event.end, this.#day, zone),
          })),
      });

      this.#dayDrawn = {
        date: this.#day,
        today: this.#day === today,
        cards: plan.cards,
        counts: plan.counts,
      };

      this.#calendarDay.show(this.#dayDrawn);

      this.#dom.apply();
    } catch (error) {
      this.#report(error);
    } finally {
      this.#calendarDay.busy(false);
    }
  }

  /**
   * Temporary, and honest about it: the plus works, the form behind
   * it is the next step. Saying so is better than a button that
   * appears broken.
   */
  #bookingSoon() {
    this.#notice.warn("Форма запису — наступний крок. Поки що календар тільки показує день.");
  }

  /**
   * The calendar as Google has it, or nothing.
   *
   * Checked rather than trusted, because a calendar can be deleted in
   * Google Calendar and nothing here would know: every later request
   * would fail on its own, one at a time, and none of them would say
   * why. Finding it gone forgets it and leaves the screen offering to
   * make a new one, which is the only thing left to offer.
   *
   * @param {object} [options]
   * @param {boolean} [options.announce] say so when it has gone. True
   *        when opening the screen, where nothing else would explain
   *        why it is offering to make one; false when saving, where
   *        what happens next is the explanation.
   * @returns {Promise<{calendar: object|null, presence: string}>}
   *          presence is "missing", "listed", "hidden", "unlisted" or
   *          "unknown" — see #presenceOf
   */
  async #findCalendar({ announce = true } = {}) {
    const saved = this.#settings.calendar;

    if (!saved?.id) {
      console.info("Mirra: no calendar recorded — nothing to ask Google about");
      return { calendar: null, presence: "missing" };
    }

    console.info(`Mirra: asking Google about calendar ${saved.id}`);
    const live = await this.#calendars.get(saved.id);

    if (!live) {
      await this.#settings.forgetCalendar();
      if (announce) this.#notice.warn("Цей календар видалили в Google Календарі поза Mirra. Можна створити новий.");
      return { calendar: null, presence: "missing" };
    }

    /* Renaming it in Google Calendar, or moving the account to another
       time zone, is allowed and breaks nothing — Mirra knows the
       calendar by its id. What it should not do is go on showing a
       name nobody uses any more. */
    if (live.summary !== saved.summary || live.timeZone !== saved.timeZone) {
      await this.#settings.setCalendar({ summary: live.summary, timeZone: live.timeZone });
    }

    const presence = await this.#presenceOf(live.id);

    if (announce && presence === "unlisted") {
      this.#notice.warn("Цього календаря немає у вашому переліку календарів Google — схоже, його прибрали зі списку. Він існує, але ви його не бачите.");
    }

    return { calendar: this.#settings.calendar, presence };
  }

  /**
   * Whether the person can actually see the calendar.
   *
   * The second of the two questions Google answers separately, asked
   * every time the first one comes back yes. Existing and being on
   * somebody's list are different facts, and only the second one is
   * what a person means by "my calendar is there".
   *
   * A failure here is not an answer, so it is not turned into one:
   * "unknown" says the question could not be put, and the screen says
   * nothing rather than something wrong.
   *
   * @param {string} calendarId
   * @returns {Promise<"listed"|"hidden"|"unlisted"|"unknown">}
   */
  async #presenceOf(calendarId) {
    try {
      const entry = await this.#calendars.listEntry(calendarId);
      if (!entry) return "unlisted";
      return entry.hidden ? "hidden" : "listed";
    } catch (error) {
      console.warn("Mirra: could not tell whether the calendar is on the account's list", error);
      return "unknown";
    }
  }

  /**
   * Saves changes to a calendar that already exists.
   *
   * Asks Google whether it still does, every single time, and nothing
   * else is trusted: not the settings file, not the browser's cache,
   * not the fact that this screen was showing a calendar when it was
   * opened. All three have been wrong about it at some point.
   *
   * Finding it gone does not quietly make another one. It says what
   * happened and asks — because a new calendar is empty, and somebody
   * pressing "save" is not asking for an empty calendar.
   *
   * @param {HTMLElement|null} button
   */
  async #saveCalendar(button) {
    const values = this.#calendarSettings.values;
    if (!this.#hasWorkingDays(values)) return;

    const { ok, calendar: saved, presence } = await this.#liveCalendar(button);
    if (!ok) return;

    if (!saved?.id) {
      console.info("Mirra: nothing to save to — no live calendar");
      this.#calendarSettings.show(null, "missing");
      this.#dom.apply();
      await this.#offerNewCalendar(button, values);
      return;
    }

    await this.#run(button, async () => {
      if (values.summary !== saved.summary || values.timeZone !== saved.timeZone) {
        await this.#calendars.update(saved.id, {
          summary: values.summary,
          timeZone: values.timeZone,
        });
      }

      await this.#settings.setCalendar(values);
      console.info(`Mirra: calendar ${saved.id} updated (${presence})`);

      /* Saved is true and useless on its own when the calendar is on
         no list: the change went through, and the person will look
         for it in Google Calendar and find nothing. */
      if (presence === "unlisted") {
        this.#notice.warn("Збережено, але цього календаря немає у вашому переліку календарів Google — там змін не видно.");
      } else {
        this.#notice.done("Налаштування збережено.");
      }
    });
  }

  /**
   * Looks the calendar up, with the button showing that something is
   * happening.
   *
   * Not through #run, for two reasons. #run swallows what the action
   * returns, and — the one that matters — a request that fails because
   * the network is down would then be indistinguishable from a
   * calendar that has been deleted. Offering to build a new one
   * because a train went into a tunnel is not a mistake worth risking.
   *
   * @param {HTMLElement|null} button
   * @returns {Promise<{ok: boolean, calendar: object|null, presence: string}>}
   */
  async #liveCalendar(button) {
    this.#notice.hide();
    this.#setBusy(button, true);

    try {
      const { calendar, presence } = await this.#findCalendar({ announce: false });

      /* The screen is as old as the last answer, and the answer just
         changed. Only the state line, never the fields: refilling
         those would throw away whatever is half-typed in them. */
      this.#calendarSettings.state(calendar, presence);

      return { ok: true, calendar, presence };
    } catch (error) {
      this.#report(error);
      return { ok: false, calendar: null, presence: "unknown" };
    } finally {
      this.#setBusy(button, false);
    }
  }

  /**
   * Offers a new calendar when the one being saved to has gone.
   *
   * @param {HTMLElement|null} button
   * @param {object} values
   */
  async #offerNewCalendar(button, values) {
    const agreed = await this.#confirm.ask({
      title: "Mirra не бачить цього календаря",
      message: values.summary,
      note: "Його видалили або прибрали з вашого Google Календаря поза Mirra, "
          + "і повернути його Mirra не може. Створити натомість новий? Він буде "
          + "порожній — записи зі старого в нього не переносяться.",
      confirmLabel: "Створити новий",
      cancelLabel: "Не зараз",
    });

    if (agreed) await this.#makeCalendar(button, values);
  }

  /**
   * Makes a new calendar, deliberately.
   *
   * Two questions stand between the button and the calendar, and both
   * exist because of the same rule: Mirra can only ever see calendars
   * it made itself. So it cannot look for one that is already there,
   * and it cannot go back to one it has left behind.
   *
   * @param {HTMLElement|null} button
   */
  async #createCalendar(button) {
    const values = this.#calendarSettings.values;
    if (!this.#hasWorkingDays(values)) return;

    const { ok, calendar: live, presence } = await this.#liveCalendar(button);
    if (!ok) return;

    /* A calendar of that name is already open in front of them, which
       nearly always means they meant to change it. Making a second one
       called the same thing would leave two identical names in their
       Google Calendar and Mirra attached to the newer, empty one.

       Not offered when that calendar is on no list: saving into
       something the person cannot see is advice that leads nowhere,
       and "there is already a calendar like this" reads as "all is
       well" when plainly it is not. */
    if (live?.id && live.summary.trim() === values.summary.trim() && presence !== "unlisted") {
      const answer = await this.#confirm.choose({
        title: "Такий календар уже є",
        message: values.summary,
        note: "Mirra вже працює з календарем із цією назвою. Якщо ви хотіли "
            + "змінити його налаштування — їх можна просто зберегти.",
        options: [
          { id: "save", label: t("Зберегти зміни в ньому") },
          { id: "create", label: t("Все одно створити новий") },
        ],
        cancelLabel: "Скасувати",
      });

      if (answer !== "create") {
        if (answer === "save") await this.#saveCalendar(button);
        return;
      }
    }

    const agreed = await this.#confirm.ask({
      title: "Створити календар?",
      message: values.summary,
      note: presence === "unlisted"
        ? "Теперішнього календаря немає у вашому переліку календарів Google — зазвичай це "
          + "означає, що його прибрали зі списку, а не видалили. Новий календар буде "
          + "видимий, але порожній: записи зі старого в нього не переносяться, а доступ до "
          + "старого Mirra втратить назавжди."
        : live?.id
        ? "Mirra назавжди втратить доступ до теперішнього календаря: за правилами "
          + "Google вона бачить лише той календар, який створила сама, і повернутися "
          + "до попереднього не зможе. Він залишиться у вашому Google Календарі, але "
          + "Mirra його більше не читатиме, і чи вдасться колись це змінити — поки "
          + "невідомо."
        : "Mirra бачить лише той календар, який створила сама. Решту вашого Google "
          + "Календаря вона не читає й читати не може.",
      confirmLabel: "Створити",
      cancelLabel: "Не зараз",
    });

    if (agreed) await this.#makeCalendar(button, values);
  }

  /**
   * The creation itself, once somebody has said yes to it.
   *
   * @param {HTMLElement|null} button
   * @param {object} values
   */
  async #makeCalendar(button, values) {
    await this.#run(button, async () => {
      const created = await this.#calendars.create({
        summary: values.summary,
        timeZone: values.timeZone,
      });

      /* Google's answer wins over the form: it decides the id, and it
         may tidy the name or the zone on the way in. */
      await this.#settings.setCalendar({
        ...values,
        id: created.id,
        summary: created.summary || values.summary,
        timeZone: created.timeZone || values.timeZone,
      });

      /* Asked straight after making it, because this is the moment
         the answer is worth most: if a calendar Mirra just created is
         on no list, that is Google's own doing and not somebody
         deleting it afterwards. */
      const presence = await this.#presenceOf(created.id);
      console.info(`Mirra: calendar ${created.id} created (${presence})`);

      this.#calendarSettings.show(this.#settings.calendar, presence);
      this.#dom.apply();

      if (presence === "unlisted") {
        this.#notice.warn("Календар створено, але Google не додав його до вашого переліку календарів — у Google Календарі його не видно.");
      } else {
        this.#notice.done("Календар створено.");
      }
    });
  }

  /**
   * Asks Google where the calendar stands, on demand.
   *
   * The same two questions #findCalendar asks when the screen opens,
   * put again because a calendar can be deleted or taken off the list
   * at any moment in another tab, and a screen that answered half an
   * hour ago is not an answer.
   *
   * Nothing is written and nothing is created: the worst this can do
   * is forget a calendar Google says no longer exists, which is what
   * every other lookup does too.
   *
   * @param {HTMLElement|null} button
   */
  async #checkCalendar(button) {
    if (!this.#settings.calendar?.id) {
      this.#notice.warn("Календаря ще немає — спершу створіть його.");
      return;
    }

    /* Through the same path as everything else, so the state line is
       refreshed by the lookup itself and this method only has to say
       the answer out loud. */
    const { ok, calendar, presence } = await this.#liveCalendar(button);
    if (!ok) return;

    if (!calendar) {
      this.#notice.warn("Календаря більше немає в Google — його видалили поза Mirra. Можна створити новий.");
      return;
    }

    if (presence === "unlisted") {
      this.#notice.warn("Цього календаря немає у вашому переліку календарів Google — схоже, його прибрали зі списку. Він існує, але ви його не бачите.");
      return;
    }

    if (presence === "hidden") {
      this.#notice.done("Календар на місці, але прихований у вашому Google Календарі.");
      return;
    }

    if (presence === "unknown") {
      this.#notice.warn("Календар на місці. Чи є він у вашому переліку календарів — Google цього разу не відповів.");
      return;
    }

    this.#notice.done("Календар на місці — Google його бачить.");
  }

  /**
   * @param {object} values from the settings screen
   * @returns {boolean} whether the week they describe is workable
   */
  #hasWorkingDays(values) {
    if (values.days.length) return true;

    /* A week with no working days would leave every hour of every day
       dimmed, which is not a setting anybody means. Said before
       anything is sent, rather than silently corrected on the way into
       the file. */
    this.#notice.warn("Виберіть хоча б один робочий день.");
    return false;
  }

  /**
   * What follows every freshly read sheet.
   *
   * One place, called from every path that loads one: opening the list,
   * picking another spreadsheet, creating one, pressing refresh. It
   * used to be called from the first of those only, so choosing
   * another sheet left it unchecked — and, because the list was then in
   * memory, every later visit took the shortcut past the checks too.
   * Nothing looked at that sheet again until the page was reloaded.
   *
   * Not awaited by its callers: the list is already readable, and this
   * may end in a dialog that waits for an answer. Holding a button's
   * loading state open for that would leave it spinning while somebody
   * reads a question.
   *
   * @param {object} snapshot
   */
  #afterLoad(snapshot) {
    const saved = this.#settings.section(MirraApp.CLIENTS_SECTION);
    if (!saved) return;

    this.#tidySheet(saved, snapshot).catch(error =>
      console.warn("Could not look over the sheet", error));
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

    const snapshot = file.trashed ? loaded : await this.#upgradeShape(saved, loaded);
    return { snapshot, file };
  }

  /**
   * Everything Mirra offers to do about the sheet, once the list is up.
   *
   * Appearance first, values second, because accepting the first can
   * move columns and re-read the sheet — and the value check would then
   * be examining rows that no longer exist in that arrangement.
   *
   * Both are rare enough that two questions in one visit is unlikely:
   * the appearance is offered once per release that changes it, and the
   * values only when something has actually gone wrong.
   *
   * @param {object} saved
   * @param {object} snapshot
   */
  async #tidySheet(saved, snapshot) {
    /* Started before the two questions rather than after them, and not
       waited on: writing the instructions on Drive needs nobody's
       permission and nobody's attention, while a dialog can sit open
       for as long as somebody takes to read it.

       Safe to run alongside: the look can move columns and the value
       check can rewrite a phone number, and the instructions describe
       neither — they name the headings, which neither of those
       changes. */
    const guide = this.#refreshGuide(snapshot);

    await this.#checkValues(saved, await this.#offerLook(saved, snapshot));
    await guide;
  }

  /**
   * Keeps the instructions on Drive matching the sheet.
   *
   * Silent in both directions. Nothing is said when the file is already
   * current, which is nearly always; and nothing is said when it could
   * not be written, because somebody who came to look at their clients
   * did not ask about a file they may not know exists. It is tried
   * again on the next visit.
   *
   * @param {object} snapshot
   */
  async #refreshGuide(snapshot) {
    try {
      await this.#guide.refresh(snapshot);
    } catch (error) {
      console.warn("Could not write the instructions for assistants", error);
    }
  }

  /**
   * Offers to bring an older Mirra sheet up to the current look.
   *
   * @param {object} saved
   * @param {object} snapshot
   * @returns {Promise<object>} the sheet as it now stands
   */
  async #offerLook(saved, snapshot) {
    const look = new SheetLook(snapshot, { saved });
    if (!look.isNeeded) return snapshot;

    const agreed = await this.#confirm.ask(look.question());

    /* Recorded either way. "Not now" is an answer about this look, not
       about every look Mirra will ever have — see setLookVersion. */
    await this.#settings.setLookVersion(MirraApp.CLIENTS_SECTION, SheetLook.version);
    if (!agreed) return snapshot;

    try {
      const updated = await look.apply(this.#sheets);
      this.#showClients(updated);
      this.#notice.done("Вигляд таблиці оновлено.");
      return updated;
    } catch (error) {
      /* The sheet is unchanged or part-changed, and either way it still
         opens. Not worth an error screen over decoration. */
      console.warn("Could not update the sheet's look", error);
      this.#notice.alert("Не вдалося оновити вигляд таблиці.");
      return snapshot;
    }
  }

  /**
   * Looks for values that something outside Mirra damaged.
   *
   * Runs behind the list rather than before it, for two reasons. The
   * rows are already in memory and the work is a few string tests
   * each, so there is nothing to wait for. And one of the answers it
   * offers is "take me to that client" — which needs a list to open a
   * card from.
   *
   * Quiet unless there is something to say. A check that greets people
   * with "everything is fine" every time they open their clients is a
   * check they will learn to look past.
   *
   * @param {object} saved
   * @param {object} snapshot
   */
  async #checkValues(saved, snapshot) {
    /* Somebody already said "not now" recently, and meant it. */
    if (this.#settings.isSilenced(MirraApp.CLIENTS_SECTION)) return;

    const check = new SheetCheck(snapshot, {
      dateFormat: this.#settings.dateFormat,
      language: this.#translator.code,
    });
    if (!check.isNeeded) return;

    /* Said in a dialog, not a notice. This is the one message in Mirra
       that hands somebody a job — a number to ask a client for again —
       and a job has to survive being looked away from. Notices report
       what Mirra just did; they are the wrong container for work. */
    if (!check.needsFixes) return this.#answerDamage(check, snapshot);

    if (await this.#repairValues(check, snapshot)) {
      this.#notice.done("Номери відновлено.");
      this.#clients.render(snapshot);
      return;
    }

    /* Declined. The dialog said this would happen, so it is not a
       surprise — and without it the same question would arrive on every
       visit until the answer changed, which is how a warning becomes
       wallpaper. */
    await this.#settings.silence(MirraApp.CLIENTS_SECTION, MirraApp.QUIET_DAYS);
  }

  /**
   * Offers the three things that can be done about damage nothing can
   * undo: fix it by hand, empty the cells, or be left alone for a week.
   *
   * @param {SheetCheck} check
   * @param {object} snapshot
   */
  async #answerDamage(check, snapshot) {
    const choice = await this.#confirm.choose(check.report());

    if (choice === SheetCheck.MANUAL) return this.#openClient(check.firstDamagedRow);

    if (choice === SheetCheck.QUIET) {
      await this.#settings.silence(MirraApp.CLIENTS_SECTION, MirraApp.QUIET_DAYS);
      return;
    }

    /* Closing the dialog, Escape and the backdrop all land here, and
       all of them mean "leave it". Nothing is written and nothing is
       silenced: next visit asks again, which is right, because the
       question was never answered. */
    if (choice !== SheetCheck.CLEAR) return;

    /* Asked twice, and the second time in red. This is the only action
       in the whole check that destroys something. */
    if (!await this.#confirm.ask(check.clearQuestion())) return;

    try {
      for (const { column, rows } of await check.clear(this.#sheets)) {
        for (const index of rows) {
          if (snapshot.rows[index]) snapshot.rows[index][column] = "";
        }
      }

      this.#clients.render(snapshot);
      this.#notice.done("Пошкоджені клітинки очищено.");
    } catch (error) {
      console.warn("Could not clear the damaged cells", error);
      this.#notice.alert("Не вдалося очистити клітинки. Спробуйте пізніше.");
    }
  }

  /**
   * Puts back what can be put back, having asked first.
   *
   * @param {SheetCheck} check
   * @param {object} snapshot
   * @returns {Promise<boolean>} whether anything was written
   */
  async #repairValues(check, snapshot) {
    if (!await this.#confirm.ask(check.question())) return false;

    try {
      const written = await check.apply(this.#sheets);

      /* The rows in memory are what the list draws from, so they are
         brought in line here rather than re-reading the whole sheet for
         a handful of cells. */
      const column = new ClientSchema(snapshot.headers).indexOf("phone");
      if (column >= 0) {
        for (const [index, value] of written) {
          if (snapshot.rows[index]) snapshot.rows[index][column] = value;
        }
      }

      return written.size > 0;
    } catch (error) {
      /* A number Mirra still shows correctly is not worth refusing to
         open the list over. It will be offered again next visit. */
      console.warn("Could not repair damaged values", error);
      return false;
    }
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
  async #upgradeShape(saved, snapshot) {
    const upgrade = new SchemaUpgrade(snapshot);
    if (!upgrade.isNeeded) return this.#rememberVersion(snapshot);

    /* Three different things can need doing, and only two of them are
       anybody's business but Mirra's.

       Adding a column to a sheet Mirra made needs no permission: the
       columns are its own. Adding one to a sheet somebody brought does,
       because its shape is theirs.

       Writing an id into an empty cell of Mirra's own ID column needs
       none either, and asking was a mistake: it is a service value
       nobody chose and nobody reads, nothing else depends on it, and a
       question with one sensible answer is a toll rather than a choice.
       It is asked about only where the column itself is not Mirra's.

       Repairing an id that is there and wrong is different again —
       something happened to a row that already existed, and whoever
       did it deserves to hear about it before it is written over. */
    const mustAsk = (upgrade.needsColumns && !saved.managed)
      || upgrade.isDamaged
      || (upgrade.needsRepair && this.#idColumnIsTheirs(saved, upgrade));

    if (mustAsk && !await this.#askToUpgrade(upgrade)) return snapshot;

    try {
      const updated = await upgrade.apply(this.#sheets, saved, this.#translator.code);

      /* The column exists because Mirra just made it, so from now on
         filling it in is Mirra's own business and needs no asking. */
      if (upgrade.missingColumns.includes("id")) {
        await this.#settings.setIdColumn(MirraApp.CLIENTS_SECTION, "mirra");
      }

      if (upgrade.isDamaged) this.#notice.done("Технічні позначки відновлено.");
      else if (upgrade.needsRepair) this.#notice.done("Позначки дописано.");
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
   * What to write down about the ID column of a sheet being chosen.
   *
   * @param {object} snapshot
   * @returns {string} "mirra", "theirs" or "" for nothing to record
   */
  #idOwnerOf(snapshot) {
    const ours = new SchemaUpgrade(snapshot).idsAreOurs;
    if (ours === true) return "mirra";
    if (ours === false) return "theirs";

    /* The column exists and holds nothing. Its contents will never
       settle it, so the fact that it was already there when the sheet
       was chosen is the only thing there is to go on. */
    return new ClientSchema(snapshot.headers).has("id") ? "theirs" : "";
  }

  /**
   * Whether the ID column belongs to the person rather than to Mirra.
   *
   * The column's contents are asked first and settle it nearly always:
   * ids in Mirra's own format are Mirra's own, whoever opened the file
   * and however it was chosen. That matters because a sheet Mirra made
   * and then had to be picked again through the Picker — a new phone,
   * or "Інша таблиця" — looks like a stranger's sheet from the
   * outside, and judging it by its columns alone had Mirra asking
   * people for permission to write into a column it had made itself.
   *
   * What is recorded in settings decides only the case the contents
   * cannot: a column that is there and entirely empty. Then the one
   * moment somebody can be asked is the moment the sheet was chosen,
   * and that is what was written down.
   *
   * @param {object} saved the section as recorded in settings
   * @param {SchemaUpgrade} upgrade
   * @returns {boolean}
   */
  #idColumnIsTheirs(saved, upgrade) {
    if (saved.managed) return false;

    const ours = upgrade.idsAreOurs;
    if (ours !== null) return !ours;

    return this.#settings.idColumn(MirraApp.CLIENTS_SECTION) === "theirs";
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
      this.#notice.done("Таблицю відновлено з кошика.");

      /* The sheet was read before anyone knew it was in the bin, so the
         checks were skipped on the way here. Now that it is back out,
         they run — the same as for any other sheet that has just been
         read. */
      if (snapshot) {
        this.#showClients(snapshot);
        this.#afterLoad(snapshot);
      }
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
         being asked. Unless it is the sheet already in use, which
         #remember recognises and does not demote. */
      await this.#remember(snapshot, false);
      this.#showClients(snapshot);

      /* Looked over like any other freshly read sheet — and this is the
         sheet most worth looking over, since Mirra has never seen it
         before. The instructions on Drive are written here too, because
         the point of that file is that somebody can hand their Mirra
         folder to an assistant, and they may well do that this
         afternoon. */
      this.#afterLoad(snapshot);
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
      this.#afterLoad(snapshot);
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

      /* Somebody presses refresh because they believe the sheet has
         changed, which is exactly when it is worth looking over again —
         and when the instructions on Drive may have a renamed column to
         catch up with. */
      this.#afterLoad(snapshot);
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

    /* Worked out before anything is deleted, while the rows still sit
       where the list thinks they do. */
    const list = this.#clients.list;
    const cleanup = list ? LinkSync.planRemoval(client, list) : [];

    /* Said up front: deleting one card also edits others, and people
       should know which before agreeing rather than discover it after. */
    const note = t("Запис буде видалено з таблиці. Цю дію не можна скасувати.")
      + (cleanup.length
        ? " " + t("Зв'язки з цим клієнтом також буде прибрано з карток: {}.",
                  cleanup.map(edit => edit.name).join(", "))
        : "");

    const agreed = await this.#confirm.ask({
      title: "Видалити клієнта?",
      message: client.displayName,
      note,
      confirmLabel: "Видалити",
      danger: true,
    });

    if (!agreed) return;

    await this.#run(button, async () => {
      await this.#sheets.deleteRow(
        saved.spreadsheetId, this.#snapshot.sheetId, client.rowNumber
      );

      this.#snapshot.rows.splice(client.rowNumber - 2, 1);

      /* After the delete rather than before. If clearing the links then
         fails, what is left is a link to nobody — the state this fixes,
         and harmless. The other order could fail the other way: links
         already gone from other cards while the client they pointed at
         is still there. */
      await this.#removeLinksTo(client, cleanup, list);

      this.#card.clear();
      this.#clients.render(this.#snapshot);
      this.#backToList();
      this.#notice.done("Клієнта видалено.");
    });
  }

  /**
   * Clears every link that pointed at a client who has just been deleted.
   *
   * @param {import("./domain/client/Client.js").Client} removed
   * @param {Array<{rowNumber: number, links: object[]}>} cleanup
   * @param {ClientList} list the list as it was before the delete
   */
  async #removeLinksTo(removed, cleanup, list) {
    if (!cleanup.length) return;

    const column = list.schema.indexOf("links");
    if (column < 0) return;

    const language = list.schema.languageOf(this.#translator.code);

    /* Rows below the deleted one have each moved up by one. The plan was
       made before the delete, so its row numbers are shifted here to
       match the sheet as it now stands. */
    const edits = new Map(cleanup.map(edit => {
      const row = edit.rowNumber > removed.rowNumber ? edit.rowNumber - 1 : edit.rowNumber;
      return [row - 2, ClientLinks.stringify(edit.links, language)];
    }));

    try {
      await this.#sheets.writeColumn(this.#snapshot, column, edits);

      for (const [index, value] of edits) {
        if (this.#snapshot.rows[index]) this.#snapshot.rows[index][column] = value;
      }
    } catch (error) {
      console.warn("Could not clear links to the deleted client", error);
      this.#notice.alert("Клієнта видалено, але зв'язки з ним в інших картках прибрати не вдалося.");
    }
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
    let draft = this.#form.draft;
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

    /* Who is being saved is settled before where: a duplicate caught
       here becomes an edit of the existing row, and everything after
       this point — columns, relationships, the write itself — then
       works on that instead. */
    if (draft.isNew) {
      const resolved = await this.#checkDuplicate(draft);
      if (resolved === null) return;
      draft = resolved;
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
   * Notices when a "new" client is somebody already in the sheet.
   *
   * Two rows for one person mean half the history in each and neither
   * card right, so the question comes before anything is written. Only
   * what the new entry would add is listed — a birthday the old card
   * never had, an Instagram it did not know — never the differences,
   * because a different spelling or phone may be a correction or a
   * mistake, and choosing between two facts is not Mirra's call.
   *
   * @param {ClientDraft} draft
   * @returns {Promise<ClientDraft|null>} what to save, or null to stop
   */
  async #checkDuplicate(draft) {
    const list = this.#clients.list;
    if (!list) return draft;

    const match = DuplicateFinder.find(draft, list);
    if (!match) return draft;

    const info = DuplicateFinder.newInfo(draft, match.client, this.#settings.dateFormat);

    const reasons = match.reasons.map(reason => t(reason.text, ...reason.values)).join(", ");

    /* The old value is shown beside anything that would be replaced, so
       one tap is enough and nobody is surprised afterwards. */
    const changes = info.map(item => {
      const line = `${t(item.name)}: ${item.value}`;
      return item.was ? `${line} (${t("було {}", item.was)})` : line;
    }).join(" · ");

    const note = t("Збігається: {}.", reasons) + " " + (info.length
      ? t("Буде записано: {}.", changes)
      : t("Нічого нового — усе це вже є в картці."));

    /* "Оновити" when something is being replaced, "Додати" when it is
       only filling gaps — the button says what it is about to do. With
       nothing to write at all, merging would be a save that changes
       nothing, so the useful offer becomes opening the card. */
    const replaces = info.some(item => item.was);
    const options = info.length
      ? [{ id: "merge", label: t(replaces ? "Оновити наявного" : "Додати до наявного") },
         { id: "create", label: t("Все одно створити нового") }]
      : [{ id: "open", label: t("Відкрити наявного") },
         { id: "create", label: t("Все одно створити нового") }];

    const choice = await this.#confirm.choose({
      title: "Схоже, такий клієнт уже є",
      message: match.client.displayName,
      note,
      options,
      cancelLabel: "Скасувати",
    });

    /* undefined means the dialog could not be shown at all. Saving as
       new is what would have happened before this feature existed, so
       it is the safe fallback — losing what was typed is not. */
    if (choice === "create" || choice === undefined) return draft;

    if (choice === "open") {
      this.#openClient(match.client.rowNumber);
      return null;
    }

    if (choice !== "merge") return null;

    const merged = new ClientDraft({
      schema: list.schema,
      values: match.client.values,
      rowNumber: match.client.rowNumber,
      dateFormat: this.#settings.dateFormat,
    });

    if (!merged.id) merged.id = ClientId.create();
    for (const item of info) item.apply(merged);

    return merged;
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

      /* The sheet has a new heading, so the instructions on Drive now
         describe a sheet that no longer exists. Only those: the whole
         look-over belongs to opening a sheet, not to the middle of
         saving a client, who is still waiting to be written. */
      this.#refreshGuide(snapshot);

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
    /* Choosing the sheet that is already in use is not news about it.
       People arrive back at the Picker for all sorts of reasons — a new
       phone, a look around "Інша таблиця" and back — and everything
       Mirra had learnt about that file used to be thrown away on the
       way past: which appearance it had already been offered, how long
       it was asked to stay quiet about damaged values, whose the ID
       column is. The questions then came round again, every single
       time, however they had been answered. */
    const current = this.#settings.section(MirraApp.CLIENTS_SECTION);
    const known = current?.spreadsheetId === snapshot.spreadsheetId
      ? current
      : this.#settings.sheetMemory(snapshot.spreadsheetId);

    /* A sheet Mirra made stays a sheet Mirra made. The Picker hands
       over a file and nothing about where it came from, so arriving
       through it says nothing either way. */
    const isOurs = managed || known?.managed === true;

    return this.#settings.setSection(MirraApp.CLIENTS_SECTION, {
      spreadsheetId: snapshot.spreadsheetId,
      sheetTitle: snapshot.sheetTitle,
      managed: isOurs,
      /* Written down for the one case nothing can be read off the sheet
         later: a column that is there and empty. Everywhere else the
         contents answer the question every time it is asked — see
         #idColumnIsTheirs. A picked sheet with no id column at all is
         left unrecorded; it becomes Mirra's if Mirra adds one. */
      idColumn: isOurs
        ? "mirra"
        : this.#idOwnerOf(snapshot) || known?.idColumn || "",
      /* A sheet Mirra just made already looks the way Mirra makes them,
         so it starts at the current appearance and is never offered an
         update to the one it was born with. A sheet Mirra has met
         before keeps whatever it was already offered. */
      lookVersion: known
        ? (Number(known.lookVersion) || 0)
        : (isOurs ? SheetLook.version : 0),
      /* Silence is about a sheet, not about a visit to the Picker. */
      quietUntil: known?.quietUntil ?? "",
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
