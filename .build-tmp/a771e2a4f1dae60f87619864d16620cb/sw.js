import {clientsClaim as workbox_core_clientsClaim} from 'D:/Projects/STM Website/node_modules/workbox-core/clientsClaim.mjs';
import {precacheAndRoute as workbox_precaching_precacheAndRoute} from 'D:/Projects/STM Website/node_modules/workbox-precaching/precacheAndRoute.mjs';
import {cleanupOutdatedCaches as workbox_precaching_cleanupOutdatedCaches} from 'D:/Projects/STM Website/node_modules/workbox-precaching/cleanupOutdatedCaches.mjs';
import {registerRoute as workbox_routing_registerRoute} from 'D:/Projects/STM Website/node_modules/workbox-routing/registerRoute.mjs';
import {NavigationRoute as workbox_routing_NavigationRoute} from 'D:/Projects/STM Website/node_modules/workbox-routing/NavigationRoute.mjs';
import {createHandlerBoundToURL as workbox_precaching_createHandlerBoundToURL} from 'D:/Projects/STM Website/node_modules/workbox-precaching/createHandlerBoundToURL.mjs';/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */




self.skipWaiting();
workbox_core_clientsClaim();
/**
 * The precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
workbox_precaching_precacheAndRoute([
  {
    "url": "manifest.webmanifest",
    "revision": "269d9065f01b1eb4c29985709db133d1"
  },
  {
    "url": "index.html",
    "revision": "1fddaf011e4850d31d8043e4c9e600e0"
  },
  {
    "url": "images/stm_mark.png",
    "revision": "8bdfb0629eee2585de22a144cfc59595"
  },
  {
    "url": "images/stm_logo.png",
    "revision": "e48fcc6ec3d9e883d202c1b716a759f5"
  },
  {
    "url": "icons/icon-512.png",
    "revision": "f988031bf32d817c1a10a2607bfa3a96"
  },
  {
    "url": "icons/icon-32.png",
    "revision": "98dea5f0be74a5945bec05eee9b78e42"
  },
  {
    "url": "icons/icon-192.png",
    "revision": "f3e3d95b83cca26352940039fec19842"
  },
  {
    "url": "icons/apple-touch-icon.png",
    "revision": "e51127be902e5571ac6da259fc6d78bb"
  },
  {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  },
  {
    "url": "assets/index-ZphTd9Cd.css",
    "revision": null
  },
  {
    "url": "assets/index-Bq3AF7LZ.js",
    "revision": null
  },
  {
    "url": "icons/apple-touch-icon.png",
    "revision": "e51127be902e5571ac6da259fc6d78bb"
  },
  {
    "url": "icons/icon-192.png",
    "revision": "f3e3d95b83cca26352940039fec19842"
  },
  {
    "url": "icons/icon-32.png",
    "revision": "98dea5f0be74a5945bec05eee9b78e42"
  },
  {
    "url": "icons/icon-512.png",
    "revision": "f988031bf32d817c1a10a2607bfa3a96"
  },
  {
    "url": "manifest.webmanifest",
    "revision": "269d9065f01b1eb4c29985709db133d1"
  }
], {});
workbox_precaching_cleanupOutdatedCaches();workbox_routing_registerRoute(new workbox_routing_NavigationRoute(workbox_precaching_createHandlerBoundToURL("index.html")));


