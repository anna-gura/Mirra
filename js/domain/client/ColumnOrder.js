import { ClientSchema } from "./ClientSchema.js";

/**
 * ColumnOrder — putting Mirra's own columns back in their intended
 * order, without touching anybody else's.
 *
 * Order carries no meaning for the code: Mirra finds every column by
 * name, so a sheet works identically whatever sequence its headings sit
 * in. This exists for the person who opens the spreadsheet directly and
 * finds "День народження" wedged between "Месенджери" and "Нотатки"
 * because that is the release it arrived in — addColumns only ever
 * appends, which keeps old sheets working and slowly scrambles them.
 *
 * Two rules keep it safe.
 *
 * Columns Mirra does not recognise never move. Somebody's own column
 * stays at its own index, and the known columns are rearranged only
 * among the positions they already occupy between them. Nothing crosses
 * a column that is not Mirra's business.
 *
 * And every move goes leftward. The API's destinationIndex is counted
 * before the source is removed, which makes a rightward move land one
 * short of where it was asked to — the single most common way to
 * scramble a sheet with this call. Sorting by repeatedly pulling the
 * right column leftward means destinationIndex is always simply the
 * target position, and that ambiguity never arises.
 */
export class ColumnOrder {
  /**
   * Works out what has to move.
   *
   * @param {string[]} headers the sheet's first row
   * @param {string[]} fields the order Mirra would use, as field names
   * @returns {{moves: Array<{from: number, to: number}>,
   *            headers: string[], isNeeded: boolean}}
   *          moves in the order they must be applied, and the headings
   *          as they will read afterwards
   */
  static plan(headers, fields) {
    const schema = new ClientSchema(headers);

    /* Which indexes belong to Mirra, and which field sits in each. A
       field whose column is absent takes part in nothing. */
    const owned = new Map();
    for (const field of fields) {
      const index = schema.indexOf(field);
      if (index >= 0) owned.set(index, field);
    }

    const slots = [...owned.keys()].sort((a, b) => a - b);

    /* The field that should end up in each of those slots: the canonical
       order, narrowed to the fields this sheet actually has. */
    const wanted = fields.filter(field => owned.has(schema.indexOf(field)));

    /* Where every column should come from, expressed in current
       indexes. Columns Mirra does not own map to themselves. */
    const destination = headers.map((_, index) => index);
    slots.forEach((slot, position) => {
      destination[slot] = schema.indexOf(wanted[position]);
    });

    return ColumnOrder.#sort(headers, destination);
  }

  /* ---------------- private ---------------- */

  /**
   * Turns "where each column should come from" into leftward moves.
   *
   * Selection sort, deliberately: it is not the fewest possible moves,
   * but every move it makes is leftward, and that is worth more here
   * than being optimal. A sheet has ten columns.
   */
  static #sort(headers, destination) {
    /* The sheet as it stands, in original indexes, mutated alongside
       the moves so that each move is planned against the arrangement
       the previous ones left behind. */
    const current = headers.map((_, index) => index);
    const moves = [];

    for (let slot = 0; slot < destination.length; slot += 1) {
      const wanted = destination[slot];
      if (current[slot] === wanted) continue;

      const from = current.indexOf(wanted, slot);
      /* Cannot happen with a destination built from the same headers,
         and if it somehow does, skipping is the safe answer: a column
         left in place is a sheet that still works. */
      if (from < 0) continue;

      moves.push({ from, to: slot });
      current.splice(slot, 0, current.splice(from, 1)[0]);
    }

    return {
      moves,
      headers: current.map(index => headers[index]),
      isNeeded: moves.length > 0,
    };
  }
}
