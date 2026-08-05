/**
 * ClientId — a name for a row that survives being moved.
 *
 * Links between clients cannot point at a row number: deleting somebody
 * shifts every row below them up by one, and every link would then
 * point at the wrong person. Google Sheets offers no stable identifier
 * of its own — a sheet has one, a row does not — so Mirra keeps its own
 * in a column.
 *
 * Short on purpose. The column is visible in the spreadsheet, and a
 * full UUID sitting next to somebody's name looks like machinery that
 * has escaped. Eight characters of an unambiguous alphabet read as a
 * reference number, which is what it is.
 */
export class ClientId {
  /**
   * No 0/O, no 1/l/I. The column is read by people often enough that
   * a pair nobody can tell apart is worth losing.
   */
  static ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

  static LENGTH = 8;

  /**
   * @returns {string}
   */
  static create() {
    const bytes = new Uint8Array(ClientId.LENGTH);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, byte =>
      ClientId.ALPHABET[byte % ClientId.ALPHABET.length]).join("");
  }

  /**
   * @param {string} value
   * @returns {boolean} whether this looks like an id Mirra made
   */
  static isValid(value) {
    const trimmed = (value ?? "").trim();
    if (trimmed.length !== ClientId.LENGTH) return false;

    return [...trimmed].every(character => ClientId.ALPHABET.includes(character));
  }

  /**
   * Works out which rows need an id, and hands one to each.
   *
   * Two cases need fixing and both happen in the wild. A row with no id
   * has never been through a version of Mirra that assigns them. A row
   * sharing an id with another was copied and pasted, which people do
   * constantly and which would otherwise make one link point at two
   * people.
   *
   * The first occurrence keeps a duplicated id and later ones are
   * reissued, because the first is the one existing links already refer
   * to.
   *
   * @param {string[]} ids current values, in row order
   * @returns {Map<number, string>} row index → the id it should have
   */
  static repair(ids) {
    const fixes = new Map();
    const seen = new Set();

    ids.forEach((value, index) => {
      const id = (value ?? "").trim();

      if (ClientId.isValid(id) && !seen.has(id)) {
        seen.add(id);
        return;
      }

      let replacement = ClientId.create();
      while (seen.has(replacement)) replacement = ClientId.create();

      seen.add(replacement);
      fixes.set(index, replacement);
    });

    return fixes;
  }
}
