import { ThemeManager } from "./ui/shell/ThemeManager.js";
import { SiteMeta } from "./core/SiteMeta.js";

/**
 * Bootstrap for the standalone pages.
 *
 * They need the theme and nothing else. The language switch here is a
 * link, not a control: a privacy policy in another language is a
 * different document, and these pages are already written in the
 * language of the folder they sit in.
 *
 * Nothing translates anything, which is the point. An earlier version
 * ran the app's translator over these pages as well, and it walked
 * English markup looking for Ukrainian — finding nothing, but visibly
 * touching the page on its way past.
 *
 * The choice made here is still shared with the app: ThemeManager uses
 * the same storage key, so the theme picked on this page is the one the
 * app opens with.
 */
new ThemeManager().init();
SiteMeta.apply();

/**
 * Remembers which language of the site you were last reading.
 *
 * Written from the folder rather than from a control: arriving at
 * /en/about.html is a statement about what you want to read, and the
 * app should open in the same language next time.
 */
(function rememberLanguage() {
  const folder = location.pathname.split("/").filter(Boolean).at(-2) ?? "";
  const code = folder === "en" ? "en" : "uk";

  try { localStorage.setItem("mirra:lang", code); }
  catch { /* private browsing; the app will guess from the browser */ }
})();
