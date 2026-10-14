// Overlay screens. The game itself needs none of them: they all hang off the Menu button
// or the level-end card. Each render function fills its element and wires its buttons.
import { GOLFERS, GEAR, ITEMS, LEVELS } from './config.js';
import { icon } from './icons.js';
import { sfx } from './audio.js';
import { topDrives } from './board.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n, size = 18) => `<span class="stars">${[0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">${icon('star', size)}</span>`).join('')}</span>`;
const golferName = (id) => GOLFERS.find((g) => g.id === id)?.name || 'Mystery golfer';
const wallet = (g) => `<span class="wallet">${icon('coin', 22)}<span>${g.save.coins}</span></span>`;

function on(root, sel, fn) {
  for (const el of root.querySelectorAll(sel)) el.onclick = (e) => { e.stopPropagation(); fn(el, e); };
}

// ---------- in-game (non-blocking) ----------

export function renderBanner(level) {
  const el = $('banner');
  el.innerHTML = `
    <div class="b-lv">Level ${level.id} of ${LEVELS.length} · ${esc(level.place)}</div>
    <div class="b-name">${esc(level.name)}</div>
    <div class="b-target">Beat <b>${level.stars[0]}</b> yards</div>
    <p class="b-blurb">${esc(level.blurb)}</p>
    <p class="b-record" id="bannerRecord" hidden></p>`;
}

export function fillBannerRecord(level, rows) {
  const rec = $('bannerRecord');
  if (!rows || !rec) return;
  rec.hidden = false;
  rec.innerHTML = rows.length
    ? `${icon('star', 14)} Course record ${rows[0].yards.toFixed(1)} by ${esc(rows[0].isMe ? 'you' : rows[0].name)}`
    : `${icon('star', 14)} No course record yet`;
}

export function renderShot(game, d) {
  const el = $('shot');
  const reasons = { oob: 'Out of bounds', water: 'In the drink', lava: 'Melted' };
  const chips = [`<span class="chip ${d.res.pure ? 'gold' : d.res.kind === 'shank' ? 'hot' : ''}">${esc(d.res.label.replace('!', ''))}</span>`];
  if (d.reason) chips.push(`<span class="chip hot">${reasons[d.reason]}</span>`);
  else chips.push(`<span class="chip">Carry ${d.carry.toFixed(0)}</span>`);
  if (d.beatTarget && !d.reason) chips.push('<span class="chip green">Target beaten</span>');
  if (d.newBest && !d.reason) chips.push('<span class="chip gold">New best</span>');
  if (d.distCoins) chips.push(`<span class="chip">+${d.distCoins} coins</span>`);
  el.innerHTML = `
    <div class="sheet shot-card" role="status">
      <div class="yards ${d.yards ? '' : 'zero'}">${d.yards.toFixed(1)}<small>yds</small></div>
      <div class="chips">${chips.join('')}</div>
      <div class="shot-next">${d.ballsLeft ? `Ball ${4 - d.ballsLeft} of 3 next` : 'Round over'} · tap to skip</div>
    </div>`;
}

// ---------- level end ----------

export function renderEnd(game, d) {
  const el = $('end');
  const lv = d.level;
  const finale = d.cleared && lv.id === LEVELS.length;
  const short = (lv.stars[0] - d.best).toFixed(1);
  const tips = [
    'A bigger driver in the Pro Shop adds ball speed.',
    'Into the wind? Try the Stinger. Wind behind you? Sky Ball.',
    'Overswing past 100 for more power, if you can still hit the white zone.',
    'Fly through boost rings and crates for free distance.',
  ];
  const headline = finale ? 'You are officially insane.'
    : d.cleared ? (d.earned === 3 ? 'Three stars. Absolute unit.' : 'Cleared!')
    : d.best >= lv.stars[0] * 0.92 ? 'So close.' : 'Not today.';
  const primary = d.cleared && d.next ? `Next: ${esc(d.next.name)}` : d.cleared ? 'Play it again' : 'Try again';
  el.innerHTML = `
    <div class="sheet end-card" role="dialog" aria-label="Round result">
      <div class="end-hero">
        <div class="eyebrow">Level ${lv.id} · ${esc(lv.name)}</div>
        <h2>${headline}</h2>
        <div class="big-stars">${[0, 1, 2].map((i) => `<span style="${i < d.earned ? '' : 'opacity:.2;filter:grayscale(1)'}">${icon('star', 64)}</span>`).join('')}</div>
        <p>Best drive <b>${d.best.toFixed(1)} yds</b> · target ${lv.stars[0]} · <b>+${d.roundCoins}</b> coins</p>
        ${d.cleared ? '' : `<p class="tip">${d.best > 0 ? `${short} yds short. ` : ''}${tips[Math.floor(Math.random() * tips.length)]}</p>`}
        ${finale ? '<p class="tip">You drove a golf ball across the Moon. Your family is worried about you.</p>' : ''}
        ${d.unlockedRex ? '<p class="chip gold">New golfer unlocked: Rex the T. rex (Menu → Golfer)</p>' : ''}
      </div>
      <div class="board" id="endBoard" hidden></div>
      <button class="btn big grass end-go" id="endGo">${primary}</button>
      <div class="end-links">
        ${d.cleared ? '<button class="link-btn" id="endRetry">Replay</button>' : ''}
        <button class="link-btn" id="endShop">Pro Shop · ${game.save.coins} coins</button>
        <button class="link-btn" id="endLevels">All levels</button>
      </div>
    </div>`;
  const board = el.querySelector('#endBoard');
  topDrives(lv.id, 3).then((rows) => {
    if (!rows || !rows.length || !board.isConnected) return;
    board.hidden = false;
    board.innerHTML = `<ol>${rows.map((r) => `<li class="${r.isMe ? 'me' : ''}"><span class="who">${esc(r.isMe ? `${r.name} (you)` : r.name)}</span><span class="club">${esc(golferName(r.golfer))}</span><b>${r.yards.toFixed(1)}</b></li>`).join('')}</ol>`;
  });
  on(el, '#endGo', () => { sfx.click(); game.endPrimary(); });
  on(el, '#endRetry', () => { sfx.click(); game.restartLevel(); });
  on(el, '#endShop', () => { sfx.click(); game.openShop('end'); });
  on(el, '#endLevels', () => { sfx.click(); game.openMap('end'); });
  setTimeout(() => { if (el.querySelector('#endGo')) el.querySelector('#endGo').focus({ preventScroll: true }); }, 50);
}

// ---------- the one menu ----------

export function renderMenu(game) {
  const el = $('pause');
  const s = game.save;
  el.innerHTML = `
    <div class="sheet menu-card" role="dialog" aria-label="Menu">
      <div class="sheet-head"><h2>Menu</h2>${wallet(game)}</div>
      <button class="btn big grass" id="mResume">Back to the tee</button>
      <div class="menu-grid">
        <button class="btn ghost" id="mLevels">Levels</button>
        <button class="btn blue" id="mShop">Pro Shop</button>
        <button class="btn ghost" id="mGolfer">Golfer: ${esc(golferName(s.golfer))}</button>
        <button class="btn ghost" id="mHow">How to play</button>
        <button class="btn ghost" id="mSound">${s.muted ? 'Sound off' : 'Sound on'}</button>
        <button class="btn ghost" id="mRestart">Restart level</button>
      </div>
    </div>`;
  on(el, '#mResume', () => { sfx.click(); game.resume(); });
  on(el, '#mLevels', () => { sfx.click(); game.openMap('menu'); });
  on(el, '#mShop', () => { sfx.click(); game.openShop('menu'); });
  on(el, '#mGolfer', () => { sfx.click(); game.openSelect('menu'); });
  on(el, '#mHow', () => { sfx.click(); game.openHowto('menu'); });
  on(el, '#mSound', (b) => { const m = game.toggleMute(); b.textContent = m ? 'Sound off' : 'Sound on'; sfx.click(); });
  on(el, '#mRestart', () => { sfx.click(); game.restartLevel(); });
}

export function renderHowto(game, back) {
  const el = $('howto');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="How to play">
      <div class="sheet-head"><h2>How to hit a bomb</h2></div>
      <div class="how-grid">
        <div class="how-step"><span class="num">1</span><h3>Start</h3><p>Tap anywhere or press <kbd>Space</kbd>. The needle races right.</p></div>
        <div class="how-step"><span class="num">2</span><h3>Power</h3><p>Tap again to lock power. Past 100 is an <b>overswing</b>: longer, but harder to hit clean.</p></div>
        <div class="how-step"><span class="num">3</span><h3>Accuracy</h3><p>Tap as the needle comes back through the <b>white zone</b>. Early hooks, late slices.</p></div>
      </div>
      <p>The ball has to finish inside the white lines (the grid) or it scores zero. Three balls per level; your best one counts. Fly through coins and crates, then spend coins in the Pro Shop.</p>
      <div class="keys">
        <kbd>&larr; &rarr;</kbd><span>Aim</span>
        <kbd>&uarr; &darr;</kbd><span>Shot shape: Stinger for headwinds, Sky Ball for tailwinds</span>
        <kbd>1-7</kbd><span>Arm a power-up you own</span>
        <kbd>Esc</kbd><span>Menu</span>
      </div>
      <div class="sheet-foot"><button class="btn" id="howBack">Got it</button></div>
    </div>`;
  on(el, '#howBack', () => { sfx.click(); game.goBack(back); });
}

export function renderSelect(game, back) {
  const el = $('select');
  const s = game.save;
  const bars = (g) => {
    const pw = Math.round((g.power / 1.3) * 100);
    const sw = Math.round((g.sweet / 1.8) * 100);
    return [['Power', pw], ['Sweet spot', sw]]
      .map(([n, v]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.max(8, Math.min(100, v))}%"></i></div></div>`).join('');
  };
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Choose your golfer">
      <div class="sheet-head"><h2>Who's swinging?</h2></div>
      <div class="golfers">
        ${GOLFERS.map((g) => {
          const locked = g.unlockAfter && !(s.stars[g.unlockAfter] > 0);
          return `<button class="card ${s.golfer === g.id ? 'on' : ''}" data-id="${g.id}" ${locked ? 'disabled' : ''}>
            <span class="who">${locked ? icon('lock', 18) + ' ' : ''}${esc(g.name)}</span>
            ${bars(g)}
            <p>${locked ? `Clear level ${g.unlockAfter} to unlock.` : esc(g.quirk)}</p>
          </button>`;
        }).join('')}
      </div>
      <div class="sheet-foot"><button class="btn grass" id="selDone">Done</button></div>
    </div>`;
  on(el, '.card', (b) => {
    game.chooseGolfer(b.dataset.id);
    for (const c of el.querySelectorAll('.card')) c.classList.toggle('on', c === b);
  });
  on(el, '#selDone', () => { sfx.click(); game.goBack(back); });
}

export function renderMap(game, back) {
  const el = $('map');
  const s = game.save;
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Levels">
      <div class="sheet-head"><h2>Levels</h2>${wallet(game)}</div>
      <div class="levels">
        ${LEVELS.map((l) => {
          const locked = l.id > s.unlocked;
          const best = s.best[l.id];
          return `<button class="card lv ${locked ? 'locked' : ''} ${l.id === LEVELS.length ? 'final' : ''}" data-id="${l.id}" ${locked ? 'disabled' : ''}>
            <div class="lv-top"><span class="lv-n">${l.id}</span>${locked ? icon('lock', 20) : stars(s.stars[l.id] || 0, 16)}</div>
            <div class="lv-name">${esc(l.name)}</div>
            <div class="lv-bot"><span>Target ${l.stars[0]}</span><span>${best ? `Best ${best.toFixed(1)}` : ''}</span></div>
          </button>`;
        }).join('')}
      </div>
      <div class="sheet-foot"><button class="btn" id="mapBack">Back</button></div>
    </div>`;
  on(el, '.lv', (b) => { sfx.click(); game.startLevel(Number(b.dataset.id)); });
  on(el, '#mapBack', () => { sfx.click(); game.goBack(back); });
}

export function renderShop(game, back) {
  const el = $('shop');
  const s = game.save;
  const gearCards = Object.entries(GEAR).map(([slot, def]) => {
    const lv = s.gear[slot];
    const cur = def.levels[lv];
    const next = def.levels[lv + 1];
    return `<div class="ware">
      <div class="ware-top">${icon(slot, 36)}<div><div class="lbl">${def.label} · ${def.stat}</div><div class="name">${esc(cur.name)}</div></div></div>
      <div class="pips">${def.levels.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
      ${next ? `<div class="note"><b>Next: ${esc(next.name)}.</b> ${esc(next.note)}</div>
        <button class="btn ${s.coins >= next.price ? 'grass' : ''}" data-slot="${slot}" ${s.coins >= next.price ? '' : 'disabled'}>Buy · ${next.price}</button>`
        : '<div class="own">Maxed out</div>'}
    </div>`;
  }).join('');
  const itemCards = ITEMS.map((it) => `<div class="ware">
      <div class="ware-top">${icon(it.id, 36)}<div><div class="name">${esc(it.name)}</div><div class="own">Own ${s.items[it.id] || 0}</div></div></div>
      <div class="note">${esc(it.desc)}</div>
      <button class="btn ${s.coins >= it.price ? 'grass' : ''}" data-item="${it.id}" ${s.coins >= it.price ? '' : 'disabled'}>Buy · ${it.price}</button>
    </div>`).join('');
  el.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Pro Shop">
      <div class="sheet-head"><div><div class="eyebrow">Sal's Pro Shop · no refunds</div><h2>Gear up</h2></div>${wallet(game)}</div>
      <h3>Gear (permanent)</h3>
      <div class="shop-grid">${gearCards}</div>
      <h3>Power-ups (one shot each)</h3>
      <div class="shop-grid">${itemCards}</div>
      <div class="sheet-foot"><button class="btn" id="shopBack">Done</button></div>
    </div>`;
  on(el, '[data-slot]', (b) => { if (game.buyGear(b.dataset.slot)) { const y = el.scrollTop; renderShop(game, back); el.scrollTop = y; } });
  on(el, '[data-item]', (b) => { if (game.buyItem(b.dataset.item)) { const y = el.scrollTop; renderShop(game, back); el.scrollTop = y; } });
  on(el, '#shopBack', () => {
    sfx.click();
    // The end card shows your wallet on its Pro Shop link; keep it current after shopping.
    const endShop = $('endShop');
    if (endShop) endShop.textContent = `Pro Shop · ${game.save.coins} coins`;
    game.goBack(back);
  });
}
