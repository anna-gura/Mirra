/**
 * ConfirmDialog — asks before something irreversible happens.
 *
 * Built on <dialog> rather than a hand-made overlay. The element
 * already does the parts that are easy to get wrong and invisible when
 * they are: it traps focus inside itself, closes on Escape, makes the
 * rest of the page inert, and returns focus where it came from. A div
 * with a high z-index does none of that, and the difference only shows
 * up for someone using a keyboard or a screen reader.
 *
 * ask() resolves to true or false, so a caller reads as a sentence:
 * if the person said yes, do the thing.
 */
export class ConfirmDialog {
  #element;
  #title;
  #message;
  #note;
  #confirm;
  #cancel;
  #options;
  #resolve = null;

  /**
   * @param {object} [options]
   * @param {string} [options.selector]
   */
  constructor({ selector = "[data-confirm]" } = {}) {
    this.#element = document.querySelector(selector);
    if (!this.#element) {
      console.error(`ConfirmDialog: ${selector} not found in index.html`);
      return;
    }

    this.#title   = this.#element.querySelector("[data-confirm-title]");
    this.#message = this.#element.querySelector("[data-confirm-message]");
    this.#note    = this.#element.querySelector("[data-confirm-note]");
    this.#confirm = this.#element.querySelector("[data-confirm-yes]");
    this.#cancel  = this.#element.querySelector("[data-confirm-no]");
    this.#options = this.#element.querySelector("[data-confirm-options]");

    this.#bind();
  }

  /**
   * @param {object} params
   * @param {string} params.title
   * @param {string} [params.message]      what exactly is affected
   * @param {string} [params.note]         the consequence worth spelling out
   * @param {string} [params.confirmLabel]
   * @param {string} [params.cancelLabel]
   * @param {boolean} [params.danger]      colours the confirm button
   * @returns {Promise<boolean>}
   */
  ask({
    title,
    message = "",
    note = "",
    confirmLabel = "Так",
    cancelLabel = "Скасувати",
    danger = false,
  }) {
    if (!this.#element) return Promise.resolve(false);

    this.#title.textContent = title;
    this.#message.textContent = message;
    this.#message.hidden = !message;
    this.#note.textContent = note;
    this.#note.hidden = !note;

    this.#confirm.textContent = confirmLabel;
    this.#cancel.textContent = cancelLabel;
    this.#confirm.classList.toggle("is-danger", danger);

    if (this.#options) {
      this.#options.hidden = true;
      this.#options.replaceChildren();
    }
    this.#confirm.hidden = false;

    this.#element.showModal();

    /* Focus starts on Cancel, not on the destructive button. Enter is
       pressed reflexively when a dialog appears, and it should not be
       the key that deletes somebody. */
    this.#cancel.focus();

    return new Promise(resolve => { this.#resolve = resolve; });
  }

  /**
   * A question with more than two answers.
   *
   * Separate from ask() rather than a mode of it, because the two
   * differ in what they return: a yes-or-no gives a boolean, this gives
   * the option chosen or null. Folded together, every caller would have
   * to check which kind of answer it got.
   *
   * @param {object} params
   * @param {string} params.title
   * @param {string} [params.message]
   * @param {Array<{id: string, label: string}>} params.options
   * @param {string} [params.cancelLabel]
   * @returns {Promise<string|null>} the chosen id, or null
   */
  choose({ title, message = "", note = "", options, cancelLabel = "Скасувати" }) {
    if (!this.#element || !this.#options) {
      /* Loud, because the caller cannot tell this apart from somebody
         pressing cancel — and a question that silently answers itself
         "no" stops whatever was about to happen for no visible reason. */
      console.error(
        "ConfirmDialog: [data-confirm-options] missing from index.html — " +
        "the question could not be asked"
      );
      return Promise.resolve(undefined);
    }

    this.#title.textContent = title;
    this.#message.textContent = message;
    this.#message.hidden = !message;
    this.#note.textContent = note;
    this.#note.hidden = !note;

    /* The confirm button has nothing to confirm: the options are the
       answers, and a stray "Так" beside them would be a third meaning
       nobody asked for. */
    this.#confirm.hidden = true;
    this.#cancel.textContent = cancelLabel;

    this.#options.hidden = false;
    this.#options.replaceChildren(...options.map(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "confirm-option";
      button.dataset.option = option.id;
      button.textContent = option.label;
      return button;
    }));

    this.#element.showModal();
    this.#cancel.focus();

    return new Promise(resolve => { this.#resolve = resolve; });
  }

  /* ---------------- private ---------------- */

  #bind() {
    this.#confirm.addEventListener("click", () => this.#close(true));

    this.#options?.addEventListener("click", event => {
      const option = event.target.closest("[data-option]");
      if (option) this.#close(option.dataset.option);
    });
    this.#cancel.addEventListener("click", () => this.#close(false));

    /* Escape fires close without going through either button, so the
       promise is settled here rather than in the handlers alone —
       otherwise it would hang and the caller would wait forever. */
    /* Escape and the backdrop both mean "no". For a yes-or-no that is
       false; for a choice it is null, which is what choose() callers
       check for — false would read as an answer. */
    this.#element.addEventListener("close", () =>
      this.#settle(this.#options?.hidden === false ? null : false));

    /* The backdrop is part of the dialog element, so a click that lands
       outside the panel still has the dialog as its target. */
    this.#element.addEventListener("click", event => {
      if (event.target === this.#element) this.#close(false);
    });
  }

  #close(answer) {
    this.#settle(answer);
    this.#element.close();
  }

  #settle(answer) {
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(answer);
  }
}
