/**
 * ViewLoader — fetches screen markup from views/ and puts it on the page.
 *
 * Each screen lives in its own file, which is easier to work on than one
 * long document, without becoming a separate page. Separate pages would
 * mean re-reading the settings from Drive on every navigation — a pause
 * of half a second each time someone taps "Головна", and a white flash
 * between screens. The markup is split; the session is not.
 *
 * The cover screen deliberately stays inline in index.html. It is the
 * first thing anyone sees, and it should not wait on a fetch.
 */
export class ViewLoader {
  /**
   * Templates are .tpl, not .html, and that is not cosmetic.
   *
   * Dev servers inject a live-reload script into every .html file they
   * serve. A full page has a </body> to insert it before; a fragment
   * does not, and the insertion mangles the file — silently, and only
   * over HTTP, so the copy on disk looks perfectly fine. An extension
   * no server claims to understand sidesteps the whole problem.
   */
  static EXTENSION = "tpl";

  #host;
  #base;

  /**
   * @param {object} [options]
   * @param {string} [options.hostSelector] where partials are appended
   * @param {string} [options.base] folder holding the templates
   */
  constructor({ hostSelector = "[data-views]", base = "views" } = {}) {
    this.#host = document.querySelector(hostSelector) ?? document.body;
    this.#base = base;
  }

  /**
   * Loads every named partial and appends it in the order given.
   *
   * Fetched in parallel but inserted in sequence: the files are a few
   * kilobytes each, so the wait is one round trip rather than several,
   * while the DOM still ends up in a predictable order.
   *
   * @param {string[]} names file names without the extension
   * @returns {Promise<void>}
   */
  async load(names) {
    const markup = await Promise.all(names.map(name => this.#fetch(name)));

    const fragment = document.createDocumentFragment();
    for (const html of markup) {
      if (html) fragment.append(this.#parse(html));
    }
    this.#host.append(fragment);
  }

  /* ---------------- private ---------------- */

  async #fetch(name) {
    try {
      const response = await fetch(`${this.#base}/${name}.${ViewLoader.EXTENSION}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      /* Loud on purpose: a screen that failed to arrive shows up later
         as a mysteriously empty view, and tracing that back to a 404 is
         far harder than reading it here. */
      console.error(`ViewLoader: ${this.#base}/${name}.${ViewLoader.EXTENSION} could not be loaded`, error);
      return null;
    }
  }

  /**
   * Parsed as a document fragment rather than assigned to innerHTML:
   * this keeps the markup out of any string concatenation and makes the
   * inert/hidden handling in ScreenManager the only thing controlling
   * visibility.
   */
  #parse(html) {
    return document.createRange().createContextualFragment(html);
  }
}
