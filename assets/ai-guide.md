{HUMAN_NOTICE}

---

# Working with a Mirra client sheet

You are reading this because someone asked you to help manage their
client records. Those records live in a Google Sheet that an app called
Mirra also reads and writes. This file tells you how to work in that
sheet without breaking it.

Mirra did not send you here and is not involved in this conversation.
This file was placed in the person's Google Drive by Mirra so that an
assistant they chose themselves has the rules rather than having to
guess them.

**Answer in whatever language the person is writing to you in.**

Their Mirra is set to {LANGUAGE_NAME}, which says nothing about how they
want to be spoken to. Somebody may keep their records in one language
and talk to you in another, and the sheet is not a vote on that.

## About the headings in this file

Every heading named below was **copied out of this particular sheet**.
They are the real text in its first row, and they are what you must
match.

Mirra understands a sheet in whichever language its headings happen to
be written, and does not care whether that matches the interface. A
sheet started years ago in Ukrainian keeps working for somebody now
using Mirra in English, and the other way round. More languages may be
added later. So the headings below may not look like the interface
language at all, and that is normal rather than a sign that something
is out of date.

Three things follow:

- **Use the headings exactly as given here.** Do not translate them, do
  not tidy their capitalisation, do not add one of your own.
- **Do not expect the canonical spelling.** Mirra also recognises
  shorthand somebody typed years ago, so a birthday column might be
  headed `ДР` or `DOB` rather than written out. Whatever it says below
  is what is in the sheet.
- **The headings' language says nothing about the values.** A client is
  called whatever they are called. Never transliterate a name to match
  the heading language — Олена stays Олена in a sheet headed in
  English.

This file describes schema version **{SCHEMA_VERSION}**, written by
Mirra {MIRRA_VERSION}.

---

## The eight rules

Read these before you touch anything. The rest of this file is detail.

1. **Read this file again before every change you make.** Not once at
   the start of the conversation — before each thing you write. A long
   conversation pushes earlier instructions out of reach, and the rules
   most easily lost are the ones below, whose breaking is silent. If
   you cannot re-read it, say so and write nothing.
2. **Never delete a row.** Not even when asked. Tell the person to do
   it in Mirra. Deleting a client in Mirra also removes the other half
   of every relationship pointing at them; a row deleted here leaves
   those pointing at nobody.
3. **Never edit `mirra.json`.** It is Mirra's own settings file. Read
   it, never write it.
4. **Never edit this file.** Mirra rewrites it when the schema changes.
5. **Never touch the `{COL_ID}` column of an existing row.** Mirra
   recognises people by it. Changing one silently breaks every
   relationship that points at that person.
6. **Phone numbers must be stored as text.** Put an apostrophe in front
   when you write one. Without it the sheet reads `{PHONE_EXAMPLE}` as
   a number and the leading zero disappears for good.
7. **Never leave a cell holding a formula.** If a value you write
   starts with `=`, `+`, `-` or `@`, put an apostrophe in front of it
   too.
8. **When in doubt, do nothing and say so.** A missing record is a
   nuisance. A quietly wrong one is worse, because nobody goes looking
   for it.

---

## The files

Everything lives in one folder on this person's Google Drive.

| What | Where |
| --- | --- |
| The Mirra folder | `{FOLDER_ID}` |
| The client sheet | `{CLIENTS_SHEET_ID}`, tab `{CLIENTS_TAB}` |
| Mirra's settings | `mirra.json` in that folder |
| This file | `ai.md` in that folder |

### `mirra.json`

Read it to find out how this person's Mirra is set up. Never write to
it. The fields you may care about:

- `dateFormat` — how dates are written in the sheet. Currently
  `{DATE_FORMAT}`, so {DATE_EXAMPLE_DATE} is written `{DATE_EXAMPLE}`.
- `language` — the interface language, currently `{LANGUAGE_CODE}`.
- `sections.clients.spreadsheetId` — the client sheet, so you can
  confirm you are looking at the right file.
- `schema` — which schema version each sheet holds.
- `version` — the Mirra release that last wrote the file.

**`schema` and `version` are Mirra's to write and nobody else's.** If
they look wrong to you, they are not wrong; your copy of this file is
old. See *Checking that these rules still apply* at the end.

---

## The client sheet

One row per person. The first row holds the headings.

**Find columns by their heading, never by position.** The order differs
between sheets and changes between Mirra releases. Reading the fourth
column because the phone number was fourth last time is how you write a
phone number into somebody's birthday.

{COLUMN_TABLE}

{MISSING_COLUMNS}

{EXTRA_COLUMNS}

### `{COL_ID}` — leave it empty on a new row

Do not invent one. Write the row with that cell empty, and Mirra will
fill it in the next time the person opens their clients. It will ask
them first and say that a record arrived without a reference.

The reason is not that the format is secret. It is that an id must be
unique across the whole sheet for ever, and the only way to be sure of
that is for one piece of software to be in charge of making them. That
is Mirra.

### `{COL_PHONE}` — one number, always as text

Write it with an apostrophe in front:

```
'{PHONE_EXAMPLE}
```

The apostrophe is not stored; it tells Sheets "this is text, do not do
arithmetic on it". Without it:

- a leading zero is dropped — `{PHONE_EXAMPLE}` becomes a number and
  the first digit is gone
- a `+` at the front makes Sheets read the cell as a formula:
  `+380 67 123 45 67` ends up as `#ERROR!`, and `+380671234567`
  quietly turns into a number
- a long number may be shown as `3.80671E+11`, and the digits past the
  sixth are rounded away and cannot be recovered

Mirra notices all three and tells the person, but only the first can be
repaired. The other two mean phoning that client to ask for their
number again.

Keep whatever shape the person dictates — `{PHONE_EXAMPLE}` and
`+380 67 123 45 67` are both fine. Mirra reads either.

One number per cell. If somebody has two, put the second in
`{COL_NOTES}`.

### `{COL_BIRTHDAY}` and `{COL_LAST_VISIT}` — dates

Write them in this sheet's format, which is `{DATE_FORMAT}`:
{DATE_EXAMPLE_DATE} is written `{DATE_EXAMPLE}`.

A birthday may have no year, which is common and perfectly useful —
write just the day and month: `{DATE_SHORT_EXAMPLE}`. Do not invent a
year. A birthday with a made-up year shows the person a wrong age for
ever, and nobody will know where it came from.

Never write a date as words. `next Tuesday`, `позаминулого тижня` and
`перед Великоднем` all mean something to a person and nothing to
Mirra — it will report the cell as unreadable. Work the date out and
write the digits.

### `{COL_SOCIALS}` and `{COL_MESSENGERS}`

`Network: handle`, several separated by a comma:

```
Instagram: @olena.k, TikTok: @olena
```

```
Telegram: @olena, WhatsApp: +380671234567
```

Mirra knows: Instagram, TikTok, Facebook, Threads, YouTube, Pinterest,
LinkedIn, X in `{COL_SOCIALS}`; Telegram, WhatsApp, Viber, Signal,
Messenger in `{COL_MESSENGERS}`.

It reads these forgivingly and tidies them into its own shape the next
time the person edits that client, so an `@` more or less does not
matter. A network it does not recognise is kept exactly as written, so
nothing is lost.

### `{COL_LINKS}` — do not write this column

It records who is related to whom: a mother and her child, partners, a
guardian. Each entry carries the other person's id, and Mirra keeps
both halves of every relationship in step — write one half and the
other card ends up pointing at nobody.

If the person wants to record a relationship, tell them it takes two
taps on the client's card in Mirra, and that doing it there keeps both
sides correct.

### `{COL_NOTES}` — free text and tags

Anything. One thing to know: a word beginning with `#` is a **tag**,
and the person can search by it. `#фарбування`, `#vip`, `#алергія`.

So:

- keep any `#word` already in a note exactly as it is — removing one
  removes the person from a search they rely on
- when they say "tag her as X", write `#X` into the note
- do not add tags they did not ask for

A `#` elsewhere in a sentence is harmless; only a word that starts with
one is a tag.

---

## Adding a client

1. Read the heading row and find your columns by name.
2. Append a new row at the bottom. Do not insert one in the middle.
3. Fill only the columns you were given something for. Leave the rest
   empty rather than writing a placeholder — an empty cell reads as
   "not known", and `-` or `n/a` reads as data.
4. Leave `{COL_ID}` empty.
5. Put an apostrophe in front of the phone number.

### Check first whether they already exist

Before appending, look for the same person: the same phone number, or
the same name. Mirra does this check itself and offers to update the
existing record instead, and duplicating somebody splits their history
in two.

If you find a likely match, **say so and ask** rather than deciding.
Two clients can genuinely share a name.

---

## Updating a client

Find the row by `{COL_ID}` if you have it, otherwise by phone number,
otherwise by name. Change only the cells you were asked to change.

If the name is what is being corrected, say which row you are changing
and what it says now, so the person can stop you if it is the wrong
one.

Do not rewrite a cell to tidy it up. A phone number written in an
unusual way, a note in shorthand, a date in an older format — all of
that is theirs, and Mirra handles it.

---

## Deleting

**Do not.** Not a row, not a cell you were not asked about, not a
"cleanup" of anything.

If the person asks you to delete a client, say this, in the language
they are writing to you in:

> I do not delete records. In Mirra, removing a client also removes the
> other half of every relationship pointing at them — a row deleted
> from the sheet leaves those pointing at nobody. Open their card in
> Mirra and delete it there, and nothing is left dangling.

Do not offer a way around it: not clearing the row instead, not moving
it to another tab, not making a copy of the sheet without that row.
Those are all deletions with extra steps, and the relationships break
in exactly the same way.

Clearing a single cell because the person said "she changed her number,
I don't have the new one" is not a deletion. That is fine.

---

## If you are asked to do something on this list

Say which rule it is and why it exists, offer the thing that does work,
and stop. Do not look for a way round it — a copy of the file, a second
tab, a script, a "just this once". The rule is there because the damage
is silent, and silent damage is not discovered until somebody needs the
data.

For `schema` and `version` in `mirra.json`, say this, in the language
they are writing to you in:

> The `version` and `schema` fields are Mirra's to write, and I do not
> change them. If they look wrong, open Mirra once and it will update
> them itself. Changed by hand, they can make Mirra read your data
> incorrectly — and you would not see it happen.

---

## Checking that these rules still apply

This file was written by Mirra and matches the sheet as it was then. If
the person has not opened Mirra since it was updated, this file may
describe a sheet that has changed.

Before every write — not only the first one in a conversation — read
this file again and compare:

- `schema.clients` in `mirra.json`
- `{SCHEMA_VERSION}`, at the top of this file

Re-reading is cheap and the conversation may have been going on for
hours. Mirra could have rewritten this file in the meantime, and what
you remember of it is the thing most likely to be out of date.

If they differ, **do not write anything.** Tell the person, in the
language they are writing to you in, that your instructions are out of
date, and ask them to open Mirra once so it can refresh them.

If they match, the rules here are current.

---

## If you think this file is wrong

It may be. Tell the person, and ask them to report it at
`https://github.com/anna-gura/mirra/issues` — it helps everybody using
Mirra, not only them.

Do not fix it yourself. Mirra regenerates this file, so an edit would
be lost anyway; and an assistant that can relax its own instructions
has no instructions.

---

## What Mirra is, for context

A browser-only app for keeping client records in your own Google Sheet.
No accounts, no server of its own, nothing stored anywhere but the
person's own Google Drive. It is open source:
`https://github.com/anna-gura/mirra`, and it lives at
`https://mirra.day`.

An explanation of this file, written for the person rather than for
you, is at `{AI_PAGE_URL}`.
