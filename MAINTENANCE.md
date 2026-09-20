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

Options, in order of preference:

1. **A DHCP reservation for the Pi plus a name that is not `.local`.** The address is a lease (`dhcpcd: eth0: leased 10.77.8.208 for 1800 seconds`), so hardcoding the IP without a reservation trades a slow connection for a broken one. Router work — the operator's call.
2. **Client-side: try the IP first and fall back to the hostname.** Needs no router change, survives an address change, and removes the delay in the common case.

Do not simply hardcode the IP.

### State of this repository

Untouched so far in this maintenance work. All effort went to the bridge, where both causes of the recurring outage were. Known defects, unchanged and documented in `CLAUDE.md`:

- `onMessage` parses inbound frames as JSON, but the bridge sends plain text, so **every message from the bus is discarded**. The buttons are blind, and the connection indicator reports only whether this app's own socket is open — it says "connected" while the bus is dead.
- `noSleep.enable()` is commented out; the screen sleeps during an event.
- The address table is duplicated here and has drifted from the bridge's: five switches, none of the scenes.
- Dead jQuery code in `src/lib/htmlHelper.js`.

### Next

Bridge-side work is in progress to cache bus state and replay it to a client when it connects, so any client — this app and Companion alike — shows the truth immediately instead of waiting for the next telegram. Once that lands, fixing `onMessage` here turns this app from blind buttons into a real remote.
