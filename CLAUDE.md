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

### The host is http://knx.tymy.sk and must stay on `http://`

The page connects to `ws://`, and every current browser blocks a non-TLS WebSocket from a page served over `https://`, with no way to allow it. Phone control therefore works only while the host serves plain HTTP.

Verified 2026-09-20 — the hosting is already configured for this:

```
http://knx.tymy.sk/    200, no redirect
https://knx.tymy.sk/   302 -> http://knx.tymy.sk/     (openresty)
```

**That downgrade redirect is load-bearing. Do not let anyone "fix" it.** Forcing HTTPS — a provider default, a security sweep, a well-meaning admin — kills phone control silently, and the console error will mean nothing to whoever reports it. Moving to `https://` properly requires `wss://` on the bridge first, which means TLS on the Pi: a bridge change, not a frontend change.

**This does not block development.** `npm run dev` on a machine on the hall network connects to the real bridge exactly like the published page does, and the operator verifies from his own phone over that machine's address. Do the work, get it verified, and treat publishing as the last step.

### Publishing

Manual FTP upload of `dist/`. **The FTP credentials are still not recorded anywhere** — ask for them when there is a build ready to publish.

As of 2026-09-20 the live build was `index-4gNYXZnX.js`, `Last-Modified: Sun, 04 Feb 2024`: nothing had been published for two and a half years, and the matching file sits untracked in the working tree.

**The service worker is a trap when publishing.** `sw.js` and `manifest.webmanifest` are live, and a PWA caches its shell hard, so after an upload a returning phone can keep running the previous app until the worker updates. Verify a deployment on a device that has never opened the page, or clear the site data first — otherwise "it didn't upload" and "the worker hasn't updated yet" look identical.

## How it connects

`src/lib/websocketClient.svelte.js` builds the URL from `localStorage` keys `_host` and `_port`, exposes a `statusStore` (`disconnected` / `connecting` / `connected`) and retries every 5 s.

`App.svelte` sets defaults in `onMount` — `knxrpi.lan` and `9240` — but **only when the keys are missing**, so a value set deliberately survives. A host still carrying the old `knxrpi.local` is migrated to `knxrpi.lan` on load.

**Use `knxrpi.lan`, never `knxrpi.local`.** The `.local` name is served by avahi on the Pi, and `.local` is reserved for mDNS, so browsers send it to multicast — measured at 5.03 s per lookup on this network against 0.04 s for `knxrpi.lan`, which is a router DNS record against a static 10.77.8.208. Until 2026-09-20 this app hardcoded the slow name and retried every 5 s, so after any bridge restart the phone sat idle before it could show anything.

There is still no UI to change the host. **The app only works on the hall network** — it is publicly hosted but not remotely usable.

## Known defects and unfinished work

These are real, and none of them is a mystery — they are places where work stopped.

**Fixed 2026-09-20 — inbound messages used to be discarded.** `onMessage` parsed each frame as JSON, logged `"No json"` and returned, so everything the bridge sent was thrown away and the buttons showed nothing but their own CSS: the dot was red on the OFF button and green on the ON button regardless of what the lights were doing.

It now parses the text protocol into `stateStore` (`{ sala: { type: 'switch', value: '1' } }`), and the button matching the current value is lit while the other is dim — so a change made from the wall panel or from Companion shows up here. The store is cleared on disconnect, because displaying what the lights were doing when the connection dropped is the same lie in a different form; the bridge replays current state as soon as a client connects.

`commands` entries carry a `name` that must match the bridge's translator key — that is what bus state arrives under.

### Layout

One circuit is one thing with two states, so it gets **one** name: Vyp on the left, the name in the middle, Zap on the right, and the side that is actually true is filled in. The earlier layout repeated the title on both buttons and carried a dot coloured by CSS rather than by anything real.

Scenes come first and are given room. The crew moves between úvod, chvály and kázeň constantly during a programme; individual circuits are the exception, not the rule.

A circuit whose state the bridge does not know needs no special mark: when **neither** button is filled, that is what unknown looks like. On this installation unknown is the normal state after a restart, because the bus does not answer read requests.

**Never mute text to convey state.** An earlier version dimmed the circuit's name when its state was unknown, which traded the one thing you most need to read for something the buttons already said. Hierarchy comes from size, weight and colour — never from `opacity` on text. The only `opacity` left in the component is on a bar of the hamburger icon, which is decoration.

**The app is dark, and that is functional.** It runs on a phone in a darkened hall while a programme is on: a white screen lights the operator's face and carries into the room. `src/app.css` holds the tokens — background, surfaces, text, and a warm lamp amber (`--lit`) as the accent, chosen because what these buttons control is light, not because interfaces are usually blue.

It also sets the touch behaviour that makes this read as an app rather than a page: no tap highlight, no double-tap zoom, no text selection, and safe-area padding so it sits correctly full-screen on a phone.

Before 2026-09-20 that file was the Vite template's: dark values on `:root`, immediately overridden by a white `body`. Anyone styling against `:root` was quietly misled.

**Buttons carry no border.** That something is pressable is implicit, and a rim inside an already-framed row is a box in a box. Resting state is a surface; the active one is filled solid. A circuit that is on warms its **whole row**, not just its button, so which lights are live reads at a glance from across the hall. The scene in effect glows. Sections are titled (`Scény`, `Okruhy`) — without headings a row of three unlabelled buttons says nothing about what it controls.

### Central has no state of its own

It is a group command: it sends off to everything below it and has no status object, so the bus never reports anything for it. Its state is **derived** here — if any circuit it governs is lit, central is on; when all are off, it is off; when none is known, it shows as unknown.

The bridge deliberately does not do this. Deriving it there would mean inventing a telegram the bus never carried, and everything the bridge reports is something it actually saw. Before this, central's cached value was the last command sent, so the app could say "Central: off" with three circuits lit.

### Scenes are blue, circuits are amber

Two accents on purpose. A circuit is a lamp and amber says so; a scene is a choice about the whole room, not a lamp, and one accent for both made them read as the same kind of control.

### Showing state without pretending

The bridge remembers bus state across restarts, so something is on screen the moment the app opens instead of after a wait that can run to hours. A remembered value must never be presented as a live one, so the heading carries the qualifier: `stav z 08:51`, or `stav spred 2 d` past twelve hours.

`liveStore` decides which it is. The bridge replays what it remembers the instant a client connects, so anything arriving in the first 1.5 s is a memory; anything later is the bus actually doing something, and the qualifier disappears. `HEALTH` is requested on connect, not just when the panel opens, because that is where `STATEAGE` comes from.

### The status panel

Behind the hamburger in the header, collapsed by default — during an event the buttons are what matter. Opening it sends `HEALTH` to the bridge and repeats every five seconds while open; the interval is cleared on close and on destroy. `HEALTH` puts nothing on the KNX bus, so it is safe at any time, including during a programme.

It exists because the app could otherwise only tell whether **its own socket** was open, and that socket stays up perfectly well while knxd is dead or the bus is unreachable — the "it says connected but nothing works" case.

Three states, never two: a value of `-1` from the bridge means *cannot determine* and is shown as "nezistené", not as "no". The panel also says plainly that an unknown circuit is unknown rather than off, because on this installation the bus does not answer read requests — see `../knx_usb_ws/MAINTENANCE.md`.

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
