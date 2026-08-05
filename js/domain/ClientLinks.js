/**
 * @typedef {object} Link
 * @property {string} roleId  key into ClientLinks.ROLES, or "" if unknown
 * @property {string} id      the linked client's id
 * @property {string} name    their name as it was when the link was made
 * @property {string} raw     the original text, kept when nothing parsed
 */

/**
 * ClientLinks — people connected to other people.
 *
 * Stored in one cell as "мама:k7m2x9:Олена Романюк; дитина:p4n8w1:Ігор
 * Романюк". Both the id and the name are written down, and each does a
 * different job: the id is what the link actually follows, and the name
 * is there so that somebody reading the spreadsheet without Mirra can
 * tell what it says.
 *
 * The name is also a fallback. If an id goes missing — a column
 * deleted, a row rebuilt by hand — the link can still be resolved by
 * matching the name, which is worse but far better than nothing.
 */
export class ClientLinks {
  /**
   * The relationships on offer.
   *
   * Short deliberately. A longer list is not more expressive, it is
   * more places to hesitate: "син" and "дочка" both mean дитина for
   * every purpose Mirra has, and asking somebody to choose between them
   * is asking them to do work that changes nothing.
   *
   * `inverse` is the role the other person gets. Where it is null the
   * answer depends on facts Mirra has no business guessing — a child's
   * parent may be мама or батько — and the user is asked instead.
   */
  static ROLES = Object.freeze({
    mother:  { label: "мама",        inverse: "child" },
    father:  { label: "батько",      inverse: "child" },
    child:   { label: "дитина",      inverse: null },
    spouse:  { label: "подружжя",    inverse: "spouse" },
    partner: { label: "партнер",     inverse: "partner" },
    sibling: { label: "брат/сестра", inverse: "sibling" },
    /* A guardian's counterpart is a child and nothing else, so it is
       written down rather than asked about. Only дитина is genuinely
       ambiguous: the parent could be either. */
    guardian:{ label: "опікун",      inverse: "child" },
    other:   { label: "інше",        inverse: "other" },
  });

  /**
   * When the inverse cannot be worked out, these are the answers worth
   * offering.
   *
   * A child's counterpart is a parent of some kind and nothing else, so
   * showing all eight roles asks somebody to find three among five they
   * will never pick. The shorter question is also the faster one.
   */
  static INVERSE_CHOICES = Object.freeze({
    child: ["mother", "father", "guardian"],
  });

  /**
   * @param {string} roleId
   * @returns {string[]} role ids to offer, or all of them
   */
  static inverseChoicesFor(roleId) {
    return ClientLinks.INVERSE_CHOICES[roleId] ?? Object.keys(ClientLinks.ROLES);
  }

  /** Separates one link from the next. */
  static SEPARATOR = "; ";

  /**
   * @param {string} roleId
   * @returns {string}
   */
  static labelFor(roleId) {
    return ClientLinks.ROLES[roleId]?.label ?? roleId;
  }

  /**
   * Finds a role by the word written in the cell.
   *
   * Matched on the normalised label, so "Мама" and "мама " are the same
   * role and a cell edited by hand still works.
   *
   * @param {string} label
   * @returns {string} the role id, or "" when unrecognised
   */
  static roleFrom(label) {
    const wanted = ClientLinks.#normalise(label);

    const found = Object.entries(ClientLinks.ROLES)
      .find(([, role]) => ClientLinks.#normalise(role.label) === wanted);

    return found ? found[0] : "";
  }

  /**
   * @param {string} cell
   * @returns {Link[]}
   */
  static parse(cell) {
    if (!cell) return [];

    const links = cell
      .split(/[;\n]/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => ClientLinks.#parseOne(part));

    /* A cell written by an older version, or edited by hand, may already
       hold two entries for one person. Reading is where that is put
       right, so nothing downstream has to think about it. */
    return ClientLinks.dedupe(links);
  }

  /**
   * @param {Link[]} links
   * @returns {string}
   */
  static stringify(links) {
    return ClientLinks.dedupe(links)
      .map(link => link.id
        ? `${ClientLinks.labelFor(link.roleId)}:${link.id}:${link.name}`
        : link.raw)
      .filter(Boolean)
      .join(ClientLinks.SEPARATOR);
  }

  /**
   * One relationship per person, and the last one wins.
   *
   * Two people can be related in only one way at a time. Left
   * unchecked, changing a role writes a second entry beside the first
   * and the card ends up claiming somebody is both a spouse and a
   * parent — which is not a relationship anybody meant to record.
   *
   * The last entry is the surviving one because it is the most recent
   * decision: a role changed from подружжя to дитина means дитина, not
   * both.
   *
   * Entries Mirra could not parse have no id to compare, so they are
   * all kept — dropping text somebody typed because it looks like
   * something else would be worse than a repeat.
   *
   * @param {Link[]} links
   * @returns {Link[]}
   */
  static dedupe(links) {
    const byId = new Map();
    const unparsed = [];

    for (const link of links) {
      if (link.id) byId.set(link.id, link);
      else unparsed.push(link);
    }

    return [...byId.values(), ...unparsed];
  }

  /**
   * The role the other person should get, or null when it cannot be
   * worked out without asking.
   *
   * @param {string} roleId
   * @returns {string|null}
   */
  static inverseOf(roleId) {
    return ClientLinks.ROLES[roleId]?.inverse ?? null;
  }

  /* ---------------- private ---------------- */

  /**
   * Reads one entry.
   *
   * The name may contain colons — rare, but a cell edited by hand can
   * contain anything — so the split takes the first two separators and
   * leaves the rest as the name.
   */
  static #parseOne(text) {
    const parts = text.split(":");

    if (parts.length >= 3) {
      const [label, id, ...rest] = parts;
      return {
        roleId: ClientLinks.roleFrom(label),
        id: id.trim(),
        name: rest.join(":").trim(),
        raw: text,
      };
    }

    /* Two parts is a link written before ids existed, or by hand:
       "мама: Олена Романюк". Kept, and resolved by name. */
    if (parts.length === 2) {
      return {
        roleId: ClientLinks.roleFrom(parts[0]),
        id: "",
        name: parts[1].trim(),
        raw: text,
      };
    }

    return { roleId: "", id: "", name: "", raw: text };
  }

  static #normalise(value) {
    return (value ?? "").trim().toLocaleLowerCase("uk").replace(/\s+/g, " ");
  }
}
