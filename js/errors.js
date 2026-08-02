/**
 * Typed errors.
 *
 * Callers branch on the error class instead of parsing message text,
 * and every error carries a message that is safe to show a user.
 * Technical detail goes in `cause`, never into `userMessage`.
 */

export class AppError extends Error {
  /**
   * @param {string} message      developer-facing detail
   * @param {object} [options]
   * @param {string} [options.userMessage] text safe to display
   * @param {unknown} [options.cause]
   */
  constructor(message, { userMessage, cause } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.userMessage = userMessage ?? "Щось пішло не так. Спробуйте ще раз.";
  }
}

/**
 * The user closed the sign-in window without deciding.
 *
 * Not a refusal and not a failure, so userMessage is empty and the
 * application stays silent — same treatment as dismissing the Picker.
 */
export class SignInAbandonedError extends AppError {
  constructor(cause) {
    super("Sign-in window closed before a decision", { userMessage: "", cause });
  }
}

/** The user closed the consent window or refused access. */
export class AccessDeniedError extends AppError {
  constructor(cause) {
    super("User declined the OAuth consent", {
      userMessage: "Доступ не надано. Щоб працювати з таблицею, потрібен дозвіл на вибраний файл.",
      cause,
    });
  }
}

/** Sign-in failed for a reason other than refusal. */
export class AuthError extends AppError {
  constructor(detail, cause) {
    super(`Sign-in failed: ${detail}`, {
      userMessage: "Не вдалося увійти. Перевірте з'єднання і спробуйте ще раз.",
      cause,
    });
  }
}

/** The browser refused to open the consent popup. */
export class PopupBlockedError extends AppError {
  constructor(cause) {
    super("Consent popup was blocked by the browser", {
      userMessage: "Браузер заблокував вікно Google. Дозвольте спливні вікна для цього сайту й спробуйте ще раз.",
      cause,
    });
  }
}

/** The access token expired or was revoked. Recoverable by refreshing. */
export class TokenExpiredError extends AppError {
  constructor() {
    super("Access token expired", {
      userMessage: "Сеанс завершився. Увійдіть ще раз.",
    });
  }
}

/** The user closed the Picker without choosing anything. Not a failure. */
export class PickerCancelledError extends AppError {
  constructor() {
    super("Picker dismissed without a selection", { userMessage: "" });
  }
}

/** Any Google API answered with an error. */
export class ApiError extends AppError {
  constructor(status, detail) {
    super(`Google API responded ${status}: ${detail}`, {
      userMessage: status === 403
        ? "Немає доступу до цього файлу. Виберіть його ще раз."
        : status === 429
          ? "Забагато запитів поспіль. Зачекайте хвилину й спробуйте знову."
          : "Не вдалося зв'язатися з Google. Спробуйте ще раз.",
    });
    this.status = status;
  }
}

/** The Sheets API answered with an error. */
export class SheetsError extends AppError {
  constructor(status, detail) {
    super(`Sheets API responded ${status}: ${detail}`, {
      userMessage: status === 403
        ? "Немає доступу до цієї таблиці. Виберіть її через кнопку ще раз."
        : "Не вдалося прочитати таблицю. Спробуйте ще раз.",
    });
    this.status = status;
  }
}

/** An external Google script could not be fetched. */
export class ScriptLoadError extends AppError {
  constructor(src) {
    super(`Failed to load script: ${src}`, {
      userMessage: "Не вдалося завантажити Google. Перевірте з'єднання.",
    });
  }
}

/** Credentials in config.js were left as placeholders. */
export class ConfigError extends AppError {
  constructor(missing) {
    super(`Missing configuration: ${missing.join(", ")}`, {
      userMessage: "Застосунок не налаштовано. Заповніть js/config.js.",
    });
  }
}
