import {
  LAUNCH_ASK_AGAIN,
  LAUNCH_COLORS,
  LAUNCH_NEXT,
  LAUNCH_PATH,
  LAUNCH_PATIENCE,
  LAUNCH_RUNE,
  LAUNCH_STONE,
  LAUNCH_WORDS,
  LAUNCH_WORKER,
} from './constants'
import { RUNE } from '@/components/loading-stone/constants'

/** A glow of the stone's design, scaled to the size the launch page draws the stone at. */
const glow = (px: number) =>
  `${Math.round((px * LAUNCH_STONE.size * 100) / LAUNCH_STONE.designSize) / 100}px`

/** One part of the rune lighting by its own keyframes, the cycle entered at the dot. */
const lights = (part: keyof typeof LAUNCH_RUNE.keyframes) =>
  `.${part}{animation:rune-${part} ${LAUNCH_RUNE.seconds}s linear ${LAUNCH_RUNE.startAt}s infinite}`

const keyframes = (part: keyof typeof LAUNCH_RUNE.keyframes) =>
  `@keyframes rune-${part}{${LAUNCH_RUNE.keyframes[part]}}`

const PARTS = ['dot', 'inner', 'outer'] as const

const text = (value: string) => JSON.stringify(value)

/**
 * The launch page's script. Where the page runs as an installed app, it registers the launch
 * worker for this page's address alone: a browser's tab that comes here registers nothing. Then it
 * opens the first page at once, in this page's place, so that Back never returns here; if that
 * hasn't come after a while, it says so, still waiting.
 *
 * Where the device says it has no connection it stays instead, dark, and says so. Try again, and
 * the device coming back online, first ask whether the server answers, and only then open, so that
 * the browser's own error page never takes this page's place while there's still no connection.
 * Coming back online, it asks again a few times before it waits for Try again, as a connection can
 * be a moment from working.
 *
 * What the page says always fits where it stands. Each opening hides the words and waits afresh,
 * so nothing is said while the first page is on its way. "It opens once you're back online." is
 * said only while the device says it isn't, as only coming back opens it. Only the latest ask
 * counts, so an earlier one answered late changes nothing. One timer at a time: the wait for the
 * first page, or the next ask.
 */
const HANDOVER = `(function(){
var words=document.getElementById('unreached'),waits=${JSON.stringify(LAUNCH_ASK_AGAIN)},timer,asked=0
function open(){document.body.className='';words.hidden=true;clearTimeout(timer);timer=setTimeout(function(){words.hidden=false},${LAUNCH_PATIENCE});location.replace(${text(LAUNCH_NEXT)})}
function stay(){document.body.className=navigator.onLine===false?'staying offline':'staying';words.hidden=false;clearTimeout(timer)}
function ask(tries){var mine=++asked;fetch(${text(LAUNCH_PATH)},{method:'HEAD',cache:'no-store'}).then(function(){if(mine===asked)open()},function(){if(mine!==asked)return;stay();if(tries<waits.length&&navigator.onLine!==false)timer=setTimeout(function(){ask(tries+1)},waits[tries])})}
try{if('serviceWorker' in navigator&&(navigator.standalone===true||matchMedia('(display-mode: standalone)').matches))navigator.serviceWorker.register(${text(LAUNCH_WORKER)},{scope:${text(LAUNCH_PATH)},updateViaCache:'none'}).catch(function(){})}catch(e){}
document.getElementById('again').addEventListener('click',function(){ask()})
addEventListener('online',function(){ask(0)})
if(navigator.onLine===false){stay();ask()}
else open()
})()`

/**
 * The launch page (ROADMAP item 56), whole: one document that needs nothing else, so that the
 * launch worker can keep it and show it with no network, and no release's files can go missing
 * under it. The stone on the night an Android phone's own launch screen is drawn on, its rune
 * lighting as the loading stone's does; then the first page takes its place. Any change to what
 * this returns changes the name of the launch worker's cache (`public/launch-worker.js`), which
 * is how a release's new launch page reaches an installed app.
 * @param stone - The stone's image, as a `data:` address.
 * @returns The document's HTML.
 */
export function launchDocument(stone: string): string {
  const { background, secondary, primary, onPrimary } = LAUNCH_COLORS
  const { size } = LAUNCH_STONE
  const lit = LAUNCH_COLORS.glow
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="${background}">
<link rel="manifest" href="/manifest.webmanifest">
<title>${LAUNCH_WORDS.title}</title>
<style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:${background};color:${LAUNCH_COLORS.text};font:14px/1.5 system-ui,sans-serif;-webkit-text-size-adjust:100%}
.stone{position:relative;flex:none;width:${size}px;height:${size}px}
.stone img,.stone svg{position:absolute;inset:0;display:block;width:100%;height:100%}
.stone svg{pointer-events:none;mix-blend-mode:screen;filter:drop-shadow(0 0 ${glow(2)} ${lit}) drop-shadow(0 0 ${glow(8)} ${lit})}
.dot{fill:${lit}}
.arcs{fill:none;stroke:${lit};stroke-width:${RUNE.arcWidth};stroke-linecap:round}
.dot,.arcs path{opacity:0}
@media (prefers-reduced-motion:no-preference){${PARTS.map(part => lights(part)).join('')}}
@media (prefers-reduced-motion:reduce){.dot,.arcs path{opacity:${LAUNCH_RUNE.still}}}
.staying .dot,.staying .arcs path{animation:none;opacity:0}
${PARTS.map(part => keyframes(part)).join('\n')}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#unreached{position:absolute;top:calc(50% + ${size / 2 + 24}px);left:0;right:0;padding:0 16px;text-align:center}
#offline{display:none;color:${secondary}}
.offline #offline{display:block}
#again{display:block;margin:16px auto 0;height:40px;padding:0 16px;border:0;border-radius:12px;background:${primary};color:${onPrimary};font:600 14px/1 system-ui,sans-serif}
@media (max-height:479px){#unreached{position:static;flex:0 1 280px;padding:0 16px 0 24px;text-align:left}#again{margin-left:0}}
</style>
</head>
<body>
<div class="stone" role="status">
<img src="${stone}" alt="" width="${size}" height="${size}">
<svg viewBox="${RUNE.viewBox}" aria-hidden="true"><circle class="dot" cx="${RUNE.dot.cx}" cy="${RUNE.dot.cy}" r="${RUNE.dot.r}"/><g class="arcs"><path class="inner" d="${RUNE.inner}"/><path class="outer" d="${RUNE.outer}"/></g></svg>
<span class="sr">${LAUNCH_WORDS.loading}</span>
</div>
<div id="unreached" role="alert" hidden>${LAUNCH_WORDS.unreached}<span id="offline">${LAUNCH_WORDS.offline}</span><button type="button" id="again">${LAUNCH_WORDS.again}</button></div>
<script>${HANDOVER}</script>
</body>
</html>
`
}
