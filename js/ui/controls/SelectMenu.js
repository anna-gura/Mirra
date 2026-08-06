/**
 * SelectMenu — a dropdown that matches the rest of Mirra.
 *
 * A native <select> is replaced reluctantly. On a phone it opens the
 * operating system's own picker, which is familiar and hard to beat,
 * and its open list cannot be styled at all — which is exactly the
 * problem: half the control follows the app's design and the other
 * half does not, and the seam is visible.
 *
 * What is given up is regained deliberately. Options are 48px tall so
 * they are no harder to hit than a system picker; the keyboard works
 * the way a select does — arrows, Home, End, Enter, Escape — and the
 * roles are spelled out so a screen reader announces a listbox rather
 * than a pile of divs.
 */
export class SelectMenu extends EventTarget {
  /** Only one menu is ever open; opening a second closes the first. */
  static #open = null;

  #element;
  #trigger;
  #label;
  #panel;
  #options;
  #value;
  #isOpen = false;
  #onDocumentPointer;
  #onKeydown;

  /**
   * @param {object} params
   * @param {Array<{value: string, label: string}>} params.options
   * @param {string} [params.value]     initially selected
   * @param {string} [params.ariaLabel]
   */
  constructor({ options, value, ariaLabel = "Вибір" }) {
    super();
    this.#options = options;
    this.#value = value ?? options[0]?.value ?? "";

    this.#element = document.createElement("div");
    this.#element.className = "sel";

    this.#trigger = document.createElement("button");
    this.#trigger.type = "button";
    this.#trigger.className = "sel-trigger";
    this.#trigger.setAttribute("aria-haspopup", "listbox");
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#trigger.setAttribute("aria-label", ariaLabel);

    this.#label = document.createElement("span");
    this.#label.className = "sel-label";
    this.#trigger.append(this.#label, this.#buildChevron());

    this.#panel = document.createElement("div");
    this.#panel.className = "sel-panel";
    this.#panel.setAttribute("role", "listbox");
    this.#panel.hidden = true;

    this.#element.append(this.#trigger, this.#panel);

    this.#bind();
    this.#renderOptions();
    this.#syncLabel();
  }

  /** @returns {HTMLElement} the node to insert into the page */
  get element() {
    return this.#element;
  }

  /** @returns {string} */
  get value() {
    return this.#value;
  }

  /** @param {string} next */
  set value(next) {
    if (!this.#options.some(option => option.value === next)) return;
    this.#value = next;
    this.#renderOptions();
    this.#syncLabel();
  }

  open() {
    if (this.#isOpen) return this;

    SelectMenu.#open?.close();
    SelectMenu.#open = this;

    this.#isOpen = true;
    this.#panel.hidden = false;
    this.#trigger.setAttribute("aria-expanded", "true");
    this.#element.classList.add("is-open");

    /* Registered only while open, and on pointerdown rather than click
       so the menu is already gone by the time whatever was underneath
       receives its own event. */
    document.addEventListener("pointerdown", this.#onDocumentPointer, true);
    document.addEventListener("keydown", this.#onKeydown, true);

    this.#currentOption()?.focus();
    return this;
  }

  close() {
    if (!this.#isOpen) return this;

    this.#isOpen = false;
    this.#panel.hidden = true;
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#element.classList.remove("is-open");

    document.removeEventListener("pointerdown", this.#onDocumentPointer, true);
    document.removeEventListener("keydown", this.#onKeydown, true);

    if (SelectMenu.#open === this) SelectMenu.#open = null;
    return this;
  }

  /** Releases the document listeners this instance may hold. */
  destroy() {
    this.close();
  }

  /** Closes whichever menu is open. Called before rebuilding a form. */
  static closeAny() {
    SelectMenu.#open?.close();
  }

  /* ---------------- private ---------------- */

  #bind() {
    this.#trigger.addEventListener("click", () => {
      this.#isOpen ? this.close() : this.open();
    });

    this.#panel.addEventListener("click", event => {
      const option = event.target.closest("[data-value]");
      if (option) this.#choose(option.dataset.value);
    });

    this.#onDocumentPointer = event => {
      if (!this.#element.contains(event.target)) this.close();
    };

    this.#onKeydown = event => this.#handleKey(event);
  }

  #handleKey(event) {
    if (!this.#isOpen) return;

    const options = [...this.#panel.querySelectorAll("[data-value]")];
    const current = options.indexOf(document.activeElement);

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.close();
        this.#trigger.focus();
        break;

      case "ArrowDown":
        event.preventDefault();
        options[Math.min(current + 1, options.length - 1)]?.focus();
        break;

      case "ArrowUp":
        event.preventDefault();
        options[Math.max(current - 1, 0)]?.focus();
        break;

      case "Home":
        event.preventDefault();
        options[0]?.focus();
        break;

      case "End":
        event.preventDefault();
        options.at(-1)?.focus();
        break;

      case "Enter":
      case " ":
        if (current >= 0) {
          event.preventDefault();
          this.#choose(options[current].dataset.value);
        }
        break;
    }
  }

  #choose(value) {
    const changed = value !== this.#value;
    this.#value = value;

    this.#renderOptions();
    this.#syncLabel();
    this.close();
    this.#trigger.focus();

    if (changed) {
      this.dispatchEvent(new CustomEvent("change", { detail: { value } }));
    }
  }

  #renderOptions() {
    this.#panel.replaceChildren(...this.#options.map(option => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sel-option";
      item.dataset.value = option.value;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.value === this.#value));
      item.textContent = option.label;
      return item;
    }));
  }

  #syncLabel() {
    const selected = this.#options.find(option => option.value === this.#value);
    this.#label.textContent = selected?.label ?? "";
  }

  #currentOption() {
    return this.#panel.querySelector(`[data-value="${this.#value}"]`)
        ?? this.#panel.firstElementChild;
  }

  #buildChevron() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "sel-chev");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M6 9.5 12 15.5 18 9.5");
    svg.append(path);

    return svg;
  }
}
