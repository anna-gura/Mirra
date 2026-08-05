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

export const config = Object.freeze({
  /** This build, from the most recent git tag. */
  VERSION: version,

  CLIENT_ID: credentials.CLIENT_ID,
  API_KEY:   credentials.API_KEY,
  APP_ID:    credentials.APP_ID,

  /**
   * drive.file is a non-sensitive scope: it grants access only to
   * files the user hand-picks through the Picker. That is what keeps
   * the project out of Google's sensitive-scope verification queue.
   * Widening this to .../auth/spreadsheets would require review.
   */
  SCOPE: "https://www.googleapis.com/auth/drive.file",

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

  SHEETS_API: "https://sheets.googleapis.com/v4/spreadsheets",
  GIS_SRC:    "https://accounts.google.com/gsi/client",
  GAPI_SRC:   "https://apis.google.com/js/api.js",

  /** Refresh this many seconds before the token actually expires. */
  TOKEN_SAFETY_MARGIN: 60,

  /** Starting point for a spreadsheet created from inside the app. */
  NEW_SHEET: Object.freeze({
    title: "Клієнти",
    tabTitle: "Клієнти",
    /* Given name and surname are separate columns even though the list
       shows them joined. Splitting later means rewriting everyone's
       data; splitting now costs nothing and makes sorting, searching
       and greeting someone by first name straightforward.
       Order matters: a sheet Mirra did not create is read by position,
       so name, phone and notes lead. */
    /* Grouped by what each answers: who this is, how to reach them,
       what is true about them, what happened.

       Ways of reaching somebody are kept together and put first among
       them, because for a small business that is most of the point —
       plenty of clients are only ever spoken to through a messenger.

       The order matters only to a person reading the file — Mirra finds
       columns by name — so it is arranged for them rather than for the
       code. */
    headers: Object.freeze([
      "ID", "Ім'я", "Прізвище",
      "Телефон", "Соцмережі", "Месенджери",
      "День народження", "Зв'язки", "Останній візит", "Нотатки",
    ]),

    /** Written by Mirra and not meant to be edited by hand. */
    protectedColumn: "ID",

    /** Columns holding dates, so Sheets offers a date picker in them. */
    dateColumns: Object.freeze(["День народження", "Останній візит"]),
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
