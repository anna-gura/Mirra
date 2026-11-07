/**
 * Configuration.
 *
 * Everything here is safe to read: it all ships in the bundle and can
 * be pulled out of the running app by anyone who opens the developer
 * tools. What protects a Google Cloud project is the origin allow-list
 * configured there, not the obscurity of these strings.
 *
 * Credentials still live in a separate, git-ignored file. The reason is
 * not secrecy but hygiene: a fork should point at its own Google
 * project, and copying a repository should not silently borrow
 * somebody else's quota.
 */

/* Loaded at runtime rather than imported statically, so a checkout with
   no credentials file starts and explains itself instead of failing
   with a module resolution error nobody can read. */
let credentials = { CLIENT_ID: "", API_KEY: "", APP_ID: "" };

/* Written by build.sh from version.json, so the app knows what it is
   without asking anybody — no request to GitHub, no third party told
   who opened Mirra and when.

   Falls back to a development marker when the file is absent, which is
   the normal state of a working copy. */
let version = "0.0.0-dev";

try {
  ({ VERSION: version } = await import("./version.js"));
} catch {
  /* Running from a checkout rather than a deployment. */
}

try {
  ({ credentials } = await import("./credentials.js"));
} catch {
  console.error(
    "Mirra: js/credentials.js is missing.\n" +
    "Copy js/credentials.example.js to js/credentials.js and fill in " +
    "the three values from Google Cloud Console."
  );
}

/**
 * Everything Mirra ever asks Google for.
 *
 * All three are non-sensitive, which is not a detail: a sensitive
 * scope would put the app in Google's verification queue, and every
 * person using it would meet an "unverified app" warning until it came
 * out the other side. The architecture is shaped around staying out of
 * that queue — files are hand-picked rather than searched, and the
 * calendar is one Mirra makes rather than the one they already keep.
 */
const SCOPES = Object.freeze({
  /** Only files the user picks or Mirra creates. Nothing else on Drive. */
  FILES: "https://www.googleapis.com/auth/drive.file",

  /** Secondary calendars Mirra creates, and the events on them. */
  CALENDAR: "https://www.googleapis.com/auth/calendar.app.created",

  /** Public calendars, which is where the holidays of a country live. */
  HOLIDAYS: "https://www.googleapis.com/auth/calendar.events.public.readonly",

  /**
   * The names of the calendars this account is subscribed to. Read
   * only, and never written to.
   *
   * Asked for because of a question nothing else can answer: whether
   * the calendar Mirra made is one the person can actually see. The
   * calendar itself and the account's list of calendars are two
   * separate things in Google's API — a calendar can exist, answer
   * every request Mirra makes, and still be absent from the list the
   * person looks at in Google Calendar. Without this scope Mirra
   * cannot tell those apart, and reports "saved" about a calendar
   * nobody can find.
   *
   * Non-sensitive, like the rest. It reads names, not events, and
   * Mirra never calls the list method — only asks after the one id it
   * wrote itself.
   */
  CALENDAR_LIST: "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
});

export const config = Object.freeze({
  /** This build, from the most recent git tag. */
  VERSION: version,

  CLIENT_ID: credentials.CLIENT_ID,
  API_KEY:   credentials.API_KEY,
  APP_ID:    credentials.APP_ID,

  SCOPES,

  /**
   * What signing in asks for, and all it asks for.
   *
   * The calendar scopes are deliberately absent. Somebody who keeps a
   * client list and never books anybody should not be handed a consent
   * screen about calendars — so those are asked for on the day they
   * first open the calendar, and not before. Google calls this
   * incremental authorisation; see AuthService.grant.
   */
  SCOPE: SCOPES.FILES,

  /** Asked for together, so the calendar costs one consent and not two. */
  CALENDAR_SCOPES: Object.freeze([SCOPES.CALENDAR, SCOPES.HOLIDAYS, SCOPES.CALENDAR_LIST]),

  /**
   * Sign-in strategy: "popup" or "redirect".
   *
   * "popup" keeps the page loaded and is the better experience, but it
   * depends on window-to-window messaging that browser isolation
   * policies sometimes break. "redirect" navigates to Google and back,
   * which has no such moving parts.
   *
   * If sign-in silently fails with the popup, switch this one value —
   * AuthServiceFactory handles the rest.
   */
  AUTH_MODE: "popup",

  /**
   * Used by redirect mode only. Where Google sends the browser back
   * after sign-in. Leave empty to
   * derive it from the current address, which is almost always right.
   * Whatever ends up here must appear in Authorized redirect URIs
   * character for character.
   */
  REDIRECT_URI: "",

  /**
   * How dates are written into the sheet. The chosen key is kept in
   * mirra.json, so it travels with the account and can be offered as a
   * setting later without touching any stored data.
   */
  DEFAULT_DATE_FORMAT: "dd/mm/yyyy",

  /**
   * The shape of the data in each kind of sheet, as a number.
   *
   * Mirra itself never decides anything by it. Whether a sheet needs a
   * column added is answered by looking at the columns, which stays
   * true after somebody edits the file by hand — a number cannot say
   * that, and a number that contradicts the data is worse than no
   * number at all.
   *
   * It exists for the assistants people work through. ai.md states the
   * version it was written for, mirra.json states the version the sheet
   * is at, and an assistant comparing the two can tell that its
   * instructions are older than the sheet and stop before writing
   * something in the wrong place.
   *
   * One number per kind of sheet, because they move independently:
   * bookings arriving will not change anything about a client row.
   * Raise a number when the sheet's fields change — not when its
   * colours do; that is SHEET_LOOK.version.
   */
  SCHEMA: Object.freeze({
    clients: 1,
  }),

  /**
   * The instructions Mirra leaves on Drive for whatever assistant the
   * person works through.
   *
   * Written into their folder rather than published on the site,
   * because the file has to describe *their* sheet — its real headings,
   * its ids, its date format — and because an assistant reading
   * mirra.day would be reading about a Mirra the person may not have
   * opened yet. The copy beside the data is the one that matches it.
   */
  AI_GUIDE: Object.freeze({
    fileName: "ai.md",
    template: "assets/ai-guide.md",

    /**
     * What the file says, as a number of its own.
     *
     * Raise it whenever the template changes or whenever the generator
     * starts putting something different in — the same job
     * SHEET_LOOK.version does for the sheet's colours.
     *
     * It exists because the alternative was leaning on VERSION, and
     * VERSION can be wrong in exactly the situation where this matters:
     * a checkout with a stale js/version.js, a deployment whose build
     * step did not run. Then every input to the file looks unchanged,
     * the file is left alone, and the instructions on somebody's Drive
     * quietly describe a Mirra that no longer exists.
     *
     * 2 — the rule to re-read the file before every change, and the
     *     staleness check moved from the first write to every write.
     * 3 — Mirra fills an empty id in by itself, so the file no longer
     *     promises that the person will be asked about it.
     */
    version: 3,
  }),

  /**
   * Where Mirra lives, written out rather than read from the browser.
   *
   * Everything in the app uses relative addresses and needs none of
   * this. The one exception is a link Mirra writes into a file on
   * somebody's Drive: that file is read somewhere else entirely — by an
   * assistant, on another machine — and a link taken from wherever the
   * app happened to be running would be useless there. A development
   * server would put http://127.0.0.1:5500 into the real file on the
   * real Drive, which is also why this is not location.origin with a
   * guard around it: a file generated locally should be the same file
   * that production generates, or testing it locally proves nothing.
   *
   * A fork should change this line, and will point at mirra.day until
   * it does. That is the harmless direction to be wrong in: the page it
   * names explains the file, which is true wherever the fork lives.
   */
  SITE_URL: "https://mirra.day",

  /**
   * The calendar Mirra keeps appointments in.
   *
   * Its own, created by Mirra, and the only one it can see. The one
   * the person already keeps — work, family, the dentist — stays
   * invisible, which is the price of a scope that needs no review and
   * a promise worth making: Mirra reads nothing it did not make.
   */
  CALENDAR: Object.freeze({
    /* Named so it is recognisable among a dozen other calendars in
       Google's sidebar. Renaming it there breaks nothing: Mirra knows
       it by id. */
    /* "Робота" rather than "Клієнти": appointments are what goes in it
       first, but it is the calendar Mirra works in, and the next thing
       to land there may not be a client at all. A name that has to be
       changed later is a name that stays wrong in everybody's sidebar,
       because nobody renames a calendar twice. */
    title: Object.freeze({ uk: "Mirra — Робота", en: "Mirra — Work" }),

    /* What a new appointment starts as, until services with durations
       of their own arrive. Minutes. */
    duration: 60,

    /* Breathing room between one client and the next. Offered when
       booking rather than enforced. */
    gap: 15,

    /* Working days as ISO numbers: 1 is Monday, 7 is Sunday. ISO
       rather than JavaScript's own 0-for-Sunday, because a number
       stored in a file somebody can open should mean what the rest of
       the world means by it. */
    days: Object.freeze([1, 2, 3, 4, 5]),

    /* Wall-clock times in the calendar's own time zone. */
    from: "09:00",
    to: "18:00",
  }),

  SHEETS_API: "https://sheets.googleapis.com/v4/spreadsheets",
  CALENDAR_API: "https://www.googleapis.com/calendar/v3",
  GIS_SRC:    "https://accounts.google.com/gsi/client",
  GAPI_SRC:   "https://apis.google.com/js/api.js",

  /** Refresh this many seconds before the token actually expires. */
  TOKEN_SAFETY_MARGIN: 60,

  /**
   * How a Mirra spreadsheet looks when opened in Google Sheets.
   *
   * The file is meant to be opened directly — that is the whole promise
   * — so it is worth it being pleasant to read there, not only inside
   * Mirra. Colours are the app's own, from css/tokens.css: a sheet in
   * Google's default grey looks like any other document, and this one
   * is supposed to look like it belongs to something.
   *
   * Alternating colours are applied as banding, which Sheets recomputes
   * itself on every render. Painting the cells instead would look the
   * same until the first row was deleted, after which the stripes would
   * be wrong for ever.
   *
   * version is what decides whether an existing sheet is offered an
   * update. Raise it whenever anything here changes, or whenever the
   * column order in NEW_SHEET.fields changes — those are the two things
   * the offer can put right. Nothing else depends on the number.
   */
  SHEET_LOOK: Object.freeze({
    version: 1,

    /* --bg-deep's warmer cousin: far enough from the band in hue that
       the heading reads as a heading rather than as a darker stripe.
       Text on it clears AAA at 7.5:1. */
    header:     "#DDB9A4",
    headerText: "#382C1D",

    /* --surface and a warm cream a shade off it. The difference is
       deliberately small: enough to follow a row across ten columns,
       not enough to look striped. */
    bandA: "#FFFFFF",
    bandB: "#F2EBDE",
  }),

  /** Starting point for a spreadsheet created from inside the app. */
  NEW_SHEET: Object.freeze({
    /* The column order matters only to a person reading the file —
       Mirra finds columns by name — so it is arranged for them rather
       than for the code. Grouped by what each answers: who this is, how
       to reach them, what is true about them, what happened.

       Ways of reaching somebody are kept together and put first among
       them, because for a small business that is most of the point:
       plenty of clients are only ever spoken to through a messenger.

       The fields are listed here, not the headings. What each is called
       depends on the language the sheet is being made in, which is
       ClientSchema's business — see NEW_SHEET.headingsFor below. */
    fields: Object.freeze([
      "id", "firstName", "lastName",
      "phone", "socials", "messengers",
      "birthday", "links", "lastVisit", "notes",
    ]),

    /** Fields holding dates, so Sheets offers a date picker in them. */
    dateFields: Object.freeze(["birthday", "lastVisit"]),

    /** Written by Mirra and not meant to be edited by hand. */
    protectedField: "id",
  }),
});

/**
 * Fails loudly at startup rather than mid-flow with a cryptic
 * Google error, which is far harder to diagnose.
 * @returns {string[]} names of fields still holding placeholders
 */
export function findMissingConfig() {
  return ["CLIENT_ID", "API_KEY", "APP_ID"]
    .filter(key => !config[key] || config[key].startsWith("PASTE"));
}
