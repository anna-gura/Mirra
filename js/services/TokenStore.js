/**
 * TokenStore — where an access token waits between visits.
 *
 * Kept in localStorage rather than in memory, so that closing a tab and
 * coming back an hour later does not mean signing in again. Someone who
 * opens Mirra six times a day should be asked once, not six times.
 *
 * That is a real trade-off and worth naming. A token in localStorage is
 * readable by any script running on the page, where one held in a
 * variable is not. What makes it acceptable here is the shape of the
 * app rather than optimism: Mirra loads no third-party code beyond
 * Google's own, builds every element through textContent rather than
 * markup strings, and holds a token that Google voids within the hour
 * and that reaches only files the user hand-picked.
 *
 * The expiry is stored alongside and checked on the way out. A record
 * past its time is discarded rather than returned — so a stale token
 * cannot sit in a browser for months waiting to be sent at an API that
 * will only reject it.
 */
export class TokenStore {
  static KEY = "mirra:token";

  /**
   * @returns {{token: string, expiresAt: number}|null} null when there
   *          is nothing usable
   */
  read() {
    let raw = null;
    try { raw = localStorage.getItem(TokenStore.KEY); }
    catch { return null; }

    if (!raw) return null;

    try {
      const record = JSON.parse(raw);

      const valid = typeof record?.token === "string"
                 && record.token
                 && Number.isFinite(record.expiresAt);

      if (!valid) { this.clear(); return null; }

      /* Expired records are cleared rather than merely ignored: leaving
         them costs nothing today and confuses whoever reads the storage
         next. */
      if (Date.now() >= record.expiresAt) { this.clear(); return null; }

      return record;
    } catch {
      this.clear();
      return null;
    }
  }

  /**
   * @param {string} token
   * @param {number} expiresAt
   */
  write(token, expiresAt) {
    try {
      localStorage.setItem(TokenStore.KEY, JSON.stringify({ token, expiresAt }));
    } catch {
      /* Private browsing refuses to write. The session still works —
         it simply will not outlive the tab. */
    }
  }

  clear() {
    try { localStorage.removeItem(TokenStore.KEY); }
    catch { /* nothing to clean */ }
  }
}
