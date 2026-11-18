// The retiring worker: what public/launch-worker.js becomes in a release that takes the launch
// worker away (README.md, "The installed app's launch page"). It replaces the worker before it at
// once, deletes the launch caches and unregisters itself; the launch page then comes from the
// server, as it does where there is no worker.
const PREFIX = 'sending-stone-launch-'

globalThis.addEventListener('install', () => globalThis.skipWaiting())

globalThis.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith(PREFIX))
            .map(name => caches.delete(name)),
        ),
      )
      .then(() => globalThis.registration.unregister()),
  )
})
