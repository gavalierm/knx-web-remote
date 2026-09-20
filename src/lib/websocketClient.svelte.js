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

// Whether anything has been heard from the bus since this connection opened.
// The bridge replays what it remembers the instant a client connects, so a
// message arriving in that first moment is a memory, not an event. Anything
// later is the bus actually doing something.
export const liveStore = writable(false);
let connectedAt = 0;
const REPLAY_WINDOW_MS = 1500;
// How long after a scene its own circuit reports keep arriving. Measured on
// this bus: 350 ms. Two seconds leaves room and still separates a scene's side
// effects from an unrelated change.
const SCENE_GRACE_MS = 2000;
let lastSceneAt = 0;

let global_warr_timer;
let global_connection_timer;
let stale_probe_timer = null;
let retryDelay = 400;

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
	console.log("Open");
	setStatus('connected');
	clearTimeout(global_connection_timer);
	connectedAt = Date.now();
	retryDelay = 400;
	liveStore.set(false);
	// Ask straight away, not only when the status panel is opened. The answer
	// carries STATEAGE, which is what tells us whether the state the bridge
	// just replayed is current or was restored from disk after a restart.
	// Nothing reaches the KNX bus.
	requestHealth();
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
	liveStore.set(false);
	//disconnected();
	clearTimeout(global_connection_timer);
	// Start again almost at once and back off from there. A flat five seconds
	// meant every brief drop looked like a dead system for five seconds, and
	// the common case - a phone waking up - is exactly when the wait is least
	// tolerable and most visible.
	global_connection_timer = setTimeout(connect, retryDelay);
	retryDelay = Math.min(retryDelay * 2, 5000);
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

	if (Date.now() - connectedAt > REPLAY_WINDOW_MS) {
		liveStore.set(true);
	}

	stateStore.update((state) => {
		const next = {
			...state,
			[name.toLowerCase()]: { type: type.toLowerCase(), value: value },
		};
		// A circuit changing on its own means the room no longer matches the
		// scene that was recalled, so the highlight goes with it.
		//
		// But a scene switches circuits itself and the actuators report it,
		// within about 350 ms on this bus, so those reports must not cancel the
		// scene that caused them. Anything arriving more than two seconds after
		// the scene is somebody else's doing.
		//
		// Only past the replay window: during a replay every message arrives at
		// once, arrival order says nothing, and the bridge has already decided
		// this from the timestamps it holds.
		if (
			type === "SWITCH" &&
			get(liveStore) &&
			Date.now() - lastSceneAt > SCENE_GRACE_MS
		) {
			delete next.activeScene;
		}
		if (type === "SCENE") {
			// Remember when, so the circuit reports this scene is about to
			// cause are not mistaken for somebody overriding it.
			lastSceneAt = Date.now();
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

//
// Waking up.
//
// Two things go wrong when a phone sleeps with this app open, and they look
// identical from the outside - a long spell of "no connection to the bridge"
// that reads as a broken system.
//
// The socket dies while the app is in the background, and the reconnect is a
// setTimeout. Browsers throttle background timers hard, often to once a
// minute, so the retry does not happen when the screen comes back on.
//
// Worse, the socket can be dead while readyState still says it is open: a
// sleeping phone leaves the TCP connection stale, so nothing even tries to
// reconnect. The server notices within 15 s via its ping and drops the client,
// but from here it just looks like a bridge that answers nothing.
//
// So: on waking, reconnect at once if we know we are down, and if we think we
// are up, ask a question and disbelieve the socket if nothing comes back.
//
let lastWakeCheck = 0;

function onWake() {
	if (typeof document !== "undefined" && document.visibilityState !== "visible") {
		return;
	}
	// focus fires every time the window is clicked back into, and four events
	// are wired to this. Without a floor, a desktop browser would probe the
	// bridge constantly - exactly the chatter that was just taken off this
	// channel by not multicasting HEALTH.
	if (Date.now() - lastWakeCheck < 2000) {
		return;
	}
	lastWakeCheck = Date.now();

	if (getStatus() !== "connected") {
		clearTimeout(global_connection_timer);
		retryDelay = 400;
		connect();
		return;
	}

	clearTimeout(stale_probe_timer);
	const before = (get(healthStore) || {}).at || 0;
	requestHealth();
	stale_probe_timer = setTimeout(function() {
		const after = (get(healthStore) || {}).at || 0;
		if (after !== before) {
			return; // answered, the socket is genuinely alive
		}
		console.log("Stale socket after wake, reconnecting");
		if (remoteWebSocket) {
			remoteWebSocket.close();
		}
		onClose();
	}, 2000);
}

if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", onWake);
	window.addEventListener("pageshow", onWake);
	window.addEventListener("online", onWake);
	window.addEventListener("focus", onWake);
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