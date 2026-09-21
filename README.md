# Mirra

A quiet workspace for a small business: clients, notes and contacts,
kept in an ordinary Google Sheet and made pleasant to use from a phone.

> Mirra існує, щоб ви працювали з людьми, а не з таблицями.

No servers, no accounts, no database. The app runs entirely in the
browser and talks to Google directly.

---

## How it works

The shortest possible description: **Mirra is a client for your own
Google account.** It renders an interface, and every byte of data
travels between the browser and Google without passing through anything
of ours.

```
┌──────────┐        ┌──────────┐        ┌──────────┐
│  static  │ ─code→ │ browser  │ ←data→ │  Google  │
│  hosting │        │  (Mirra) │        │ Drive +  │
└──────────┘        └──────────┘        │  Sheets  │
                                        └──────────┘
```

The hosting on the left serves HTML, CSS and JavaScript — the same
files for everyone. It never sees a spreadsheet, a client record or an
access token, because none of those are ever sent to it.

That has three consequences worth stating plainly:

- **There is nothing to breach.** No user database exists to leak.
- **There is nothing to migrate.** Data lives in the user's own Drive,
  in a normal spreadsheet they can open, export or delete themselves.
- **Availability is Google's.** If Google changes an API, Mirra changes
  with it. This is the price of the other two.

### The Mirra folder

On first sign-in the app creates one visible folder named `Mirra` on
the user's Drive, holding `mirra.json` — which spreadsheet belongs to
which menu section, and the chosen date format. Settings therefore
follow the account rather than the device: set up on a laptop, already
configured on a phone.

Google offers a hidden per-app storage area for exactly this. It is
deliberately not used: a settings file nobody can see is also a
settings file nobody can inspect when something goes wrong.

### Permissions

One scope: `drive.file` — access to files the user picked through the
Google Picker, plus files the app created itself. Everything else on
their Drive is invisible to Mirra, not by policy but by construction.

`drive.file` is also non-sensitive, which keeps the project out of
Google's verification queue. Widening it would mean a review, and there
has been no reason to.

### Authentication

Two interchangeable implementations behind one interface, chosen by
`AUTH_MODE` in `js/config.js`:

- **`popup`** keeps the page loaded. Nicer, but it depends on a second
  window delivering the token by `postMessage` and on the Google
  library polling `window.closed` — both of which break under
  cross-origin isolation policies that keep tightening.
- **`redirect`** navigates to Google and back with the token in the URL
  fragment. No second window, no `postMessage`, nothing to isolate.
  Slower by one page load and considerably harder to break.

`AuthServiceFactory` picks between them. Nothing above that layer knows
which is in use.

---

## Running it yourself

Mirra is static files. Any web server will do, and the whole setup is
in Google Cloud rather than in code.

### 1. Get the files

```bash
git clone https://github.com/anna-gura/Mirra.git
cd Mirra
```

### 2. Set up a Google Cloud project

1. Create a project at `console.cloud.google.com`.
2. **APIs & Services → Library** — enable *Google Sheets API*,
   *Google Drive API* and *Google Picker API*.
3. **Google Auth Platform → Data Access** — add the scope
   `https://www.googleapis.com/auth/drive.file` and nothing else.
4. **Audience** — set the publishing status to **In production**. Left
   in Testing, Google forces a fresh consent every seven days.
5. **Clients → Create client** — Web application. Under *Authorized
   JavaScript origins* add every origin the app runs on, scheme and
   host only:
   ```
   http://localhost:5500
   https://your-domain.example
   ```
   Using redirect mode, add the full page addresses under *Authorized
   redirect URIs* as well:
   ```
   http://localhost:5500/index.html
   https://your-domain.example/
   ```
6. **Credentials → API key** — create one and restrict it: by HTTP
   referrer to your origins, and by API to the three enabled above.

### 3. Fill in the credentials

```bash
cp js/credentials.example.js js/credentials.js
```

Then open `js/credentials.js` and set three values:

```js
CLIENT_ID: "000000000000-xxxxxxxx.apps.googleusercontent.com",
API_KEY:   "AIza...",
APP_ID:    "000000000000",   // the project NUMBER, not its ID
```

`APP_ID` is the digits before the dash in the client ID. Using the
project *ID* instead is the usual mistake, and it fails silently: the
Picker simply opens empty.

`js/credentials.js` is git-ignored. Not because these values are
secret — they ship in the bundle and can be read out of any running
copy — but so that a fork points at its own Google project rather than
silently borrowing someone else's quota. What actually protects a
project is the origin allow-list in Cloud Console.

`js/config.js` stays in the repository and is safe to edit and share:
it holds the scope, the endpoints and the template for new sheets.

### 4. Serve it

```bash
python3 -m http.server 5500
```

VS Code's Live Server does the same with one click. Opening
`index.html` from disk will not work: ES modules need a real origin,
and Google refuses `file://` outright.

### 5. Deploy

Copy the folder to any static host — GitHub Pages, Netlify, Cloudflare
Pages, nginx. Three requirements:

- **HTTPS.** Google will not authenticate over plain HTTP, and no
  browser will offer to install a PWA without it.
- **`manifest.webmanifest` and `sw.js` at the root**, beside
  `index.html`. A service worker only controls what sits at its own
  level or below.
- **`js/credentials.js` must exist on the server.** It is git-ignored,
  so it will not arrive by itself — either upload it separately or let
  the deployment write it, as below.

Then add the deployed origin to the Cloud Console lists from step 2.

#### Deploying with credentials kept out of the repository

`build.sh` writes `js/credentials.js` from environment variables during
the build. Set the build command to `bash build.sh` on any host that
builds from a repository — Cloudflare Pages, Netlify, Vercel — and add
three variables in its dashboard:

```
MIRRA_CLIENT_ID
MIRRA_API_KEY
MIRRA_APP_ID
```

Leave the output directory as the project root. There is nothing to
compile; the script only writes one file.

If a variable is missing the build fails with a message naming it,
rather than publishing a site whose sign-in button quietly does nothing.

#### GitHub Pages

`.github/workflows/deploy.yml` publishes to GitHub Pages and writes
`js/credentials.js` from repository secrets during the build. The
repository stays clean; the published site still works.

1. **Settings → Secrets and variables → Actions** — add three secrets:
   `MIRRA_CLIENT_ID`, `MIRRA_API_KEY`, `MIRRA_APP_ID`.
2. **Settings → Pages → Source** — switch from *Deploy from a branch*
   to **GitHub Actions**.
3. Push. The workflow runs on every push to `main`, and can also be
   started by hand from the Actions tab — useful after changing a
   secret without changing any code.

Worth being clear about what this does and does not achieve. The values
still reach every visitor's browser, because a browser cannot
authenticate with credentials it does not have. What it prevents is
their sitting in the repository and its history, where they would
outlive any later decision to change them.

---

## Installing as an app

`manifest.webmanifest` and `sw.js` are what let a browser offer to add
Mirra to a home screen or desktop.

Chrome and Edge fire `beforeinstallprompt`, which the app captures and
replays from its own button. Safari fires nothing, so on iOS the app
shows the Share → Add to Home Screen steps instead. Neither offer
appears once `display-mode: standalone` reports it is already
installed.

The service worker fetches from the network first and falls back to its
cache, rather than the usual cache-first. Cache-first is faster but
stays correct only if `VERSION` in `sw.js` is bumped on every deploy —
forget once and existing users keep running old code with nothing to
tell them.

---

### A note on Wrangler deployments

Cloudflare's Workers deployment publishes the whole working directory,
including `.git`. Without `.assetsignore` the repository history is
served at `/.git/` — public code either way, but it is precisely what
automated scanners probe for, and it stops being harmless the moment
anything private enters the tree.

`.assetsignore` keeps that and the other development-only files out of
the deployment. Anything added to the project that should not be public
belongs in that list as well as in `.gitignore`.

## Releasing

`version.json` holds the version the app reports. Change it in the same
commit as the tag:

```json
{ "version": "2.1.0" }
```

`build.sh` reads it and writes `js/version.js` at deploy time.

It used to read the latest git tag instead, which was tidier and did not
work: hosts clone without tags to save time, so `git describe` found
nothing and every deployment called itself 0.0.0. A line in a file
cannot fail that way.

## Deploy checklist

After moving to a new domain, four places need it:

| Where | What |
|---|---|
| `robots.txt` | the `Sitemap:` line |
| `sitemap.xml` | every `<loc>` |
| Google Cloud → Clients | JavaScript origins and redirect URIs |
| Google Cloud → API key | website restrictions |
| Google Auth Platform → Branding | the three links and authorized domains |

Everything else derives the address from wherever it is served.

## Templates

Screens live in `views/*.tpl` and are fetched once at startup.
`index.html` holds only the cover, so the first paint never waits on a
request.

The extension matters. Dev servers inject a live-reload script into
every `.html` file they serve, and a fragment has no `</body>` to
insert it before — the result is a truncated file, visible only over
HTTP while the copy on disk looks fine. `.tpl` avoids that entirely.

`.vscode/settings.json` maps `.tpl` to HTML so the editor behaves
normally.

---

## Structure

```
index.html              the cover; every other screen is fetched
manifest.webmanifest    installability
sw.js                   service worker, shell cache
version.json            the version the app reports
about · privacy · terms · roadmap.html

css/
  tokens.css        colours and tuning numbers; edit the palette here
  base · layout · components.css
  hub · chooser · clients · client · form · dialog · picker ·
  install · page.css

views/
  loading · hub · chooser · clients · client · client-form.tpl

js/
  credentials.js          git-ignored; copy from credentials.example.js
  version.js              git-ignored; written by build.sh
  config.js               scope, endpoints, new-sheet template
  errors.js               typed errors carrying user-safe messages
  App.js                  composition root; owns the flow

  core/                   how the application itself works
    ScriptLoader · ScreenManager · ViewLoader · SiteMeta.js

  domain/                 pure logic, no DOM, testable in node
    client/               a spreadsheet read as people
      ClientSchema · Client · ClientList · ClientDraft · ClientId.js
    links/                people connected to people
      ClientLinks · LinkSync · LinkCandidates.js
    values/               things that know nothing about clients
      PhoneNumber · DateValue · Birthday · NoteTags · SocialCatalog.js

  services/               everything that talks to the outside
    auth/                 two token strategies behind one interface
      AuthService · RedirectAuthService · AuthServiceFactory · TokenStore.js
    GoogleApiClient.js    one place that speaks HTTP to Google
    DriveRepository · SheetsRepository · SettingsService ·
    SchemaUpgrade · PickerService · InstallService.js

  ui/                     everything that shows
    screens/              one per view
      ChooserView · ClientListView · ClientCardView · ClientFormView.js
    controls/             inputs that replace a native one
      SelectMenu · DatePicker · PhoneInput · NameInput.js
    dialogs/              things that take over the screen
      ConfirmDialog · PeoplePicker.js
    shell/                present on every screen
      ThemeManager · Notice · RevealController · InstallPrompt.js
```

The grouping is by role rather than by page. A page-shaped layout looks
tidier and stops working at the first shared file: the client card uses
five things from `values/`, and a calendar will want the same ones —
folders named after screens would mean either duplicating them or
inventing a shared folder, which is where this already is.

`domain/` holds no DOM references at all, which is what makes the
awkward parts — how Ukrainian sorts, which column is a name, what
`03/04` means — testable by running node against them directly.

The `domain/` layer holds no DOM references at all, which is what makes
the awkward parts — how Ukrainian sorts, which column is a name, what
`03/04` means — testable by running node against them directly.

---

## Contributing

Mirra collects nothing, so it cannot see what people use or where they
struggle. Suggestions are the only signal there is.

Open an issue, or write to **paintedfox.studio@gmail.com**.

Plans are on the [roadmap](roadmap.html): approximate ordering rather
than dates, and some of it may never ship if nobody wants it.

---

## Licence

**Mirra Licence 1.0** — see [LICENSE](LICENSE). Written for this project
because nothing off the shelf fit: every standard non-commercial licence
forbids business use, and business use is the entire point.

| | |
|---|---|
| Run your business on it | ✅ yes, whatever it earns |
| Read, fork, modify it | ✅ yes |
| Host it yourself, free of charge | ✅ yes |
| Use it in a non-commercial product | ✅ with attribution |
| Sell it, or charge for access | ❌ ask first |
| Call it Mirra | ❌ pick your own name |

Attribution means a visible credit and a link to this repository.
Derivatives need a different name — not out of pride, but so nobody
meets something broken or careless with their data believing it to be
this project.

Contributions are welcome. Submitting one licenses it to the author,
including for use under other terms — which is what makes a separate
commercial licence possible later. Copyright in your contribution stays
yours.

Want to do something the licence forbids? **paintedfox.studio@gmail.com**

Note that this is a source-available licence, not open source by the OSI
definition, which permits no restriction on field of use. The code is
public and yours to read, run, fork and modify; what is withheld is the
right to sell it.
