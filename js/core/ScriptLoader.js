import { ScriptLoadError } from "../errors.js";

/**
 * ScriptLoader — loads external scripts on demand, once each.
 *
 * Google's libraries are fetched lazily rather than blocking the
 * first paint: the cover screen renders instantly and the ~200 KB
 * of Google code only arrives when the user actually signs in.
 *
 * Repeat calls for the same URL share one promise, so two services
 * asking for the same library never trigger two downloads.
 */
export class ScriptLoader {
  /** @type {Map<string, Promise<void>>} */
  static #inFlight = new Map();

  /**
   * @param {string} src
   * @returns {Promise<void>} resolves once the script has executed
   */
  static load(src) {
    if (this.#inFlight.has(src)) return this.#inFlight.get(src);

    const pending = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => {
        // drop it so a later attempt can retry after the network returns
        ScriptLoader.#inFlight.delete(src);
        reject(new ScriptLoadError(src));
      };
      document.head.append(tag);
    });

    this.#inFlight.set(src, pending);
    return pending;
  }

  /**
   * Polls until a global appears. Some Google libraries finish
   * loading a moment after their script tag fires onload.
   * @param {() => boolean} predicate
   * @param {object} [options]
   * @param {number} [options.timeout] milliseconds
   * @param {number} [options.interval] milliseconds
   * @returns {Promise<void>}
   */
  static waitFor(predicate, { timeout = 10000, interval = 60 } = {}) {
    return new Promise((resolve, reject) => {
      if (predicate()) return resolve();

      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (predicate()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - startedAt > timeout) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for a Google global"));
        }
      }, interval);
    });
  }
}
