import { config } from "../config.js";
import { AuthService } from "./AuthService.js";
import { RedirectAuthService } from "./RedirectAuthService.js";

/**
 * AuthServiceFactory — picks a sign-in strategy.
 *
 * Two implementations exist because browser popups are fragile in ways
 * no application code can fix. The popup flow is the nicer experience:
 * the page never unloads. But it relies on a second window delivering
 * the token by postMessage, and on the Google library polling
 * window.closed to notice cancellation — both of which break under
 * cross-origin isolation policies that keep tightening.
 *
 * The redirect flow has none of that machinery, so it works where the
 * popup does not, at the cost of a page reload.
 *
 * Both satisfy the same contract, so nothing above this layer changes:
 *   init() · isReady · isSignedIn · token · getToken()
 *   requestToken() · invalidate() · signOut() · "signin" event
 *
 * Flip config.AUTH_MODE to switch. No other file needs editing, which
 * is the whole point of having the seam here.
 */
export class AuthServiceFactory {
  static POPUP = "popup";
  static REDIRECT = "redirect";

  /**
   * @param {string} [mode] overrides config, useful in tests
   * @returns {AuthService|RedirectAuthService}
   */
  static create(mode = config.AUTH_MODE) {
    switch (mode) {
      case AuthServiceFactory.REDIRECT:
        return new RedirectAuthService();

      case AuthServiceFactory.POPUP:
        return new AuthService();

      default:
        console.warn(`Unknown AUTH_MODE "${mode}", falling back to popup`);
        return new AuthService();
    }
  }
}
