import { ScriptLoader } from "../core/ScriptLoader.js";
import { config } from "../config.js";
import {
  AccessDeniedError,
  AuthError,
  PopupBlockedError,
  SignInAbandonedError,
} from "../errors.js";

/**
 * AuthService — owns the Google access token and nothing else.
 *
 * Uses the Google Identity Services implicit token flow, which runs
 * entirely in the browser and needs no backend. The trade-off is that
 * there is no refresh token: the access token lives about an hour and
 * has to be re-requested. A silent request (`prompt: ""`) renews it
 * without a popup as long as the Google session is still alive, which
 * is why the user is not thrown back to the cover screen mid-session.
 *
 * Timing matters more than it looks. Browsers only allow a popup while
 * the click that asked for it is still "active", and that permission
 * expires in seconds. Loading the Google library inside the click
 * handler burns that budget and the popup gets blocked silently. So
 * the library is warmed up at startup and requestToken() reaches
 * requestAccessToken() synchronously, with no await in between.
 *
 * The token is held in memory only and never written to storage, so
 * closing the tab ends the session.
 */
export class AuthService extends EventTarget {
  #tokenClient = null;
  #initPromise = null;
  #token = null;
  #expiresAt = 0;
  #pending = null;   // { promise, resolve, reject } of the request in flight

  /**
   * Loads the Google library and prepares the token client.
   * Safe to call repeatedly: the work happens once.
   * @returns {Promise<this>}
   */
  init() {
    this.#initPromise ??= (async () => {
      await ScriptLoader.load(config.GIS_SRC);
      await ScriptLoader.waitFor(() => Boolean(window.google?.accounts?.oauth2));

      this.#tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.CLIENT_ID,
        scope: config.SCOPE,
        callback: response => this.#settle(response),
        error_callback: error => this.#fail(error),
      });

      return this;
    })();

    return this.#initPromise;
  }

  /** @returns {boolean} true once the popup can be opened without delay */
  get isReady() {
    return Boolean(this.#tokenClient);
  }

  /** @returns {boolean} true while a usable token is held */
  get isSignedIn() {
    return Boolean(this.#token) && Date.now() < this.#expiresAt;
  }

  /** @returns {string|null} the raw token, or null if there is none */
  get token() {
    return this.isSignedIn ? this.#token : null;
  }

  /**
   * Returns a usable token, renewing it silently when possible.
   * @returns {Promise<string>}
   */
  async getToken() {
    if (this.isSignedIn) return this.#token;
    return this.requestToken({ silent: true });
  }

  /**
   * Asks Google for a token.
   *
   * Deliberately not an async function: when the client is already
   * warmed up this reaches the popup in the same tick as the click.
   *
   * @param {object} [options]
   * @param {boolean} [options.silent] skip the consent window if the
   *        Google session already allows it
   * @returns {Promise<string>}
   * @throws {AccessDeniedError|SignInAbandonedError|PopupBlockedError|AuthError}
   */
  requestToken({ silent = false } = {}) {
    // A second popup while one is open confuses Google and the user.
    if (this.#pending) return this.#pending.promise;

    return this.isReady
      ? this.#ask(silent)
      : this.init().then(() => this.#ask(silent));
  }

  /** Drops the local token without revoking it; forces a renewal. */
  invalidate() {
    this.#token = null;
    this.#expiresAt = 0;
  }

  /** Revokes the token at Google and clears local state. */
  async signOut() {
    const token = this.#token;
    this.invalidate();

    if (token && window.google?.accounts?.oauth2) {
      await new Promise(resolve => google.accounts.oauth2.revoke(token, resolve));
    }
    this.dispatchEvent(new CustomEvent("signout"));
  }

  /* ---------------- private ---------------- */

  /** Opens the popup and hands back a promise for its outcome. */
  #ask(silent) {
    const pending = {};
    pending.promise = new Promise((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.#pending = pending;

    this.#tokenClient.requestAccessToken({ prompt: silent ? "" : "consent" });
    return pending.promise;
  }

  /**
   * Handles the token client callback.
   *
   * A token is accepted even when nothing is waiting for it. That is
   * not defensive padding: Google's own pages send
   * Cross-Origin-Opener-Policy: same-origin, which stops the library
   * from reading popup.closed. It then reports the popup as closed
   * while the user is still on the consent screen, the pending request
   * gets rejected, and the real token arrives a moment later with no
   * one left to receive it. Storing it regardless and announcing it as
   * an event means a genuine sign-in always counts, however confused
   * the library became on the way.
   */
  #settle(response) {
    const pending = this.#takePending();

    if (response.error) {
      pending?.reject(
        response.error === "access_denied"
          ? new AccessDeniedError(response)
          : new AuthError(response.error, response)
      );
      return;
    }

    this.#token = response.access_token;
    this.#expiresAt =
      Date.now() + (Number(response.expires_in) - config.TOKEN_SAFETY_MARGIN) * 1000;

    pending?.resolve(this.#token);
    this.dispatchEvent(new CustomEvent("signin"));
  }

  /**
   * Handles popup-level problems: closed window, blocked popup.
   *
   * "popup_closed" is not trustworthy here (see #settle), so it is
   * downgraded to a silent abandonment: it clears the busy state and
   * nothing more. If the user was in fact still deciding, the token
   * arrives later and the signin event carries the flow forward.
   */
  #fail(error) {
    const pending = this.#takePending();
    if (!pending) return;

    switch (error?.type) {
      case "popup_closed":
        pending.reject(new SignInAbandonedError(error));
        break;
      case "popup_failed_to_open":
        pending.reject(new PopupBlockedError(error));
        break;
      default:
        pending.reject(new AuthError(error?.type ?? "unknown", error));
    }
  }

  #takePending() {
    const pending = this.#pending;
    this.#pending = null;
    return pending;
  }
}
