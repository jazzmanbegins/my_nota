# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**My Nota** is a Chrome Extension (Manifest V3) for Notion-style block notes, styled like Post-it paper. It is plain HTML/CSS/vanilla JS with no build step, no package manager, no bundler, and no test suite. The user interface and comments are in Thai, and the user communicates in Thai.

## Running / checking

- **Load the extension:** open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select this folder. After changing code, use the extension's **Reload** button.
- **Syntax check:** `node --check js/<file>.js` (also run it on `background.js`). This is the only automated check.
- **Testing the UI without installing:** serve a copy of the folder over `python -m http.server`. Inject a small script before `js/storage.js` in `popup.html` that defines a fake `window.chrome`. It needs:
  - `storage.sync` / `storage.local` backed by `localStorage`, with `get`, `set`, `remove` and `getBytesInUse`
  - `storage.onChanged.addListener`
  - `runtime.connect` and `runtime.getURL`
  - `windows.getCurrent`, `sidePanel.open` and `tabs.create`

  Keep this harness outside the repo (for example in a scratchpad folder) so the shipped `popup.html` stays clean.

## Hard constraints

- **Never remove `"key"` from `manifest.json`.** It pins the extension ID (`ifhjgglokfbjbcmehnicgkonoifkkboh`), so every unpacked install shares the same `chrome.storage.sync` data. Without it, each machine gets a different ID and notes stop syncing.
- **No remote code (MV3 rule).** Every library-like piece is hand-written and local: the syntax highlighter, the icons, and the fonts in `fonts/`, which hold Poppins for Latin and Noto Sans Thai for Thai, plus the `@font-face` CSS. Do not add CDN script tags.
- **Sync quota:** `chrome.storage.sync` allows 100 KB in total and 8 KB per item, plus write-rate limits. Keep note data compact:
  - Drawings are stored as simplified vector strokes, never as images.
  - Rich text is stored as `html` only when formatting actually exists.
- **Uninstall wipes data on every device:** uninstalling the extension wipes its `storage.sync` data. The user tested this on 2026-10-22: removing the extension on one synced machine also erased the notes on the other machine, because the deletion syncs through the Google account. A durable backup outside the extension (Supabase, Google Drive, or auto file backup) was discussed but deferred by the user. The only backup today is manual export/import as `.json`.

## Architecture

`popup.html` is the only page. It serves three modes through `?mode=`:
- the popup, which is 400×580
- `panel`, the side panel declared in the manifest
- `tab`

Any mode other than the popup adds `html.wide` for a fluid layout.

Scripts load in this order as plain globals (no modules): `icons.js` → `colors.js` → `storage.js` → `highlight.js` → `draw.js` → `app.js`.

| File | Global | Role |
|---|---|---|
| `js/storage.js` | `Store` | Persistence and sync engine. Also loaded by `background.js` via `importScripts`. |
| `js/app.js` | (IIFE) | All UI: board/list view, block editor, popovers, import/export, remote-merge handling. |
| `js/highlight.js` | `Highlight` | Code highlighter and language guesser for about 25 languages. |
| `js/draw.js` | `Sketch` | Drawing block (canvas, pointer events, eraser, undo, card thumbnails). |
| `js/colors.js` | `NoteColors` | Note palette, custom colors, automatic text tone. |
| `js/icons.js` | `Icons` | Stroke SVG icon set, plus auto-injection into `[data-icon]` elements. |

### Storage / sync flow (`storage.js`)

- **Sync layout:** each note is JSON, deflate-raw compressed, base64-encoded, then split into chunks.
  - Keys `c:<id>:<i>` hold the chunks.
  - Keys `m:<id>` hold `{c: chunkCount, u: updated}`.
- **Drafts:** `Store.save(note)` writes immediately to `chrome.storage.local` as a *draft*, then debounces one batched `sync.set`. This protects against data loss when the popup closes mid-edit.
- **Background flush:** `background.js` listens for the UI port (`nota-ui`) to disconnect, then flushes any leftover drafts.
- **Remote changes:** `chrome.storage.onChanged` (area `sync`) is filtered against `syncedMeta` to ignore the instance's own writes. `Store.onRemote` then hands the notes to `app.js`, which merges them by `updated` (last write wins) and re-renders.
- **Status:** `Store.onStatus` drives the status bar (`synced` / `saving` / `pending` / `error`), including the quota and rate-limit messages.

### Note data model

```js
{ id, title, color, pinned, created, updated, blocks: [...] }
// color: preset name ('yellow', 'navy', ...) OR '#rrggbb'
// block: { id, type, text, html?, checked?, lang?, strokes?, h? }
```

Block types are `text h1 h2 todo bullet numbered quote code draw divider`.
- **Static blocks:** `divider` and `draw` have no caret. `isStatic()` in `app.js` makes keyboard navigation skip over them.
- **`text` and `html`:** `text` is always plain text, used for search and card previews. `html` exists only when the block has `<b>` or `<i>`. All rich content goes through `sanitize()` → `setContent()` in `app.js`, which allows only `b`, `i` and `br`.
- **Code blocks:** a `<textarea>` overlaid on a highlighted `<pre>`. The output of `Highlight.code()` must reproduce the source text **exactly** after tags are stripped, or the caret will misalign. Re-verify this round-trip after any highlighter change.
- **Drawings:** `strokes` are `{c, w, p:[x,y,...]}` on a logical 360-wide board with height `h`, scaled to the real width when rendered.

### Editor conventions (`app.js`)

- **Text blocks:** `contenteditable="true"`. Paste is forced to plain text. Ctrl+B / Ctrl+I use `execCommand`.
- **Shortcuts:** markdown shortcuts and the `/` slash menu are both handled in `onTextInput` / `onTextKey`.
- **Saving:** every mutation calls `touch()`, which updates `updated` and calls `Store.save`.
- **Popovers:** share one system: `placePopover`, plus `closePopovers`, which calls an optional `pop.onclose`.
- **Confirmations:** destructive actions use an inline "ยืนยัน…?" second click, never `confirm()` dialogs.
- **Per-device preferences:** use `localStorage` (`nota:*` keys, wrapped in try/catch), not synced storage.

### Theming (`styles.css` + `colors.js`)

- **Colors:** `NoteColors.paint(el, color)` sets `--note` and `--note-top` inline on `.paper` and `.card`.
- **Text tone:** it adds `.tone-dark` when light ink has better contrast than dark ink. `.tone-dark` redefines `--ink`, `--ink-soft`, `--ink-rgb`, `--ink-inv` and `--pad-bg`.
- **Rule for new CSS:** inside note surfaces, use `rgba(var(--ink-rgb), a)` and these variables, never hard-coded dark colors, so dark notes stay readable.
- **Icons:** all UI icons are stroke SVGs from `Icons.svg(name)` or `data-icon="name"`. Do not use emoji in the UI (the user explicitly asked for this).
