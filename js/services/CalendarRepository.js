import { config } from "../config.js";
import { ApiError } from "../errors.js";

/**
 * @typedef {object} CalendarRecord
 * @property {string} id       what Mirra stores and never shows
 * @property {string} summary  the name, as it reads in Google Calendar
 * @property {string} timeZone IANA name, e.g. Europe/Kyiv
 */

/**
 * CalendarRepository — the only place that talks to Google Calendar.
 *
 * Sibling to SheetsRepository, and built on the same rule: everything
 * above this layer works with plain objects and never sees a URL or a
 * token.
 *
 * One calendar, made by Mirra. The scope it runs on —
 * calendar.app.created — grants exactly that and nothing else: Mirra
 * can make secondary calendars and work inside the ones it made, and
 * the calendar somebody already keeps for their own life stays
 * invisible to it. That is a real limitation, chosen rather than
 * suffered. The alternative scope reads every calendar in the account,
 * which would put the app in Google's verification queue and ask
 * people to hand over far more than a client list needs.
 *
 * Note that the scope covers the *calendar*, not only the events Mirra
 * wrote. An appointment somebody adds by hand in Google Calendar, or
 * one an assistant creates, lands in the same calendar and is read
 * back here like any other — which is what makes it possible to notice
 * it and ask whose it is.
 */
export class CalendarRepository {
  #api;

  /**
   * @param {object} deps
   * @param {import("./GoogleApiClient.js").GoogleApiClient} deps.api
   */
  constructor({ api }) {
    this.#api = api;
  }

  /**
   * Makes a calendar of Mirra's own.
   *
   * @param {object} options
   * @param {string} options.summary what it is called in Google Calendar
   * @param {string} options.timeZone IANA name
   * @returns {Promise<CalendarRecord>}
   */
  async create({ summary, timeZone }) {
    const created = await this.#api.post(`${config.CALENDAR_API}/calendars`, {
      summary,
      timeZone,
    });

    return CalendarRepository.#record(created);
  }

  /**
   * Reads a calendar's own details — not its events.
   *
   * Worth having for the same reason DriveRepository.getFile is: the
   * calendar may be gone. Somebody can delete it in Google Calendar,
   * and nothing else would say so; every later request would simply
   * fail, one at a time, with nothing to tell the person.
   *
   * @param {string} calendarId
   * @returns {Promise<CalendarRecord|null>} null when it no longer exists
   */
  async get(calendarId) {
    try {
      const found = await this.#api.get(
        `${config.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`
      );
      return CalendarRepository.#record(found);
    } catch (error) {
      /* Gone, or never ours to see. Both mean the same thing to the
         caller: there is no calendar behind that id any more. Anything
         else — no network, an expired token, a rate limit — is a real
         failure and is passed on. */
      if (error instanceof ApiError && CalendarRepository.GONE.includes(error.status)) {
        /* Said out loud, because this is the one place where a missing
           calendar becomes a new one, and whoever is looking at the
           console while that happens deserves to know which answer
           Google actually gave. */
        console.info(`Mirra: calendar ${calendarId} is gone (HTTP ${error.status})`);
        return null;
      }

      console.warn(`Mirra: could not read calendar ${calendarId}`, error);
      throw error;
    }
  }

  /**
   * Whether the calendar is on this account's own list of calendars.
   *
   * A different question from get(), and the difference is the whole
   * reason this exists. get() asks whether a calendar exists at all;
   * this asks whether the person sees it in Google Calendar. Google
   * keeps the two apart — the calendar is one resource, the account's
   * list of calendars is another — so a calendar can answer every
   * request Mirra makes and still be nowhere on the screen of the
   * person who owns it. Mirra then says "saved" about something
   * nobody can find, which is how an hour went into looking for a
   * calendar that was there all along.
   *
   * Read only. Mirra never asks for the whole list and never writes
   * to it: adding a calendar back to somebody's list needs a
   * sensitive scope, which would mean Google's verification queue and
   * an "unverified app" warning for everybody. So this can report the
   * state and cannot repair it — which is still far better than not
   * knowing.
   *
   * @param {string} calendarId
   * @returns {Promise<{id: string, summary: string, hidden: boolean}|null>}
   *          null when the calendar is not on the list at all
   */
  async listEntry(calendarId) {
    try {
      const entry = await this.#api.get(
        `${config.CALENDAR_API}/users/me/calendarList/${encodeURIComponent(calendarId)}`
      );

      return {
        id: entry?.id ?? "",
        summary: entry?.summary ?? "",
        /* Google's own word for "on the list, but the person chose
           not to see it". Not the same as absent, and worth telling
           apart: one is a setting, the other is a problem. */
        hidden: entry?.hidden === true,
      };
    } catch (error) {
      /* Only 404 means "not on the list". Deliberately narrower than
         GONE: a 403 here is the permission missing, not an answer
         about the calendar, and reading it as "not on the list" would
         have Mirra reporting a fault that is its own. */
      if (error instanceof ApiError && error.status === 404) {
        console.info(`Mirra: calendar ${calendarId} is not on this account's list (HTTP 404)`);
        return null;
      }

      console.warn(`Mirra: could not read the list entry for calendar ${calendarId}`, error);
      throw error;
    }
  }

  /**
   * Changes the name or the time zone of a calendar Mirra made.
   *
   * @param {string} calendarId
   * @param {{summary?: string, timeZone?: string}} changes
   * @returns {Promise<CalendarRecord>}
   */
  async update(calendarId, changes) {
    const updated = await this.#api.patch(
      `${config.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      changes
    );

    return CalendarRepository.#record(updated);
  }

  /* ---------------- private ---------------- */

  /**
   * Keeps what Mirra uses and drops the rest.
   *
   * Google returns a good deal more — conference properties, etags,
   * kind strings — and carrying all of it upwards would mean every
   * screen above handling fields nobody reads.
   */
  /**
   * Answers that mean "there is no calendar behind that id any more".
   *
   * 404 is the expected one. 410 is Google saying it was deleted
   * rather than never existed, and 403 covers a calendar that is no
   * longer ours to see — which, for a calendar Mirra made itself,
   * amounts to the same thing. Deliberately not every 4xx: 429 is
   * "too fast, ask again", and treating that as a deletion would have
   * Mirra building a second calendar because the first was busy.
   */
  static GONE = Object.freeze([403, 404, 410]);

  static #record(raw) {
    return {
      id: raw?.id ?? "",
      summary: raw?.summary ?? "",
      timeZone: raw?.timeZone ?? "",
    };
  }
}
