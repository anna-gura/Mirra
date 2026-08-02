import { config } from "../config.js";
import { AccessDeniedError, AuthError } from "../errors.js";

/**
 * RedirectAuthService — the same job as AuthService, without a popup.
 *
 * The popup flow depends on two things browsers keep restricting: a
 * second window delivering the token by postMessage, and the library
 * polling window.closed to notice cancellation. When that polling
 * starts returning wrong answers the library concludes the window was
 * closed and abandons the flow — a failure no application-level code
 * can repair, because the library's own state is already wrong.
 *
 * This class removes that layer. The page navigates to Google itself,
 * Google navigates back with the token in the URL fragment, and the
 * token is read on load. No second window, no postMessage, no COOP.
 *
 * Trade-off: the page reloads on sign-in. That costs nothing here —
 * at sign-in time there is no unsaved state to lose.
 *
 * Interface-compatible with AuthService, so swapping between them is
 * a single import line in App.js.
 */
export class RedirectAuthService extends EventTarget {
  static AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
  static STATE_KEY = "mirra:oauth-state";
  static TOKEN_KEY = "mirra:oauth-token";

  #token = null;
  #expiresAt = 0;
  #error = null;

  /**
   * Where the token is kept between the redirect out and the return.
   *
   * sessionStorage in a browser tab, because the session should end
   * when the tab does. But an installed app on iOS may hand the sign-in
   * to a separate browsing context and come back into a fresh one, and
   * sessionStorage does not survive that — the token would arrive and
   * then vanish, looking to the user like the sign-in simply failed.
   * localStorage survives it, and the extra exposure is small: the
   * token is void within the hour either way.
   */
  static get store() {
    const standalone = matchMedia("(display-mode: standalone)").matches
                    || window.navigator.standalone === true;
    return standalone ? localStorage : sessionStorage;
  }

  /**
   * Reads whatever Google left in the URL, or restores a token still
   * valid from earlier in this tab.
   * @returns {Promise<this>}
   */
  async init() {
    this.#readFragment() || this.#restore();

    if (this.#error) {
      const error = this.#error;
      this.#error = null;
      throw error;
    }

    return this;
  }

  /** @returns {boolean} always true; there is no library to load */
  get isReady() {
    return true;
  }

  /** @returns {boolean} true while a usable token is held */
  get isSignedIn() {
    return Boolean(this.#token) && Date.now() < this.#expiresAt;
  }

  /** @returns {string|null} */
  get token() {
    return this.isSignedIn ? this.#token : null;
  }

  /**
   * @returns {Promise<string>} resolves only if a token is already held;
   *          otherwise navigates away and never settles
   */
  async getToken() {
    if (this.isSignedIn) return this.#token;
    return this.requestToken();
  }

  /**
   * Sends the browser to Google.
   *
   * The returned promise deliberately never settles: the page is on its
   * way out, and anything awaiting it simply stops running. The result
   * arrives on the next page load as a `signin` event.
   *
   * @returns {Promise<never>}
   */
  requestToken() {
    const state = this.#issueState();

    /* `prompt` is deliberately absent. Forcing "consent" would show the
       permission screen on every single sign-in, including renewals an
       hour into the session. Left out, Google shows the account chooser
       and consent only when they are actually needed, and returns
       straight away when the grant already exists. */
    const params = new URLSearchParams({
      client_id: config.CLIENT_ID,
      redirect_uri: this.redirectUri,
      response_type: "token",
      scope: config.SCOPE,
      state,
      include_granted_scopes: "true",
    });

    window.location.assign(`${RedirectAuthService.AUTH_ENDPOINT}?${params}`);
    return new Promise(() => {});
  }

  /**
   * Where Google sends the browser back.
   *
   * Must match an entry in Authorized redirect URIs character for
   * character, which is why it is derived rather than typed by hand.
   * @returns {string}
   */
  get redirectUri() {
    return config.REDIRECT_URI || window.location.origin + window.location.pathname;
  }

  /** Drops the local token; forces a fresh sign-in. */
  invalidate() {
    this.#token = null;
    this.#expiresAt = 0;
    this.#forget();
  }

  /** Revokes the token at Google and clears local state. */
  async signOut() {
    const token = this.#token;
    this.invalidate();

    if (token) {
      // Best effort: revocation failing must not block signing out.
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
        mode: "no-cors",
      }).catch(() => {});
    }

    this.dispatchEvent(new CustomEvent("signout"));
  }

  /* ---------------- private ---------------- */

  /**
   * Parses the fragment Google appended, then wipes it from the URL so
   * the token does not sit in the address bar or in history.
   * @returns {boolean} whether a fragment was present
   */
  #readFragment() {
    const raw = window.location.hash.slice(1);
    if (!raw) return false;

    const params = new URLSearchParams(raw);
    const hasAuthData = params.has("access_token") || params.has("error");
    if (!hasAuthData) return false;

    this.#clearFragment();

    /* State check: a fragment that did not originate from this tab's
       request is discarded rather than trusted. */
    const expected = this.#takeState();
    if (!expected || params.get("state") !== expected) {
      this.#error = new AuthError("state mismatch");
      return true;
    }

    if (params.has("error")) {
      this.#error = params.get("error") === "access_denied"
        ? new AccessDeniedError(params.get("error"))
        : new AuthError(params.get("error"));
      return true;
    }

    this.#accept(params.get("access_token"), Number(params.get("expires_in")));
    return true;
  }

  /** Picks up a token still valid from earlier in this tab. */
  #restore() {
    let stored = null;
    try { stored = RedirectAuthService.store.getItem(RedirectAuthService.TOKEN_KEY); }
    catch { return false; }

    if (!stored) return false;

    try {
      const { token, expiresAt } = JSON.parse(stored);
      if (Date.now() >= expiresAt) { this.#forget(); return false; }

      this.#token = token;
      this.#expiresAt = expiresAt;
      queueMicrotask(() => this.dispatchEvent(new CustomEvent("signin")));
      return true;
    } catch {
      this.#forget();
      return false;
    }
  }

  #accept(token, expiresIn) {
    this.#token = token;
    this.#expiresAt = Date.now() + (expiresIn - config.TOKEN_SAFETY_MARGIN) * 1000;

    /* sessionStorage, not localStorage: the token dies with the tab.
       Without it a reload would throw the user back to the cover
       screen, which the popup flow never did. */
    try {
      RedirectAuthService.store.setItem(
        RedirectAuthService.TOKEN_KEY,
        JSON.stringify({ token: this.#token, expiresAt: this.#expiresAt })
      );
    } catch { /* the token will simply not survive a reload */ }

    queueMicrotask(() => this.dispatchEvent(new CustomEvent("signin")));
  }

  #clearFragment() {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  #issueState() {
    const state = crypto.randomUUID();
    try { RedirectAuthService.store.setItem(RedirectAuthService.STATE_KEY, state); }
    catch { /* the check below will then fail closed */ }
    return state;
  }

  #takeState() {
    try {
      const state = RedirectAuthService.store.getItem(RedirectAuthService.STATE_KEY);
      RedirectAuthService.store.removeItem(RedirectAuthService.STATE_KEY);
      return state;
    } catch { return null; }
  }

  #forget() {
    try { RedirectAuthService.store.removeItem(RedirectAuthService.TOKEN_KEY); }
    catch { /* nothing to clean */ }
  }
}
