# Security

## Reporting

Email **paintedfox.studio@gmail.com**. Please do not open a public issue
for anything exploitable — write first, and the fix and the disclosure
can go out together.

Say what you found, how to reproduce it, and what it lets somebody do.
You will get an answer, including if the answer is that it is known or
not a problem.

## What the threat model actually is

Mirra has no server and no database, so the usual targets are absent:
there is no account to take over, no session store to steal, no list of
users to leak. What exists is a browser holding one person's access
token and talking to Google.

That shapes what matters:

- **Anything that runs script on the page** can read that token and the
  client records on screen. This is the whole risk surface, which is why
  the Content-Security-Policy forbids inline script and why no part of
  the app builds HTML from strings.
- **The API key and client ID are public.** They ship in the bundle and
  can be read by anybody. What protects them is the origin allow-list in
  Google Cloud Console: on another site they do nothing. Treating them
  as secrets would be theatre.
- **The token is short-lived.** Google voids it within the hour, and the
  scope it carries reaches only files the user handed the app.

## Rules the code follows

- No inline scripts or inline styles; the CSP has no `unsafe-inline`.
- No `innerHTML`, `eval`, `document.write`, or `new Function` with any
  value that came from outside this repository. Text goes in through
  `textContent`; elements are built, never parsed.
- Markup fetched from `views/` is parsed as a fragment, not assigned.
- Client data never reaches a console log, an analytics call, or a third
  party, because none of those exist.
- Every new third-party origin needs a CSP line, and every CSP line
  needs a reason written next to it.

## Headers

Set in `_headers` at the repository root, with the reasoning beside each
one. The two deliberate omissions are documented there: `preload` on
HSTS, and `Cross-Origin-Embedder-Policy`.
