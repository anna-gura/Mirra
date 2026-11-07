import { ScriptLoader } from "../../core/ScriptLoader.js";
import { config } from "../../config.js";
import { TokenStore } from "./TokenStore.js";
import {
  AccessDeniedError,
  AuthError,
  PopupBlockedError,
  SignInAbandonedError,
} from "../../errors.js";

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
  #granted = new Set();
  #clients = new Map();   // scope string → token client, built as needed
  #pending = null;   // { promise, resolve, reject } of the request in flight
  #store = new TokenStore();

  constructor() {
    super();

    /* Read here rather than inside init(), because init() loads a
       library over the network and resume() asks whether we are signed
       in before that finishes. Restoring later meant the answer was
       always "no", and the app went to Google for a token it already
       had — which is the flash of a popup opening and closing again. */
    this.#restore();
  }

  /**
   * Loads the Google library and prepares the token client.
   * Safe to call repeatedly: the work happens once.
   * @returns {Promise<this>}
   */
  init() {
    this.#initPromise ??= (async () => {
      await ScriptLoader.load(config.GIS_SRC);
      await ScriptLoader.waitFor(() => Boolean(window.google?.accounts?.oauth2));

      this.#tokenClient = this.#clientFor(config.SCOPE);

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
   * Whether the token in hand already covers what is about to be done.
   *
   * @param {string[]} scopes
   * @returns {boolean}
   */
  hasScopes(scopes) {
    return this.isSignedIn && scopes.every(scope => this.#granted.has(scope));
  }

  /**
   * Asks for permissions beyond the ones signing in covers.
   *
   * Google calls this incremental authorisation, and the point of it
   * is restraint: somebody who only keeps a client list is never shown
   * a consent screen about calendars. The permission is asked for on
   * the day the calendar is first opened, in the same breath as
   * opening it, where the reason for the question is on the screen
   * behind it.
   *
   * The base scope travels along every time, because the token that
   * comes back replaces the one in hand — asking only for the new
   * permission would hand back a token that cannot read the sheet.
   *
   * Deliberately not an async function, for the same reason as
   * requestToken: when the library is warm this reaches the popup in
   * the same tick as the click that asked for it.
   *
   * @param {string[]} scopes
   * @returns {Promise<string>} a token covering them
   */
  grant(scopes) {
    if (this.hasScopes(scopes)) return Promise.resolve(this.#token);

    const wanted = [config.SCOPE, ...scopes].join(" ");

    return this.isReady
      ? this.#ask(false, wanted)
      : this.init().then(() => this.#ask(false, wanted));
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
    if (this.isSignedIn) return Promise.resolve(this.#token);

    // A second popup while one is open confuses Google and the user.
    if (this.#pending) return this.#pending.promise;

    return this.isReady
      ? this.#ask(silent)
      : this.init().then(() => this.#ask(silent));
  }

  /**
   * Tries to get a token without showing anything.
   *
   * Google returns one straight away when the person is signed in to
   * their account in this browser and has granted access before —
   * which, for someone using Mirra daily, is always. No window opens
   * and nothing is clicked; the app simply starts signed in.
   *
   * Failure here is ordinary, not exceptional: it means they signed out
   * of Google or withdrew the permission, and the cover screen is the
   * right answer. So it resolves false rather than throwing.
   *
   * @returns {Promise<boolean>} whether a token was obtained
   */
  async resume() {
    /* A stored token that is still good is the whole answer. Google is
       not asked, no window opens, and the app starts on the hub — which
       is what someone opening Mirra for the fourth time today expects.

       The library is still loaded, just not waited for: it is needed
       only when this token expires, and by then it will have arrived.
       Warming it now also means the eventual sign-in click is not spent
       waiting on a download, which is what browsers block popups for. */
    if (this.isSignedIn) {
      this.init().catch(error => console.warn("Google preload failed", error));
      return true;
    }

    try {
      await this.init();
      await this.#ask(true);
      return true;
    } catch {
      return false;
    }
  }

  /** Drops the local token without revoking it; forces a renewal. */
  invalidate() {
    this.#token = null;
    this.#expiresAt = 0;

    /* The permissions stay. They belong to the account rather than to
       this token, and a renewal has to ask for all of them again — see
       #renewalScope. */
    this.#store.clear();
  }

  /** Revokes the token at Google and clears local state. */
  async signOut() {
    const token = this.#token;

    /* invalidate() clears the stored copy as well, which is what makes
       signing out actually stick across visits. Signing out is also
       the one moment the granted permissions are forgotten: the next
       person at this browser may not be the one who gave them. */
    this.invalidate();
    this.#granted.clear();
    this.#store.forget();

    if (token && window.google?.accounts?.oauth2) {
      await new Promise(resolve => google.accounts.oauth2.revoke(token, resolve));
    }
    this.dispatchEvent(new CustomEvent("signout"));
  }

  /* ---------------- private ---------------- */

  /**
   * Opens the popup and hands back a promise for its outcome.
   *
   * @param {boolean} _silent
   * @param {string} [scope] when more than the sign-in scope is wanted
   */
  #ask(_silent, scope = this.#renewalScope) {
    const pending = {};
    pending.promise = new Promise((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.#pending = pending;

    /* `prompt` is left empty even for a deliberate sign-in. Forcing
       "consent" showed the permission screen every single time, including
       to someone who granted it months ago — Google shows an account
       chooser or a consent screen when either is actually needed, and
       returns silently when neither is. */
    this.#clientFor(scope).requestAccessToken({ prompt: "" });
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

    /* What Google says it granted, not what was asked for. Somebody can
       untick a permission on the consent screen, and a token believed
       to carry one it does not is how an app ends up making a request
       that fails for reasons nobody can see. */
    this.#remember(response.scope);
    this.#store.write(this.#token, this.#expiresAt, [...this.#granted].join(" "));

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

  /** Picks up a token left by an earlier visit, if it is still good. */
  #restore() {
    /* Read first and separately: an expired token is discarded by the
       store, and the permissions must survive that. */
    this.#remember(this.#store.readScope());

    const record = this.#store.read();
    if (!record) return;

    this.#token = record.token;
    this.#expiresAt = record.expiresAt;
    if (record.scope) this.#remember(record.scope);
  }

  /**
   * One token client per scope set, made the first time it is needed.
   *
   * The library wants the scopes at construction, so asking for a new
   * permission means a new client. They are kept rather than rebuilt
   * because building one inside a click handler is free only while the
   * library is already loaded, and keeping them removes the question.
   *
   * @param {string} scope space-separated
   */
  #clientFor(scope) {
    if (!this.#clients.has(scope)) {
      this.#clients.set(scope, google.accounts.oauth2.initTokenClient({
        client_id: config.CLIENT_ID,
        scope,
        callback: response => this.#settle(response),
        error_callback: error => this.#fail(error),
      }));
    }

    return this.#clients.get(scope);
  }

  /**
   * What a renewal should ask for: everything granted so far.
   *
   * An hour-old token is replaced by a new one, and a replacement that
   * asked only for the sign-in scope would quietly drop the calendar
   * permission — the next thing the person did in the calendar would
   * then fail, an hour into a session, for no reason they could see.
   *
   * @returns {string}
   */
  get #renewalScope() {
    return this.#granted.size ? [...this.#granted].join(" ") : config.SCOPE;
  }

  /** @param {string} [scope] space-separated, as Google reports it */
  #remember(scope) {
    this.#granted = new Set(String(scope ?? "").split(" ").filter(Boolean));

    /* A token from before scopes were recorded, or one Google returned
       without naming them. It was obtained by signing in, so that is
       what it covers — and anything more will be asked for and
       recorded properly when it is first needed. */
    if (!this.#granted.size) this.#granted.add(config.SCOPE);
  }

  #takePending() {
    const pending = this.#pending;
    this.#pending = null;
    return pending;
  }
}
