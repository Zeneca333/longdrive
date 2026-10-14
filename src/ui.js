// Menu and overlay screens. Each render function fills its <section> and wires its buttons.
import { GOLFERS, GEAR, ITEMS, LEVELS } from './config.js';
import { icon } from './icons.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n, size = 18) => `<span class="stars">${[0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">${icon('star', size)}</span>`).join('')}</span>`;
const wallet = (g) => `<span class="wallet">${icon('coin', 22)}<span>${g.save.coins}</span></span>`;

function on(root, sel, fn) {
  for (const el of root.querySelectorAll(sel)) el.onclick = (e) => { e.stopPropagation(); fn(el, e); };
}

export function renderHowto(game, back) {
  const el = $('howto');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="How to play">
      <div class="sheet-head"><div><div class="eyebrow">Caddie's notes</div><h2>How to hit a bomb</h2></div></div>
      <div class="how-grid">
        <div class="how-step"><span class="num">1</span><h3>Start</h3><p>Tap, click or press <kbd>Space</kbd>. The needle starts racing right.</p></div>
        <div class="how-step"><span class="num">2</span><h3>Power</h3><p>Tap again to lock power. Past 100 is an <b>overswing</b>: more distance, a smaller sweet spot and a faster needle.</p></div>
        <div class="how-step"><span class="num">3</span><h3>Accuracy</h3><p>The needle races back. Tap as it crosses the <b>white zone</b> for a PURE strike. Early hooks left, late slices right. Miss it completely and you shank it.</p></div>
      </div>
      <div class="how-grid">
        <div class="how-step"><h3>The grid</h3><p>Like real long drive, the ball has to finish inside the grid. Outside the white lines it scores zero. Three balls per level, and your best one counts.</p></div>
        <div class="how-step"><h3>Shot shape</h3><p><b>Stinger</b> stays low and runs, which is great into the wind. <b>Sky Ball</b> floats on a tailwind. <b>Stock</b> is in between.</p></div>
        <div class="how-step"><h3>Coins &amp; crates</h3><p>Fly through coins and mystery crates. Most crates help. One contains an anvil. Spend coins in the Pro Shop between rounds.</p></div>
      </div>
      <div class="keys">
        <kbd>Space</kbd><span>Swing (3 taps). Mid-flight: fire a Rocket Ball, or fast-forward</span>
        <kbd>&larr; &rarr;</kbd><span>Aim left and right</span>
        <kbd>&uarr; &darr;</kbd><span>Change shot shape</span>
        <kbd>1-7</kbd><span>Arm a power-up before you swing</span>
        <kbd>Esc</kbd><span>Pause</span>
      </div>
      <div class="sheet-foot"><button class="btn" id="howBack">Got it</button></div>
    </div>`;
  on(el, '#howBack', () => { sfx.click(); back === 'title' ? game.toTitle() : back === 'pause' ? game.showScreen('pause') : game.openMap(); });
}

export function renderSelect(game) {
  const el = $('select');
  const s = game.save;
  const bars = (g) => {
    const pw = Math.round((g.power / 1.3) * 100);
    const sw = Math.round((g.sweet / 1.8) * 100);
    const tp = Math.round(((1.25 - g.tempo) / 0.45) * 100);
    return [['Power', pw], ['Sweet spot', sw], ['Calm needle', tp]]
      .map(([n, v]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.max(8, Math.min(100, v))}%"></i></div></div>`).join('');
  };
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Choose your golfer">
      <div class="sheet-head"><div><div class="eyebrow">The roster</div><h2>Who's swinging?</h2></div></div>
      <div class="golfers">
        ${GOLFERS.map((g) => {
          const locked = g.unlockAfter && !(s.stars[g.unlockAfter] > 0);
          return `<button class="card ${s.golfer === g.id ? 'on' : ''}" data-id="${g.id}" ${locked ? 'disabled' : ''}>
            <span class="tag">${esc(g.tag)}</span>
            <span class="who">${locked ? icon('lock', 18) + ' ' : ''}${esc(g.name)}</span>
            ${bars(g)}
            <p>${locked ? `Clear level ${g.unlockAfter} to unlock.` : esc(g.quirk)}</p>
          </button>`;
        }).join('')}
      </div>
      <div class="sheet-foot"><button class="btn grass" id="selDone">Let's go</button></div>
    </div>`;
  on(el, '.card', (b) => {
    game.chooseGolfer(b.dataset.id);
    for (const c of el.querySelectorAll('.card')) c.classList.toggle('on', c === b);
  });
  on(el, '#selDone', () => { game.save.seenSelect = true; game.persist(); game.openMap(); });
}

export function renderMap(game) {
  const el = $('map');
  const s = game.save;
  const g = GOLFERS.find((x) => x.id === s.golfer);
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Tour map">
      <div class="sheet-head">
        <div><div class="eyebrow">The Insanity Tour · playing as ${esc(g.name)}</div><h2>${s.beaten ? 'You beat the Moon. Now get 3 stars everywhere.' : 'Pick your next tee'}</h2></div>
        ${wallet(game)}
      </div>
      <div class="levels">
        ${LEVELS.map((l) => {
          const locked = l.id > s.unlocked;
          const st = s.stars[l.id] || 0;
          const best = s.best[l.id];
          return `<button class="card lv ${locked ? 'locked' : ''} ${l.id === LEVELS.length ? 'final' : ''}" data-id="${l.id}" ${locked ? 'disabled' : ''}>
            <div class="lv-top"><span class="lv-n">${l.id}</span>${locked ? icon('lock', 22) : stars(st)}</div>
            <div><div class="lv-name">${esc(l.name)}</div><div class="lv-place">${esc(l.place)}</div></div>
            <div class="lv-bot"><span>Target ${l.stars[0]}</span><span>${best ? `Best ${best.toFixed(1)}` : locked ? '' : 'Not played'}</span></div>
          </button>`;
        }).join('')}
      </div>
      <div class="sheet-foot">
        <button class="btn ghost" id="mapTitle">Title</button>
        <button class="btn ghost" id="mapHow">How to play</button>
        <button class="btn ghost" id="mapGolfer">Change golfer</button>
        <button class="btn ghost" id="mapSound">${s.muted ? 'Sound off' : 'Sound on'}</button>
        <button class="btn blue" id="mapShop">Pro Shop</button>
      </div>
    </div>`;
  on(el, '.lv', (b) => { sfx.click(); game.startLevel(Number(b.dataset.id)); });
  on(el, '#mapShop', () => { sfx.click(); game.openShop('map'); });
  on(el, '#mapGolfer', () => { sfx.click(); game.openSelect(); });
  on(el, '#mapHow', () => { sfx.click(); game.openHowto('map'); });
  on(el, '#mapTitle', () => { sfx.click(); game.toTitle(); });
  on(el, '#mapSound', (b) => { const m = game.toggleMute(); b.textContent = m ? 'Sound off' : 'Sound on'; sfx.click(); });
}

export function renderShop(game, tab = 'gear', back = 'map') {
  const el = $('shop');
  const s = game.save;
  const gearCards = Object.entries(GEAR).map(([slot, def]) => {
    const lv = s.gear[slot];
    const cur = def.levels[lv];
    const next = def.levels[lv + 1];
    return `<div class="ware">
      <div class="ware-top">${icon(slot, 40)}<div><div class="lbl">${def.label} · ${def.stat}</div><div class="name">${esc(cur.name)}</div></div></div>
      <div class="pips">${def.levels.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
      <div class="note">${esc(cur.note)}</div>
      ${next ? `<div class="note"><b>Next: ${esc(next.name)}.</b> ${esc(next.note)}</div>
        <button class="btn ${s.coins >= next.price ? 'grass' : ''}" data-slot="${slot}" ${s.coins >= next.price ? '' : 'disabled'}>Buy · ${next.price}</button>`
        : `<div class="own">Maxed out</div>`}
    </div>`;
  }).join('');
  const itemCards = ITEMS.map((it) => `<div class="ware">
      <div class="ware-top">${icon(it.id, 40)}<div><div class="name">${esc(it.name)}</div><div class="own">Own ${s.items[it.id] || 0}</div></div></div>
      <div class="note">${esc(it.desc)}</div>
      <button class="btn ${s.coins >= it.price ? 'grass' : ''}" data-item="${it.id}" ${s.coins >= it.price ? '' : 'disabled'}>Buy · ${it.price}</button>
    </div>`).join('');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Pro Shop">
      <div class="sheet-head">
        <div><div class="eyebrow">Sal's Pro Shop · no refunds, no questions</div><h2>Gear up</h2></div>
        ${wallet(game)}
      </div>
      <div class="shop-tabs">
        <button class="btn" aria-pressed="${tab === 'gear'}" id="tabGear">Gear</button>
        <button class="btn" aria-pressed="${tab === 'items'}" id="tabItems">Power-ups</button>
      </div>
      <div class="shop-grid">${tab === 'gear' ? gearCards : itemCards}</div>
      <div class="sheet-foot"><button class="btn" id="shopBack">${back === 'end' ? 'Back' : 'Done'}</button></div>
    </div>`;
  on(el, '#tabGear', () => { sfx.click(); renderShop(game, 'gear', back); });
  on(el, '#tabItems', () => { sfx.click(); renderShop(game, 'items', back); });
  on(el, '[data-slot]', (b) => { if (game.buyGear(b.dataset.slot)) renderShop(game, tab, back); });
  on(el, '[data-item]', (b) => { if (game.buyItem(b.dataset.item)) renderShop(game, tab, back); });
  on(el, '#shopBack', () => {
    sfx.click();
    if (back === 'end') game.showScreen('end');
    else game.openMap();
  });
}

export function renderIntro(game, level) {
  const el = $('intro');
  const hazardNames = {
    cart: 'Ball-picker cart', sheep: 'Sheep', bunker: 'Pot bunkers', water: 'A pond', geese: 'Angry geese',
    windmill: 'Windmills', ring: 'Boost rings', wreck: 'Wrecking balls', trampoline: 'Trampolines', lava: 'Lava',
    geyser: 'Geysers', bombs: 'Flying lava rocks', tornado: 'Tornadoes', ufo: 'UFOs', asteroids: 'Asteroids',
  };
  const kinds = [...new Set(level.hazards.map((h) => (h.skin === 'cow' ? 'cows' : h.type)))];
  const list = kinds.map((k) => (k === 'cows' ? 'Cows' : k === 'bunker' && level.theme === 'moon' ? 'Craters' : k === 'bunker' && level.theme === 'construction' ? 'Wet cement' : hazardNames[k])).filter(Boolean);
  if (level.wind[1] >= 15) list.unshift('Big wind');
  if (level.gravity) list.unshift('Low gravity');
  el.innerHTML = `
    <div class="sheet intro-card" role="dialog" aria-label="${esc(level.name)}">
      <div class="lv-n">Level ${level.id} of ${LEVELS.length} · ${esc(level.place)}</div>
      <h2>${esc(level.name)}</h2>
      <p>${esc(level.blurb)}</p>
      <div class="targets">
        <div>${icon('star', 18)} ${level.stars[0]}</div>
        <div>${icon('star', 18)}${icon('star', 18)} ${level.stars[1]}</div>
        <div>${icon('star', 18)}${icon('star', 18)}${icon('star', 18)} ${level.stars[2]}</div>
        <div>Grid ${level.grid} yds wide</div>
      </div>
      <p><b>On the course:</b> ${list.length ? esc(list.join(', ')) : 'Nothing but a bucket of balls'}.</p>
      <div class="sheet-foot"><button class="btn ghost" id="introBack">Tour map</button><button class="btn big grass" id="introGo">Tee it up</button></div>
    </div>`;
  on(el, '#introGo', () => { sfx.click(); game.beginAiming(); });
  on(el, '#introBack', () => { sfx.click(); game.openMap(); });
}

export function renderShot(game, d) {
  const el = $('shot');
  const reasons = { oob: 'Out of bounds', water: 'In the drink', lava: 'Melted' };
  const chips = [];
  chips.push(`<span class="chip ${d.res.pure ? 'gold' : d.res.kind === 'shank' ? 'hot' : ''}">${esc(d.res.label.replace('!', ''))}</span>`);
  if (d.reason) chips.push(`<span class="chip hot">${reasons[d.reason]}</span>`);
  else chips.push(`<span class="chip">Carry ${d.carry.toFixed(0)}</span><span class="chip">Apex ${d.apex.toFixed(0)} yds</span>`);
  if (d.beatTarget && !d.reason) chips.push('<span class="chip green">Target beaten</span>');
  if (d.newBest && !d.reason) chips.push('<span class="chip gold">New best</span>');
  if (d.distCoins) chips.push(`<span class="chip">+${d.distCoins} coins</span>`);
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Shot result">
      <div class="yards ${d.yards ? '' : 'zero'}">${d.yards.toFixed(1)}<small>yds</small></div>
      <div class="chips">${chips.join('')}</div>
      <p>${esc(d.comment)}</p>
      <button class="btn big ${d.ballsLeft ? '' : 'grass'}" id="shotNext">${d.ballsLeft ? `Next ball (${d.ballsLeft} left)` : 'See results'}</button>
    </div>`;
  on(el, '#shotNext', () => { sfx.click(); game.nextBall(); });
}

export function renderEnd(game, d) {
  const el = $('end');
  const lv = d.level;
  const next = LEVELS.find((l) => l.id === lv.id + 1);
  const finale = d.cleared && lv.id === LEVELS.length;
  const short = (lv.stars[0] - d.best).toFixed(1);
  const total = d.coins.dist + d.coins.pickups + d.coins.crates + d.bonus + d.starBonus;
  const tips = [
    'The Pro Shop sells a bigger driver. Ball speed is everything.',
    'Into the wind? Switch to the STINGER. Wind behind you? SKY BALL.',
    'A Butter Grip doubles the sweet spot. PURE strikes add 3% ball speed.',
    'Overswing past 100 for more power, but the sweet spot shrinks.',
    'Fly through boost rings and crates. Coins pay for upgrades.',
  ];
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Round result">
      <div class="end-hero">
        <div class="eyebrow">${esc(lv.name)}</div>
        <h2>${finale ? 'You are officially insane.' : d.cleared ? (d.earned === 3 ? 'Three stars. Absolute unit.' : 'Cleared!') : d.best >= lv.stars[0] * 0.92 ? 'So close.' : 'Not today.'}</h2>
        <div class="big-stars">${[0, 1, 2].map((i) => `<span class="${i < d.earned ? '' : 'off'}" style="${i < d.earned ? '' : 'opacity:.2;filter:grayscale(1)'}">${icon('star', 64)}</span>`).join('')}</div>
        <p>${d.cleared
          ? `Best drive <b>${d.best.toFixed(1)} yds</b> against a target of ${lv.stars[0]}.${finale ? ' You drove a golf ball across the Moon. Your family is worried about you.' : ''}`
          : `Best drive <b>${d.best.toFixed(1)} yds</b>. You were <b>${short} yds</b> short of ${lv.stars[0]}. ${tips[Math.floor(Math.random() * tips.length)]}`}</p>
      </div>
      <div class="ledger">
        <span>Distance coins</span><b>${d.coins.dist}</b>
        <span>Coins grabbed in flight</span><b>${d.coins.pickups + d.coins.crates}</b>
        ${d.bonus ? `<span>${d.firstClear ? 'First clear bonus' : 'Clear bonus'}</span><b>${d.bonus}</b>` : ''}
        ${d.starBonus ? `<span>New star bonus</span><b>${d.starBonus}</b>` : ''}
        <span class="total">Round total</span><b class="total">${total}</b>
      </div>
      ${d.unlockedRex ? '<p class="chip gold" style="justify-self:center">New golfer unlocked: Rex the T. rex</p>' : ''}
      ${d.firstClear && next ? `<p class="chip green" style="justify-self:center">Unlocked: ${esc(next.name)}</p>` : ''}
      <div class="sheet-foot">
        <button class="btn ghost" id="endMap">Tour map</button>
        <button class="btn blue" id="endShop">Pro Shop</button>
        <button class="btn ${d.cleared ? 'ghost' : 'grass'}" id="endRetry">${d.cleared ? 'Replay' : 'Try again'}</button>
        ${d.cleared && next ? '<button class="btn grass" id="endNext">Next level</button>' : ''}
      </div>
    </div>`;
  on(el, '#endMap', () => { sfx.click(); game.openMap(); });
  on(el, '#endShop', () => { sfx.click(); renderShop(game, 'gear', 'end'); game.showScreen('shop'); });
  on(el, '#endRetry', () => { sfx.click(); game.restartLevel(); });
  on(el, '#endNext', () => { sfx.click(); game.startLevel(next.id); });
}

export function renderPause(game) {
  const el = $('pause');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Paused" style="width:min(420px,100%)">
      <h2>Paused</h2>
      <div style="display:grid;gap:12px">
        <button class="btn grass" id="pResume">Resume</button>
        <button class="btn ghost" id="pHow">How to play</button>
        <button class="btn ghost" id="pSound">${game.save.muted ? 'Sound off' : 'Sound on'}</button>
        <button class="btn ghost" id="pRestart">Restart level</button>
        <button class="btn hot" id="pQuit">Quit to tour map</button>
      </div>
    </div>`;
  on(el, '#pResume', () => { sfx.click(); game.resume(); });
  on(el, '#pHow', () => { sfx.click(); renderHowto(game, 'pause'); game.showScreen('howto'); });
  on(el, '#pSound', (b) => { const m = game.toggleMute(); b.textContent = m ? 'Sound off' : 'Sound on'; });
  on(el, '#pRestart', () => { sfx.click(); game.paused = null; game.restartLevel(); });
  on(el, '#pQuit', () => { sfx.click(); game.paused = null; game.openMap(); });
}
