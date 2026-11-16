import { t } from "../../locales/t.js";
import { NoteTags } from "../../domain/values/NoteTags.js";

/**
 * VisitFormView — the screen that books somebody in.
 *
 * It holds no times of its own. The day and the slot arrive already
 * decided, from the plus that was pressed, and changing either means
 * going back to the calendar — which is the only place in Mirra where
 * a time is chosen, and the only one that knows what is free.
 *
 * What is left is the client and a comment, and on the commonest path
 * even the client is already there: booking from somebody's card
 * carries them along. That is the whole design. A form that asks four
 * questions to write one appointment is a form people stop using by
 * the third week.
 */
export class VisitFormView {
  /**
   * How many tags are offered under the comment.
   *
   * Three. A row of chips is a shortcut, not a vocabulary: past three
   * it takes longer to read them than to type the word.
   */
  static TAGS_SHOWN = 3;

  /**
   * How long the hour chosen is, against the usual visit.
   *
   * full — nothing is said. tight — amber, this will be quick.
   * short — red, this is half a visit or less, and far more often a
   * mistyped hour than a plan.
   */
  static FITS = new Set(["full", "tight", "short"]);

  #root;
  #fields = {};

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="visit-form"]' } = {}) {
    this.#root = document.querySelector(selector);
  }

  init() {
    if (!this.#root) return this;

    const find = name => this.#root.querySelector(`[data-visit-${name}]`);

    this.#fields = {
      title:    find("title"),
      day:      find("day"),
      time:     find("time"),
      slot:     find("slot"),
      warn:     find("warn"),
      who:      find("who"),
      comment:  find("comment"),
      tags:     find("tags"),
      saveName: find("save-name"),
      saveHint: find("save-hint"),
      remove:   this.#root.querySelector("[data-visit-delete]"),
    };

    return this;
  }

  /**
   * @param {object} visit
   * @param {string} visit.day    "субота, 14 листопада", already in the
   *        reader's language
   * @param {string} visit.time   "11:00–13:00"
   * @param {"full"|"tight"|"short"} [visit.fit] how the hour chosen
   *        measures against the usual visit: amber when it is short,
   *        the same amber the card in the day was, and red at half a
   *        visit or less
   * @param {object|null} [visit.client] as the list holds them
   * @param {string} [visit.comment]
   * @param {string[]} [visit.warnings] said in the form rather than in
   *        a dialog: a warning that has to be dismissed before it can
   *        be read is a warning nobody reads
   * @param {string[]} [visit.tags] offered under the comment
   * @param {boolean} [visit.editing]
   */
  show({ day, time, fit = "full", client = null, comment = "",
         warnings = [], tags = [], editing = false }) {
    const f = this.#fields;

    if (f.title) f.title.textContent = editing ? t("Запис") : t("Новий запис");
    if (f.day) f.day.textContent = day;
    if (f.time) f.time.textContent = time;

    /* Colour on the window itself, not only a line of text below it.
       The hour is what is short, and it is the hour somebody is
       looking at while they decide whether to change it. */
    const level = VisitFormView.FITS.has(fit) ? fit : "full";

    if (f.slot) f.slot.dataset.fit = level;

    /* The lines underneath take the same colour, because they are
       about the same hour. Said once in two places is one warning;
       said in two colours it reads as two. */
    if (f.warn) f.warn.dataset.fit = level;

    if (f.saveName) f.saveName.textContent = editing ? t("Зберегти") : t("Записати");
    if (f.saveHint) {
      f.saveHint.textContent = editing
        ? t("Оновити цей запис у календарі")
        : t("У ваш календар і на телефон");
    }

    if (f.remove) f.remove.hidden = !editing;

    if (f.comment) f.comment.value = comment;

    this.#showWarnings(warnings);
    this.#showClient(client);
    this.#showTags(tags);

    return this;
  }

  /** Just the client row, after somebody has been chosen. */
  setClient(client) {
    this.#showClient(client);
    return this;
  }

  /** @returns {{comment: string}} */
  get values() {
    return { comment: (this.#fields.comment?.value ?? "").trim() };
  }

  /** Focuses what still needs answering, and nothing else. */
  focus() {
    this.#fields.comment?.focus();
    return this;
  }

  /* ---------------- private ---------------- */

  /**
   * Either two buttons or the person who was chosen.
   *
   * Two rather than one with a menu: picking somebody who is already
   * in the list and adding somebody who is not are both common, and
   * neither should be a step deeper than the other.
   */
  #showClient(client) {
    const host = this.#fields.who;
    if (!host) return;

    if (client) {
      host.replaceChildren(VisitFormView.#chosen(client));
      return;
    }

    host.replaceChildren(VisitFormView.#pickButton(), VisitFormView.#newButton());
  }

  static #chosen(client) {
    const row = document.createElement("div");
    row.className = "vf-client";

    const mark = document.createElement("span");
    mark.className = "vf-initials";
    mark.textContent = VisitFormView.#initials(client.name);

    const name = document.createElement("span");
    name.className = "vf-name";
    name.textContent = client.name;

    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "vf-drop-client";
    drop.dataset.visitClear = "";
    drop.setAttribute("aria-label", t("Обрати іншого клієнта"));
    drop.textContent = "✕";

    row.append(mark, name, drop);
    return row;
  }

  static #pickButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action vf-pick";
    button.dataset.visitPick = "";

    const name = document.createElement("span");
    name.className = "action-name";
    name.textContent = t("Обрати клієнта");

    button.append(name);
    return button;
  }

  static #newButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile-square vf-new";
    button.dataset.visitNew = "";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");

    for (const d of ["M9.5 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z",
                     "M3.2 20c0-3.3 2.8-5.6 6.3-5.6 1.3 0 2.5.3 3.5.9",
                     "M17.5 14.5v6M14.5 17.5h6"]) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      icon.append(path);
    }

    /* One phrase rather than two words joined by a line break: the
       break belongs to the box being narrow, not to the sentence, and
       a dictionary with "Створити" in it on its own would translate
       the wrong "create" somewhere else. */
    const label = document.createElement("span");
    label.textContent = t("Створити клієнта");

    button.append(icon, label);
    return button;
  }

  /**
   * The tags people put on visits, offered as a row of chips.
   *
   * From visits, never from the notes in client cards: those two say
   * different things. A note records what somebody is like — thick
   * hair, comes with a friend — and a visit records what was done.
   * Offering one in place of the other turns both into noise by the
   * time anything counts them.
   */
  #showTags(tags) {
    const host = this.#fields.tags;
    if (!host) return;

    const chips = tags.slice(0, VisitFormView.TAGS_SHOWN).map(tag => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "vf-tag";
      chip.dataset.visitTag = tag;
      chip.textContent = tag;
      return chip;
    });

    host.replaceChildren(...chips);
  }

  /** Adds a tag to the comment, where it reads as part of the sentence. */
  addTag(tag) {
    const field = this.#fields.comment;
    if (!field) return this;

    const already = NoteTags.parse(field.value);
    if (already.includes(tag.toLocaleLowerCase("uk"))) return this;

    const text = field.value.trim();
    field.value = text ? `${text} ${tag}` : tag;
    field.focus();

    return this;
  }

  #showWarnings(warnings) {
    const host = this.#fields.warn;
    if (!host) return;

    host.hidden = warnings.length === 0;
    host.replaceChildren(...warnings.map(text => {
      const line = document.createElement("span");
      line.textContent = text;
      return line;
    }));
  }

  /** @param {string} name @returns {string} one or two letters */
  static #initials(name) {
    const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";

    return words.slice(0, 2).map(word => word[0].toLocaleUpperCase("uk")).join("");
  }
}
