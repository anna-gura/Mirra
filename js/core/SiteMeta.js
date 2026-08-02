/**
 * SiteMeta — retired, deliberately kept.
 *
 * This class used to write the canonical link, Open Graph tags and
 * structured data at runtime, so that the site's address lived in one
 * place instead of seven. That worked for search — Google renders
 * JavaScript — but not for Google's OAuth brand review, which appears
 * to read the markup as served. It reported that the app's home page
 * did not explain its purpose and that the name did not match, because
 * from where it stood, neither was there.
 *
 * The tags are now written into each page. The lesson is worth keeping:
 * anything a machine other than a browser needs to read belongs in the
 * HTML, not in a script that produces it.
 *
 * Nothing calls this any more. It is left as a record rather than
 * deleted, so the reasoning survives the decision.
 */
export class SiteMeta {
  /** Does nothing. The tags it used to write are in the pages now. */
  static apply() {}
}
