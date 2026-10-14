// Overlay screens. The game itself needs none of them: they all hang off the Menu button
// or the level-end card. Each render function fills its element and wires its buttons.
import { GOLFERS, GEAR, ITEMS, LEVELS } from './config.js';
import { icon } from './icons.js';
import { sfx } from './audio.js';
import * as Board from './board.js';
import { todayKey, dailyLevel, prettyDate } from './daily.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n, size = 18) => `<span class="stars">${[0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">${icon('star', size)}</span>`).join('')}</span>`;
const golferName = (id) => GOLFERS.find((g) => g.id === id)?.name || 'Mystery golfer';
const wallet = (g) => `<span class="wallet">${icon('coin', 22)}<span>${g.save.coins}</span></span>`;

function on(root, sel, fn) {
  for (const el of root.querySelectorAll(sel)) el.onclick = (e) => { e.stopPropagation(); fn(el, e); };
}

// ---------- in-game (non-blocking) ----------

export function renderBanner(level, game) {
  const el = $('banner');
  if (level.daily) {
    const played = game.run.used;
    el.innerHTML = `
      <div class="b-lv">Daily Drive · ${esc(prettyDate(level.date))} · same course for everyone</div>
      <div class="b-name">${esc(level.name.replace('Daily Drive: ', ''))}</div>
      <div class="b-target">Starter gear · ${played ? `ball ${played + 1} of 3` : '3 balls'} · best one counts</div>
      <p class="b-blurb">${esc(level.blurb)}</p>
      <p class="b-record" id="bannerRecord" hidden></p>`;
    return;
  }
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
  const top = rows[0];
  if (level.daily) {
    rec.innerHTML = top
      ? `${icon('trophy', 14)} Leading today: ${top.yards.toFixed(1)} by ${esc(top.isMe ? 'you' : top.name)} · ${rows.length} played`
      : `${icon('trophy', 14)} Nobody has played today's yet. Go first.`;
    return;
  }
  rec.innerHTML = top
    ? `${icon('star', 14)} Course record ${top.yards.toFixed(1)} by ${esc(top.isMe ? 'you' : top.name)}`
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
        ${dailyDone(game) ? '' : '<button class="link-btn" id="endDaily">Daily Drive</button>'}
        ${d.best > 0 ? '<button class="link-btn" id="endBrag">Copy brag</button>' : ''}
      </div>
    </div>`;
  const board = el.querySelector('#endBoard');
  Board.levelTop(lv.id, 3).then((rows) => {
    if (!rows || !rows.length || !board.isConnected) return;
    board.hidden = false;
    board.innerHTML = `<ol>${rows.map((r) => `<li class="${r.isMe ? 'me' : ''}"><span class="who">${esc(r.isMe ? `${r.name} (you)` : r.name)}</span><span class="club">${esc(golferName(r.golfer))}</span><b>${r.yards.toFixed(1)}</b></li>`).join('')}</ol>`;
  });
  on(el, '#endGo', () => { sfx.click(); game.endPrimary(); });
  on(el, '#endRetry', () => { sfx.click(); game.restartLevel(); });
  on(el, '#endShop', () => { sfx.click(); game.openShop('end'); });
  on(el, '#endDaily', () => { sfx.click(); game.startDaily(); });
  on(el, '#endBrag', () => game.brag(`Just hit ${d.best.toFixed(1)} yds on ${lv.name} (${d.earned} star${d.earned === 1 ? '' : 's'}) in LONG DRIVE INSANITY. Your move:`));
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
      <button class="btn daily-btn" id="mDaily">${esc(dailyLabel(game))}</button>
      <div class="menu-grid">
        ${game.social ? '<button class="btn ghost" id="mClub">Clubhouse</button>' : ''}
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
  on(el, '#mDaily', () => { sfx.click(); game.startDaily(); });
  on(el, '#mClub', () => { sfx.click(); game.openClub('level', 'menu'); });
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

// ---------- the Daily Drive ----------

function dailyState(game) {
  const d = game.save.daily;
  return d?.date === todayKey() ? d : null;
}

function dailyDone(game) { return (dailyState(game)?.used || 0) >= 3; }

function dailyLabel(game) {
  const d = dailyState(game);
  if (!d) return "Play today's Daily Drive";
  if (d.used >= 3) return `Daily Drive done · ${d.best.toFixed(1)} yds`;
  return `Finish the Daily Drive (${d.used} of 3)`;
}

export function renderDailyEnd(game, d) {
  const el = $('end');
  el.innerHTML = `
    <div class="sheet end-card" role="dialog" aria-label="Daily Drive result">
      <div class="end-hero">
        <div class="eyebrow">Daily Drive · ${esc(prettyDate(d.level.date))} · ${esc(d.level.name.replace('Daily Drive: ', ''))}</div>
        <h2>${d.best.toFixed(1)} yds</h2>
        <p id="dailyRank">${game.social ? 'Checking the board…' : 'Same course for everyone today. A new one lands at midnight UTC.'}</p>
        <p class="tip">+${d.roundCoins} coins</p>
      </div>
      <div class="board" id="endBoard" hidden></div>
      <button class="btn big grass end-go" id="endGo">Back to the tour</button>
      <div class="end-links">
        <button class="link-btn" id="endBrag">Copy brag</button>
        ${game.social ? '<button class="link-btn" id="endClub">Clubhouse</button>' : ''}
      </div>
    </div>`;
  Board.dailyTop(d.level.date).then((rows) => {
    if (!rows || !el.isConnected) return;
    const rank = rows.findIndex((r) => r.isMe) + 1;
    const rk = $('dailyRank');
    if (rk) rk.innerHTML = rank ? `You're <b>#${rank}</b> of ${rows.length} today.` : `${rows.length} played today.`;
    const board = el.querySelector('#endBoard');
    if (!rows.length || !board) return;
    board.hidden = false;
    board.innerHTML = `<ol>${rows.slice(0, 5).map((r) => rowHtml(r, r.yards.toFixed(1), golferName(r.golfer))).join('')}</ol>`;
  });
  on(el, '#endGo', () => { sfx.click(); game.endPrimary(); });
  on(el, '#endBrag', () => game.brag(game.bragLine()));
  on(el, '#endClub', () => { sfx.click(); game.openClub('daily', 'end'); });
  setTimeout(() => el.querySelector('#endGo')?.focus({ preventScroll: true }), 50);
}

// ---------- the Clubhouse ----------

function rowHtml(r, value, sub) {
  const av = r.avatar ? `<img class="av" src="${esc(r.avatar)}" alt="" width="24" height="24">` : '<span class="av"></span>';
  return `<li class="${r.isMe ? 'me' : ''}">${av}<span class="who">${esc(r.name)}${r.isMe ? ' (you)' : ''}${r.online ? '<i class="live-dot" title="On the course now"></i>' : ''}</span><span class="club">${esc(sub || '')}</span><b>${value}</b></li>`;
}

function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function renderClub(game, tab = 'level', back = 'menu') {
  const el = $('club');
  const curLevel = game.run && !game.run.level.daily ? game.run.level.id : game.save.level || 1;
  let levelSel = curLevel;
  el.innerHTML = `
    <div class="sheet club-card" role="dialog" aria-label="Clubhouse">
      <div class="sheet-head">
        <div><div class="eyebrow">Clubhouse</div><h2>Leaderboards</h2></div>
        <div class="online-pill" id="clubOnlinePill" hidden></div>
      </div>
      <div class="seg" role="tablist">
        <button role="tab" data-tab="daily">Daily Drive</button>
        <button role="tab" data-tab="level">Levels</button>
        <button role="tab" data-tab="tour">Tour</button>
      </div>
      <div id="clubPanel" class="club-panel"></div>
      <div class="club-extra">
        <div><h3>Recent bombs</h3><ol class="feed" id="clubRecent"><li class="muted">Loading…</li></ol></div>
        <div><h3>On the course now</h3><div class="here" id="clubHere"><span class="muted">Just you right now.</span></div></div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost" id="clubBrag">Copy brag</button>
        <button class="btn" id="clubBack">Back</button>
      </div>
    </div>`;

  const panel = el.querySelector('#clubPanel');
  const show = (t) => {
    tab = t;
    for (const b of el.querySelectorAll('.seg button')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
    if (t === 'daily') drawDaily();
    else if (t === 'level') drawLevel();
    else drawTour();
  };
  const empty = (msg) => `<p class="muted">${msg}</p>`;
  const offline = 'Leaderboards live on the published claude.ai version of the game.';

  function drawDaily() {
    const key = todayKey();
    const lv = dailyLevel(key);
    const st = dailyState(game);
    const action = st && st.used >= 3 ? `<span class="chip gold">You played: ${st.best.toFixed(1)} yds</span>`
      : `<button class="btn grass" id="clubPlayDaily">${st ? `Finish it (${st.used} of 3)` : "Play today's"}</button>`;
    panel.innerHTML = `
      <div class="daily-head">
        <div><b>${esc(prettyDate(key))} · ${esc(lv.name.replace('Daily Drive: ', ''))}</b><span>Same course and wind for everyone · starter gear · 3 balls</span></div>
        ${action}
      </div>
      <ol class="rank" id="clubRows"><li class="muted">Loading…</li></ol>`;
    on(panel, '#clubPlayDaily', () => { sfx.click(); game.startDaily(); });
    Board.dailyTop(key).then((rows) => {
      const ol = panel.querySelector('#clubRows');
      if (!ol || tab !== 'daily') return;
      ol.outerHTML = !rows ? empty(offline) : rows.length
        ? `<ol class="rank">${rows.slice(0, 15).map((r) => rowHtml(r, r.yards.toFixed(1), golferName(r.golfer))).join('')}</ol>`
        : empty('Nobody has played today yet. Go first and set the bar.');
    });
  }

  function drawLevel() {
    panel.innerHTML = `
      <div class="lv-chips">${LEVELS.map((l) => `<button data-lv="${l.id}" aria-pressed="${l.id === levelSel}" title="${esc(l.name)}">${l.id}</button>`).join('')}</div>
      <div class="lv-title">${esc(LEVELS[levelSel - 1].name)} · target ${LEVELS[levelSel - 1].stars[0]}</div>
      <ol class="rank" id="clubRows"><li class="muted">Loading…</li></ol>`;
    on(panel, '[data-lv]', (b) => { levelSel = Number(b.dataset.lv); sfx.tick(); drawLevel(); });
    const want = levelSel;
    Board.levelTop(want, 10).then((rows) => {
      const ol = panel.querySelector('#clubRows');
      if (!ol || tab !== 'level' || levelSel !== want) return;
      ol.outerHTML = !rows ? empty(offline) : rows.length
        ? `<ol class="rank">${rows.map((r) => rowHtml(r, r.yards.toFixed(1), golferName(r.golfer))).join('')}</ol>`
        : empty('No drives posted on this course yet.');
    });
  }

  function drawTour() {
    panel.innerHTML = `<div class="lv-title">Tour standings: most stars, then longest drive</div><ol class="rank" id="clubRows"><li class="muted">Loading…</li></ol>`;
    Board.tourTop(20).then((rows) => {
      const ol = panel.querySelector('#clubRows');
      if (!ol || tab !== 'tour') return;
      ol.outerHTML = !rows ? empty(offline) : rows.length
        ? `<ol class="rank">${rows.map((r) => rowHtml(r, `${r.stars}★`, r.longest ? `Longest ${r.longest.toFixed(1)}` : '')).join('')}</ol>`
        : empty('Nobody has earned a star yet.');
    });
  }

  Board.recentBombs(6).then((rows) => {
    const ol = el.querySelector('#clubRecent');
    if (!ol) return;
    ol.innerHTML = !rows ? `<li class="muted">${offline}</li>` : rows.length
      ? rows.map((r) => `<li><b>${esc(r.isMe ? 'You' : r.name)}</b> hit ${r.yards.toFixed(1)} on ${esc(r.lv ? LEVELS[r.lv - 1]?.name || '' : 'the Daily Drive')} <span class="muted">${ago(r.at)}</span></li>`).join('')
      : '<li class="muted">No drives yet.</li>';
  });
  Board.onlineNow().then((people) => {
    const box = el.querySelector('#clubHere');
    const pill = el.querySelector('#clubOnlinePill');
    if (!box || !people.length) return;
    pill.hidden = false;
    pill.innerHTML = `<i class="live-dot"></i>${people.length} on the course`;
    box.innerHTML = people.map((p) => `<span class="here-p">${p.avatar ? `<img class="av" src="${esc(p.avatar)}" alt="" width="24" height="24">` : ''}${esc(p.name)} <span class="muted">${p.daily ? 'Daily Drive' : esc(LEVELS[p.lv - 1]?.name || 'warming up')}</span></span>`).join('');
  });

  on(el, '.seg button', (b) => { sfx.tick(); show(b.dataset.tab); });
  on(el, '#clubBrag', () => game.brag(tab === 'daily' && dailyDone(game)
    ? `Daily Drive ${prettyDate(todayKey())}: ${dailyState(game).best.toFixed(1)} yds in LONG DRIVE INSANITY. Same course, same wind, your move:`
    : game.bragLine()));
  on(el, '#clubBack', () => { sfx.click(); game.goBack(back); });
  show(tab);
}

// If the clipboard is blocked, show the text selected so it can be copied by hand.
export function showCopyFallback(text) {
  const box = document.createElement('textarea');
  box.className = 'copy-fallback';
  box.value = text;
  box.readOnly = true;
  document.body.appendChild(box);
  box.focus();
  box.select();
  setTimeout(() => box.remove(), 8000);
}
