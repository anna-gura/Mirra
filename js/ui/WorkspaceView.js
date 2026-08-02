/**
 * WorkspaceView — renders whatever spreadsheet is currently open.
 *
 * For now it only proves the read path works: file name, record count
 * and column names. On the next step the grid replaces the body of
 * this view, and the class keeps the same public surface — render()
 * with a snapshot, clear() to empty it.
 */
export class WorkspaceView {
  #root;
  #title;
  #count;
  #columns;

  /**
   * @param {object} [options]
   * @param {string} [options.selector] the view container
   */
  constructor({ selector = '[data-view="workspace"]' } = {}) {
    this.#root    = document.querySelector(selector);
    this.#title   = this.#root?.querySelector("[data-sheet-title]");
    this.#count   = this.#root?.querySelector("[data-sheet-count]");
    this.#columns = this.#root?.querySelector("[data-sheet-columns]");
  }

  /**
   * @param {import("../services/SheetsRepository.js").SheetSnapshot} snapshot
   */
  render(snapshot) {
    if (!this.#root) return this;

    this.#title.textContent = snapshot.title;
    this.#count.textContent = snapshot.rows.length
      ? `${snapshot.rows.length} ${WorkspaceView.pluralise(snapshot.rows.length)}`
      : "поки що порожня";

    this.#columns.replaceChildren(
      ...snapshot.headers.map(label => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = label;
        return chip;
      })
    );

    return this;
  }

  clear() {
    if (!this.#root) return this;
    this.#title.textContent = "—";
    this.#count.textContent = "";
    this.#columns.replaceChildren();
    return this;
  }

  /**
   * Ukrainian needs three plural forms, and the rule is not "add s".
   * 1 запис · 2–4 записи · 5–20 записів, then it repeats by last digit.
   * @param {number} count
   * @returns {string}
   */
  static pluralise(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;

    if (lastTwo > 10 && lastTwo < 20) return "записів";
    if (lastOne === 1) return "запис";
    if (lastOne >= 2 && lastOne <= 4) return "записи";
    return "записів";
  }
}
