/**
 * DatePicker — a calendar in Mirra's own language.
 *
 * Like the dropdown, this replaces a native control whose open state
 * cannot be styled: <input type="date"> renders a browser calendar
 * that looks like nothing else on the screen and differs on every
 * platform. What is built here is the same idea in the app's own
 * typography, and identical everywhere.
 *
 * The value is kept as yyyy-mm-dd — what a date input would have given
 * — so nothing above this class has to know the control changed.
 *
 * All arithmetic runs in UTC. Doing it in local time means a date
 * created at midnight can land on the previous day for anyone west of
 * Greenwich, which is the sort of bug that only appears for some users
 * and only sometimes.
 */
export class DatePicker extends EventTarget {
  /** Only one calendar is ever open. */
  static #open = null;

  /** Monday, as Ukrainian calendars are drawn. */
  static FIRST_DAY = 1;

  #element;
  #trigger;
  #label;
  #panel;
  #grid;
  #caption;
  #locale;
  #placeholder;
  #value = "";
  #viewYear;
  #viewMonth;
  #isOpen = false;
  #onDocumentPointer;
  #onKeydown;

  /**
   * @param {object} [params]
   * @param {string} [params.value]       yyyy-mm-dd
   * @param {string} [params.locale]
   * @param {string} [params.placeholder]
   */
  constructor({ value = "", locale = "uk-UA", placeholder = "Не вказано" } = {}) {
    super();
    this.#locale = locale;
    this.#placeholder = placeholder;

    this.#build();
    this.value = value;
  }

  /** @returns {HTMLElement} the node to insert into the page */
  get element() {
    return this.#element;
  }

  /** @returns {string} yyyy-mm-dd, or an empty string */
  get value() {
    return this.#value;
  }

  /** @param {string} next yyyy-mm-dd */
  set value(next) {
    this.#value = /^\d{4}-\d{2}-\d{2}$/.test(next ?? "") ? next : "";

    const anchor = this.#value ? this.#parse(this.#value) : this.#today();
    this.#viewYear = anchor.year;
    this.#viewMonth = anchor.month;

    this.#syncLabel();
    if (this.#isOpen) this.#renderGrid();
  }

  open() {
    if (this.#isOpen) return this;

    DatePicker.#open?.close();
    DatePicker.#open = this;

    this.#isOpen = true;
    this.#panel.hidden = false;
    this.#trigger.setAttribute("aria-expanded", "true");
    this.#element.classList.add("is-open");
    this.#renderGrid();

    document.addEventListener("pointerdown", this.#onDocumentPointer, true);
    document.addEventListener("keydown", this.#onKeydown, true);

    this.#panel.querySelector("[data-selected], [data-today]")?.focus();
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

    if (DatePicker.#open === this) DatePicker.#open = null;
    return this;
  }

  /** Releases the document listeners this instance may hold. */
  destroy() {
    this.close();
  }

  /* ---------------- building ---------------- */

  #build() {
    this.#element = document.createElement("div");
    this.#element.className = "cal";

    this.#trigger = document.createElement("button");
    this.#trigger.type = "button";
    this.#trigger.className = "cal-trigger";
    this.#trigger.setAttribute("aria-haspopup", "dialog");
    this.#trigger.setAttribute("aria-expanded", "false");

    this.#label = document.createElement("span");
    this.#label.className = "cal-label";
    this.#trigger.append(this.#label, this.#icon());

    this.#panel = document.createElement("div");
    this.#panel.className = "cal-panel";
    this.#panel.setAttribute("role", "dialog");
    this.#panel.setAttribute("aria-label", "Вибір дати");
    this.#panel.hidden = true;

    const head = document.createElement("div");
    head.className = "cal-head";

    const previous = this.#navButton("‹", "Попередній місяць", -1);
    const next = this.#navButton("›", "Наступний місяць", 1);

    this.#caption = document.createElement("span");
    this.#caption.className = "cal-caption";
    this.#caption.setAttribute("aria-live", "polite");

    head.append(previous, this.#caption, next);

    const weekdays = document.createElement("div");
    weekdays.className = "cal-week";
    weekdays.append(...this.#weekdayNames().map(name => {
      const cell = document.createElement("span");
      cell.textContent = name;
      return cell;
    }));

    this.#grid = document.createElement("div");
    this.#grid.className = "cal-grid";

    const foot = document.createElement("div");
    foot.className = "cal-foot";

    const today = document.createElement("button");
    today.type = "button";
    today.className = "cal-action";
    today.textContent = "Сьогодні";
    today.addEventListener("click", () => this.#choose(this.#iso(this.#today())));

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "cal-action";
    clear.textContent = "Очистити";
    clear.addEventListener("click", () => this.#choose(""));

    foot.append(today, clear);

    this.#panel.append(head, weekdays, this.#grid, foot);
    this.#element.append(this.#trigger, this.#panel);

    this.#trigger.addEventListener("click", () => {
      this.#isOpen ? this.close() : this.open();
    });

    this.#grid.addEventListener("click", event => {
      const day = event.target.closest("[data-date]");
      if (day) this.#choose(day.dataset.date);
    });

    this.#onDocumentPointer = event => {
      if (!this.#element.contains(event.target)) this.close();
    };
    this.#onKeydown = event => this.#handleKey(event);
  }

  #navButton(glyph, label, step) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-nav";
    button.textContent = glyph;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => this.#shiftMonth(step));
    return button;
  }

  #icon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "cal-icon");
    svg.setAttribute("aria-hidden", "true");

    const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    frame.setAttribute("x", "3.5");
    frame.setAttribute("y", "5");
    frame.setAttribute("width", "17");
    frame.setAttribute("height", "15");
    frame.setAttribute("rx", "3");

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", "M3.5 10h17M8 3.5v3M16 3.5v3");

    svg.append(frame, line);
    return svg;
  }

  /* ---------------- rendering ---------------- */

  #renderGrid() {
    this.#caption.textContent = this.#monthName(this.#viewYear, this.#viewMonth);

    const todayIso = this.#iso(this.#today());
    const cells = [];

    const firstWeekday = new Date(Date.UTC(this.#viewYear, this.#viewMonth - 1, 1)).getUTCDay();
    const lead = (firstWeekday - DatePicker.FIRST_DAY + 7) % 7;
    const length = new Date(Date.UTC(this.#viewYear, this.#viewMonth, 0)).getUTCDate();

    for (let i = 0; i < lead; i += 1) {
      const blank = document.createElement("span");
      blank.className = "cal-blank";
      cells.push(blank);
    }

    for (let day = 1; day <= length; day += 1) {
      const iso = this.#iso({ year: this.#viewYear, month: this.#viewMonth, day });

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-day";
      cell.dataset.date = iso;
      cell.textContent = String(day);

      if (iso === this.#value) {
        cell.dataset.selected = "";
        cell.setAttribute("aria-current", "date");
      }
      if (iso === todayIso) cell.dataset.today = "";

      cells.push(cell);
    }

    this.#grid.replaceChildren(...cells);
  }

  #syncLabel() {
    if (!this.#value) {
      this.#label.textContent = this.#placeholder;
      this.#label.classList.add("is-empty");
      return;
    }

    const { year, month, day } = this.#parse(this.#value);
    const date = new Date(Date.UTC(year, month - 1, day));

    this.#label.textContent = new Intl.DateTimeFormat(this.#locale, {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(date);
    this.#label.classList.remove("is-empty");
  }

  /* ---------------- behaviour ---------------- */

  #handleKey(event) {
    if (!this.#isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      this.#trigger.focus();
      return;
    }

    const days = [...this.#grid.querySelectorAll("[data-date]")];
    const current = days.indexOf(document.activeElement);
    if (current < 0) return;

    /* A week is seven days, so up and down move by seven cells. Running
       off either end changes month rather than stopping dead. */
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[event.key];
    if (step === undefined) return;

    event.preventDefault();
    const target = days[current + step];

    if (target) target.focus();
    else this.#shiftMonth(step > 0 ? 1 : -1);
  }

  #shiftMonth(step) {
    const month = this.#viewMonth + step;

    if (month < 1) {
      this.#viewMonth = 12;
      this.#viewYear -= 1;
    } else if (month > 12) {
      this.#viewMonth = 1;
      this.#viewYear += 1;
    } else {
      this.#viewMonth = month;
    }

    this.#renderGrid();
  }

  #choose(iso) {
    const changed = iso !== this.#value;
    this.value = iso;

    this.close();
    this.#trigger.focus();

    if (changed) {
      this.dispatchEvent(new CustomEvent("change", { detail: { value: iso } }));
    }
  }

  /* ---------------- dates ---------------- */

  #today() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }

  #parse(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day };
  }

  #iso({ year, month, day }) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  #monthName(year, month) {
    return new Intl.DateTimeFormat(this.#locale, {
      month: "long", year: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  /** Weekday abbreviations in the right order, from the locale. */
  #weekdayNames() {
    const format = new Intl.DateTimeFormat(this.#locale, { weekday: "short", timeZone: "UTC" });

    /* 4 January 1970 was a Sunday, which makes the offset arithmetic
       below read directly as day-of-week. */
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(Date.UTC(1970, 0, 4 + ((DatePicker.FIRST_DAY + index) % 7)));
      return format.format(day);
    });
  }
}
