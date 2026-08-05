import { LinkCandidates } from "../domain/LinkCandidates.js";

/**
 * PeoplePicker — choosing which client to link to.
 *
 * A modal rather than a dropdown, because the list can be long and the
 * choice deserves the screen. It opens with the likeliest people
 * already at the top: relatives of somebody this client is linked to,
 * then people sharing their surname, then everybody else.
 *
 * That order is the whole point. Alphabetical is complete and useless —
 * with two hundred clients, the one being looked for is almost never
 * near the top. Families cluster, and the ordering follows the shape
 * relationships actually take.
 *
 * The reason is printed beside each name. An order nobody can explain
 * feels arbitrary even when it is right, and "той самий рід" turns a
 * mysterious sort into an obvious one.
 */
export class PeoplePicker {
  #dialog;
  #search;
  #host;
  #candidates = null;
  #taken = [];
  #resolve = null;
  #onInput;
  #onClick;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = "[data-people]" } = {}) {
    this.#dialog = document.querySelector(selector);
    if (!this.#dialog) {
      console.error(`PeoplePicker: ${selector} not found in index.html`);
      return;
    }

    this.#search = this.#dialog.querySelector("[data-people-search]");
    this.#host = this.#dialog.querySelector("[data-people-list]");

    this.#onInput = () => this.#paint();

    this.#onClick = event => {
      const row = event.target.closest("[data-person]");
      if (row) return this.#close({ id: row.dataset.person, name: row.dataset.name });

      if (event.target.closest("[data-people-cancel]")) this.#close(null);
      if (event.target === this.#dialog) this.#close(null);
    };

    this.#dialog.addEventListener("input", this.#onInput);
    this.#dialog.addEventListener("click", this.#onClick);

    /* Escape closes without going through either path, so the promise
       is settled here as well — otherwise it would hang and the caller
       would wait forever. */
    this.#dialog.addEventListener("close", () => this.#settle(null));
  }

  /**
   * @param {object} params
   * @param {import("../domain/ClientList.js").ClientList} params.list
   * @param {import("../domain/Client.js").Client} params.client
   * @param {string[]} [params.taken] ids already linked
   * @returns {Promise<{id: string, name: string}|null>}
   */
  open({ list, client, taken = [] }) {
    if (!this.#dialog) return Promise.resolve(null);

    this.#candidates = new LinkCandidates(list, client);
    this.#taken = taken;

    if (this.#search) this.#search.value = "";
    this.#paint();

    this.#dialog.showModal();

    /* Focus goes to the search box on a keyboard and nowhere on a
       phone: opening the on-screen keyboard immediately would cover the
       suggestions, which are the reason the ordering exists. */
    if (!matchMedia("(pointer: coarse)").matches) this.#search?.focus();

    return new Promise(resolve => { this.#resolve = resolve; });
  }

  /* ---------------- private ---------------- */

  #paint() {
    if (!this.#host || !this.#candidates) return;

    const query = this.#search?.value ?? "";
    const found = this.#candidates.search(query, this.#taken);

    if (!found.length) {
      this.#host.replaceChildren(this.#buildEmpty(query));
      return;
    }

    this.#host.replaceChildren(...found.map(candidate => this.#buildRow(candidate)));
  }

  #buildRow(candidate) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "picker-row";
    row.dataset.person = candidate.id;
    row.dataset.name = candidate.name;

    const name = document.createElement("span");
    name.className = "picker-name";
    name.textContent = candidate.name;
    row.append(name);

    if (candidate.reason) {
      const reason = document.createElement("span");
      reason.className = "picker-reason";
      reason.textContent = candidate.reason;
      row.append(reason);
    }

    return row;
  }

  /**
   * Three different nothings, told apart.
   *
   * "Нікого не знайдено" after a search is obvious. An empty list with
   * no search is not: it may mean the sheet has one client, or that
   * every other one is already linked — and those call for different
   * next steps, so they say different things.
   */
  #buildEmpty(query) {
    const message = document.createElement("p");
    message.className = "picker-empty";

    if (query.trim()) {
      message.textContent = "Нікого не знайдено.";
      return message;
    }

    message.textContent = this.#taken.length
      ? "Усі інші клієнти вже пов'язані з цим."
      : "Поки що немає інших клієнтів, з ким можна пов'язати.";

    return message;
  }

  #close(answer) {
    this.#settle(answer);
    this.#dialog.close();
  }

  #settle(answer) {
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(answer);
  }
}
