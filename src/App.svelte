<script type="text/javascript">
  //
  //
  import { onMount } from "svelte";
  import { onDestroy } from "svelte";
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
    console.log(this, this.value);
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
</script>

<header>
  <h1>Svetlá</h1>
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
  <div class="status">{status}</div>
{:else}
  {#if !knowsState}
    <div class="status">čaká sa na stav zbernice</div>
  {/if}
  <div class="buttons">
    <span class="label">OFF</span>
    <span class="label">ON</span>

    {#each commands as command (command.name)}
      <button
        on:click={onSendMessage}
        value={"ADDR " + command.path + " 0"}
        class="off"
        class:active={state[command.name]?.value === "0"}
      >
        <span>{command.title}</span>
      </button>
      <button
        on:click={onSendMessage}
        value={"ADDR " + command.path + " 1"}
        class="on"
        class:active={state[command.name]?.value === "1"}
      >
        <span>{command.title}</span>
      </button>
    {/each}
  </div>
{/if}

<style type="text/css">
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3em;
  }

  h1 {
    text-transform: uppercase;
    font-size: 1em;
    margin: 0;
  }

  /* Deliberately small and quiet. During an event the buttons are what
     matters; the status panel is for when something is wrong. */
  .hamburger {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 0.6em;
    background: none;
    border: 1px solid #444;
    border-radius: 4px;
    cursor: pointer;
  }

  .hamburger span {
    display: block;
    width: 18px;
    height: 2px;
    background: currentColor;
    transition: opacity 0.15s ease;
  }

  .hamburger.open span:nth-child(2) {
    opacity: 0.25;
  }

  .panel {
    border: 1px solid #444;
    border-radius: 4px;
    padding: 0.6em 0.9em;
    margin-bottom: 2em;
    font-size: 0.85em;
    text-align: left;
  }

  .panel .row {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    padding: 0.35em 0;
    border-bottom: 1px solid #2a2a2a;
  }

  .panel .row:last-of-type {
    border-bottom: none;
  }

  .panel .good {
    color: green;
  }

  .panel .bad {
    color: red;
  }

  .panel .note {
    margin: 0.8em 0 0.2em;
    opacity: 0.6;
    line-height: 1.4;
  }

  .status {
    font-size: 0.8em;
    text-transform: uppercase;
  }

  .buttons {
    display: grid;
    flex-wrap: wrap;
    grid-template-columns: 1fr 1fr;
    grid-gap: 1em;
  }

  .buttons button {
    padding: 1em;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
  }

  .buttons button span {
    flex: 1;
  }

  /* The dot used to be coloured by which button it was, so it showed the same
     thing whatever the lights were doing. It now shows the state the bridge
     reports: dim means "not the current state", lit means "this is how it is
     right now" - including changes made from the wall panel or Companion. */
  .buttons button::before {
    color: #444;
    content: "•";
    font-size: 2em;
    padding-right: 0.5em;
    transition: color 0.15s ease;
  }

  .buttons button.off.active::before {
    color: red;
  }

  .buttons button.on.active::before {
    color: green;
  }

  .buttons button.active {
    border-color: currentColor;
    font-weight: 600;
  }

  .buttons .label {
    text-align: center;
    font-size: 0.8em;
    text-transform: uppercase;
  }
</style>
