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
   * Granted permissions are kept apart from the token, and outlive it.
   *
   * A token is good for an hour; a permission lasts until the person
   * takes it back in their Google account. Keeping them in one record
   * meant that coming back the next morning — when the token is thrown
   * away as expired — also threw away the knowledge that the calendar
   * had ever been allowed. Mirra would then renew with the narrow
   * permission it started with, and the first thing it tried to read
   * in the calendar would fail for a reason nobody could see.
   */
  static SCOPE_KEY = "mirra:scopes";

  /**
   * @returns {{token: string, expiresAt: number, scope: string}|null}
   *          null when there is nothing usable
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

      /* Records written before scopes were tracked carry none. They
         were written when signing in asked for files and nothing else,
         so that is what they cover — and reading them as such is what
         stops Mirra assuming a calendar permission it never had. */
      return { ...record, scope: typeof record.scope === "string" ? record.scope : "" };
    } catch {
      this.clear();
      return null;
    }
  }

  /**
   * @param {string} token
   * @param {number} expiresAt
   * @param {string} [scope] space-separated scopes the token carries,
   *        exactly as Google reported them
   */
  write(token, expiresAt, scope = "") {
    try {
      localStorage.setItem(TokenStore.KEY, JSON.stringify({ token, expiresAt, scope }));
      if (scope) localStorage.setItem(TokenStore.SCOPE_KEY, scope);
    } catch {
      /* Private browsing refuses to write. The session still works —
         it simply will not outlive the tab. */
    }
  }

  /**
   * @returns {string} permissions granted to the app, space-separated,
   *          whether or not a usable token is left
   */
  readScope() {
    try { return localStorage.getItem(TokenStore.SCOPE_KEY) ?? ""; }
    catch { return ""; }
  }

  /** Drops the token. What the person allowed is not the token's to forget. */
  clear() {
    try { localStorage.removeItem(TokenStore.KEY); }
    catch { /* nothing to clean */ }
  }

  /** Drops the permissions too: for signing out, and nothing else. */
  forget() {
    this.clear();
    try { localStorage.removeItem(TokenStore.SCOPE_KEY); }
    catch { /* nothing to clean */ }
  }
}
