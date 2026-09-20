<script type="text/javascript">
  //
  //
  import { onMount, onDestroy } from "svelte";
  import {
    connect,
    sendMessage,
    statusStore,
    stateStore,
    healthStore,
    requestHealth,
  } from "./lib/websocketClient.svelte.js";
  //
  import NoSleep from "@zakj/no-sleep";
  var noSleep = new NoSleep();

  async function requestNoSleep() {
    // Enable wake lock.
    // (must be wrapped in a user input event handler e.g. a mouse or touch handler)
    document.addEventListener(
      "click",
      function enableNoSleep() {
        console.warn("Enable NoSleep")
        document.removeEventListener("click", enableNoSleep, false);
        //noSleep.enable();
      },
      false,
    );
  }

  $: status = $statusStore;
  $: state = $stateStore;
  // Until the bridge has told us anything, say so rather than showing buttons
  // that look authoritative. It replays what it knows the moment we connect,
  // so this is usually empty only for a moment after a bridge restart.
  $: knowsState = Object.keys(state).length > 0;
  $: health = $healthStore;

  // The status panel. Collapsed by default - during an event the buttons are
  // what matters. While it is open the bridge is asked every five seconds;
  // HEALTH puts nothing on the KNX bus, so this is safe at any time.
  let showStatus = false;
  let healthTimer = null;

  function toggleStatus() {
    showStatus = !showStatus;
    clearInterval(healthTimer);
    if (showStatus) {
      requestHealth();
      healthTimer = setInterval(requestHealth, 5000);
    }
  }

  onDestroy(() => clearInterval(healthTimer));

  function humanUptime(seconds) {
    const s = Number(seconds);
    if (!isFinite(s) || s < 0) return "?";
    if (s < 60) return s + " s";
    if (s < 3600) return Math.floor(s / 60) + " min";
    if (s < 86400) return Math.floor(s / 3600) + " h";
    return Math.floor(s / 86400) + " d";
  }

  // -1 from the bridge means "cannot determine", which is not the same as no.
  function flag(value) {
    if (value === undefined) return { text: "?", ok: null };
    if (value === "-1") return { text: "nezistené", ok: null };
    return value === "1" ? { text: "áno", ok: true } : { text: "nie", ok: false };
  }

  async function requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // You can now use the Badging API
    }
  }

  async function checkNotificationPermission() {
    const permissionStatus = await navigator.permissions.query({
      name: "notifications",
    });

    switch (permissionStatus.state) {
      case "granted":
        // You can use the Badging API
        break;
      case "denied":
        // The user has denied the permission
        break;
      default:
        // The user has not yet granted or denied the permission
        await requestNotificationPermission();
        break;
    }
  }
  onMount(() => {
    //
    requestNoSleep();
    //
    checkNotificationPermission();
    //
    //
    // knxrpi.lan, not knxrpi.local. The .local name is served by avahi on the
    // Pi and every lookup costs five seconds: .local is reserved for mDNS, so
    // browsers send it to multicast, which is slow or filtered on this network.
    // Measured 2026-09-20: 5027 ms to connect by .local, 17 ms by .lan.
    // knxrpi.lan is a router DNS record against a static 10.77.8.208.
    //
    // Only set when missing, so a value put there deliberately survives.
    if (!localStorage.getItem("_host")) {
      localStorage.setItem("_host", "knxrpi.lan");
    }
    if (!localStorage.getItem("_port")) {
      localStorage.setItem("_port", "9240");
    }
    // Anyone still carrying the slow name from an earlier version gets moved.
    if (localStorage.getItem("_host") === "knxrpi.local") {
      localStorage.setItem("_host", "knxrpi.lan");
    }
    connect();
  });

  function onSendMessage() {
    if (this.value == undefined) {
      return;
    }
    sendMessage(this.value);
  }

  // `name` must match the bridge's translator entry in app.js - that is the
  // key the bus state arrives under (SWITCH SALA 1). This table is a duplicate
  // of the bridge's and has already drifted from it once; see CLAUDE.md.
  let commands = [
    { title: "Central", path: "0/0/1", name: "central" },
    { title: "Schody", path: "0/1/0", name: "schody" },
    { title: "Zvukári", path: "0/2/0", name: "zvukari" },
    { title: "Sála", path: "0/3/0", name: "sala" },
    { title: "Pódium", path: "0/4/0", name: "podium" },
  ];

  // The scenes are what the hall actually runs on - the crew moves between
  // these during a programme, from the Streamdeck and from the wall panel,
  // far more often than they touch a single circuit. The bridge has known
  // them all along; this app did not show them at all.
  //
  // `value` is what identifies the scene coming back from the bus; see the
  // note in websocketClient.svelte.js about why name matching does not work.
  let scenes = [
    { title: "Úvod", name: "uvod", value: "0" },
    { title: "Chvály", name: "chvaly", value: "1" },
    { title: "Kázeň", name: "kazen", value: "2" },
  ];

  function onScene() {
    if (this.value == undefined) return;
    sendMessage(this.value);
  }
</script>

<header>
  <div class="title">
    <h1>Svetlá</h1>
    <span class="pulse" class:live={status === "connected"}></span>
  </div>
  <button
    class="hamburger"
    class:open={showStatus}
    on:click={toggleStatus}
    aria-expanded={showStatus}
    aria-label="Stav systému"
  >
    <span></span><span></span><span></span>
  </button>
</header>

{#if showStatus}
  <div class="panel">
    {#if status !== "connected"}
      <div class="row"><span>Spojenie</span><b class="bad">{status}</b></div>
    {:else if !health}
      <div class="row"><span>Stav</span><b>zisťuje sa…</b></div>
    {:else}
      {@const knxd = flag(health.knxd)}
      {@const listener = flag(health.listener)}
      {@const usb = flag(health.usb)}
      <div class="row"><span>Spojenie na bridge</span><b class="good">áno</b></div>
      <div class="row">
        <span>Spojenie na knxd</span>
        <b class:good={knxd.ok === true} class:bad={knxd.ok === false}>{knxd.text}</b>
      </div>
      <div class="row">
        <span>Odber zbernice</span>
        <b class:good={listener.ok === true} class:bad={listener.ok === false}>{listener.text}</b>
      </div>
      <div class="row">
        <span>USB rozhranie KNX</span>
        <b class:good={usb.ok === true} class:bad={usb.ok === false}>{usb.text}</b>
      </div>
      <div class="row">
        <span>Posledný telegram</span>
        <b>{health.lastbus === "-1" ? "zatiaľ žiadny" : humanUptime(health.lastbus) + " dozadu"}</b>
      </div>
      <div class="row"><span>Bridge beží</span><b>{humanUptime(health.uptime)}</b></div>
      <div class="row"><span>Pripojení klienti</span><b>{health.clients ?? "?"}</b></div>
      <div class="row">
        <span>Známy stav</span>
        <b>{health.known ?? "?"} z {health.addresses ?? "?"} adries</b>
      </div>
      <p class="note">
        Neznámy stav neznamená vypnuté. Zbernica na tejto inštalácii
        neodpovedá na dopyt, takže bridge sa stav dozvie až keď niekto
        okruh prepne.
      </p>
    {/if}
  </div>
{/if}

{#if status !== "connected"}
  <div class="offline">
    {status === "connecting" ? "Pripája sa…" : "Bez spojenia s bridgeom"}
  </div>
{/if}

<h2>Scény</h2>
  <div class="scenes">
    {#each scenes as scene (scene.name)}
      <button
        on:click={onScene}
        value={"SCENE " + scene.name}
        disabled={status !== "connected"}
        class:active={state.activeScene === scene.value}
      >
        {scene.title}
      </button>
    {/each}
  </div>

  <h2>
    <span>Okruhy</span>
    {#if !knowsState}<span class="hint">čaká sa na stav</span>{/if}
  </h2>
  <div class="circuits">
    {#each commands as command (command.name)}
      <div class="circuit" class:lit={state[command.name]?.value === "1"}>
        <button
          on:click={onSendMessage}
          value={"ADDR " + command.path + " 0"}
          disabled={status !== "connected"}
          class="off"
          class:active={state[command.name]?.value === "0"}
        >
          Vyp
        </button>
        <span class="name">{command.title}</span>
        <button
          on:click={onSendMessage}
          value={"ADDR " + command.path + " 1"}
          disabled={status !== "connected"}
          class="on"
          class:active={state[command.name]?.value === "1"}
        >
          Zap
        </button>
      </div>
    {/each}
  </div>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2em;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
  }

  h1 {
    font-size: 1.35em;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }

  /* A live indicator next to the name, so the state of the connection is
     visible without opening anything. */
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dark);
    flex: none;
    align-self: center;
  }

  .pulse.live {
    background: var(--good);
    box-shadow: 0 0 0 3px rgba(87, 201, 139, 0.16);
  }

  .hamburger {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 0.75em;
    background: var(--surface);
    border: none;
    border-radius: var(--r-sm);
    cursor: pointer;
  }

  .hamburger span {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 2px;
    background: var(--text-2);
    transition: opacity 0.15s ease;
  }

  .hamburger.open span:nth-child(2) {
    opacity: 0.25;
  }

  h2 {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1em;
    font-size: 0.72em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-2);
    font-weight: 700;
    margin: 0 0 0.75em;
  }

  /* Lives inside the heading on purpose. It used to sit between the heading
     and the rows, so the whole list jumped the moment the bus said anything.
     The heading is always there; this appears within it and shifts nothing. */
  h2 .hint {
    text-transform: none;
    letter-spacing: normal;
    font-weight: 500;
    color: var(--text-2);
  }

  /* Losing the connection used to blank the whole interface and leave a
     single word, so the operator lost every bit of context mid-programme and
     got a jump back when it returned. The layout stays; the controls simply
     stop being pressable and a banner says why. */
  .offline {
    background: rgba(239, 83, 80, 0.14);
    box-shadow: inset 0 0 0 1px rgba(239, 83, 80, 0.3);
    color: var(--text);
    border-radius: var(--r-sm);
    padding: 0.75em 1em;
    margin-bottom: 1.5em;
    font-size: 0.9em;
    font-weight: 600;
  }

  /* --- scenes: the primary control ------------------------------------ */

  .scenes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6em;
    margin-bottom: 2.25em;
  }

  .scenes button {
    padding: 1.35em 0.4em;
    border: none;
    border-radius: var(--r);
    background: var(--surface);
    color: var(--text-2);
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.08s ease;
  }

  .scenes button:active:not(:disabled) {
    transform: scale(0.97);
  }

  .scenes button:disabled,
  .circuit button:disabled {
    cursor: default;
  }

  .scenes button.active {
    background: var(--lit);
    color: #241a08;
    box-shadow: 0 0 22px var(--lit-glow);
  }

  /* --- circuits -------------------------------------------------------- */

  .circuits {
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

  /* The whole row warms up when the circuit is on, so which lights are live
     reads at a glance from across a dark hall - not just from the button. */
  .circuit {
    display: grid;
    grid-template-columns: 4.6em 1fr 4.6em;
    align-items: center;
    gap: 0.55em;
    background: var(--surface);
    border-radius: var(--r);
    padding: 0.45em;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .circuit.lit {
    background: var(--lit-soft);
    box-shadow: inset 0 0 0 1px rgba(255, 179, 64, 0.22);
  }

  .circuit .name {
    text-align: center;
    font-size: 1em;
    font-weight: 600;
  }

  .circuit button {
    padding: 1em 0.3em;
    border: none;
    border-radius: var(--r-sm);
    background: var(--surface-hi);
    color: var(--text-2);
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition:
      background 0.18s ease,
      color 0.18s ease,
      transform 0.08s ease;
  }

  .circuit button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .circuit button.on.active {
    background: var(--lit);
    color: #241a08;
  }

  .circuit button.off.active {
    background: var(--dark);
    color: #0e1013;
  }

  /* --- status panel ---------------------------------------------------- */

  .panel {
    background: var(--surface);
    border-radius: var(--r);
    padding: 0.4em 1em 0.9em;
    margin-bottom: 2em;
    font-size: 0.88em;
  }

  .panel .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1em;
    padding: 0.55em 0;
    border-bottom: 1px solid var(--line);
  }

  .panel .row span {
    color: var(--text-2);
  }

  .panel .row b {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .panel .row:last-of-type {
    border-bottom: none;
  }

  .panel .good {
    color: var(--good);
  }

  .panel .bad {
    color: var(--bad);
  }

  .panel .note {
    margin: 0.7em 0 0;
    color: var(--text-2);
    font-size: 0.92em;
    line-height: 1.45;
  }
</style>
