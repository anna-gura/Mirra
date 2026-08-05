/**
 * LinkCandidates — who to offer first when linking two clients.
 *
 * An alphabetical list of everybody is technically complete and
 * practically useless: the person being looked for is almost never near
 * the top, and somebody with two hundred clients scrolls past a hundred
 * and ninety-nine strangers to reach them.
 *
 * Relationships are not evenly distributed, and the shape they take is
 * predictable. So the list is ordered by how likely each person is to
 * be the one wanted, and the reason is shown beside them — an order
 * nobody can explain feels arbitrary even when it is right.
 */
export class LinkCandidates {
  /** Higher sorts first. */
  static RANK = Object.freeze({
    relative: 3,   // related to somebody this client is already linked to
    surname: 2,    // shares a surname
    other: 1,
  });

  static REASON = Object.freeze({
    relative: "родич пов'язаного",
    surname: "той самий рід",
    other: "",
  });

  #list;
  #client;

  /**
   * @param {import("./ClientList.js").ClientList} list
   * @param {import("./Client.js").Client} client the one being edited
   */
  constructor(list, client) {
    this.#list = list;
    this.#client = client;
  }

  /**
   * Everyone who could be linked, best guesses first.
   *
   * @param {string[]} [taken] ids already linked, which are left out
   * @returns {Array<{id: string, name: string, group: string, reason: string}>}
   */
  all(taken = []) {
    const skip = new Set([this.#client.id, ...taken].filter(Boolean));
    const relatives = this.#relativesOfLinked();
    const surname = this.#client.lastName.trim().toLocaleLowerCase("uk");

    return this.#list.clients
      .filter(other => other.id && !skip.has(other.id))
      .map(other => {
        const group = relatives.has(other.id) ? "relative"
          : surname && other.lastName.trim().toLocaleLowerCase("uk") === surname ? "surname"
          : "other";

        return {
          id: other.id,
          name: other.displayName,
          group,
          reason: LinkCandidates.REASON[group],
        };
      })
      .sort((a, b) => {
        const rank = LinkCandidates.RANK[b.group] - LinkCandidates.RANK[a.group];
        return rank || a.name.localeCompare(b.name, "uk");
      });
  }

  /**
   * @param {string} query
   * @param {string[]} [taken]
   * @returns {Array<{id: string, name: string, group: string, reason: string}>}
   */
  search(query, taken = []) {
    const all = this.all(taken);

    const wanted = (query ?? "").trim().toLocaleLowerCase("uk");
    if (!wanted) return all;

    /* Ranking is dropped once somebody types: they have said who they
       are looking for, and a guessed order would then be pushing back
       against an answer already given. */
    return all
      .filter(candidate => candidate.name.toLocaleLowerCase("uk").includes(wanted))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  /* ---------------- private ---------------- */

  /**
   * People related to somebody this client is already linked to.
   *
   * A family is a cluster: if Олена is linked to Ігор, then Ігор's
   * father is very likely the next link Олена needs. Following one step
   * out from each existing link finds them, and one step is enough —
   * two would reach half the sheet and mean nothing.
   */
  #relativesOfLinked() {
    const found = new Set();

    for (const link of this.#client.links) {
      const linked = this.#list.findById(link.id);
      if (!linked) continue;

      for (const theirs of linked.links) {
        if (theirs.id && theirs.id !== this.#client.id) found.add(theirs.id);
      }
    }

    return found;
  }
}
