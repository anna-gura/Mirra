/**
 * DomTranslator — replaces the Ukrainian in the markup with another
 * language.
 *
 * Only text nodes and a short list of attributes are touched. Walking
 * the DOM rather than templating it means the markup stays readable on
 * its own — anybody can open a template and see what the screen says,
 * without following a key into a dictionary — and it means Ukrainian
 * needs no work at all.
 *
 * Nothing is translated twice. Screens arrive from views/ after
 * startup and some are rebuilt as data changes, so each pass records
 * what it has already visited.
 */
export class DomTranslator {
  /**
   * Attributes worth translating.
   *
   * placeholder and title are read by users; aria-label is read aloud.
   * value is left alone deliberately — it is data far more often than
   * it is a label, and translating somebody's client name would be a
   * spectacular way to lose their trust.
   */
  static ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];

  /** Elements whose contents are not prose. */
  static SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "CODE", "PRE"]);

  /** Marks a subtree as already done, so a rebuild is cheap. */
  static DONE = "data-i18n-done";

  /**
   * Where the Ukrainian original is kept once it has been replaced.
   *
   * Translation is destructive: after the first pass there is no
   * Ukrainian left in the page to translate from, so switching back to
   * it — or on to a third language — would have nothing to work with.
   * The original is therefore parked on the element, and every pass
   * translates from that rather than from whatever is on screen.
   */
  static ORIGINAL = "data-i18n";

  #translator;

  /**
   * @param {import("./Translator.js").Translator} translator
   */
  constructor(translator) {
    this.#translator = translator;
  }

  /**
   * Translates everything under a root.
   *
   * @param {ParentNode} [root]
   * @param {object} [options]
   * @param {boolean} [options.force] ignore the already-done marks
   */
  apply(root = document.body, { force = false } = {}) {
    /* Runs even when nothing is being translated. Switching back to the
       language the markup is written in is a pass like any other — it
       restores the originals rather than doing nothing. */
    if (!root) return this;

    this.#translateAttributes(root, force);
    this.#translateText(root, force);

    return this;
  }

  /**
   * Clears the marks so the next pass covers everything again.
   *
   * Needed when the language changes: the page is already translated,
   * and without this nothing would be revisited.
   */
  reset(root = document.body) {
    root.querySelectorAll(`[${DomTranslator.DONE}]`)
      .forEach(element => element.removeAttribute(DomTranslator.DONE));
    return this;
  }

  /* ---------------- private ---------------- */

  #translateAttributes(root, force) {
    const selector = DomTranslator.ATTRIBUTES.map(name => `[${name}]`).join(",");

    for (const element of root.querySelectorAll(selector)) {
      for (const name of DomTranslator.ATTRIBUTES) {
        const stored = `${DomTranslator.ORIGINAL}-${name}`;
        const marker = `${DomTranslator.DONE}-${name}`;

        /* The original if we have one, otherwise what is there now —
           which is the original, this being the first pass. */
        const source = element.getAttribute(stored) ?? element.getAttribute(name);
        if (!source || !source.trim()) continue;

        if (!force && element.hasAttribute(marker)) continue;

        const translated = this.#translator.t(source);

        if (translated !== source) {
          if (!element.hasAttribute(stored)) element.setAttribute(stored, source);
          element.setAttribute(name, translated);
        } else if (element.hasAttribute(stored)) {
          /* Back to the language the markup is written in. */
          element.setAttribute(name, source);
        }

        element.setAttribute(marker, "");
      }
    }
  }

  /**
   * Walks text nodes directly rather than reading innerHTML.
   *
   * Setting innerHTML would re-parse every element it touches, throwing
   * away event listeners and any state the browser holds — and it would
   * turn a client's note into markup if it happened to contain a
   * bracket.
   */
  #translateText(root, force) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent || DomTranslator.SKIP.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!force && parent.hasAttribute(DomTranslator.DONE)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    /* Collected before editing: changing nodes while the walker is
       still moving through them is asking for skipped ones. */
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const parent = node.parentElement;

      /* Kept on the node itself rather than the element: one element can
         hold several text nodes, and a single attribute could only
         remember one of them. */
      const source = node[DomTranslator.ORIGINAL] ?? node.nodeValue;
      const translated = this.#translator.t(source);

      if (translated !== source) {
        node[DomTranslator.ORIGINAL] ??= source;
        node.nodeValue = translated;
      } else if (node[DomTranslator.ORIGINAL]) {
        node.nodeValue = source;
      }

      parent?.setAttribute(DomTranslator.DONE, "");
    }
  }
}
