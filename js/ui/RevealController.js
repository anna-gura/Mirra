/**
 * RevealController — opens and closes the explanation panel.
 *
 * There is no scrolling: both screens sit on one rail and a class on
 * the stage slides it by exactly one screen height. The controller
 * also handles the accessibility side of that illusion — the screen
 * that is off-view becomes inert, and focus moves with the panel so
 * keyboard users are never left pressing buttons they cannot see.
 */
export class RevealController {
  static OPEN_CLASS = "is-open";

  #stage;
  #mainScreen;
  #panelScreen;
  #openTriggers = [];
  #closeTriggers = [];
  #isOpen = false;
  #onOpen;
  #onClose;
  #onKeydown;

  /**
   * @param {object} options
   * @param {HTMLElement} options.stage       element the state class goes on
   * @param {string} [options.openSelector]   buttons that open the panel
   * @param {string} [options.closeSelector]  buttons that close it
   * @param {string} [options.mainSelector]   the upper screen
   * @param {string} [options.panelSelector]  the lower screen
   */
  constructor({
    stage,
    openSelector  = "[data-reveal-open]",
    closeSelector = "[data-reveal-close]",
    mainSelector  = '[data-screen="main"]',
    panelSelector = '[data-screen="panel"]',
  }) {
    if (!stage) throw new Error("RevealController: stage is required");

    this.#stage = stage;
    this.#mainScreen  = stage.querySelector(mainSelector);
    this.#panelScreen = stage.querySelector(panelSelector);
    this.#openTriggers  = Array.from(stage.querySelectorAll(openSelector));
    this.#closeTriggers = Array.from(stage.querySelectorAll(closeSelector));

    this.#onOpen  = () => this.open();
    this.#onClose = () => this.close();
    this.#onKeydown = event => {
      if (event.key === "Escape" && this.#isOpen) this.close();
    };
  }

  init() {
    this.#openTriggers.forEach(btn => btn.addEventListener("click", this.#onOpen));
    this.#closeTriggers.forEach(btn => btn.addEventListener("click", this.#onClose));
    document.addEventListener("keydown", this.#onKeydown);
    this.#sync({ moveFocus: false });
    return this;
  }

  /** @returns {boolean} */
  get isOpen() {
    return this.#isOpen;
  }

  open() {
    if (this.#isOpen) return this;
    this.#isOpen = true;
    this.#sync({ moveFocus: true });
    return this;
  }

  close() {
    if (!this.#isOpen) return this;
    this.#isOpen = false;
    this.#sync({ moveFocus: true });
    return this;
  }

  toggle() {
    return this.#isOpen ? this.close() : this.open();
  }

  destroy() {
    this.#openTriggers.forEach(btn => btn.removeEventListener("click", this.#onOpen));
    this.#closeTriggers.forEach(btn => btn.removeEventListener("click", this.#onClose));
    document.removeEventListener("keydown", this.#onKeydown);
  }

  /* ---------------- private ---------------- */

  /** Brings the DOM in line with the current state. */
  #sync({ moveFocus }) {
    this.#stage.classList.toggle(RevealController.OPEN_CLASS, this.#isOpen);

    this.#openTriggers.forEach(btn =>
      btn.setAttribute("aria-expanded", String(this.#isOpen)));

    if (this.#mainScreen)  this.#mainScreen.inert  = this.#isOpen;
    if (this.#panelScreen) this.#panelScreen.inert = !this.#isOpen;

    if (moveFocus) this.#focusTarget()?.focus({ preventScroll: true });
  }

  #focusTarget() {
    return this.#isOpen ? this.#closeTriggers[0] : this.#openTriggers[0];
  }
}
