if(!self.define){let e,s={};const i=(i,a)=>(i=new URL(i+".js",a).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(a,n)=>{const r=e||("document"in self?document.currentScript.src:"")||location.href;if(s[r])return;let l={};const o=e=>i(e,r),d={module:{uri:r},exports:l,require:o};s[r]=Promise.all(a.map((e=>d[e]||o(e)))).then((e=>(n(...e),l)))}}define(["./workbox-3e911b1d"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/index-bg4J8i58.css",revision:null},{url:"assets/index-sPBnVBPL.js",revision:null},{url:"index.html",revision:"000be42f263fb44d63ff40e71d535a75"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"splash/apple-touch-icon.png",revision:"9da0fb2124e26ce6e36a33639c33636a"},{url:"splash/favicon.ico",revision:"2f73f816a35347b30693dade93be5be9"},{url:"splash/favicon.svg",revision:"bcdcd1814225ed759ab5e573288bde36"},{url:"splash/logo.svg",revision:"ddae9b25f4fd7f1d2223bdda9f678634"},{url:"splash/pwa-192x192.png",revision:"114e25ef0ae53dc333316a498eb4532c"},{url:"splash/pwa-512x512.png",revision:"39a2a3e4aeb56ba37b0e38189efae78b"},{url:"splash/pwa-maskable-192x192.png",revision:"f1fe60e3411741b3e0f04d5d514e541f"},{url:"splash/pwa-maskable-512x512.png",revision:"375249b6253fc408d8335d075c9f004e"},{url:"splash/pwa-192x192.png",revision:"114e25ef0ae53dc333316a498eb4532c"},{url:"splash/apple-touch-icon.png",revision:"9da0fb2124e26ce6e36a33639c33636a"},{url:"splash/favicon.ico",revision:"2f73f816a35347b30693dade93be5be9"},{url:"splash/favicon.svg",revision:"bcdcd1814225ed759ab5e573288bde36"},{url:"splash/logo.svg",revision:"ddae9b25f4fd7f1d2223bdda9f678634"},{url:"splash/pwa-512x512.png",revision:"39a2a3e4aeb56ba37b0e38189efae78b"},{url:"splash/pwa-maskable-192x192.png",revision:"f1fe60e3411741b3e0f04d5d514e541f"},{url:"splash/pwa-maskable-512x512.png",revision:"375249b6253fc408d8335d075c9f004e"},{url:"manifest.webmanifest",revision:"0868171e65fa60a6904c217f496be60c"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));