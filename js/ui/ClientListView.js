import { ClientList } from "../domain/ClientList.js";

/**
 * ClientListView — renders people as a browsable list.
 *
 * Names only. Anything else about a person waits for their own screen,
 * where there is room to show it properly; a list that tries to show
 * three facts per row stops being scannable at about twenty people.
 *
 * Two details do real work here. Each row carries a chevron, because
 * "you can tap this" is not obvious to someone who does not use apps
 * much. And the scroll position survives leaving and coming back —
 * without that, every visit to a client would throw the list back to
 * the top, which is maddening once there are more names than fit on
 * one screen.
 */
export class ClientListView extends EventTarget {
  /** How many tag suggestions are shown before the rest are folded away. */
  static TAGS_SHOWN = 3;

  #root;
  #title;
  #count;
  #host;
  #scroller;
  #search;
  #searchClear;
  #tagbar;
  #list = null;
  #query = "";
  #savedScroll = 0;
  #onClick;
  #onSearch;
  #onClearSearch;
  #onTagClick;
  #tagsExpanded = false;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="clients"]' } = {}) {
    super();
    this.#root     = document.querySelector(selector);
    this.#title    = this.#root?.querySelector("[data-sheet-title]");
    this.#count    = this.#root?.querySelector("[data-sheet-count]");
    this.#host     = this.#root?.querySelector("[data-client-list]");
    this.#scroller = this.#root?.querySelector("[data-scroll]");
    this.#search   = this.#root?.querySelector("[data-search]");
    this.#searchClear = this.#root?.querySelector("[data-search-clear]");
    this.#tagbar   = this.#root?.querySelector("[data-tagbar]");

    /* One listener on the container rather than one per row: the list is
       rebuilt on every reload, and per-row listeners would have to be
       torn down each time or quietly accumulate. */
    /* Filtering happens on every keystroke with no debounce. The data
       is already in memory, so the work is a pass over an array —
       waiting would only make typing feel laggy. */
    this.#onSearch = event => this.setQuery(event.target.value);

    /* Tapping a chip toggles it: pressing the one already active clears
       the filter, which is what people try first when they want out. */
    this.#onTagClick = event => {
      if (event.target.closest("[data-tags-more]")) {
        this.#tagsExpanded = true;
        this.#paintTags();
        return;
      }

      const chip = event.target.closest("[data-tag]");
      if (!chip) return;

      const tag = chip.dataset.tag;
      this.setQuery(this.#query.trim() === tag ? "#" : tag);
    };
    this.#onClearSearch = () => {
      this.setQuery("");
      this.#search?.focus();
    };

    this.#onClick = event => {
      const row = event.target.closest("[data-row]");
      if (!row) return;
      this.dispatchEvent(new CustomEvent("select", {
        detail: { rowNumber: Number(row.dataset.row) },
      }));
    };
  }

  init() {
    this.#host?.addEventListener("click", this.#onClick);
    this.#tagbar?.addEventListener("click", this.#onTagClick);
    this.#search?.addEventListener("input", this.#onSearch);
    this.#searchClear?.addEventListener("click", this.#onClearSearch);
    return this;
  }

  /** @returns {ClientList|null} */
  get list() {
    return this.#list;
  }

  /**
   * @param {import("../services/SheetsRepository.js").SheetSnapshot} snapshot
   */
  render(snapshot) {
    if (!this.#root) return this;

    this.#list = new ClientList(snapshot);
    this.#title.textContent = snapshot.title;
    this.#paint();

    return this;
  }

  /** @returns {string} */
  get query() {
    return this.#query;
  }

  /**
   * @param {string} query
   */
  setQuery(query) {
    /* Collapsed again on every change: the expanded list belongs to the
       moment it was opened in, and leaving it open means the next
       search starts under a wall of chips. */
    if ((query ?? "") !== this.#query) this.#tagsExpanded = false;

    this.#query = query ?? "";

    if (this.#search && this.#search.value !== this.#query) {
      this.#search.value = this.#query;
    }
    if (this.#searchClear) this.#searchClear.hidden = !this.#query;

    this.#paint();
    return this;
  }

  /**
   * Makes sure a client is among those on screen.
   *
   * Called after saving: someone who adds Богдан while a search for
   * "Ан" is active should see Богдан, not an unchanged list. Dropping
   * the query only when it actually hides the result keeps the search
   * for every other case.
   *
   * @param {number} rowNumber
   */
  ensureVisible(rowNumber) {
    if (!this.#query || !this.#list) return this;

    const client = this.#list.findByRow(rowNumber);
    const text = this.#query.trim().toLocaleLowerCase("uk");
    const digits = this.#query.replace(/\D/g, "");

    if (client && !client.matches(text, digits)) this.setQuery("");
    return this;
  }

  /** Remembers where the reader was. Called when leaving the screen. */
  saveScroll() {
    if (this.#scroller) this.#savedScroll = this.#scroller.scrollTop;
    return this;
  }

  /**
   * Puts them back. Deferred a frame because a screen that has just
   * become visible has no measured height yet, and scrollTop set on a
   * zero-height element is silently discarded.
   */
  restoreScroll() {
    if (!this.#scroller) return this;
    requestAnimationFrame(() => { this.#scroller.scrollTop = this.#savedScroll; });
    return this;
  }

  /** Sends the reader back to the top; used after a reload. */
  resetScroll() {
    this.#savedScroll = 0;
    if (this.#scroller) this.#scroller.scrollTop = 0;
    return this;
  }

  clear() {
    if (!this.#root) return this;
    this.#list = null;
    this.setQuery("");
    this.#title.textContent = "—";
    this.#count.textContent = "";
    this.#host.replaceChildren();
    this.resetScroll();
    return this;
  }

  destroy() {
    this.#host?.removeEventListener("click", this.#onClick);
    this.#search?.removeEventListener("input", this.#onSearch);
    this.#tagbar?.removeEventListener("click", this.#onTagClick);
    this.#searchClear?.removeEventListener("click", this.#onClearSearch);
  }

  /**
   * Ukrainian needs three plural forms, and the rule is not "add s".
   * 1 клієнт · 2–4 клієнти · 5–20 клієнтів, then it repeats by last digit.
   * @param {number} count
   * @returns {string}
   */
  static pluralise(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;

    if (lastTwo > 10 && lastTwo < 20) return "клієнтів";
    if (lastOne === 1) return "клієнт";
    if (lastOne >= 2 && lastOne <= 4) return "клієнти";
    return "клієнтів";
  }

  /* ---------------- private ---------------- */

  /** Draws the list for whatever the query currently is. */
  #paint() {
    if (!this.#list) return;

    this.#paintTags();

    const matches = this.#list.filter(this.#query);
    this.#count.textContent = this.#countText(matches.length);

    this.#host.replaceChildren(
      matches.length
        ? this.#buildGroups(this.#list.groupsOf(matches))
        : this.#buildEmpty()
    );
  }

  /**
   * Draws the tags present in the sheet, marking the active one.
   *
   * Hidden entirely when there are none, rather than shown empty: a bar
   * that is usually blank teaches people to stop looking at it.
   */
  /**
   * Draws tag suggestions, and only while a tag is being typed.
   *
   * An always-visible bar of every tag in the sheet is fine with six and
   * unusable with sixty — it becomes a wall above the names people came
   * for. Showing it in answer to a typed # makes it appear exactly when
   * it is wanted and take no room otherwise.
   */
  #paintTags() {
    if (!this.#tagbar) return;

    const suggestions = this.#list.suggestTags(this.#query);

    this.#tagbar.hidden = suggestions.length === 0;
    if (!suggestions.length) return;

    const active = this.#query.trim().toLocaleLowerCase("uk");

    /* A handful at a time. Three fits a phone without the last one
       falling off the edge, which is what makes a scrolling row feel
       broken rather than scrollable. */
    const visible = this.#tagsExpanded
      ? suggestions
      : suggestions.slice(0, ClientListView.TAGS_SHOWN);

    const chips = visible.map(({ tag, count }) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cl-tag";
      chip.dataset.tag = tag;
      chip.setAttribute("aria-pressed", String(tag === active));

      const label = document.createElement("span");
      label.textContent = tag;

      const badge = document.createElement("em");
      badge.textContent = String(count);

      chip.append(label, badge);
      return chip;
    });

    const hidden = suggestions.length - visible.length;
    if (hidden > 0) chips.push(this.#buildMore(hidden));

    this.#tagbar.replaceChildren(...chips);
  }

  /**
   * The control that reveals the rest.
   *
   * Carries the number rather than three dots alone: "ще 12" answers
   * the question the dots raise, and costs the same space.
   */
  #buildMore(hidden) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cl-tag cl-tag-more";
    button.dataset.tagsMore = "";
    button.setAttribute("aria-label", `Показати решту теґів: ще ${hidden}`);
    button.textContent = `… ще ${hidden}`;
    return button;
  }

  /**
   * "3 з 12" while searching, a plain count otherwise. Seeing how many
   * were set aside is what tells someone whether to refine the query
   * or clear it.
   */
  #countText(found) {
    const total = this.#list.count;
    if (!total) return "";
    if (!this.#query) return `${total} ${ClientListView.pluralise(total)}`;
    return `${found} з ${total}`;
  }

  #buildGroups(groups) {
    const fragment = document.createDocumentFragment();

    for (const group of groups) {
      const heading = document.createElement("div");
      heading.className = "cl-letter";
      heading.textContent = group.letter;

      const list = document.createElement("ul");
      list.className = "cl-rows";
      list.replaceChildren(...group.clients.map(client => this.#buildRow(client)));

      fragment.append(heading, list);
    }

    return fragment;
  }

  #buildRow(client) {
    const item = document.createElement("li");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cl-row";
    button.dataset.row = String(client.rowNumber);
    button.textContent = client.displayName;

    item.append(button);
    return item;
  }

  #buildEmpty() {
    const message = document.createElement("p");
    message.className = "cl-empty";
    message.textContent = this.#query
      ? "Нікого не знайдено. Спробуйте інше ім'я або номер."
      : "Тут поки що порожньо. Додайте першого клієнта.";
    return message;
  }
}
