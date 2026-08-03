/**
 * Service worker.
 *
 * It exists for two reasons. Browsers will not offer to install an app
 * without one, and the shell is worth having offline: opening Mirra out
 * of signal should show the app saying it cannot reach Google, not a
 * browser error page that looks like the app is broken.
 *
 * What it does not do is cache anything from Google. Client data is
 * fetched fresh every time — a stale phone number served from a cache
 * would be worse than no phone number at all, and an expired token
 * replayed from one would fail in a way nobody could diagnose.
 */

const VERSION = "mirra-v19";

/**
 * Files the app is made of. Listed rather than discovered, because a
 * worker that guesses what to cache eventually caches something it
 * should not.
 */
const SHELL = [
  "./",
  "./index.html",
  "./about.html",
  "./roadmap.html",
  "./privacy.html",
  "./terms.html",
  "./manifest.webmanifest",
  "./sitemap.xml",
  "./robots.txt",

  "./css/tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/hub.css",
  "./css/chooser.css",
  "./css/clients.css",
  "./css/client.css",
  "./css/form.css",
  "./css/dialog.css",
  "./css/page.css",

  "./views/loading.tpl",
  "./views/hub.tpl",
  "./views/chooser.tpl",
  "./views/clients.tpl",
  "./views/client.tpl",
  "./views/client-form.tpl",

  "./favicon.ico",
  "./assets/logo-120.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./js/App.js",
  "./js/config.js",
  "./js/credentials.js",
  "./js/core/ScreenManager.js",
  "./js/core/ScriptLoader.js",
  "./js/core/ViewLoader.js",
  "./js/core/SiteMeta.js",
  "./js/domain/Client.js",
  "./js/domain/ClientDraft.js",
  "./js/domain/ClientList.js",
  "./js/domain/ClientSchema.js",
  "./js/domain/DateValue.js",
  "./js/domain/PhoneNumber.js",
  "./js/domain/NoteTags.js",
  "./js/domain/SocialCatalog.js",
  "./js/errors.js",
  "./js/page.js",
  "./js/services/AuthService.js",
  "./js/services/TokenStore.js",
  "./js/services/AuthServiceFactory.js",
  "./js/services/DriveRepository.js",
  "./js/services/GoogleApiClient.js",
  "./js/services/InstallService.js",
  "./js/services/PickerService.js",
  "./js/services/RedirectAuthService.js",
  "./js/services/SettingsService.js",
  "./js/services/SheetsRepository.js",
  "./js/ui/ChooserView.js",
  "./js/ui/ClientCardView.js",
  "./js/ui/ClientFormView.js",
  "./js/ui/ClientListView.js",
  "./js/ui/ConfirmDialog.js",
  "./js/ui/DatePicker.js",
  "./js/ui/InstallPrompt.js",
  "./js/ui/Notice.js",
  "./js/ui/PhoneInput.js",
  "./js/ui/RevealController.js",
  "./js/ui/SelectMenu.js",
  "./js/ui/ThemeManager.js",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    /* Added one at a time rather than with addAll, which rejects the
       whole batch if a single file is missing — leaving the worker
       uninstalled and the app uninstallable for one stray filename. */
    await Promise.all(SHELL.map(async path => {
      try {
        await cache.add(new Request(path, { cache: "reload" }));
      } catch (error) {
        console.warn(`[sw] could not cache ${path}`, error);
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== VERSION).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;

  /* Only same-origin reads are ours to answer. Everything aimed at
     Google — tokens, spreadsheets, the Picker — goes straight to the
     network, every time. */
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

/**
 * Network first, cache as the fallback — for everything of ours, not
 * only for pages.
 *
 * Cache-first would be quicker, and it is the usual advice, but it
 * only stays correct if the cache name is changed on every deployment.
 * Forget once and every existing user keeps running the old code with
 * no sign that anything is wrong, until they think to clear their
 * browser data. Trading a round trip for never having to remember that
 * is the right way round here: the app is a few hundred kilobytes and
 * HTTP caching already handles most of the cost.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(VERSION);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    /* An unreachable page falls back to the shell, so opening Mirra
       without signal shows Mirra rather than a browser error. */
    if (request.mode === "navigate") {
      const shell = await caches.match("./index.html");
      if (shell) return shell;
    }

    return Response.error();
  }
}
