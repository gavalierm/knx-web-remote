# Maintenance log

One entry per maintenance pass, newest first, including passes where nothing changed. The rule for recording your own wrong claims is in `../CLAUDE.md`; the sibling log in `../knx_usb_ws/MAINTENANCE.md` carries the bridge-side history.

---

## 2026-09-20 — wrong turn, no code changes yet

### Claimed the FTP gap blocked frontend work. It does not.

| Claimed | Actually |
|---|---|
| Work on this app is blocked until the FTP host URL and credentials are known, because a build cannot be shipped | Only *publishing* needs them. `npm run dev` on any machine on the hall network reaches the real bridge exactly as the published page does, and the operator verifies from his phone over that machine's address. The full development and verification loop is available today |

The check that was skipped: asking what the verification loop actually is, instead of assuming that "deployed" and "testable" are the same thing. They are not, in a LAN-only system where the developer's own machine is already on the same network as the bridge.

Corrected in `CLAUDE.md` here and in `../CLAUDE.md`.

### Measured: resolving `knxrpi.local` costs 5 seconds per connection

```
ws://10.77.8.208:9240       15 ms    15 ms    12 ms
ws://knxrpi.local:9240    5029 ms  5029 ms  5024 ms

hostname resolution alone:  knxrpi.local 5.04 s   ·   10.77.8.208 0.03 s
```

The delay is entirely in name resolution, not the connection. `.local` is tried over mDNS first, times out after five seconds, and only then falls back to the router's DNS record.

This app hardcodes `knxrpi.local` (`App.svelte` overwrites `localStorage._host` with it on every mount) and retries every 5 s, so after any bridge restart the phone sits idle for five seconds before it can show anything, and during an outage those waits chain. Measured from macOS; browsers use their own resolvers, so the exact cost on a phone needs its own measurement — but the name is the thing to stop depending on.

Cause confirmed:

```
avahi-daemon on the Pi:          active, hostname knxrpi
resolving knxrpi.local:          5.01 s  (succeeds, over mDNS)
router 10.77.8.1 for "knxrpi":   nothing
router for "knxrpi.local":       nothing
network search domain:           none
```

So the name is served by **avahi on the Pi**, and the router knows nothing about it.

**Moving the record to the router is necessary but not sufficient.** RFC 6762 reserves `.local` for mDNS, and macOS and Android send `.local` queries to multicast regardless of what unicast DNS holds — a `knxrpi.local` A record on the router would still be bypassed. **The suffix has to change.**

That five seconds instead of milliseconds also suggests multicast is filtered or rate-limited on this network, which is a second reason not to depend on it.

The fix, in order:

1. **On the router:** a DHCP reservation for the Pi's MAC pinned to 10.77.8.208, and an A record under a name that is **not** `.local` — `knxrpi.lan` or whatever suffix the router serves. Both are needed: the address today is a lease (`dhcpcd: eth0: leased 10.77.8.208 for 1800 seconds`), so a name without a reservation still points at something that can move.
2. **In this app:** default to that name, and keep a fallback so a resolution failure is not a dead app.
3. **Leave avahi running** on the Pi. It costs nothing and remains a fallback for anyone on a network without the DNS record.

Do not simply hardcode the address — that trades a slow connection for one that breaks at the next lease change.

### Wrong turns while doing this work

| What happened | Actually | The check that was skipped |
|---|---|---|
| Passed source to the Svelte autofixer with HTML-escaped angle brackets (`&lt;script&gt;`). It returned a JavaScript parse error, which reads like a fault in the code | The code was fine. Tool parameters take **raw source**, never HTML-escaped text — the escaping was introduced while composing the call | Read the error literally: a parse failure at line 8 column 2 of a file that had just built cleanly points at the input, not the source |
| Wrote a commit message with `git commit -m "... backticked words ..."` | The shell ran them as commands. Two words vanished from the message and the terminal reported `command not found`. Backticks inside double quotes are command substitution | Use `git commit -F -` with a quoted heredoc, which is what every other commit today used. The warning was already on screen — `command not found: scene` — and was nearly scrolled past |
| Reported that a second WebSocket client "received 0 state messages", and treated it as the replay feature failing | The client had never connected. Its `open` event was missing from the output entirely, and the bridge's own log showed all three clients connecting and all three being served | Look for the connect event before judging what arrived after it. The test used fixed timers, and connections here took five seconds because of the `.local` lookup, so the steps ran out of order |
| Ran a scripted edit that printed "hotovo" and moved on | The change was never applied — the replacement string had three tabs of indentation where the file has two. Caught only because the commit afterwards said "nothing to commit, working tree clean" | A scripted edit has to assert its own result and fail loudly, not print success unconditionally. Every one since checks the change is present before reporting |

The last is the worst of them, because it fails quietly: a wrong claim gets argued with, a no-op just sits there looking finished.

The connection-timing one has a reusable lesson for this project specifically: **connections take seconds, not milliseconds**, so any test sequenced on fixed timers will lie. Drive test steps off `open` events, not `setTimeout`. That the delay was itself the bug being hunted made it worse — the test was built on the assumption the measurement later destroyed.

### What was done here

- **Inbound messages are parsed.** The text protocol fills a `stateStore`, so the buttons show what the lights are actually doing — including changes made from the wall panel or Companion. Previously every message from the bus was discarded as "No json".
- **Scenes are shown at all**, which they never were, and tracked by value rather than name to sidestep the bridge's duplicate `1/0/0` entry.
- **A status panel** behind the hamburger, fed by the new `HEALTH` query, so the app can say whether knxd and the bus are alive rather than only whether its own socket is open.
- **The host moved to `knxrpi.lan`**, removing a five-second wait from every connection.
- **The interface was redesigned** — dark, warm amber for circuits, blue for scenes, app-like touch behaviour. See `CLAUDE.md` for why dark is a functional choice here.
- **Two layout shifts removed**: the waiting note moved into the heading, and losing the connection no longer blanks the whole screen.

Still open, unchanged from the start of the day:

- `noSleep.enable()` is commented out; the screen sleeps during an event.
- The address table is duplicated from the bridge's and has to be kept in step by hand.
- Dead jQuery code in `src/lib/htmlHelper.js`.
- Nothing has been published yet — the live site still serves the February 2024 build.
