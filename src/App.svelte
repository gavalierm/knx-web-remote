<script type="text/javascript">
  import { onMount } from "svelte";
  import {
    connect,
    sendMessage,
    statusStore,
  } from "./lib/websocketClient.svelte.js";

  $: status = $statusStore;

  async function detectSWUpdate() {
    //console.log("test")
    const registration = await navigator.serviceWorker.ready;
    registration.addEventListener("updatefound", (event) => {
      //console.log("found")
      const newSW = registration.installing;
      newSW.addEventListener("statechange", (event) => {
        if (newSW.state == "installed") {
          //console.log("installed")
          if (confirm("New update available. Reload?")) {
            newSW.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }
        }
      });
    });
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
    detectSWUpdate();
    //
    checkNotificationPermission();
    //
    //
    localStorage.setItem("_host", "knxrpi.local");
    localStorage.setItem("_port", "9240");
    connect();
  });

  function onSendMessage() {
    console.log(this, this.value);
    if (this.value == undefined) {
      return;
    }
    sendMessage(this.value);
  }

  let commands = [
    { title: "Central", path: "0/0/1" },
    { title: "Schody", path: "0/1/0" },
    { title: "Zvukári", path: "0/2/0" },
    { title: "Sála", path: "0/3/0" },
    { title: "Pódium", path: "0/4/0" },
  ];
</script>

<h1>Svetlá</h1>
{#if status !== "connected"}
  <div class="status">{status}</div>
{:else}
  <div class="buttons">
    <span class="label">OFF</span>
    <span class="label">ON</span>

    {#each commands as command, i}
      <button
        on:click={onSendMessage}
        value={"ADDR " + command.path + " " + 0}
        class="off"
      >
        <span>{command.title}</span>
      </button>
      <button
        on:click={onSendMessage}
        value={" ADDR " + command.path + " " + 1}
        class="on"
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

  .buttons button::before {
    color: red;
    content: "•";
    font-size: 2em;
    padding-right: 0.5em;
  }

  .buttons button.on::before {
    color: green;
  }

  .buttons .label {
    text-align: center;
    font-size: 0.8em;
    text-transform: uppercase;
  }
</style>
