import { SocialCatalog } from "../domain/SocialCatalog.js";
import { DateValue } from "../domain/DateValue.js";
import { NoteTags } from "../domain/NoteTags.js";

/**
 * ClientCardView — renders one person.
 *
 * Handles are shown as real links, built from the catalogue rather than
 * stored in the sheet. Keeping addresses out of the data means a
 * network changing its URL is a change here, not a migration of
 * everyone's spreadsheet — and it keeps the cell readable for someone
 * who opens the file in Sheets.
 *
 * The folding panels animate an explicit height because `auto` is not
 * an animatable length. Each panel is measured when it opens, so it
 * fits its contents rather than a guess.
 */
export class ClientCardView extends EventTarget {
  #root;
  #name;
  #phone;
  #birthdayLine;
  #socials;
  #socialsSummary;
  #messengers;
  #messengersSummary;
  #extra;
  #scroller;
  #call;
  #sms;
  #moreLabel;
  #client = null;
  #onFoldClick;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="client"]' } = {}) {
    super();
    this.#root = document.querySelector(selector);
    if (!this.#root) {
      console.error(`ClientCardView: ${selector} not found — is views/client.html in place?`);
      return;
    }

    this.#name              = this.#find("[data-client-name]");
    this.#phone             = this.#find("[data-client-phone]");
    this.#birthdayLine      = this.#root.querySelector("[data-client-birthday]");
    this.#socials           = this.#find("[data-socials]");
    this.#socialsSummary    = this.#find("[data-socials-summary]");
    this.#messengers        = this.#find("[data-messengers]");
    this.#messengersSummary = this.#find("[data-messengers-summary]");
    this.#extra             = this.#find("[data-extra]");
    this.#call              = this.#find("[data-action-call]");
    this.#sms               = this.#find("[data-action-sms]");
    this.#moreLabel         = this.#root.querySelector("[data-more-label]");
    this.#scroller          = this.#root.querySelector("[data-scroll]");

    this.#onFoldClick = event => {
      const tag = event.target.closest("[data-tag]");
      if (tag) {
        this.dispatchEvent(new CustomEvent("tag", { detail: { tag: tag.dataset.tag } }));
        return;
      }

      const trigger = event.target.closest("[data-fold]");
      if (trigger) this.#toggleFold(trigger);
    };
  }

  /**
   * Looks up a required element and says so when it is absent.
   *
   * The markup lives in views/client.html and arrives at runtime, so it
   * can be out of step with this class in a way the code cannot prevent.
   * A named warning costs one line and turns "Cannot set properties of
   * null" into a sentence that says which element is missing.
   *
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  #find(selector) {
    const element = this.#root.querySelector(selector);
    if (!element) console.error(`ClientCardView: ${selector} missing from views/client.html`);
    return element;
  }

  init() {
    this.#root?.addEventListener("click", this.#onFoldClick);
    return this;
  }

  /** @returns {import("../domain/Client.js").Client|null} */
  get client() {
    return this.#client;
  }

  /**
   * How ambiguous dates should be read. Set by the application from
   * settings; the view has no business fetching it itself.
   * @type {string}
   */
  dateFormat = DateValue.DEFAULT_FORMAT;

  /**
   * @param {import("../domain/Client.js").Client} client
   */
  render(client) {
    if (!this.#root) return this;

    this.#client = client;
    this.#closeAllFolds();

    /* Each piece is optional so that markup missing one block still
       renders the rest. A card showing a name and no messengers is
       useful; a card that threw halfway through is not. */
    const phone = client.phoneNumber;

    this.#setText(this.#name, client.displayName);
    this.#showBirthday(client);
    this.#setText(this.#phone, phone.isValid ? phone.display : "Телефон не вказано");
    this.#setAction(this.#call, phone.isValid ? phone.dialUri : null);
    this.#setAction(this.#sms, phone.isValid ? phone.smsUri : null);

    this.#fill(this.#socials, this.#socialsSummary, client.socials, "Не вказано");
    this.#fill(this.#messengers, this.#messengersSummary, client.messengers, "Не вказано");
    this.#fillExtras(client, this.dateFormat);

    if (this.#scroller) this.#scroller.scrollTop = 0;
    return this;
  }

  clear() {
    if (!this.#root) return this;

    this.#client = null;
    this.#setText(this.#name, "—");
    if (this.#birthdayLine) this.#birthdayLine.hidden = true;
    this.#setText(this.#phone, "");
    this.#setAction(this.#call, null);
    this.#setAction(this.#sms, null);
    this.#socials?.replaceChildren();
    this.#messengers?.replaceChildren();
    this.#extra?.replaceChildren();
    this.#closeAllFolds();
    return this;
  }

  /** @param {HTMLElement|null} element @param {string} text */
  #setText(element, text) {
    if (element) element.textContent = text;
  }

  /**
   * Points an action at an address, or takes it out of service.
   *
   * An anchor with no href is not focusable and not clickable, which
   * is exactly right for an action with nothing to act on — the class
   * only makes that visible.
   *
   * @param {HTMLElement|null} element
   * @param {string|null} uri
   */
  #setAction(element, uri) {
    if (!element) return;

    element.classList.toggle("is-off", !uri);

    if (uri) element.href = uri;
    else element.removeAttribute("href");
  }

  destroy() {
    this.#root?.removeEventListener("click", this.#onFoldClick);
  }

  /* ---------------- private ---------------- */

  /**
   * @param {HTMLElement} host
   * @param {HTMLElement} summary
   * @param {import("../domain/SocialCatalog.js").Profile[]} profiles
   * @param {string} emptyText
   */
  #fill(host, summary, profiles, emptyText) {
    this.#setText(summary, profiles.length
      ? profiles.map(profile => profile.network?.label ?? "інше").join(", ")
      : emptyText);

    if (!host) return;

    host.replaceChildren(
      profiles.length
        ? this.#buildProfiles(profiles)
        : this.#buildNone("Тут поки що порожньо.")
    );
  }

  #buildProfiles(profiles) {
    const fragment = document.createDocumentFragment();

    for (const profile of profiles) {
      const link = SocialCatalog.linkFor(profile);
      fragment.append(link ? this.#buildLink(profile, link) : this.#buildPlain(profile));
    }

    return fragment;
  }

  #buildLink(profile, href) {
    const anchor = document.createElement("a");
    anchor.className = "cd-profile";
    anchor.href = href;
    anchor.target = "_blank";
    /* noopener keeps the opened page from reaching back into Mirra
       through window.opener. */
    anchor.rel = "noopener noreferrer";

    const text = document.createElement("span");

    const network = document.createElement("span");
    network.className = "cd-profile-net";
    network.textContent = profile.network.label;

    const handle = document.createElement("span");
    handle.className = "cd-profile-handle";
    handle.textContent = SocialCatalog.display(profile);

    text.append(network, handle);
    anchor.append(text, this.#buildArrow());

    return anchor;
  }

  #buildArrow() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "cd-profile-go");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M7 17 17 7M9 7h8v8");
    svg.append(path);

    return svg;
  }

  #buildPlain(profile) {
    const item = document.createElement("div");
    item.className = "cd-profile-plain";
    item.textContent = profile.raw;
    return item;
  }

  #buildNone(text) {
    const message = document.createElement("p");
    message.className = "cd-none";
    message.textContent = text;
    return message;
  }

  /**
   * @param {import("../domain/Client.js").Client} client
   * @param {string} [dateFormat] how ambiguous dates should be read
   */
  #fillExtras(client, dateFormat) {
    const fields = [];

    if (client.birthday) {
      const date = new DateValue(client.birthday, dateFormat);
      const age = date.age;

      fields.push({
        label: "День народження",
        value: client.birthday,
        date: date.parts(),
        /* No weekday. Which day of the week somebody was born on in 1998
           is a fact about 1998, not about them — where the same detail
           on a recent visit answers a question people actually ask. */
        weekday: false,
        /* Only when a year was written. A birthday recorded as 15.03 is
           perfectly useful for remembering to send a message; it simply
           cannot say how old anyone is. */
        age: age === null ? "" : `${age} ${DateValue.pluraliseYears(age)}`,
      });
    }

    if (client.lastVisit) {
      fields.push({
        label: "Останній візит",
        value: client.lastVisit,
        date: new DateValue(client.lastVisit, dateFormat).parts(),
        soon: "автоматизація згодом",
      });
    }
    /* A note holding nothing but tags leaves no prose behind, and a
       heading over an empty line reads as something failing to load. */
    if (client.notes) {
      /* Both, because they answer different questions. The chips are a
         glance — which categories is this person in — and the note is
         the sentence somebody wrote, which loses its meaning if the
         tagged words are cut out of it. */
      fields.push({
        label: "Нотатки",
        tags: client.tags,
        note: client.notes,
      });
    }
    fields.push(...client.extras);

    if (!this.#extra) return;

    this.#extra.replaceChildren(
      fields.length
        ? this.#buildFields(fields)
        : this.#buildNone("Більше нічого не записано.")
    );
  }

  #buildFields(fields) {
    const fragment = document.createDocumentFragment();

    for (const field of fields) {
      const row = document.createElement("div");
      row.className = "cd-field";

      const label = document.createElement("span");
      label.className = "cd-field-label";
      label.textContent = field.label;

      if (field.soon) label.append(this.#buildSoon(field.soon));
      row.append(label);

      if (field.tags?.length) row.append(this.#buildTags(field.tags));

      if (field.date) {
        row.append(this.#buildDate(field.date, field.age, field.weekday !== false));
      }
      else if (field.note) row.append(this.#buildNote(field.note));
      else if (field.value) row.append(this.#buildValue(field.value));
      fragment.append(row);
    }

    return fragment;
  }

  /**
   * The note as written, with its tags marked where they stand.
   *
   * Built from segments rather than by replacing text, so nothing typed
   * is ever interpreted as markup — the words go in through textContent
   * and only the tags become elements.
   *
   * Tapping a tag returns to the list filtered by it, which is the point
   * of tagging at all: seeing this client reminds you of a category, and
   * the category should be one tap away.
   */
  /**
   * The line under the name, on the days it has something to say.
   *
   * Hidden the rest of the time rather than left empty. A row that is
   * usually blank is a row people stop looking at, and this one only
   * works if it is noticed on the two or three days a year it appears.
   */
  #showBirthday(client) {
    if (!this.#birthdayLine) return;

    const status = client.birthdayStatus(this.dateFormat);

    this.#birthdayLine.textContent = status.message;
    this.#birthdayLine.hidden = !status.message;
    this.#birthdayLine.classList.toggle("is-today", status.isToday);
  }

  /**
   * Tags as chips, for reading at a glance.
   *
   * Tapping one returns to the list filtered by it, which is the point
   * of tagging at all: seeing this client reminds you of a category,
   * and the category should be one tap away.
   */
  #buildTags(tags) {
    const row = document.createElement("div");
    row.className = "cd-tags";

    row.replaceChildren(...tags.map(tag => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cd-chip";
      chip.dataset.tag = tag;
      chip.textContent = tag;
      return chip;
    }));

    return row;
  }

  /**
   * The note as written, with the tagged words picked out by colour.
   *
   * The hash is dropped here and kept on the chips. In a sentence it is
   * punctuation nobody wrote for a reader: "#алергія на аміак" was
   * meant to be read as "алергія на аміак" with one word standing out,
   * and the colour says everything the hash was there to say.
   *
   * Built from segments rather than by replacing text, so nothing typed
   * is ever interpreted as markup — words go in through textContent and
   * only the tags become elements.
   */
  #buildNote(note) {
    const value = document.createElement("span");
    value.className = "cd-field-value cd-note";

    for (const part of NoteTags.segments(note)) {
      if (part.type === "text") {
        value.append(part.value);
        continue;
      }

      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "cd-tag";
      tag.dataset.tag = part.value;
      tag.textContent = part.label;
      value.append(tag);
    }

    return value;
  }

  #buildValue(text) {
    const value = document.createElement("span");
    value.className = "cd-field-value";
    value.textContent = text;
    return value;
  }

  /**
   * A date written the way it would be said aloud.
   *
   * "16 липня (четвер) 2026" answers the question actually being asked
   * — how long ago, and what day of the week — where 16/07/2026 leaves
   * the reader counting. The year is set smaller because it is the
   * part least often needed: a last visit is nearly always this year
   * or the one before.
   */
  #buildDate(parts, age = "", withWeekday = true) {
    const value = document.createElement("span");
    value.className = "cd-field-value cd-date";

    const dayMonth = document.createElement("span");
    dayMonth.textContent = parts.dayMonth;

    value.append(dayMonth);

    /* A date with no year has no weekday either — the 15th of March fell
       on a different day in every year there has been — and an empty
       pair of brackets is worse than saying nothing. */
    if (withWeekday && parts.weekday) {
      const weekday = document.createElement("span");
      weekday.className = "cd-weekday";
      weekday.textContent = `(${parts.weekday})`;
      value.append(" ", weekday);
    }

    if (parts.year) {
      const year = document.createElement("span");
      year.className = "cd-year";
      year.textContent = parts.year;
      value.append(" ", year);
    }

    /* The age set apart from the date rather than folded into it: one is
       what was written down, the other is worked out from it, and they
       should not look like the same kind of fact. */
    if (age) {
      const badge = document.createElement("span");
      badge.className = "cd-age";
      badge.textContent = age;
      value.append(" ", badge);
    }

    return value;
  }

  /**
   * A quiet marker on a field that will do more later.
   *
   * Saying so where the field is beats a changelog nobody reads: it
   * explains why the value sits there doing nothing, and it teaches the
   * shape of the app before the shape arrives.
   */
  #buildSoon(text) {
    const badge = document.createElement("em");
    badge.className = "cd-soon";
    badge.textContent = text;
    return badge;
  }

  /* ---------------- folding ---------------- */

  #toggleFold(trigger) {
    const panel = document.getElementById(trigger.dataset.fold);
    if (!panel) return;

    const isOpen = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!isOpen));
    panel.style.height = isOpen ? "0px" : `${panel.scrollHeight}px`;

    if (trigger.dataset.fold === "fold-extra" && this.#moreLabel) {
      this.#moreLabel.textContent = isOpen ? "Додатково" : "Згорнути";
    }

    /* Додатково sits in the footer while its panel is at the bottom of
       the scrolling area, so opening it can reveal something the reader
       cannot see. Waiting for the animation before scrolling means the
       panel has its full height by the time the browser measures it. */
    if (!isOpen && !this.#isInView(panel)) {
      setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "end" }), 300);
    }
  }

  #isInView(element) {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  }

  #closeAllFolds() {
    this.#root.querySelectorAll("[data-fold]").forEach(trigger => {
      trigger.setAttribute("aria-expanded", "false");
      const panel = document.getElementById(trigger.dataset.fold);
      if (panel) panel.style.height = "0px";
    });
    this.#setText(this.#moreLabel, "Додатково");
  }
}
