import { ClientSchema } from "./ClientSchema.js";
import { Client } from "./Client.js";

/**
 * @typedef {object} ClientGroup
 * @property {string} letter
 * @property {Client[]} clients
 */

/**
 * ClientList — a spreadsheet as a browsable list of people.
 *
 * Pure logic, no DOM: given a snapshot it decides who is in the sheet
 * and in what order. Keeping this apart from rendering means the
 * awkward parts — which column holds a name, how Ukrainian sorts — can
 * be reasoned about, and tested, on their own.
 */
export class ClientList {
  #snapshot;
  #schema;
  #clients = null;

  /**
   * @param {import("../services/SheetsRepository.js").SheetSnapshot} snapshot
   */
  constructor(snapshot) {
    this.#snapshot = snapshot;
    this.#schema = new ClientSchema(snapshot.headers);
  }

  /** @returns {ClientSchema} */
  get schema() {
    return this.#schema;
  }

  /** @returns {Client[]} everyone, sorted */
  get clients() {
    this.#clients ??= this.#build();
    return this.#clients;
  }

  /** @returns {number} */
  get count() {
    return this.clients.length;
  }

  /**
   * Everyone matching a query.
   *
   * Both fields are searched at once rather than through a chooser:
   * someone looking up a client knows the name or the number, and
   * having to say which one first is a step that earns nothing.
   *
   * @param {string} query
   * @returns {Client[]}
   */
  /**
   * Tags matching what has been typed so far, most used first.
   *
   * A hash on its own returns everything, which is what someone who
   * types it is asking for. Anything after it narrows by prefix, so
   * "#кор" reaches "#коротке-волосся" without typing the rest.
   *
   * @param {string} query
   * @returns {Array<{tag: string, count: number}>}
   */
  suggestTags(query) {
    const typed = (query ?? "").trim().toLocaleLowerCase("uk");
    if (!typed.startsWith("#")) return [];

    const all = this.tags;
    if (typed === "#") return all;

    return all.filter(({ tag }) => tag.startsWith(typed));
  }

  /**
   * Every tag used anywhere in the sheet, with how many clients carry
   * it, most used first.
   *
   * Counted rather than merely listed: a tag on twelve people is worth
   * offering, one used once is noise, and only the count tells them
   * apart.
   *
   * @returns {Array<{tag: string, count: number}>}
   */
  get tags() {
    const counts = new Map();

    for (const client of this.clients) {
      for (const tag of client.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "uk"));
  }

  filter(query) {
    const trimmed = (query ?? "").trim();
    if (!trimmed) return this.clients;

    const text = trimmed.toLocaleLowerCase("uk");
    const digits = trimmed.replace(/\D/g, "");

    return this.clients.filter(client => client.matches(text, digits));
  }

  /**
   * @returns {ClientGroup[]} alphabetical, with the unnamed group last
   */
  get groups() {
    return this.groupsOf(this.clients);
  }

  /**
   * @param {Client[]} clients already sorted
   * @returns {ClientGroup[]}
   */
  groupsOf(clients) {
    /* A Map keeps insertion order and the clients are already sorted,
       so the groups come out right without a second sort. */
    const groups = new Map();

    for (const client of clients) {
      if (!groups.has(client.letter)) groups.set(client.letter, []);
      groups.get(client.letter).push(client);
    }

    const named = [];
    let unknown = null;

    for (const [letter, clients] of groups) {
      const group = { letter, clients };
      if (letter === Client.OTHER_LETTER) unknown = group;
      else named.push(group);
    }

    return unknown ? [...named, unknown] : named;
  }

  /**
   * @param {number} rowNumber
   * @returns {Client|undefined}
   */
  findByRow(rowNumber) {
    return this.clients.find(client => client.rowNumber === rowNumber);
  }

  /* ---------------- private ---------------- */

  #build() {
    const clients = this.#snapshot.rows
      .map((values, index) => new Client({
        schema: this.#schema,
        values,
        rowNumber: index + 2,        // +1 for the header, +1 for 1-based rows
      }))
      .filter(client => !client.isBlank);

    /* Sorted by what is shown rather than by surname: the eye lands on
       the first word, and a list whose order contradicts that reads as
       broken even when it is technically correct. */
    return clients.sort((a, b) => this.#compare(a, b));
  }

  #compare(a, b) {
    const aUnknown = a.letter === Client.OTHER_LETTER;
    const bUnknown = b.letter === Client.OTHER_LETTER;
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;

    /* localeCompare with "uk" is what puts і, ї and є where a Ukrainian
       reader expects them; comparing strings directly sorts by code
       point and scatters them. */
    return a.displayName.localeCompare(b.displayName, "uk", { sensitivity: "base" });
  }
}
