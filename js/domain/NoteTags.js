/**
 * NoteTags — hashtags written inside an ordinary note.
 *
 * There is no separate tags column and no tag editor. Someone types
 * "#коротке-волосся, приходить із подругою" into the notes field and
 * that is the whole feature: the note stays readable prose, the
 * spreadsheet stays a spreadsheet, and anyone who opens the file in
 * Sheets sees exactly what they wrote.
 *
 * The alternative — a dedicated column, a picker, a list of allowed
 * values — would be more structured and worse. It would mean deciding
 * in advance what people are allowed to remember about a client, and
 * teaching them a second place to type.
 */
export class NoteTags {
  /**
   * A hash followed by letters, digits, dashes and underscores.
   *
   * \p{L} rather than a-z, or Ukrainian tags would end at the first
   * letter. The character before must be whitespace or nothing at all,
   * so an address like вул.Шевченка#12 is not read as a tag.
   */
  static PATTERN = /(?:^|\s)(#[\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

  /**
   * Every tag in a note, lowercased and without repeats.
   *
   * Case is folded because #Волосся and #волосся are the same thought,
   * and a list that shows both teaches people to be careful about
   * something that should not need care.
   *
   * @param {string} note
   * @returns {string[]}
   */
  static parse(note) {
    if (!note) return [];

    const found = [...note.matchAll(NoteTags.PATTERN)]
      .map(match => match[1].toLocaleLowerCase("uk"));

    return [...new Set(found)];
  }

  /**
   * The note with its tags removed, for showing prose on its own.
   * @param {string} note
   * @returns {string}
   */
  static strip(note) {
    if (!note) return "";

    return note
      .replace(NoteTags.PATTERN, " ")
      /* Removing a tag from "Мила, #коротке, гарна" leaves the commas on
         both sides of the hole, so repeated punctuation is collapsed
         and any left stranded at either end is dropped. Prose that
         survives an edit should read as prose. */
      .replace(/\s*([,.;:])\s*(?=[,.;:])/g, "")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/^[\s,.;:]+/, "")
      .replace(/[\s,;:]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /**
   * Splits a note into its parts in order, so it can be rendered with
   * the tags marked and everything else left alone.
   *
   * @param {string} note
   * @returns {Array<{type: "text"|"tag", value: string}>}
   */
  static segments(note) {
    if (!note) return [];

    const parts = [];
    let cursor = 0;

    for (const match of note.matchAll(NoteTags.PATTERN)) {
      const tag = match[1];
      const start = match.index + match[0].indexOf(tag);

      if (start > cursor) {
        parts.push({ type: "text", value: note.slice(cursor, start) });
      }

      parts.push({ type: "tag", value: tag });
      cursor = start + tag.length;
    }

    if (cursor < note.length) {
      parts.push({ type: "text", value: note.slice(cursor) });
    }

    return parts;
  }

  /**
   * Whether a query is someone searching for a tag.
   * @param {string} query
   * @returns {boolean}
   */
  static isTagQuery(query) {
    return (query ?? "").trim().startsWith("#");
  }

  /**
   * @param {string} tag
   * @param {string} query
   * @returns {boolean} whether the tag matches what is being typed
   */
  static matches(tag, query) {
    return tag.startsWith(query.trim().toLocaleLowerCase("uk"));
  }
}
