import { ClientLinks } from "./ClientLinks.js";

/**
 * LinkSync — keeping both halves of a relationship in step.
 *
 * A link is a fact about two people. If Олена has a child called Ігор,
 * then Ігор has a parent called Олена, and a version of the truth that
 * only one of them knows is worse than no version at all — somebody
 * opens Ігор's card, sees nothing, and concludes the link was never
 * made.
 *
 * So every change on one side is worked out for the other, and the rows
 * that need editing are reported. Nothing here writes anything: what
 * comes out is a plan, which the caller can carry out or discard.
 */
export class LinkSync {
  /**
   * Works out what has to change elsewhere.
   *
   * @param {object} params
   * @param {string} params.id        the client being saved
   * @param {string} params.name      their name, possibly just changed
   * @param {string} params.previousName what it was before
   * @param {import("./ClientLinks.js").Link[]} params.links their links now
   * @param {import("./ClientLinks.js").Link[]} params.before their links as saved
   * @param {import("./ClientList.js").ClientList} params.list everyone else
   * @returns {Array<{rowNumber: number, links: import("./ClientLinks.js").Link[]}>}
   */
  static plan({ id, name, previousName, links, before, list }) {
    if (!id) return [];

    /* Keyed by row rather than by client, because two changes can land
       on the same person — a link added and their name updated — and
       both have to be in the same write. */
    const edits = new Map();

    const touch = client => {
      if (!edits.has(client.rowNumber)) {
        edits.set(client.rowNumber, { client, links: client.links.map(link => ({ ...link })) });
      }
      return edits.get(client.rowNumber).links;
    };

    /* --- links that are new --- */
    for (const link of links) {
      if (!link.id || before.some(old => old.id === link.id && old.roleId === link.roleId)) continue;

      const other = list.findById(link.id);
      if (!other) continue;

      const theirLinks = touch(other);

      /* By id, so a role change replaces the entry that is already
         there instead of adding a second one beside it. Two people are
         related in one way at a time. */
      const existing = theirLinks.find(back => back.id === id);

      /* inverseRole is set by the application when it had to ask.
         Otherwise the role follows from the one chosen. */
      const role = link.inverseRole ?? ClientLinks.inverseOf(link.roleId);

      if (existing) {
        existing.name = name;

        /* An inverse we can work out replaces whatever was there. One we
           cannot is left as it stands: a wrong role is worse than an old
           one, and the application asks rather than letting this guess. */
        if (role) existing.roleId = role;
        continue;
      }

      theirLinks.push({ roleId: role ?? "other", id, name, raw: "" });
    }

    /* --- links that were removed --- */
    for (const old of before) {
      if (!old.id || links.some(link => link.id === old.id)) continue;

      const other = list.findById(old.id);
      if (!other) continue;

      const theirLinks = touch(other);
      const index = theirLinks.findIndex(back => back.id === id);
      if (index >= 0) theirLinks.splice(index, 1);
    }

    /* --- the name changed, so everyone pointing here is stale --- */
    if (previousName && previousName !== name) {
      for (const client of list.clients) {
        if (client.id === id) continue;
        if (!client.links.some(link => link.id === id)) continue;

        for (const link of touch(client)) {
          if (link.id === id) link.name = name;
        }
      }
    }

    return [...edits.values()].map(({ client, links: updated }) => ({
      rowNumber: client.rowNumber,
      name: client.displayName,
      links: ClientLinks.dedupe(updated),
      /* What changed on their card, in words. The application says it
         out loud: a role rewritten on a card nobody is looking at is
         correct but invisible, and invisible changes to somebody's data
         are how trust in a tool quietly goes. */
      changes: LinkSync.#describe(client, updated, id, name),
    }));
  }

  /**
   * Whether the other side's role has to be asked about.
   *
   * Мама gives дитина without ambiguity. Дитина does not give a parent:
   * whether Mirra should write мама or батько depends on something it
   * has no business inferring from a name.
   *
   * @param {import("./ClientLinks.js").Link[]} links
   * @param {import("./ClientLinks.js").Link[]} before
   * @returns {import("./ClientLinks.js").Link[]} links needing an answer
   */
  /**
   * How the other person's link to this client changed, if it did.
   *
   * Only the role: a name kept in step is bookkeeping, not news, and
   * announcing it would bury the one line worth reading.
   *
   * @returns {string} empty when nothing worth mentioning happened
   */
  /**
   * How the other person's link changed, said so that it cannot be
   * misread.
   *
   * A role describes who the link points at, not whose card it is on.
   * Saying "у картці Анни роль змінено на «дитина»" is true and reads
   * as though Анна had become a child — so both people are named and
   * the sentence says which of them the role belongs to.
   *
   * @param {import("./Client.js").Client} client whose card changed
   * @param {import("./ClientLinks.js").Link[]} updated their links now
   * @param {string} id the client being saved
   * @param {string} name their name
   * @returns {string} empty when nothing worth mentioning happened
   */
  static #describe(client, updated, id, name) {
    const was = client.links.find(link => link.id === id);
    const now = updated.find(link => link.id === id);

    if (!now) return was ? `зв'язок з «${name}» прибрано` : "";

    const role = ClientLinks.labelFor(now.roleId);

    if (!was) return `додано зв'язок: «${name}» — ${role}`;
    if (was.roleId === now.roleId) return "";

    return `«${name}» тепер ${role}`;
  }

  static needingInverse(links, before, list = null, clientId = "") {
    return links.filter(link => {
      const skip = LinkSync.#whySkip(link, before, list, clientId);

      /* Logged rather than silent. "Why did it not ask me?" is a
         question with four possible answers, and without this the only
         way to tell them apart is to read the source. */
      if (skip) console.debug(`[links] ${link.name || link.id}: не питаю — ${skip}`);

      return !skip;
    });
  }

  /**
   * @returns {string} the reason not to ask, or "" to ask
   */
  static #whySkip(link, before, list, clientId) {
    if (!link.id) return "немає ідентифікатора";

    if (ClientLinks.inverseOf(link.roleId) !== null) {
      return `роль «${ClientLinks.labelFor(link.roleId)}» дає зворотну сама`;
    }

    if (link.inverseRole) return "відповідь уже дано в цій сесії";

    const saved = before.find(old => old.id === link.id);

    if (saved && saved.roleId === link.roleId) {
      return "зв'язок не змінювався з моменту збереження";
    }

    /* A role that changed makes the other side's answer stale, so it is
       asked about again. Skipping here was what let "подружжя" survive
       on the other person after this side became "дитина": the question
       was suppressed, no inverse could be worked out, and their row was
       left as it was. */
    if (saved) return "";

    if (LinkSync.#hasAnswer(list?.findById(link.id), clientId)) {
      return "в іншої людини вже записано зворотний зв'язок";
    }

    return "";
  }

  /**
   * Whether the other side already records a relationship back to this
   * particular client.
   *
   * The link has to point here. An earlier version asked only whether
   * the other person had any role at all, so a child who already had a
   * mother was never asked about a father — the question was answered
   * by somebody else's relationship.
   *
   * "інше" does not count: it is what Mirra writes when it could not
   * find out, and treating it as an answer would make the question
   * unaskable exactly where it matters.
   *
   * @param {import("./Client.js").Client|undefined} other
   * @param {string} clientId who the link should point back at
   */
  static #hasAnswer(other, clientId) {
    if (!other || !clientId) return false;

    return other.links.some(back =>
      back.id === clientId && back.roleId && back.roleId !== "other");
  }
}
