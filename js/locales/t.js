import { Translator } from "./Translator.js";

/**
 * The shared translator.
 *
 * A single instance reached by importing rather than passed down
 * through constructors. Translation is a cross-cutting concern in the
 * same way logging is: nearly every class needs it, none of them own
 * it, and threading it through twelve constructors would say something
 * about the architecture that is not true.
 *
 * The application still owns the lifecycle — it decides what to load
 * and when — and everything else only reads.
 */
export const translator = new Translator();

/**
 * @param {string} text the Ukrainian original
 * @returns {string}
 */
export function t(text) {
  return translator.t(text);
}
