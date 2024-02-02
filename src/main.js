import './app.css'
import App from './App.svelte'
import StayAwake from "stayawake.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then((registration) => {
      console.log("Service Worker registered with scope:", registration.scope);
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

StayAwake.init();

const app = new App({
  target: document.getElementById('app'),
})

document.body.addEventListener('click', function(){
  StayAwake.enable();
});

export default app