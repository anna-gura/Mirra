import { InstallService } from "../services/InstallService.js";

/**
 * InstallPrompt — the offer to add Mirra to a device.
 *
 * One tap wherever one tap is possible. If the browser will show its
 * own install dialog, the button opens it directly — no sheet of ours
 * in between, because a screen that exists only to say "press the next
 * button" is a screen that teaches people to stop reading.
 *
 * The sheet appears only where no dialog exists. On an iPhone that is
 * always: Safari offers no install prompt at all, so the steps have to
 * be followed by hand and the most the app can do is show them.
 */
export class InstallPrompt {
  static ICONS = {
    share: "M12 3v12M8.5 6.5 12 3l3.5 3.5|M6 12v8h12v-8",
    add:   "M4 4h16v16H4z|M12 9v6M9 12h6",
    menu:  "M12 6.5h.01M12 12h.01M12 17.5h.01",
  };

  #service;
  #dialog;
  #triggers = [];
  #title;
  #stepsHost;
  #onTriggerClick;
  #busy = false;

  /**
   * @param {object} params
   * @param {InstallService} params.service
   * @param {string} [params.triggerSelector]
   * @param {string} [params.dialogSelector]
   */
  constructor({
    service,
    triggerSelector = "[data-install]",
    dialogSelector = "[data-install-sheet]",
  }) {
    this.#service = service;
    this.#dialog = document.querySelector(dialogSelector);
    this.#triggers = Array.from(document.querySelectorAll(triggerSelector));

    if (this.#dialog) {
      this.#title     = this.#dialog.querySelector("[data-install-title]");
      this.#stepsHost = this.#dialog.querySelector("[data-install-steps]");
    }

    this.#onTriggerClick = () => this.activate();
  }

  init() {
    this.#triggers.forEach(trigger => trigger.addEventListener("click", this.#onTriggerClick));

    this.#dialog?.querySelector("[data-install-close]")
      ?.addEventListener("click", () => this.#dialog.close());

    this.#dialog?.querySelector("[data-install-never]")
      ?.addEventListener("click", () => {
        this.#service.dismiss();
        this.#dialog.close();
      });

    /* A click on the backdrop has the dialog as its target, since the
       backdrop belongs to the element rather than to the page. */
    this.#dialog?.addEventListener("click", event => {
      if (event.target === this.#dialog) this.#dialog.close();
    });

    this.#service.addEventListener("change", () => this.sync());
    this.sync();

    return this;
  }

  /**
   * The whole interaction: one tap, and the shortest path from there.
   */
  async activate() {
    if (this.#busy) return this;

    if (this.#service.route === InstallService.ROUTE_PROMPT) {
      /* The browser's own dialog is the confirmation, so there is
         nothing to confirm beforehand. */
      this.#busy = true;
      try {
        await this.#service.prompt();
      } finally {
        this.#busy = false;
      }
      return this;
    }

    return this.#openSheet();
  }

  /** Shows or hides every trigger according to what is possible now. */
  sync() {
    const available = this.#service.isAvailable;
    this.#triggers.forEach(trigger => { trigger.hidden = !available; });
    return this;
  }

  destroy() {
    this.#triggers.forEach(trigger =>
      trigger.removeEventListener("click", this.#onTriggerClick));
  }

  /* ---------------- private ---------------- */

  #openSheet() {
    const guide = this.#service.guide;
    if (!this.#dialog) {
      console.error("InstallPrompt: [data-install-sheet] missing from index.html");
      return this;
    }

    if (this.#title) this.#title.textContent = guide.title;
    this.#renderSteps(guide.steps);
    this.#dialog.showModal();

    return this;
  }

  #renderSteps(steps) {
    if (!this.#stepsHost) return;

    this.#stepsHost.replaceChildren(...steps.map((step, index) => {
      const row = document.createElement("div");
      row.className = "install-step";

      const number = document.createElement("span");
      number.className = "install-n";
      number.textContent = String(index + 1);

      const text = document.createElement("span");
      text.className = "install-text";

      /* The <b> in each step is written in this file — these strings
         never come from a user or a sheet, so setting them as markup is
         not the risk it would be anywhere else in the app. */
      text.innerHTML = step.text;

      row.append(number, text);
      if (step.icon) row.append(this.#buildIcon(step.icon));

      return row;
    }));
  }

  #buildIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    for (const d of (InstallPrompt.ICONS[name] ?? "").split("|")) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.append(path);
    }

    return svg;
  }
}
