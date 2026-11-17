// Sending Stone's launch worker (ROADMAP item 56).
//
// The launch page registers it, where it runs as an installed app, for the scope /launch alone. So
// the only request it ever answers is the installed app's opening one, a navigation to /launch:
// with the launch page it keeps, at once, with no network. Every other page of the app is outside
// its scope and never passes through it. It keeps that one page and nothing else, fetched without
// cookies.
//
// A new launch page reaches it as a new worker. Its cache is named for the page it keeps, and
// src/features/launch/launch-worker.test.ts fails when the page changes until that name does. A
// browser asks for this file again, past every cache, each time the app opens; a changed file
// installs with the new page, takes over at once and deletes the cache before it. So a release's
// launch page is shown from the second opening after it.
//
// Its way out is the same: a release that changes this file replaces this worker, and one that
// puts public/launch-worker-retire.js in its place removes it and its cache (README.md, "The
// installed app's launch page"). Never rename this file, and never stop serving /launch: an
// installed app keeps opening there.
const LAUNCH = '/launch'
const PREFIX = 'sending-stone-launch-'
const CACHE = `${PREFIX}52d7be6451ae`

/** Whether a response is the launch page as the server sends it, and so may be kept. */
const isLaunchPage = response =>
  response.ok &&
  !response.redirected &&
  (response.headers.get('content-type') ?? '').startsWith('text/html')

/** The launch page from the server, past the browser's cache, with no cookies; kept if it's one. */
async function fetchLaunchPage() {
  const response = await fetch(LAUNCH, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  })
  if (!isLaunchPage(response)) throw new Error('not the launch page')
  const cache = await caches.open(CACHE)
  await cache.put(LAUNCH, response.clone())
  return response
}

/** The page kept, at once; with none kept, such as after the device cleared it, the server's. */
async function launchPage() {
  const cache = await caches.open(CACHE)
  return (await cache.match(LAUNCH)) ?? fetchLaunchPage()
}

globalThis.addEventListener('install', event => {
  event.waitUntil(fetchLaunchPage().then(() => globalThis.skipWaiting()))
})

globalThis.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith(PREFIX) && name !== CACHE)
            .map(name => caches.delete(name)),
        ),
      ),
  )
})

globalThis.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return
  if (new URL(request.url).pathname !== LAUNCH) return
  // Whatever goes wrong here, the server answers as if there were no worker.
  event.respondWith(launchPage().catch(() => fetch(request)))
})
