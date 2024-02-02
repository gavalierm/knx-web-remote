import './app.css'
import App from './App.svelte'
import StayAwake from "stayawake.js";

StayAwake.init();

const app = new App({
  target: document.getElementById('app'),
})

document.body.addEventListener('click', function () {
  StayAwake.enable();
});

export default app