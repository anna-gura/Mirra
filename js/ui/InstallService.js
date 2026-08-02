/**
 * The event is caught here, at module scope, rather than inside init().
 *
 * Chrome fires beforeinstallprompt very early and exactly once. The
 * application starts by awaiting its templates, so by the time any
 * instance exists the event has usually already been and gone — and
 * with it the only chance to offer installation from a button of our
 * own. Listening as soon as this file is imported is the earliest a
 * module can be, and it is early enough.
 */
let captured = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    captured = event;
    listeners.forEach(notify => notify());
  });

  window.addEventListener("appinstalled", () => {
    captured = null;
    listeners.forEach(notify => notify());
  });
}

/**
 * InstallService — whether Mirra can be added to a device, and how.
 *
 * Two routes exist and they have nothing in common. Chrome and Edge
 * hand over a prompt that can be replayed on demand. Safari hands over
 * nothing at all: on an iPhone the only way in is Share → Add to Home
 * Screen, done by hand, so the most the app can do is show the steps.
 *
 * That asymmetry is why this reports a route and a guide rather than a
 * boolean. A button that says "Додати" and then does nothing on an
 * iPhone is worse than no button.
 */
export class InstallService extends EventTarget {
  static ROUTE_PROMPT = "prompt";   // the browser will do it for us
  static ROUTE_MANUAL = "manual";   // the user has to, with guidance
  static ROUTE_NONE = "none";       // already installed, or no way in

  static DISMISS_KEY = "mirra:install-dismissed";

  /**
   * How long a "not now" lasts.
   *
   * It expires rather than being permanent. Someone who declines today
   * may install next month, and a preference recorded once should not
   * outlive the situation that produced it — especially when the app
   * has no settings screen to take it back from.
   */
  static DISMISS_DAYS = 30;

  /**
   * What to show where the browser will not do it itself. Each guide is
   * the shortest true path on that platform.
   */
  static GUIDES = Object.freeze({
    ios: {
      title: "Додати на екран «Домівка»",
      steps: [
        { text: "Натисніть <b>Поділитися</b> на панелі браузера", icon: "share" },
        { text: "Виберіть <b>На екран «Домівка»</b>", icon: "add" },
        { text: "Натисніть <b>Додати</b>", icon: null },
      ],
    },
    android: {
      title: "Додати на головний екран",
      steps: [
        { text: "Відкрийте меню браузера <b>⋮</b>", icon: "menu" },
        { text: "Виберіть <b>Встановити застосунок</b>", icon: "add" },
        { text: "Підтвердіть", icon: null },
      ],
    },
    desktop: {
      title: "Встановити на комп'ютер",
      steps: [
        { text: "Натисніть значок встановлення в адресному рядку", icon: "add" },
        { text: "Або меню <b>⋮</b> → <b>Транслювати, зберегти й поділитися</b>", icon: "menu" },
        { text: "Виберіть <b>Встановити Mirra</b>", icon: null },
      ],
    },
    safari: {
      title: "Додати в Dock",
      steps: [
        { text: "У меню Safari відкрийте <b>Файл</b>", icon: "menu" },
        { text: "Виберіть <b>Додати в Dock…</b>", icon: "add" },
        { text: "Натисніть <b>Додати</b>", icon: null },
      ],
    },

    /* The last resort. Vague on purpose: naming a menu item that turns
       out not to exist is worse than describing where to look. */
    generic: {
      title: "Додати Mirra на пристрій",
      steps: [
        { text: "Відкрийте меню браузера", icon: "menu" },
        { text: "Знайдіть <b>Встановити</b> або <b>Додати на головний екран</b>", icon: "add" },
        { text: "Підтвердіть", icon: null },
      ],
    },
  });

  #onCapture;

  init() {
    this.#onCapture = () => this.#announce();
    listeners.add(this.#onCapture);

    console.info(
      `[install] route=${this.route} installed=${this.isInstalled} ` +
      `dismissed=${this.isDismissed} guide=${this.guide.title}`
    );

    /* Leaving standalone mode is possible — an installed app can also
       be opened in a tab — so the state is watched, not sampled once. */
    matchMedia("(display-mode: standalone)")
      .addEventListener("change", this.#onCapture);

    return this;
  }

  destroy() {
    listeners.delete(this.#onCapture);
  }

  /** @returns {boolean} running from a home screen or desktop shortcut */
  get isInstalled() {
    return matchMedia("(display-mode: standalone)").matches
        || matchMedia("(display-mode: window-controls-overlay)").matches
        || window.navigator.standalone === true;
  }

  /** @returns {boolean} */
  get isIOS() {
    const ua = navigator.userAgent;

    /* iPads have called themselves Macs since iPadOS 13, so a touch
       screen is the tell — desktop Safari has none. */
    return /iPad|iPhone|iPod/.test(ua)
        || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  /** @returns {boolean} */
  get isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  /** @returns {boolean} Chrome, Edge, Opera and the rest of the family */
  get isChromium() {
    return Boolean(window.chrome) || /Edg\/|OPR\//.test(navigator.userAgent);
  }

  /** @returns {boolean} Safari proper, not a browser wearing its engine */
  get isSafari() {
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/.test(ua);
  }

  /** @returns {string} one of the ROUTE_ constants */
  get route() {
    if (this.isInstalled) return InstallService.ROUTE_NONE;
    return captured ? InstallService.ROUTE_PROMPT : InstallService.ROUTE_MANUAL;
  }

  /**
   * Which set of steps applies. Never null: there is always something
   * more useful to say than nothing.
   * @returns {object}
   */
  get guide() {
    const { GUIDES } = InstallService;

    /* Every browser on iOS is Safari underneath, so this comes first
       whichever one is in use. */
    if (this.isIOS) return GUIDES.ios;
    if (this.isAndroid && this.isChromium) return GUIDES.android;
    if (this.isSafari) return GUIDES.safari;
    if (this.isChromium) return GUIDES.desktop;

    return GUIDES.generic;
  }

  /**
   * Whether to offer at all.
   *
   * Deliberately simple: not installed, not recently declined. An
   * earlier version also asked whether installation was detectably
   * possible, and hid the offer whenever it could not tell — which
   * meant the button vanished exactly when browser detection was
   * least reliable, with nothing to explain why. Being wrong now costs
   * a sheet of instructions; being wrong then cost the whole feature.
   *
   * @returns {boolean}
   */
  get isAvailable() {
    return !this.isInstalled && !this.isDismissed;
  }

  /** @returns {boolean} declined recently enough to still count */
  get isDismissed() {
    const until = this.#readDismissed();
    return until !== null && Date.now() < until;
  }

  /**
   * Asks the browser to install, where the browser is willing.
   * @returns {Promise<boolean>} whether they accepted
   */
  async prompt() {
    if (!captured) return false;

    const deferred = captured;

    /* Cleared before awaiting the answer: the event cannot be replayed,
       and a second tap while the dialog is open would throw. */
    captured = null;

    deferred.prompt();
    const { outcome } = await deferred.userChoice;

    this.#announce();
    return outcome === "accepted";
  }

  /** Sets the offer aside for a while. */
  dismiss() {
    const until = Date.now() + InstallService.DISMISS_DAYS * 86400000;

    try { localStorage.setItem(InstallService.DISMISS_KEY, String(until)); }
    catch { /* it will simply be offered again next time */ }

    this.#announce();
  }

  /** Brings the offer back immediately. Useful from the console. */
  reset() {
    try { localStorage.removeItem(InstallService.DISMISS_KEY); }
    catch { /* nothing to clear */ }

    this.#announce();
  }

  /* ---------------- private ---------------- */

  #announce() {
    this.dispatchEvent(new CustomEvent("change", {
      detail: { route: this.route, isAvailable: this.isAvailable },
    }));
  }

  /** @returns {number|null} when the dismissal runs out */
  #readDismissed() {
    try {
      const stored = localStorage.getItem(InstallService.DISMISS_KEY);
      if (!stored) return null;

      /* Earlier versions wrote "1" and meant forever. Read as an
         expiry that has already passed, so those users are asked once
         more rather than never again. */
      const until = Number(stored);
      return Number.isFinite(until) && until > 0 ? until : null;
    } catch {
      return null;
    }
  }
}
