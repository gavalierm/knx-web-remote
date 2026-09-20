# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `../CLAUDE.md` first for the system-wide picture. The message format this app speaks is specified in `../knx_usb_ws/PROTOCOL.md`.

## What this is

A phone remote for the hall lighting: a PWA that opens a WebSocket to the bridge on the Pi and sends text commands.

**It is the secondary control surface.** The hall is operated day to day from a Streamdeck through Bitfocus Companion, which talks to the same bridge and is not part of this workspace. Treat this app accordingly — it is worth keeping healthy, but it is not what the crew depends on during an event.

**Svelte 4 + Vite, not SvelteKit.** Plain SPA: `index.html` → `src/main.js` → `src/App.svelte`. `"type": "module"`. No TypeScript; `jsconfig.json` sets `checkJs: true`, which is IDE-only — there is no `svelte-check` and no typecheck command.

## Commands

```bash
npm run dev                  # vite
npm run build                # vite build  → dist/
npm run preview              # vite preview
npm run generate-pwa-assets  # regenerate PWA icons
```

There is **no test, no lint and no typecheck command** in this repo. (A `lint` script exists in the dead `knx_web_remote_` directory — that is not this project, and it must not be worked in. See `../CLAUDE.md`.)

## Deploying

`npm run build`, then the contents of `dist/` are uploaded to a public FTP host **by hand, by the operator**. There is no deploy script and no CI.

**`dist/` is committed on purpose**, because it is the artefact that gets uploaded. `.gitignore` covers `node_modules` but deliberately not `dist`. Do not add it.

The working tree normally carries uncommitted `dist/` churn from the last build — Vite rewrites the bundle hash on every build. That is noise, not work in progress.

### The host must stay on `http://`

The page connects to `ws://`, and every current browser blocks a non-TLS WebSocket from a page served over `https://`, with no way to allow it. Phone control therefore works only while the host serves plain HTTP.

If someone enables HTTPS at the hosting provider, or the provider adds an automatic redirect, this app dies silently and the console error will not be obvious to whoever reports it. Moving to `https://` requires `wss://` on the bridge first, which means TLS on the Pi — a bridge change, not a frontend change.

**This does not block development.** `npm run dev` on a machine on the hall network connects to the real bridge exactly like the published page does, and the operator verifies from his own phone over that machine's address. Do the work, get it verified, and treat publishing as the last step.

**Known gap:** the URL of that host and the FTP credentials are not recorded anywhere and are not currently known. Ask for them when there is a build ready to publish — not before starting.

## How it connects

`src/lib/websocketClient.svelte.js` builds the URL from `localStorage` keys `_host` and `_port`, exposes a `statusStore` (`disconnected` / `connecting` / `connected`) and retries every 5 s.

But `App.svelte` **overwrites both keys on every mount**:

```js
localStorage.setItem("_host", "knxrpi.local");
localStorage.setItem("_port", "9240");
```

So the target is effectively hardcoded and there is no UI to change it. `knxrpi.local` resolves through the router's local DNS. **The app only works on the hall network** — it is publicly hosted but not remotely usable.

## Known defects and unfinished work

These are real, and none of them is a mystery — they are places where work stopped.

**Inbound messages are discarded.** `onMessage` parses the frame as JSON and returns early on failure, logging `"No json"`. The bridge sends plain text (`SWITCH SALA 1`). The result: this app never displays actual light state, and its buttons are blind. Companion, the other client, *does* consume that channel. If this app is ever meant to show state, this is the one thing to fix — and the fix belongs here, not in the protocol.

**Wake lock is disabled.** `@zakj/no-sleep` is the only runtime dependency and the whole wake-lock path exists, but `noSleep.enable()` is commented out, leaving only `console.warn("Enable NoSleep")`. The screen therefore sleeps mid-event. Commit `60980c9 StayAwake` stopped halfway.

**Notification / Badging permission is requested and then unused.** `checkNotificationPermission` asks the user, and both branches are empty apart from a comment.

**`src/lib/htmlHelper.js` contains dead jQuery code.** `showWarr()` uses `$(...)`, Font Awesome classes, an undefined global and a function that does not exist. jQuery is not a dependency. It was copied from another project and is never called.

**`websocketClient.svelte.js` has a misleading extension.** `.svelte.js` is the Svelte 5 runes convention; this project is Svelte 4 and the file uses classic `writable` stores. Renaming it is safe but touches imports.

**A commented-out authentication handshake** survives in the same file (`{"action":"authenticate","protocol":"701", ...}`). The bridge has no authentication and adding it would break Companion — see `../CLAUDE.md`. Do not revive this without deciding that question first.

## The address list is duplicated and out of date

`App.svelte` holds its own `commands` array and sends `ADDR <address> <value>` frames built from it:

| Label | Address |
|---|---|
| Central | 0/0/1 |
| Schody | 0/1/0 |
| Zvukári | 0/2/0 |
| Sála | 0/3/0 |
| Pódium | 0/4/0 |

The bridge's table in `../knx_usb_ws/app.js` has nine entries, including the DPT5 scenes (`uvod`, `chvaly`, `kazen`). **This app exposes none of them.** The two lists are maintained by hand and have already drifted.

The bridge is the source of truth. If the lists are ever unified, the direction is to take them from there — but that needs a protocol addition (there is no way to ask the bridge for its table), which means the Companion operator has to be in the conversation.
