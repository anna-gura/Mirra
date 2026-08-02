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

    this.#element.showModal();

    /* Focus starts on Cancel, not on the destructive button. Enter is
       pressed reflexively when a dialog appears, and it should not be
       the key that deletes somebody. */
    this.#cancel.focus();

    return new Promise(resolve => { this.#resolve = resolve; });
  }

  /* ---------------- private ---------------- */

  #bind() {
    this.#confirm.addEventListener("click", () => this.#close(true));
    this.#cancel.addEventListener("click", () => this.#close(false));

    /* Escape fires close without going through either button, so the
       promise is settled here rather than in the handlers alone —
       otherwise it would hang and the caller would wait forever. */
    this.#element.addEventListener("close", () => this.#settle(false));

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
