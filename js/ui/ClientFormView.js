import { SocialCatalog } from "../domain/SocialCatalog.js";
import { SelectMenu } from "./SelectMenu.js";
import { DatePicker } from "./DatePicker.js";
import { PhoneInput } from "./PhoneInput.js";
import { NameInput } from "./NameInput.js";

/**
 * ClientFormView — the screen where a client is written.
 *
 * Nothing is saved until Зберегти is pressed. That is deliberate: an
 * autosaving form sends a request on every keystroke pause, and on a
 * phone in a salon — one hand, patchy signal, a client waiting — a
 * half-typed name reaching the sheet is worse than an extra tap.
 *
 * Networks are chosen from a list rather than typed. Free text means
 * "Инстаграм", "instagramm" and "инста" all end up in the same column
 * meaning the same thing and matching nothing, and no amount of
 * forgiving parsing afterwards is as good as not creating the problem.
 */
export class ClientFormView extends EventTarget {
  #root;
  #title;
  #socialRows;
  #messengerRows;
  #extraFields;
  #scroller;
  #fields = new Map();
  #menus = [];
  #datePickers = new Map();
  #phoneInput = null;
  #nameInputs = [];
  #draft = null;
  #onClick;
  #onInput;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = '[data-view="form"]' } = {}) {
    super();
    this.#root = document.querySelector(selector);
    if (!this.#root) {
      console.error(`ClientFormView: ${selector} not found — is views/client-form.tpl in place?`);
      return;
    }

    this.#title         = this.#root.querySelector("[data-form-title]");
    this.#socialRows    = this.#root.querySelector("[data-social-rows]");
    this.#messengerRows = this.#root.querySelector("[data-messenger-rows]");
    this.#extraFields   = this.#root.querySelector("[data-extra-fields]");
    this.#scroller      = this.#root.querySelector("[data-scroll]");

    this.#root.querySelectorAll("[data-field]").forEach(input => {
      this.#fields.set(input.dataset.field, input);
    });

    this.#mountPhoneInput();
    this.#mountNameInputs();

    this.#onClick = event => this.#handleClick(event);
    this.#onInput = event => this.#handleInput(event);
  }

  /**
   * Built once and kept. Like the calendar, only its value changes
   * between clients, and rebuilding it would drop its listeners.
   */
  #mountPhoneInput() {
    const input = this.#fields.get("phone");
    const ghost = this.#root.querySelector("[data-phone-ghost]");

    if (!input || !ghost) {
      console.error(
        "ClientFormView: the phone field is missing its ghost layer — " +
        "is views/client-form.tpl up to date?"
      );
      return;
    }

    this.#phoneInput = new PhoneInput({ input, ghost }).init();
    this.#phoneInput.addEventListener("change", event => {
      if (this.#draft) this.#draft.phone = event.detail.value;
    });
  }

  /**
   * Given name and surname are capitalised as they are typed.
   *
   * They are what the list sorts and groups by, so a lowercase entry
   * lands under a heading of its own and looks like a separate letter.
   */
  #mountNameInputs() {
    this.#nameInputs = ["firstName", "lastName"]
      .map(field => this.#fields.get(field))
      .filter(Boolean)
      .map(input => new NameInput(input).init());
  }

  init() {
    if (!this.#root) return this;
    this.#root.addEventListener("click", this.#onClick);
    this.#root.addEventListener("input", this.#onInput);
    this.#root.addEventListener("change", this.#onInput);
    return this;
  }

  /** @returns {import("../domain/ClientDraft.js").ClientDraft|null} */
  get draft() {
    return this.#draft;
  }

  /**
   * @param {import("../domain/ClientDraft.js").ClientDraft} draft
   */
  render(draft) {
    if (!this.#root) return this;

    this.#draft = draft;
    this.#title.textContent = draft.isNew ? "Новий клієнт" : "Редагувати";

    this.#setValue("firstName", draft.firstName);
    this.#setValue("lastName", draft.lastName);
    /* Falls back to a plain field if the masking layer never mounted,
       so a stale template degrades to something usable rather than to
       an input that silently ignores what is typed into it. */
    if (this.#phoneInput) this.#phoneInput.value = draft.phone;
    else this.#setValue("phone", draft.phone);
    this.#renderDates(draft);
    this.#setValue("notes", draft.notes);

    this.#renderEntries(this.#socialRows, draft.socials, "social");
    this.#renderEntries(this.#messengerRows, draft.messengers, "messenger");
    this.#renderExtras(draft.extras);

    if (this.#scroller) this.#scroller.scrollTop = 0;
    this.#focusFirst();

    return this;
  }

  clear() {
    this.#draft = null;
    return this;
  }

  destroy() {
    this.#menus.forEach(entry => entry.menu.destroy());
    this.#menus = [];
    this.#datePickers.forEach(picker => picker.destroy());
    this.#datePickers.clear();
    this.#root?.removeEventListener("click", this.#onClick);
    this.#root?.removeEventListener("input", this.#onInput);
    this.#root?.removeEventListener("change", this.#onInput);
  }

  /* ---------------- events ---------------- */

  #handleClick(event) {
    const remove = event.target.closest("[data-remove-entry]");
    if (remove) return this.#removeEntry(remove);

    if (event.target.closest("[data-add-social]")) {
      return this.#addEntry(this.#draft?.socials, this.#socialRows, "social");
    }
    if (event.target.closest("[data-add-messenger]")) {
      return this.#addEntry(this.#draft?.messengers, this.#messengerRows, "messenger");
    }
  }

  /**
   * Every edit lands straight on the draft.
   *
   * The draft is not the sheet, so this costs nothing and means the
   * form has no separate copy of the truth to fall out of step with.
   */
  #handleInput(event) {
    if (!this.#draft) return;
    const target = event.target;

    if (target.dataset.field) {
      this.#draft[target.dataset.field] = target.value;
      return;
    }

    if (target.dataset.entryKind) {
      const list = this.#listFor(target.dataset.entryKind);
      const entry = list?.[Number(target.dataset.entryIndex)];
      if (entry) entry.handle = target.value;
      return;
    }

    if (target.dataset.extraIndex !== undefined) {
      const extra = this.#draft.extras.find(
        item => item.index === Number(target.dataset.extraIndex)
      );
      if (extra) extra.value = target.value;
    }
  }

  /* ---------------- building ---------------- */

  #renderEntries(host, entries, kind) {
    if (!host) return;

    /* Menus hold a document listener while open, so they are released
       before the rows holding them are thrown away. */
    this.#releaseMenus(host);

    host.replaceChildren(
      ...entries.map((entry, index) => this.#buildEntryRow(entry, index, kind, host))
    );
  }

  /**
   * @param {object} entry
   * @param {number} index
   * @param {string} kind
   * @param {HTMLElement} host the container, remembered so the menu can
   *        be released when these rows are replaced
   */
  #buildEntryRow(entry, index, kind, host) {
    const row = document.createElement("div");
    row.className = "fm-entry";

    const menu = new SelectMenu({
      options: SocialCatalog.byKind(kind).map(network => ({
        value: network.id,
        label: network.label,
      })),
      value: entry.id,
      ariaLabel: kind === "social" ? "Соцмережа" : "Месенджер",
    });

    menu.addEventListener("change", event => {
      entry.id = event.detail.value;
      this.#syncPlaceholder(row, entry.id);
    });

    this.#menus.push({ host, menu });

    const handle = document.createElement("input");
    handle.className = "fm-input fm-handle";
    handle.type = "text";
    handle.value = entry.handle;
    handle.maxLength = 64;
    handle.autocomplete = "off";
    handle.spellcheck = false;
    handle.dataset.entryKind = kind;
    handle.dataset.entryIndex = String(index);
    handle.dataset.entryPart = "handle";

    /* The placeholder follows the chosen network, so it asks for a
       number where a number is meant and a name where a name is. */
    const network = SocialCatalog.find(entry.id);
    handle.placeholder = network?.input === "phone" ? "+380 67 123 45 67" : "@нік";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "fm-remove";
    remove.dataset.removeEntry = kind;
    remove.dataset.entryIndex = String(index);
    remove.setAttribute("aria-label", "Прибрати");
    remove.textContent = "×";

    row.append(menu.element, handle, remove);
    return row;
  }

  /**
   * One picker per date field, keyed by the draft property it writes to.
   *
   * Each is built once and reused. Rebuilding per client would throw
   * away a live document listener each time and leave the focus ring
   * pointing at an element no longer in the page.
   */
  #renderDates(draft) {
    for (const mount of this.#root.querySelectorAll("[data-date-mount]")) {
      const field = mount.dataset.dateMount;
      if (!field) continue;

      let picker = this.#datePickers.get(field);

      if (!picker) {
        picker = new DatePicker({
          value: draft[field] ?? "",
          allowNoYear: field === "birthday",
        });
        picker.addEventListener("change", event => {
          if (this.#draft) this.#draft[field] = event.detail.value;
        });

        mount.replaceChildren(picker.element);
        this.#datePickers.set(field, picker);
        continue;
      }

      picker.value = draft[field] ?? "";
    }
  }

  #renderExtras(extras) {
    if (!this.#extraFields) return;

    this.#extraFields.replaceChildren(...extras.map(extra => {
      const label = document.createElement("label");
      label.className = "fm-field";

      const caption = document.createElement("span");
      caption.className = "fm-label";
      caption.textContent = extra.label;

      const input = document.createElement("input");
      input.className = "fm-input";
      input.type = "text";
      input.value = extra.value;
      input.maxLength = 200;
      input.dataset.extraIndex = String(extra.index);

      label.append(caption, input);
      return label;
    }));
  }

  /* ---------------- entries ---------------- */

  #addEntry(list, host, kind) {
    if (!list) return;

    const first = SocialCatalog.byKind(kind)[0];
    list.push({ id: first.id, handle: "" });
    this.#renderEntries(host, list, kind);

    /* Focus lands on the new field, so adding one is a single motion
       rather than tap-add then tap-into. */
    host.querySelector(".fm-entry:last-child .fm-handle")?.focus();
  }

  #removeEntry(button) {
    const list = this.#listFor(button.dataset.removeEntry);
    if (!list) return;

    list.splice(Number(button.dataset.entryIndex), 1);

    const kind = button.dataset.removeEntry;
    this.#renderEntries(kind === "social" ? this.#socialRows : this.#messengerRows, list, kind);
  }

  /** Keeps the hint in step with whichever network is chosen. */
  #syncPlaceholder(row, networkId) {
    const network = SocialCatalog.find(networkId);
    const handle = row.querySelector(".fm-handle");
    if (handle) {
      handle.placeholder = network?.input === "phone" ? "+380 67 123 45 67" : "@нік";
    }
  }

  #releaseMenus(host) {
    this.#menus = this.#menus.filter(entry => {
      if (entry.host !== host) return true;
      entry.menu.destroy();
      return false;
    });
  }

  #listFor(kind) {
    if (!this.#draft) return null;
    return kind === "social" ? this.#draft.socials : this.#draft.messengers;
  }

  /* ---------------- helpers ---------------- */

  #setValue(field, value) {
    const input = this.#fields.get(field);
    if (input) input.value = value ?? "";
  }

  #focusFirst() {
    if (!this.#draft?.isNew) return;
    /* Only for a new client: on an edit the reader wants to see what is
       there before the keyboard covers half the screen. */
    this.#fields.get("firstName")?.focus();
  }
}
