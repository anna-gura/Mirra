/**
 * @typedef {object} Network
 * @property {string} id
 * @property {string} label     what the user sees and what is written to the cell
 * @property {"social"|"messenger"} kind
 * @property {"handle"|"phone"} input  what the user is asked for
 * @property {string} template  {value} is replaced to build the link
 * @property {string[]} aliases lowercase spellings accepted when reading
 */

/**
 * @typedef {object} Profile
 * @property {Network|null} network  null when the name was not recognised
 * @property {string} handle
 * @property {string} raw            the original text, kept verbatim
 */

/**
 * SocialCatalog — which networks exist and how to reach a profile.
 *
 * Kept in code rather than in a sheet on purpose. The address pattern
 * for Instagram is a fact about Instagram, not something a hairdresser
 * has an opinion about: putting it in the user's spreadsheet would mean
 * an extra read on every visit, a file they could break by accident,
 * and a separate copy to fix in every account when a network changes.
 * Here, adding one is a line of code that reaches everyone at once.
 *
 * Cells are stored as "Instagram: @anna.sirra, TikTok: @ana_sir" —
 * readable by a person who opens the spreadsheet directly, and precise
 * enough to parse. Reading is deliberately forgiving and writing is
 * strict: whatever someone types by hand becomes tidy the next time
 * Mirra saves that client.
 */
export class SocialCatalog {
  /** @type {Network[]} */
  static NETWORKS = Object.freeze([
    /* ---------------- socials ---------------- */
    {
      id: "instagram", label: "Instagram", kind: "social", input: "handle",
      template: "https://instagram.com/{value}",
      aliases: ["instagram", "інстаграм", "инстаграм", "insta", "інста", "инста", "ig"],
    },
    {
      id: "tiktok", label: "TikTok", kind: "social", input: "handle",
      template: "https://tiktok.com/@{value}",
      aliases: ["tiktok", "tik-tok", "tik tok", "тікток", "тік-ток", "тикток", "тик-ток"],
    },
    {
      id: "facebook", label: "Facebook", kind: "social", input: "handle",
      template: "https://facebook.com/{value}",
      aliases: ["facebook", "фейсбук", "фб", "fb"],
    },
    {
      id: "threads", label: "Threads", kind: "social", input: "handle",
      template: "https://threads.net/@{value}",
      aliases: ["threads", "тредс"],
    },
    {
      id: "youtube", label: "YouTube", kind: "social", input: "handle",
      template: "https://youtube.com/@{value}",
      aliases: ["youtube", "ютуб", "yt"],
    },
    {
      id: "pinterest", label: "Pinterest", kind: "social", input: "handle",
      template: "https://pinterest.com/{value}",
      aliases: ["pinterest", "пінтерест", "пинтерест"],
    },
    {
      id: "linkedin", label: "LinkedIn", kind: "social", input: "handle",
      template: "https://linkedin.com/in/{value}",
      aliases: ["linkedin", "лінкедін", "линкедин"],
    },
    {
      id: "x", label: "X", kind: "social", input: "handle",
      template: "https://x.com/{value}",
      aliases: ["twitter", "твіттер", "твиттер", "x"],
    },

    /* ---------------- messengers ---------------- */
    {
      id: "telegram", label: "Telegram", kind: "messenger", input: "handle",
      template: "https://t.me/{value}",
      aliases: ["telegram", "телеграм", "тг", "tg"],
    },
    {
      id: "whatsapp", label: "WhatsApp", kind: "messenger", input: "phone",
      template: "https://wa.me/{value}",
      aliases: ["whatsapp", "whats app", "вотсап", "ватсап", "вацап", "wa"],
    },
    {
      id: "viber", label: "Viber", kind: "messenger", input: "phone",
      template: "viber://chat?number={value}",
      aliases: ["viber", "вайбер"],
    },
    {
      id: "signal", label: "Signal", kind: "messenger", input: "phone",
      template: "https://signal.me/#p/{value}",
      aliases: ["signal", "сігнал", "сигнал"],
    },
    {
      id: "messenger", label: "Messenger", kind: "messenger", input: "handle",
      template: "https://m.me/{value}",
      aliases: ["messenger", "мессенджер", "месенджер", "m.me"],
    },
  ]);

  /**
   * Aliases longest first, so "instagram" is matched before "insta"
   * and the handle is not left with a stray "gram" on the front.
   * @type {Array<{alias: string, network: Network}>}
   */
  static #index = SocialCatalog.NETWORKS
    .flatMap(network => network.aliases.map(alias => ({ alias, network })))
    .sort((a, b) => b.alias.length - a.alias.length);

  /**
   * @param {"social"|"messenger"} kind
   * @returns {Network[]} for building a dropdown
   */
  static byKind(kind) {
    return SocialCatalog.NETWORKS.filter(network => network.kind === kind);
  }

  /**
   * @param {string} id
   * @returns {Network|undefined}
   */
  static find(id) {
    return SocialCatalog.NETWORKS.find(network => network.id === id);
  }

  /**
   * Reads a cell into profiles.
   *
   * Anything unrecognised is kept as raw text rather than dropped. A
   * network Mirra has never heard of is still information the user
   * typed on purpose, and losing it would be worse than not linking it.
   *
   * @param {string} cell
   * @returns {Profile[]}
   */
  static parse(cell) {
    if (!cell) return [];

    return cell
      .split(/[,;\n]/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => SocialCatalog.#parseOne(part));
  }

  /**
   * Writes profiles back in canonical form.
   * @param {Profile[]} profiles
   * @returns {string}
   */
  static stringify(profiles) {
    return profiles
      .map(profile => profile.network
        ? `${profile.network.label}: ${SocialCatalog.#decorate(profile)}`
        : profile.raw)
      .join(", ");
  }

  /**
   * Builds the address that opens this profile.
   * @param {Profile} profile
   * @returns {string|null} null when there is nothing to open
   */
  static linkFor(profile) {
    if (!profile.network || !profile.handle) return null;

    const value = profile.network.input === "phone"
      ? profile.handle.replace(/[^\d+]/g, "").replace(/^\+/, "")
      : profile.handle.replace(/^@/, "");

    if (!value) return null;
    return profile.network.template.replace("{value}", encodeURIComponent(value));
  }

  /**
   * How the handle is shown and stored: "@nick" for names, the number
   * as typed for phones.
   * @param {Profile} profile
   * @returns {string}
   */
  static display(profile) {
    return profile.network ? SocialCatalog.#decorate(profile) : profile.raw;
  }

  /* ---------------- private ---------------- */

  static #parseOne(text) {
    const lower = text.toLowerCase();

    for (const { alias, network } of SocialCatalog.#index) {
      if (!lower.startsWith(alias)) continue;

      /* Matching the name at the front and stripping whatever follows
         sidesteps the separator problem entirely: a phone number full
         of dashes cannot be mistaken for "network - handle". */
      const handle = text
        .slice(alias.length)
        .replace(/^[\s:\-—–{(\[]+/, "")
        .replace(/[\s})\]]+$/, "")
        .trim();

      if (handle) return { network, handle, raw: text };
    }

    return { network: null, handle: "", raw: text };
  }

  static #decorate(profile) {
    if (profile.network.input === "phone") return profile.handle;
    return profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`;
  }
}
