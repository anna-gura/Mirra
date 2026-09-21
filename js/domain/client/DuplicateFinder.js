import { PhoneNumber } from "../values/PhoneNumber.js";
import { DateValue } from "../values/DateValue.js";
import { SocialCatalog } from "../values/SocialCatalog.js";

/**
 * @typedef {object} Match
 * @property {import("./Client.js").Client} client  the one already there
 * @property {Array<{text: string, values: string[]}>} reasons  what matched,
 *           as templates to translate
 * @property {boolean} strong  matched on a phone or a handle, not a name
 */

/**
 * @typedef {object} NewInfo
 * @property {string} field  which part of the client
 * @property {string} name   what it is — a label to translate
 * @property {string} value  what it says — data, never translated
 * @property {string} [was]  what it replaces, when it is a change
 * @property {function(import("./ClientDraft.js").ClientDraft): void} apply
 */

/**
 * DuplicateFinder — noticing that a "new" client is somebody already
 * in the sheet.
 *
 * It happens constantly and innocently: a client books again after a
 * year, a colleague adds someone who is already there, a person first
 * seen as @anna.style later gives their full name. Two rows for one
 * person mean half the history in each, and neither card is right.
 *
 * Matching is by what identifies a person rather than by what merely
 * describes one:
 *
 *   a phone number   — strong, nobody shares one
 *   a social handle  — strong, likewise
 *   a full name      — weaker, since two Олена Коваль exist, but worth
 *                      asking about; a first name alone is not, or
 *                      every second Анна would trigger it
 *
 * Nothing here writes or decides. It reports a likely match and what
 * the new entry would add, and the person chooses.
 */
export class DuplicateFinder {
  /**
   * The existing client this draft most likely duplicates.
   *
   * @param {import("./ClientDraft.js").ClientDraft} draft
   * @param {import("./ClientList.js").ClientList} list
   * @returns {Match|null}
   */
  static find(draft, list) {
    let best = null;

    for (const client of list.clients) {
      const reasons = DuplicateFinder.#reasons(draft, client);
      if (!reasons.length) continue;

      const strong = reasons.some(reason => reason.strong);
      const score = reasons.length + (strong ? 10 : 0);

      if (!best || score > best.score) {
        best = { client, reasons: reasons.map(({ text, values }) => ({ text, values })), strong, score };
      }
    }

    if (!best) return null;
    const { score, ...match } = best;
    return match;
  }

  /**
   * What saving the draft into the existing client would change.
   *
   * Additions and replacements both, each marked for what it is. An
   * earlier version offered additions only, on the theory that a
   * different phone might be a mistake — and the result was a dialog
   * that ignored the number somebody had just typed and sent them off
   * to edit the card by hand. Showing the old value beside the new one
   * gives the same safety with none of the extra taps: the person can
   * see exactly what will be overwritten and decide.
   *
   * Fields left empty in the draft are never treated as changes. Not
   * typing a surname is not a request to delete one.
   *
   * @param {import("./ClientDraft.js").ClientDraft} draft
   * @param {import("./Client.js").Client} client
   * @param {string} [dateFormat]
   * @returns {NewInfo[]}
   */
  static newInfo(draft, client, dateFormat) {
    const found = [];

    for (const [field, label] of [["firstName", "Ім'я"], ["lastName", "Прізвище"]]) {
      const value = draft[field].trim();
      const old = client[field].trim();
      if (!value || DuplicateFinder.#normalise(value) === DuplicateFinder.#normalise(old)) continue;

      found.push({
        field, name: label, value, was: old || undefined,
        apply: target => { target[field] = value; },
      });
    }

    const phone = new PhoneNumber(draft.phone);
    const existingPhone = new PhoneNumber(client.phone);
    const samePhone = existingPhone.isValid
      && DuplicateFinder.#tail(draft.phone) === DuplicateFinder.#tail(client.phone);

    if (phone.isValid && !samePhone) {
      found.push({
        field: "phone",
        name: "Телефон",
        value: phone.display,
        /* A broken cell is not worth quoting back: "#ERROR!" as the old
           value would only raise a question nobody needs answered. */
        was: existingPhone.isValid && !existingPhone.isBroken ? existingPhone.display : undefined,
        apply: target => { target.phone = draft.phone.trim(); },
      });
    }

    for (const [field, label] of [["birthday", "День народження"], ["lastVisit", "Останній візит"]]) {
      if (!draft[field]) continue;

      const existing = client[field].trim() ? new DateValue(client[field], dateFormat) : null;
      if (existing?.iso === draft[field]) continue;

      found.push({
        field,
        name: label,
        value: DateValue.fromIso(draft[field]).format(dateFormat),
        was: existing?.isValid ? existing.format(dateFormat) : undefined,
        apply: target => { target[field] = draft[field]; },
      });
    }

    for (const kind of ["socials", "messengers"]) {
      const existing = client[kind]
        .filter(profile => profile.network)
        .map(profile => DuplicateFinder.#key(profile.network.id, profile.handle));

      for (const entry of draft[kind]) {
        if (!entry.handle.trim()) continue;
        if (existing.includes(DuplicateFinder.#key(entry.id, entry.handle))) continue;

        const network = SocialCatalog.find(entry.id);
        found.push({
          field: kind,
          /* Brand names are not translated; they are the same word
             in every language. */
          name: network?.label ?? entry.id,
          value: entry.handle.trim(),
          apply: target => { target[kind].push({ ...entry }); },
        });
      }
    }

    const note = draft.notes.trim();
    if (note && !DuplicateFinder.#normalise(client.notes).includes(DuplicateFinder.#normalise(note))) {
      /* Appended, not replaced: an old note is history, and the new one
         is the latest chapter of it. */
      found.push({
        field: "notes",
        name: "Нотатка",
        value: `«${DuplicateFinder.#shorten(note)}»`,
        apply: target => {
          target.notes = target.notes.trim() ? `${target.notes.trim()}\n${note}` : note;
        },
      });
    }

    const linked = new Set(client.links.map(link => link.id).filter(Boolean));
    for (const link of draft.links) {
      if (!link.id || linked.has(link.id)) continue;
      found.push({
        field: "links",
        name: "Зв'язок",
        value: link.name,
        apply: target => { target.links.push({ ...link }); },
      });
    }

    return found;
  }

  /* ---------------- private ---------------- */

  /** @returns {Array<{text: string, values: string[], strong: boolean}>} */
  static #reasons(draft, client) {
    const reasons = [];

    const phone = new PhoneNumber(draft.phone);
    const theirs = new PhoneNumber(client.phone);
    if (phone.isValid && theirs.isValid
        && (phone.e164 && phone.e164 === theirs.e164
            || DuplicateFinder.#tail(draft.phone) === DuplicateFinder.#tail(client.phone))) {
      reasons.push({ text: "той самий телефон", values: [], strong: true });
    }

    for (const kind of ["socials", "messengers"]) {
      const existing = new Map(client[kind]
        .filter(profile => profile.network)
        .map(profile => [DuplicateFinder.#key(profile.network.id, profile.handle), profile.network.label]));

      for (const entry of draft[kind]) {
        const label = existing.get(DuplicateFinder.#key(entry.id, entry.handle));
        if (label && entry.handle.trim()) {
          reasons.push({ text: "той самий {}", values: [label], strong: true });
        }
      }
    }

    /* Both parts or nothing. "Анна" alone matches half the sheet. */
    const first = DuplicateFinder.#normalise(draft.firstName);
    const last = DuplicateFinder.#normalise(draft.lastName);
    if (first && last
        && first === DuplicateFinder.#normalise(client.firstName)
        && last === DuplicateFinder.#normalise(client.lastName)) {
      reasons.push({ text: "те саме ім'я", values: [], strong: false });
    }

    return reasons;
  }

  /**
   * The last nine digits: enough to identify a number, and immune to
   * whether a country code or a leading zero was written.
   */
  static #tail(raw) {
    const digits = (raw ?? "").replace(/\D/g, "");
    return digits.length >= 9 ? digits.slice(-9) : "";
  }

  /** A handle compared without its @, its case, or stray spaces. */
  static #key(networkId, handle) {
    return `${networkId}:${DuplicateFinder.#normalise(handle).replace(/^@/, "")}`;
  }

  static #normalise(text) {
    return (text ?? "").trim().toLocaleLowerCase("uk").replace(/\s+/g, " ");
  }

  static #shorten(text) {
    return text.length > 40 ? `${text.slice(0, 38).trim()}…` : text;
  }
}
