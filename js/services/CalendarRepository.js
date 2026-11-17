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
      /* Only an answer about the calendar counts as one. 404 and 410
         are Google saying there is nothing behind that id; everything
         else — no network, an expired token, a rate limit, a refused
         permission — is a failure of the question, not of the thing
         asked about, and is passed on.

         403 used to be in this list, and it cost somebody their
         calendar. Google answers 403 for a rate limit and for a
         quota as readily as for a permission, and the caller reacts
         to null by forgetting the calendar for good. One busy minute
         was enough to erase a calendar that was sitting there the
         whole time. */
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
   * Everything on the calendar between two instants.
   *
   * singleEvents is on, so a repeating appointment arrives as the
   * occurrences it actually has rather than as a rule somebody here
   * would have to expand — and getting that expansion wrong means
   * showing a client a time that does not exist.
   *
   * Cancelled events come back too when a page token is followed, and
   * they are dropped here: Google keeps them as tombstones for clients
   * doing incremental sync, which this is not.
   *
   * @param {object} query
   * @param {string} query.calendarId
   * @param {string} query.from RFC3339 instant
   * @param {string} query.to   RFC3339 instant
   * @returns {Promise<object[]>}
   */
  async events({ calendarId, from, to }) {
    const base = `${config.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
      + `?singleEvents=true&orderBy=startTime&maxResults=250`
      + `&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`;

    const found = [];
    let token = "";

    /* A month of a busy calendar can pass 250. The loop is bounded
       rather than "while there is a token": a server that keeps
       handing back the same token would otherwise spin here forever. */
    for (let page = 0; page < 10; page += 1) {
      const url = token ? `${base}&pageToken=${encodeURIComponent(token)}` : base;
      const answer = await this.#api.get(url);

      for (const item of answer?.items ?? []) {
        if (item?.status === "cancelled") continue;
        found.push(CalendarRepository.#event(item));
      }

      token = answer?.nextPageToken ?? "";
      if (!token) break;
    }

    return found;
  }

  /**
   * Which day this account's week starts on.
   *
   * Google's own numbering comes back as a string: "0" Sunday, "1"
   * Monday, "6" Saturday. Asked rather than assumed, and never
   * insisted on — a month grid starting on the wrong day is a small
   * ugliness, while a failed request that stops the calendar opening
   * is not. So anything other than an answer means null, and the
   * caller keeps its own default.
   *
   * @returns {Promise<number|null>}
   */
  async weekStart() {
    try {
      const setting = await this.#api.get(`${config.CALENDAR_API}/users/me/settings/weekStart`);
      const value = Number(setting?.value);

      return [0, 1, 6].includes(value) ? value : null;
    } catch (error) {
      console.info("Mirra: could not read the week start from Google, keeping Monday", error);
      return null;
    }
  }

  /**
   * Writes an appointment.
   *
   * Everything Mirra needs to read it back later goes into
   * extendedProperties.private, where only this application can see
   * it. Two of those fields are there because of a lesson rather than
   * a feature: the gap after the visit and the mark saying the day
   * was not a working one are stored with the appointment, not looked
   * up in the settings. Settings change. An appointment made in March
   * should still be drawn in April the way it was made.
   *
   * @param {object} visit
   * @param {string} visit.calendarId
   * @param {string} visit.title     what Google Calendar shows
   * @param {string} [visit.comment] goes in the description, tags and all
   * @param {string} visit.from  RFC3339 instant
   * @param {string} visit.to    RFC3339 instant
   * @param {string} visit.timeZone
   * @param {string[]} [visit.clients] client ids — a list from the
   *        start, so group visits need no rewriting of what people
   *        have already booked
   * @param {string} [visit.sheetId]
   * @param {number} [visit.gap] minutes held after the visit
   * @param {boolean} [visit.offSchedule] booked on a day off
   * @returns {Promise<object>}
   */
  async addEvent(visit) {
    const mine = {};

    if (visit.clients?.length) mine.clients = visit.clients.join(",");
    if (visit.sheetId) mine.sheet = visit.sheetId;
    if (Number.isFinite(visit.gap)) mine.gap = String(Math.max(0, Math.round(visit.gap)));
    if (visit.offSchedule) mine.workday = "once";

    const created = await this.#api.post(
      `${config.CALENDAR_API}/calendars/${encodeURIComponent(visit.calendarId)}/events`,
      {
        summary: visit.title,
        description: visit.comment || undefined,
        start: { dateTime: visit.from, timeZone: visit.timeZone },
        end: { dateTime: visit.to, timeZone: visit.timeZone },
        extendedProperties: { private: mine },
      }
    );

    return CalendarRepository.#event(created);
  }

  /**
   * Changes an appointment that already exists.
   *
   * PATCH rather than PUT: what is sent is what changes, and an
   * appointment carries things Mirra never set — a colour somebody
   * picked in Google Calendar, a reminder, a guest. A full replace
   * would quietly take all of them away.
   *
   * The hidden properties are the exception. Google merges them key
   * by key, so a key left out stays as it was; to clear one it has to
   * be sent as null. That is how unlinking a client will work when
   * there is a place to ask for it.
   *
   * @param {object} visit the same shape addEvent takes, plus eventId
   * @returns {Promise<object>} the appointment as it now stands
   */
  async updateEvent(visit) {
    const mine = {
      clients: visit.clients?.length ? visit.clients.join(",") : null,
      sheet: visit.sheetId || null,
      gap: Number.isFinite(visit.gap) ? String(Math.max(0, Math.round(visit.gap))) : null,
      workday: visit.offSchedule ? "once" : null,
    };

    const changed = await this.#api.patch(
      `${config.CALENDAR_API}/calendars/${encodeURIComponent(visit.calendarId)}`
      + `/events/${encodeURIComponent(visit.eventId)}`,
      {
        summary: visit.title,
        /* Empty rather than missing: a comment somebody deleted has
           to leave the event, and a missing key would keep it. */
        description: visit.comment ?? "",
        start: { dateTime: visit.from, timeZone: visit.timeZone },
        end: { dateTime: visit.to, timeZone: visit.timeZone },
        extendedProperties: { private: mine },
      }
    );

    return CalendarRepository.#event(changed);
  }

  /**
   * Removes an appointment. Cancelling a visit is deleting it: a
   * calendar full of struck-through entries is a calendar nobody can
   * read at a glance.
   *
   * @param {string} calendarId
   * @param {string} eventId
   */
  async removeEvent(calendarId, eventId) {
    await this.#api.delete(
      `${config.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`
      + `/events/${encodeURIComponent(eventId)}`
    );
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
  /**
   * Every calendar on the account's list.
   *
   * Read with the same read-only scope the presence check uses, and
   * for one job only: finding a calendar Mirra made and then lost
   * track of. Mirra cannot open a calendar it did not create, so the
   * list on its own proves nothing — each candidate still has to be
   * asked for directly. What the list gives is the ids to ask about,
   * which is exactly what goes missing when the settings file loses
   * its calendar.
   *
   * @returns {Promise<object[]>} id, summary, owner and hidden
   */
  async listEntries() {
    const found = [];
    let token = "";

    for (let page = 0; page < 10; page += 1) {
      const url = `${config.CALENDAR_API}/users/me/calendarList?maxResults=250`
        + (token ? `&pageToken=${encodeURIComponent(token)}` : "");

      const answer = await this.#api.get(url);

      for (const entry of answer?.items ?? []) {
        found.push({
          id: entry?.id ?? "",
          summary: entry?.summary ?? "",
          timeZone: entry?.timeZone ?? "",
          owner: entry?.accessRole === "owner",
          hidden: entry?.hidden === true,
        });
      }

      token = answer?.nextPageToken ?? "";
      if (!token) break;
    }

    return found;
  }

  /**
   * Which of those calendars Mirra is actually allowed to open.
   *
   * The scope Mirra holds reaches only the calendars it created
   * itself, so asking is the test: the ones that answer are its own,
   * and the ones that refuse belong to somebody else's life — work,
   * a shared family calendar, the holidays Google adds.
   *
   * Refusals are expected here and are not errors, so they are
   * swallowed rather than reported. A refusal is the answer.
   *
   * @returns {Promise<object[]>}
   */
  async findOwn() {
    const entries = await this.listEntries();

    /* Secondary calendars only. The primary one is the account
       itself, named for the address, and Mirra never made it. */
    const candidates = entries.filter(entry =>
      entry.owner && entry.id && entry.id !== "primary" && !entry.id.includes("@gmail.")
      && entry.id.endsWith("@group.calendar.google.com"));

    const mine = [];

    for (const entry of candidates) {
      try {
        const live = await this.#api.get(
          `${config.CALENDAR_API}/calendars/${encodeURIComponent(entry.id)}`
        );

        mine.push({ ...CalendarRepository.#record(live), hidden: entry.hidden });
      } catch {
        /* Not ours. That is what we came to find out. */
      }
    }

    return mine;
  }

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
  /**
   * Statuses that are an answer about the calendar rather than about
   * the request. Deliberately without 403: see get().
   */
  static GONE = Object.freeze([404, 410]);

  /**
   * One event, reduced to what the calendar screens use.
   *
   * An all-day event has a date and no time — a birthday, a holiday,
   * somebody's note to themselves. It is kept and marked rather than
   * dropped: it belongs at the top of the day, not in the hours.
   *
   * What Mirra itself wrote lives in extendedProperties.private, where
   * only this application can see it. That is where a break says it is
   * a break, and where an appointment remembers which client it is
   * for and which sheet that client lives in.
   */
  static #event(raw) {
    const mine = raw?.extendedProperties?.private ?? {};

    return {
      id: raw?.id ?? "",
      title: raw?.summary ?? "",
      comment: raw?.description ?? "",
      /* When Google last touched it. Two reads of the same stretch
         can be compared on this alone, without looking at a single
         field inside them. */
      updated: raw?.updated ?? "",
      start: raw?.start?.dateTime ?? raw?.start?.date ?? "",
      end: raw?.end?.dateTime ?? raw?.end?.date ?? "",
      allDay: !raw?.start?.dateTime,
      kind: mine.kind === "break" ? "break" : "visit",
      /* A list from the first version, holding one. */
      clients: mine.clients ? mine.clients.split(",").filter(Boolean) : [],
      sheetId: mine.sheet ?? "",
      /* null, not the setting: "this visit never recorded one" and
         "this visit holds no time after it" are different facts, and
         only the caller knows what to put in place of the first. */
      gap: mine.gap === undefined ? null : Number(mine.gap),
      offSchedule: mine.workday === "once",
      allowOverlap: mine.overlap === "allowed",
    };
  }

  static #record(raw) {
    return {
      id: raw?.id ?? "",
      summary: raw?.summary ?? "",
      timeZone: raw?.timeZone ?? "",
    };
  }
}
