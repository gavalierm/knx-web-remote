<script type="text/javascript">
  //
  //
  import { onMount } from "svelte";
  import {
    connect,
    sendMessage,
    statusStore,
    stateStore,
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

<h1>Svetlá</h1>
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
  h1 {
    text-transform: uppercase;
    font-size: 1em;
    margin-bottom: 4em;
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
