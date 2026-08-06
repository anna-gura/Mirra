import { ApiError, TokenExpiredError } from "../errors.js";

/**
 * GoogleApiClient — one place that speaks HTTP to Google.
 *
 * Every repository used to carry its own copy of the same three
 * concerns: attach the token, notice a dead token, turn a failure into
 * a typed error. Now they carry none: they describe *what* to fetch and
 * this class handles *how*.
 *
 * The retry deserves a note. Tokens last about an hour, so expiry
 * lands in the middle of a working session as a matter of routine, not
 * as an edge case. A 401 therefore means "renew and try again" exactly
 * once — twice in a row means the session is genuinely over and the
 * caller needs to know.
 */
export class GoogleApiClient {
  #auth;

  /**
   * @param {object} deps
   * @param {import("./auth/AuthService.js").AuthService} deps.auth
   */
  constructor({ auth }) {
    this.#auth = auth;
  }

  /** @param {string} url */
  get(url) {
    return this.request("GET", url);
  }

  /**
   * @param {string} url
   * @param {object} body sent as JSON
   */
  post(url, body) {
    return this.request("POST", url, { body });
  }

  /**
   * @param {string} url
   * @param {object} body
   */
  put(url, body) {
    return this.request("PUT", url, { body });
  }

  /**
   * @param {string} url
   * @param {object} [body]
   */
  patch(url, body) {
    return this.request("PATCH", url, { body });
  }

  /**
   * @param {string} method
   * @param {string} url
   * @param {object}  [options]
   * @param {object}  [options.body]     serialised as JSON
   * @param {string}  [options.rawBody]  sent verbatim; for multipart uploads
   * @param {object}  [options.headers]
   * @param {boolean} [options.allowRetry] internal; false on the second try
   * @returns {Promise<object>}
   */
  async request(method, url, { body, rawBody, headers = {}, allowRetry = true } = {}) {
    const token = await this.#auth.getToken();

    const init = {
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
    };

    if (rawBody !== undefined) {
      init.body = rawBody;
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, init);

    if (response.status === 401) {
      if (!allowRetry) throw new TokenExpiredError();
      this.#auth.invalidate();
      return this.request(method, url, { body, rawBody, headers, allowRetry: false });
    }

    if (!response.ok) {
      const detail = await response
        .json()
        .then(payload => payload?.error?.message ?? response.statusText)
        .catch(() => response.statusText);
      throw new ApiError(response.status, detail);
    }

    /* 204 and friends carry no body; asking for JSON would throw. */
    if (response.status === 204) return null;
    return response.json();
  }
}
