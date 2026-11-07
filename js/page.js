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
/**
 * The copy buttons — at present one, on the page about assistants.
 *
 * The text is taken from the element the button points at rather than
 * held in here, so the prompt lives in one place: what is copied is
 * exactly what was read, in both languages, and the page can be edited
 * without touching any script.
 *
 * The clipboard is not always there to write to. It needs a secure
 * context and the browser's permission, and both can be absent — from
 * a page served over plain http on a local address, for instance. When
 * that happens the text is selected instead, which leaves the person
 * one familiar keystroke away rather than facing a button that does
 * nothing.
 */
(function copyButtons() {
  const CLEAR_AFTER = 4000;
  const english = document.documentElement.lang === "en";

  const said = {
    copied: english ? "Copied." : "Скопійовано.",
    select: english
      ? "Your browser would not let the page copy it. The text is selected — press Ctrl+C."
      : "Браузер не дозволив сторінці скопіювати текст. Він виділений — натисніть Ctrl+C.",
  };

  const status = document.querySelector("[data-copy-status]");
  let clearing = null;

  const say = message => {
    if (!status) return;
    status.textContent = message;
    clearTimeout(clearing);
    clearing = setTimeout(() => { status.textContent = ""; }, CLEAR_AFTER);
  };

  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      const source = document.querySelector(button.dataset.copy);
      if (!source) return;

      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        say(said.copied);
      } catch {
        getSelection()?.selectAllChildren(source);
        say(said.select);
      }
    });
  }
})();

(function rememberLanguage() {
  const folder = location.pathname.split("/").filter(Boolean).at(-2) ?? "";
  const code = folder === "en" ? "en" : "uk";

  try { localStorage.setItem("mirra:lang", code); }
  catch { /* private browsing; the app will guess from the browser */ }
})();
