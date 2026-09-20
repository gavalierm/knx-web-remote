import { isNa } from "./htmlHelper.js";
import { writable, get } from 'svelte/store';

const LOGGING = false

let remoteWebSocket;
export const statusStore = writable('disconnected');

// What the bus is actually doing, keyed by the name the bridge uses:
//   { sala: { type: 'switch', value: '1' }, kazen: { type: 'scene', value: '2' } }
//
// The bridge broadcasts a line for every telegram on the bus, and replays the
// last known state to a client as soon as it connects, so this fills in
// immediately rather than waiting for someone to press something.
export const stateStore = writable({});

// What the bridge says about itself, from the HEALTH query:
//   { knxd: '1', listener: '1', usb: '1', clients: '2', uptime: '3600', ... }
//
// Without this the app can only tell whether its own socket is open - and that
// socket stays up perfectly well while knxd is dead or the bus is unreachable,
// which is exactly how "it says connected but nothing works" happens.
export const healthStore = writable(null);

let global_warr_timer;
let global_connection_timer;

export function setStatus(state) {
	statusStore.set(state)
	//console.log(state)
}

export function getStatus() {
	//return "test"
	return get(statusStore);
	//console.log(state)
}

export function connect() {
	clearTimeout(global_connection_timer);
	setStatus('connecting');
	if (isNa(localStorage.getItem("_host")) || isNa(localStorage.getItem("_port"))) {
		//no credentials
		if (LOGGING) console.log("No credentials");
		return onClose();
	}
	//
	//showWarr('connect');
	//
	if (remoteWebSocket) {
		if (LOGGING) console.warn('Socket opened before reconnect: Closing socket');
		remoteWebSocket.close();
	}

	let wsUri = "ws://" + localStorage.getItem("_host") + ":" + localStorage.getItem("_port");
	//wsUri = "wss://echo.websocket.org"

	remoteWebSocket = new WebSocket(wsUri);
	remoteWebSocket.onopen = function() { onOpen(); };
	remoteWebSocket.onclose = function() { onClose(); };
	remoteWebSocket.onmessage = function(evt) { onMessage(evt); };
	remoteWebSocket.onerror = function(evt) { onError(evt); };
}

async function onOpen() {
	//connected();
	console.log("Open");
	setStatus('connected');
	clearTimeout(global_connection_timer);
	//remoteWebSocket.send('{"action":"authenticate","protocol":"701","password":"' + localStorage.getItem("_pass") + '"}');
}

async function onError(evt) {
	console.log("Error");
	setStatus('disconnected');
	//disconnected();
	if (remoteWebSocket) {
		if (LOGGING) console.error('Socket encountered error: ', evt.message, 'Closing socket');
		remoteWebSocket.close();
	}
}
async function onClose() {
	console.log("Close");
	setStatus('disconnected');
	// Forget the bus state. Showing what the lights were doing when the
	// connection dropped is exactly the stale-display problem being fixed here:
	// the bridge replays the current state as soon as we reconnect.
	stateStore.set({});
	healthStore.set(null);
	//disconnected();
	clearTimeout(global_connection_timer);
	global_connection_timer = setTimeout(function() {
		console.log(statusStore);
		connect();
	}, 5000);
}

// The bridge speaks plain text, not JSON. This used to parse the frame as JSON,
// log "No json" and return - so every message from the bus was thrown away and
// the buttons showed nothing but their own CSS. See PROTOCOL.md in the
// knx-usb-ws repository for the format.
//
//   SWITCH SALA 1        a light changed, by whoever - us, Companion, the wall panel
//   SCENE KAZEN 2        a scene was recalled
//   ADDR 0/0/1 1         another client's raw command, echoed to us
//
async function onMessage(evt) {
	const raw = String(evt.data).trim();
	if (!raw) {
		return;
	}

	const parts = raw.split(" ");
	if (parts.length !== 3) {
		// Commands echoed from other clients (ADDR .., SCENE ..) and anything
		// unrecognised. Nothing to display, and not worth a console warning on
		// every button press somebody else makes.
		if (LOGGING) console.log("Ignoring:", raw);
		return;
	}

	const [type, name, value] = parts;

	if (type === "HEALTH") {
		healthStore.update((health) => ({
			...(health || {}),
			[name.toLowerCase()]: value,
			at: Date.now(),
		}));
		return;
	}

	if (type !== "SWITCH" && type !== "SCENE") {
		if (LOGGING) console.log("Unknown message type:", raw);
		return;
	}

	stateStore.update((state) => {
		const next = {
			...state,
			[name.toLowerCase()]: { type: type.toLowerCase(), value: value },
		};
		if (type === "SCENE") {
			// Which scene is active is tracked by VALUE, not by name, and that
			// is deliberate. Each scene has its own group address, but 1/0/0 is
			// listed twice in the bridge's table - as `scene` and as `uvod` -
			// and the first match wins, so recalling úvod arrives as
			// "SCENE SCENE 0" and never as "SCENE UVOD 0".
			//
			// The value identifies the scene unambiguously (0 úvod, 1 chvály,
			// 2 kázeň), so matching on it sidesteps the naming quirk entirely.
			// Fixing the order in the bridge would change what it broadcasts,
			// and that is a contract shared with Companion - see PROTOCOL.md.
			next.activeScene = value;
		}
		return next;
	});
}

// Ask the bridge how it is. Nothing reaches the KNX bus - safe at any time,
// including during a programme. See PROTOCOL.md in the knx-usb-ws repository.
export const requestHealth = () => {
	sendMessage("HEALTH");
};

export const sendMessage = (message) => {
	//console.log(remoteWebSocket, getStatus())
	if (remoteWebSocket && remoteWebSocket.readyState <= 1 && getStatus() == 'connected') {
		remoteWebSocket.send(message);
	} else {
		console.log("Error")
	}

};