import { isNa, isJson } from "./htmlHelper.js";
import { writable, get } from 'svelte/store';

const LOGGING = false

let remoteWebSocket;
export const statusStore = writable('disconnected');
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
	if (isNa(localStorage.getItem("_host")) || isNa(localStorage.getItem("_port")) || isNa(localStorage.getItem("_pass")) || isNa(localStorage.getItem("_quality"))) {
		//no credentials
		if (LOGGING) console.log("No credentials");
		//return onClose();
	}
	//
	//showWarr('connect');
	//
	if (remoteWebSocket) {
		if (LOGGING) console.warn('Socket opened before reconnect: Closing socket');
		remoteWebSocket.close();
	}

	let wsUri = "ws://" + localStorage.getItem("_host") + ":" + localStorage.getItem("_port") + "/remote";
	wsUri = "wss://echo.websocket.org"

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
	//disconnected();
	clearTimeout(global_connection_timer);
	global_connection_timer = setTimeout(function() {
		console.log(statusStore);
		connect();
	}, 5000);
}

async function onMessage(evt) {
	let data = isJson(evt.data);
	if (data === undefined) {
		console.log("No json", evt.data);
		return false;
	}
	console.log(data);
}

export const sendMessage = (message) => {
	//console.log(remoteWebSocket, getStatus())
	if (remoteWebSocket && remoteWebSocket.readyState <= 1 && getStatus() == 'connected') {
		remoteWebSocket.send(message);
	} else {
		console.log("Error")
	}

};