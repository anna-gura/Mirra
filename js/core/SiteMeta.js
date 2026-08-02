/**
 * SiteMeta — the tags that need to know the site's own address.
 *
 * Canonical links, Open Graph and Twitter cards all require absolute
 * URLs, which means every page would otherwise carry a hard-coded
 * domain. Seven copies of the same string is seven places to forget
 * when it changes, and the one that gets forgotten is the one nobody
 * notices for a year.
 *
 * So the address is not written down at all: it is read from wherever
 * the page happens to be served. Deploy to a preview URL, a
 * pages.dev subdomain or a custom domain, and each is correct about
 * itself with nothing to edit.
 *
 * The trade-off is honest: a crawler that does not run scripts sees no
 * canonical tag. Google renders JavaScript and will see them; some
 * smaller crawlers and a few link previewers will not. For a five-page
 * site that is a fair price for never shipping a stale domain, and the
 * page still carries its title and description in the HTML itself.
 */
export class SiteMeta {
  /** Per-page copy. The key is the file name as served. */
  static PAGES = {
    "index.html": {
      title: "Mirra — облік клієнтів для малого бізнесу",
      description: "Простий робочий простір для малого бізнесу. Клієнти у вашій Google Таблиці — без серверів, без реєстрації.",
    },
    "about.html": {
      title: "Про Mirra — простий робочий простір для малого бізнесу",
      description: "Mirra існує, щоб ви працювали з людьми, а не з таблицями. Клієнти під рукою, мінімум кліків, ваші дані залишаються вашими.",
    },
    "roadmap.html": {
      title: "Плани розвитку — Mirra",
      description: "Що вже працює в Mirra і що планується далі: календар, облік прибутку, маршрути, аналітика, шаблони повідомлень.",
    },
    "privacy.html": {
      title: "Політика конфіденційності — Mirra",
      description: "Mirra не збирає даних, не має облікових записів і не є проміжною ланкою між вами та Google.",
    },
    "terms.html": {
      title: "Умови використання — Mirra",
      description: "Умови використання Mirra: безкоштовно, як є, ваші дані залишаються у вашому акаунті Google.",
    },
  };

  static IMAGE = "assets/social-preview.png";

  /** Writes the tags into the head. Safe to call once per page load. */
  static apply() {
    const origin = window.location.origin;
    const file = SiteMeta.#currentFile();
    const meta = SiteMeta.PAGES[file] ?? SiteMeta.PAGES["index.html"];

    /* An index page is canonical at the directory, not at its file
       name: /about.html and / are the same page to a reader and should
       be the same page to a search engine. */
    const path = file === "index.html" ? "/" : `/${file}`;
    const url = origin + path;
    const image = `${origin}/${SiteMeta.IMAGE}`;

    SiteMeta.#link("canonical", url);

    SiteMeta.#property("og:type", "website");
    SiteMeta.#property("og:site_name", "Mirra");
    SiteMeta.#property("og:locale", "uk_UA");
    SiteMeta.#property("og:title", meta.title);
    SiteMeta.#property("og:description", meta.description);
    SiteMeta.#property("og:url", url);
    SiteMeta.#property("og:image", image);
    SiteMeta.#property("og:image:width", "1280");
    SiteMeta.#property("og:image:height", "640");

    SiteMeta.#name("twitter:card", "summary_large_image");
    SiteMeta.#name("twitter:title", meta.title);
    SiteMeta.#name("twitter:description", meta.description);
    SiteMeta.#name("twitter:image", image);

    if (file === "about.html") SiteMeta.#structuredData(origin);
  }

  /* ---------------- private ---------------- */

  static #currentFile() {
    const last = window.location.pathname.split("/").pop();
    return last && last.endsWith(".html") ? last : "index.html";
  }

  static #link(rel, href) {
    const tag = document.querySelector(`link[rel="${rel}"]`)
             ?? document.head.appendChild(document.createElement("link"));
    tag.rel = rel;
    tag.href = href;
  }

  static #property(property, content) {
    SiteMeta.#meta("property", property, content);
  }

  static #name(name, content) {
    SiteMeta.#meta("name", name, content);
  }

  static #meta(attribute, key, content) {
    const tag = document.querySelector(`meta[${attribute}="${key}"]`)
             ?? document.head.appendChild(document.createElement("meta"));
    tag.setAttribute(attribute, key);
    tag.setAttribute("content", content);
  }

  /**
   * Tells a search engine this is an application rather than an
   * article: free, in Ukrainian, by a named author.
   */
  static #structuredData(origin) {
    const data = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Mirra",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${origin}/`,
      description: SiteMeta.PAGES["index.html"].description,
      inLanguage: "uk",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: {
        "@type": "Person",
        name: "Anna Gura",
        url: "https://github.com/Anna-Gura",
      },
      softwareVersion: "1.0.0",
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data, null, 2);
    document.head.append(script);
  }
}
