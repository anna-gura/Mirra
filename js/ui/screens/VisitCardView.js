import { t } from "../../locales/t.js";

/**
 * VisitCardView — one appointment, to look at.
 *
 * The reading half of a pair, the same way a client has a card and a
 * form. Nothing here can be typed into, which is the point: the hour
 * was a button in an earlier draft of this screen, and somebody who
 * changed it and pressed Назад would have left sure the appointment
 * had moved. A screen with nothing to lose cannot lose it.
 *
 * What it does hold is one way out to the person — her name, and one
 * action beside it. Everything in that row is about her; everything
 * about the appointment is at the foot, where the same pair sits on a
 * client's card and means the same two things.
 */
export class VisitCardView {
  #root;
  #time;
  #day;
  #who;
  #comment;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="visit-card"]' } = {}) {
    this.#root = document.querySelector(selector);
  }

  init() {
    if (!this.#root) return this;

    this.#time = this.#root.querySelector("[data-card-time]");
    this.#day = this.#root.querySelector("[data-card-day]");
    this.#who = this.#root.querySelector("[data-card-who]");
    this.#comment = this.#root.querySelector("[data-card-comment]");

    return this;
  }

  /**
   * @param {object} visit
   * @param {string} visit.time "14:00–15:50", already in the reader's
   *        language
   * @param {string} visit.day  "пʼятниця, 13 листопада"
   * @param {object|null} [visit.client] id, name and a phone, when the
   *        appointment is linked to somebody in the sheet
   * @param {string} [visit.title] what the event is called in Google,
   *        shown when it is linked to nobody
   * @param {string} [visit.comment]
   */
  show({ time, day, client = null, title = "", comment = "" }) {
    if (this.#time) this.#time.textContent = time;
    if (this.#day) this.#day.textContent = day;

    this.#showWho(client, title);

    if (this.#comment) {
      this.#comment.textContent = comment;
      this.#comment.hidden = !comment;
    }

    return this;
  }

  /* ---------------- private ---------------- */

  /**
   * Either the person, or what the entry calls itself.
   *
   * An appointment written by hand in Google Calendar belongs to
   * nobody in the sheet, and there is nowhere for the row to lead. It
   * says what it is called instead — which is all anybody knows about
   * it — until there is a way to link it to a client.
   *
   * @param {object|null} client
   * @param {string} title
   */
  #showWho(client, title) {
    const host = this.#who;
    if (!host) return;

    if (!client) {
      const plain = document.createElement("p");
      plain.className = "vc-title";
      plain.textContent = title || t("Без імені");

      host.replaceChildren(plain);
      return;
    }

    host.replaceChildren(VisitCardView.#person(client), VisitCardView.#write(client));
  }

  /** The wide half of the row: who it is, and the way to her card. */
  static #person(client) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vf-client vc-person";
    button.dataset.visitClient = "";

    const mark = document.createElement("span");
    mark.className = "vf-initials";
    mark.textContent = VisitCardView.#initials(client.name);

    const name = document.createElement("span");
    name.className = "vf-name";
    name.textContent = client.name;

    button.append(mark, name);
    return button;
  }

  /**
   * The square half: a message, which is what people actually send
   * about an appointment — "затримуюсь на десять хвилин" is typed far
   * more often than it is said.
   *
   * An anchor rather than a button, like the ones on a client's card,
   * so the phone decides which app opens. Without a number it stays
   * exactly where it is and goes dim: a control that disappears reads
   * as something broken, and the shape of the screen should not
   * depend on what is in the spreadsheet.
   */
  static #write(client) {
    const link = document.createElement("a");
    link.className = "tile-square vc-write";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d",
      "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20.5l1.6-4.8A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z");
    icon.append(path);

    const label = document.createElement("span");
    label.textContent = t("Написати");

    if (client.sms) {
      link.href = client.sms;
    } else {
      link.classList.add("is-off");
      link.setAttribute("aria-disabled", "true");
    }

    link.append(icon, label);
    return link;
  }

  /** One letter from each of the first two words. */
  static #initials(name) {
    return (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0].toLocaleUpperCase("uk"))
      .join("");
  }
}
