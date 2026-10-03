/**
 * Runs before the first paint: theme, and on the app itself, language.
 *
 * A separate file rather than an inline script, so the page can be
 * served under a strict Content-Security-Policy with no 'unsafe-inline'.
 * Inline scripts are the single most useful thing an attacker can inject,
 * and a policy that allows ours allows theirs too — so the rule is kept
 * absolute and this file pays the price of one extra request. It is a
 * few hundred bytes, same-origin, and cached by the service worker.
 *
 * Deliberately not a module: modules are deferred, and a theme applied
 * after the first paint is a visible flash of the wrong colour.
 */
(function () {
  var root = document.documentElement;

  try {
    var theme = localStorage.getItem("mirra:theme");
    if (!theme) {
      theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.dataset.theme = theme;
  } catch (error) {
    /* Private browsing refuses storage; light is the safer default. */
    root.dataset.theme = "light";
  }

  /* Only where the markup asks for it. The standalone pages exist in one
     language each — their folder says which — and overriding that here
     would relabel an English page as Ukrainian for a screen reader. */
  if (!("bootLang" in root.dataset)) return;

  try {
    var saved = localStorage.getItem("mirra:lang");
    var language = saved || (navigator.language || "uk").slice(0, 2).toLowerCase();
    root.lang = ["uk", "en"].indexOf(language) >= 0 ? language : "uk";
  } catch (error) {
    root.lang = "uk";
  }
})();
