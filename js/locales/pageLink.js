import { translator } from "./t.js";

/**
 * Where a document page lives in the current language.
 *
 * The pages are separate files rather than translated strings — a
 * privacy policy in another language is a different document, not a
 * string swap — so a link to one has to know which language is showing.
 * Otherwise "Tell me more" leads to a Ukrainian page, which is the sort
 * of small betrayal that makes people stop trusting a language switch.
 *
 * Ukrainian lives at the root because its addresses are already indexed
 * and already registered with Google as the app's policy links. Every
 * other language lives in a folder of its own — and any language
 * without one of its own falls back to English, on the reasoning that
 * a Korean speaker reading an untranslated page does better with
 * English than with Ukrainian.
 */
export class PageLink {
  /** Languages with their own pages. Others fall back to English. */
  static TRANSLATED = ["en"];

  /**
   * @param {string} page e.g. "about.html"
   * @param {string} [code] defaults to the language showing now
   * @returns {string} a path relative to the site root
   */
  static to(page, code = translator.code) {
    if (code === "uk") return page;

    const folder = PageLink.TRANSLATED.includes(code) ? code : "en";
    return `${folder}/${page}`;
  }

  /**
   * Points every marked link at the right language.
   *
   * The markup carries the Ukrainian path, which is what it should say
   * when nothing is running — so this rewrites rather than fills in.
   *
   * @param {ParentNode} [root]
   */
  static apply(root = document) {
    for (const link of root.querySelectorAll("[data-page-link]")) {
      const page = link.dataset.pageLink;
      if (page) link.setAttribute("href", PageLink.to(page));
    }
  }
}
