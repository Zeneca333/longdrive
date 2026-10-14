// The game loop and state machine. The page opens straight onto the tee:
// aim → swing → flight → result (auto) → next ball → level end → next level. Everything else lives behind Menu.
import { Stage } from './scene.js';
import { buildCourse, rollWind } from './course.js';
import { createBall, stepBall, fireRocket, simulate, scoreBall, STEP } from './physics.js';
import { SwingMeter, makeLaunch, SHAPES, METER_MIN, METER_MAX, BASE_SWEET } from './swing.js';
import { GOLFERS, GEAR, ITEMS, LEVELS, LINES, SHARE_URL, starsFor } from './config.js';
import { loadSave, writeSave } from './save.js';
import { initAudio, sfx, setMuted } from './audio.js';
import { icon } from './icons.js';
import * as UI from './ui.js';
import * as Board from './board.js';
import { todayKey, dailyLevel, dailyWind, prettyDate } from './daily.js';

const $ = (id) => document.getElementById(id);
const FLIGHT_SPEED = 1.7;
const SHOT_CARD_SECS = 2.3;
const BALL_COLORS = ['#ffc83d', '#ff4f6d', '#7fe3ff', '#9b6bff', '#8dff6a', '#ff9a3d'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const MODALS = new Set(['select', 'map', 'shop', 'pause', 'howto', 'club']);
const RIVAL_COLORS = ['#ffc83d', '#c9ced6', '#d9935a'];
const pct = (m) => ((m - METER_MIN) / (METER_MAX - METER_MIN)) * 100;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.stage = new Stage(canvas);
    this.save = loadSave();
    setMuted(this.save.muted);
    this.state = 'boot';
    this.t = 0;
    this.clock = 0;
    this.aim = 0;
    this.shapeIdx = 1;
    this.armed = new Set();
    this.ff = false;
    this.acc = 0;
    this.run = null;
    this.ball = null;
    this.overlay = null;
    this.toastTimer = 0;
    this.bindInput();
    $('coinIcon').innerHTML = icon('coin', 22);
    $('clubIcon').innerHTML = icon('trophy', 22);
    Board.boardReady().then((ok) => { this.social = ok; $('clubBtn').hidden = !ok; this.refreshClubBtn(); });
    Board.onSocial((ev) => this.onSocial(ev));
  }

  get golfer() { return GOLFERS.find((g) => g.id === this.save.golfer) || GOLFERS[0]; }
  get gear() {
    // The Daily Drive is starter gear for everyone, so the board measures swings, not wallets.
    const g = this.run?.level.daily ? { driver: 0, ball: 0, grip: 0 } : this.save.gear;
    return { driver: GEAR.driver.levels[g.driver], ball: GEAR.ball.levels[g.ball], grip: GEAR.grip.levels[g.grip] };
  }

  persist() { writeSave(this.save); this.refreshCoins(); }

  // ---------- boot ----------

  // No title menu: land on the tee of your current level with the logo over it. The first tap swings.
  start() {
    const id = Math.max(1, Math.min(this.save.level || 1, this.save.unlocked));
    this.startLevel(id, { title: true });
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    this.overlay = id;
  }

  setState(s) {
    this.state = s;
    const playing = ['aim', 'swing', 'flight', 'settle', 'shot', 'paused'].includes(s);
    $('hud').hidden = !playing;
    $('dock').hidden = s !== 'aim';
    $('flightBar').hidden = s !== 'flight';
  }

  // ---------- menus ----------

  // Sub-screens open from the menu (back = 'menu') or the level-end card (back = 'end').
  openSelect(back = 'menu') { UI.renderSelect(this, back); this.showScreen('select'); }
  openMap(back = 'menu') { UI.renderMap(this, back); this.showScreen('map'); }
  openHowto(back = 'menu') { UI.renderHowto(this, back); this.showScreen('howto'); }
  openShop(back = 'menu') { UI.renderShop(this, back); this.showScreen('shop'); }
  openMenu() { this.hideBanner(); this.clearToast(); UI.renderMenu(this); this.showScreen('pause'); }

  // The Clubhouse can open mid-game (from the HUD), from the menu or from a level-end card.
  openClub(tab = 'level', back = null) {
    if (['aim', 'flight', 'settle', 'shot'].includes(this.state)) {
      this.paused = { state: this.state, overlay: this.overlay };
      this.setState('paused');
      back = back || 'play';
    }
    this.hideBanner();
    this.clearToast();
    UI.renderClub(this, tab, back || 'menu');
    this.showScreen('club');
  }

  goBack(back) {
    if (back === 'end') this.showScreen('end');
    else if (back === 'play') this.resume();
    else this.openMenu();
  }

  chooseGolfer(id) {
    this.save.golfer = id;
    this.persist();
    this.stage.setGolfer(id);
    sfx.buy();
  }

  toggleMute() {
    this.save.muted = !this.save.muted;
    setMuted(this.save.muted);
    this.persist();
    return this.save.muted;
  }

  buyGear(slot) {
    const lvl = this.save.gear[slot] + 1;
    const next = GEAR[slot].levels[lvl];
    if (!next || this.save.coins < next.price) { sfx.nope(); return false; }
    this.save.coins -= next.price;
    this.save.gear[slot] = lvl;
    this.persist();
    sfx.buy();
    return true;
  }

  buyItem(id) {
    const it = ITEMS.find((i) => i.id === id);
    if (this.save.coins < it.price) { sfx.nope(); return false; }
    this.save.coins -= it.price;
    this.save.items[id] = (this.save.items[id] || 0) + 1;
    this.persist();
    sfx.buy();
    return true;
  }

  // ---------- levels ----------

  startLevel(id, { title = false } = {}) {
    const level = LEVELS.find((l) => l.id === id);
    this.save.level = id;
    this.persist();
    this.loadRun(level, buildCourse(level));
    this.titleUp = title;
    if (title) { this.showScreen('title'); $('hud').hidden = true; }
    else this.showBanner(level);
  }

  // Same course and wind for everyone today, one three-ball attempt. Leaving mid-way keeps your place.
  startDaily() {
    const key = todayKey();
    const prev = this.save.daily?.date === key ? this.save.daily : null;
    if (prev && prev.used >= 3) { this.openClub('daily', this.overlay === 'end' ? 'end' : 'menu'); return; }
    const level = dailyLevel(key);
    this.loadRun(level, buildCourse(level, { seed: level.seed }), { used: prev?.used || 0, best: prev?.best || 0 });
    this.showBanner(level);
  }

  loadRun(level, course, { used = 0, best = 0 } = {}) {
    this.paused = null;
    this.titleUp = false;
    this.course = course;
    this.stage.buildLevel(course);
    this.stage.setGolfer(this.save.golfer);
    this.run = { level, balls: 3, used, results: [], best, coins: { dist: 0, pickups: 0, crates: 0 } };
    this.armed.clear();
    this.aim = 0;
    this.t = 0;
    this.windBall = null;
    this.leader = 0;
    this.beginAiming();
    this.stage.cameraAddress(0, 0, true);
    this.placeRivalFlags();
    Board.setPresence({ lv: level.daily ? 0 : level.id, daily: !!level.daily });
  }

  restartLevel() {
    if (this.run?.level.daily) this.startDaily();
    else if (this.run) this.startLevel(this.run.level.id);
  }

  showBanner(level) {
    UI.renderBanner(level, this);
    $('banner').hidden = false;
    this.bannerT = 4.5;
    const rows = level.daily ? Board.dailyTop(level.date) : Board.levelTop(level.id, 1);
    rows.then((r) => UI.fillBannerRecord(level, r));
  }

  // Flags out on the fairway: your own best, plus the top three on the leaderboard where their balls stopped.
  placeRivalFlags() {
    const course = this.course;
    const level = this.run.level;
    const own = level.daily
      ? (this.save.daily?.date === level.date ? { yards: this.save.daily.best, x: this.save.daily.bestX || 0 } : null)
      : { yards: this.save.best[level.id] || 0, x: this.save.bestX?.[level.id] || 0 };
    if (own?.yards > 0) this.stage.addRivalFlag(own.x, -own.yards, `You ${own.yards.toFixed(1)}`, '#ff4f6d');
    const rows = level.daily ? Board.dailyTop(level.date) : Board.levelTop(level.id, 3);
    rows.then((r) => {
      if (!r || this.course !== course) return;
      r.slice(0, 3).forEach((row, i) => {
        if (row.isMe) return;
        this.stage.addRivalFlag(row.x || 0, -row.yards, `${i + 1}. ${shortName(row.name)} ${row.yards.toFixed(1)}`, RIVAL_COLORS[i]);
      });
      this.leader = r[0]?.yards || 0;
      this.refreshHud();
    });
  }

  hideBanner() { this.bannerT = 0; $('banner').hidden = true; }

  beginAiming() {
    this.showScreen(null);
    const r = this.run;
    if (this.windBall !== r.used) this.rollWindFor(r.used);
    this.resetBallAtTee();
    this.meter = this.makeMeter();
    this.swingAngle = 0;
    this.setState('aim');
    this.refreshHud();
    this.refreshDock();
    this.updateScope();
  }

  rollWindFor(ballIndex) {
    const lv = this.run.level;
    this.wind = lv.daily ? dailyWind(lv, ballIndex) : rollWind(lv);
    this.windBall = ballIndex;
    this.course.env.wind = { x: this.wind.x, z: this.wind.z };
  }

  resetBallAtTee() {
    this.ball = null;
    this.stage.ball.visible = true;
    this.stage.ball.position.set(0, 0.19, 0);
    this.stage.ballShadow.position.set(0, 0.07, 0);
    this.stage.ballShadow.scale.setScalar(1);
    this.stage.ballShadow.visible = true;
  }

  makeMeter() {
    const g = this.golfer, gear = this.gear;
    return new SwingMeter({
      sweet: BASE_SWEET * g.sweet * gear.grip.sweet * (this.armed.has('butter') ? 2 : 1),
      tempo: g.tempo * gear.grip.tempo,
      maxPower: g.maxPower,
      wobble: g.wobble,
    });
  }

  // ---------- input ----------

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key;
      if (k === ' ' || k === 'Enter') {
        if (MODALS.has(this.overlay)) return;
        e.preventDefault();
        if (!e.repeat) this.press();
      } else if (this.state === 'aim' && (!this.meter || this.meter.state === 'idle')) {
        if (k === 'ArrowLeft' || k === 'a') { this.nudgeAim(-1); e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd') { this.nudgeAim(1); e.preventDefault(); }
        else if (k === 'ArrowUp' || k === 'w') { this.cycleShape(1); e.preventDefault(); }
        else if (k === 'ArrowDown' || k === 's') { this.cycleShape(-1); e.preventDefault(); }
        else if (/^[1-7]$/.test(k)) this.toggleItem(ITEMS[Number(k) - 1].id);
      }
      if (k === 'Escape' || k === 'p') {
        if (this.state === 'paused' && this.overlay !== 'pause') this.openMenu();
        else this.togglePause();
      }
      if ((k === 'f' || k === 'F') && this.state === 'flight') this.ff = !this.ff;
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (['aim', 'flight', 'shot'].includes(this.state)) this.press();
    });
    $('aimL').onclick = () => this.nudgeAim(-1);
    $('aimR').onclick = () => this.nudgeAim(1);
    $('shapeBtn').onclick = () => this.cycleShape(1);
    $('pauseBtn').onclick = () => this.togglePause();
    $('clubBtn').onclick = () => { sfx.click(); this.openClub(this.run?.level.daily ? 'daily' : 'level'); };
    $('rocketBtn').onclick = (e) => { e.stopPropagation(); this.fire(); };
    let holdTimer = null;
    for (const id of ['aimL', 'aimR']) {
      const el = $(id);
      const dir = id === 'aimL' ? -1 : 1;
      el.addEventListener('pointerdown', () => { clearInterval(holdTimer); holdTimer = setInterval(() => this.nudgeAim(dir), 110); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => clearInterval(holdTimer));
    }
  }

  press() {
    initAudio();
    switch (this.state) {
      case 'aim':
        if (this.titleUp) { this.titleUp = false; this.showScreen(null); $('hud').hidden = false; }
        this.swingPress();
        break;
      case 'flight': if (!this.fire()) { this.ff = !this.ff; this.refreshFlightBar(); } break;
      case 'shot': this.nextBall(); break;
      case 'end': this.endPrimary(); break;
    }
  }

  nudgeAim(d) {
    if (this.state !== 'aim' || this.meter.state !== 'idle') return;
    this.aim = Math.max(-20, Math.min(20, this.aim + d));
    this.refreshDock();
    this.updateScope();
  }

  cycleShape(d) {
    if (this.state !== 'aim' || this.meter.state !== 'idle') return;
    this.shapeIdx = (this.shapeIdx + d + SHAPES.length) % SHAPES.length;
    sfx.tick();
    this.refreshDock();
    this.updateScope();
    this.toast(`${SHAPES[this.shapeIdx].name}: ${SHAPES[this.shapeIdx].hint}`, 1.8);
  }

  toggleItem(id) {
    if (this.state !== 'aim' || this.meter.state !== 'idle' || this.run.level.daily) return;
    const have = this.save.items[id] || 0;
    if (id === 'mulligan') {
      if (!have) { sfx.nope(); return; }
      this.save.items.mulligan--;
      this.run.balls++;
      this.persist();
      sfx.crate();
      this.pop('MULLIGAN!', 'green');
      this.toast('Extra ball added. Nobody saw anything.');
      this.refreshHud();
      this.refreshDock();
      return;
    }
    if (this.armed.has(id)) this.armed.delete(id);
    else if (have > 0) this.armed.add(id);
    else { sfx.nope(); this.toast('None left. Grab more in the Pro Shop or from mystery crates.', 2); return; }
    sfx.click();
    const it = ITEMS.find((i) => i.id === id);
    if (this.armed.has(id)) this.toast(`${it.name} armed. ${it.desc}`, 2.2);
    this.meter = this.makeMeter();
    this.refreshDock();
    this.refreshHud();
    this.updateScope();
  }

  togglePause() {
    if (['aim', 'flight', 'settle', 'shot'].includes(this.state)) {
      this.paused = { state: this.state, overlay: this.overlay };
      this.setState('paused');
      this.openMenu();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  resume() {
    const p = this.paused;
    if (!p) return;
    this.paused = null;
    this.setState(p.state);
    this.showScreen(p.overlay === 'title' ? null : p.overlay);
    this.titleUp = false;
    $('hud').hidden = false;
    // A new golfer or new gear from the menu applies to the very next swing.
    if (p.state === 'aim' && this.meter.state === 'idle') {
      this.meter = this.makeMeter();
      this.refreshDock();
      this.refreshHud();
    }
  }

  // ---------- the swing ----------

  swingPress() {
    const m = this.meter;
    const before = m.state;
    m.press();
    sfx.tick();
    if (before === 'idle') { this.stage.setAim(this.aim, false); this.hideBanner(); }
    if (m.state === 'done') this.startDownswing();
    this.refreshHint();
  }

  startDownswing() {
    const res = this.meter.result;
    this.setState('swing');
    this.swingAnim = { t: 0, from: this.swingAngle, launched: false };
    this.lastResult = res;
    if (res.power > 1.001 && !res.pure && res.kind !== 'draw' && res.kind !== 'fade') this.pendingOver = true;
  }

  launch() {
    const res = this.lastResult;
    const g = this.golfer, gear = this.gear;
    const shape = SHAPES[this.shapeIdx];
    const L = makeLaunch({ result: res, golfer: g, gear: { speed: gear.driver.speed }, shape, aimDeg: this.aim });
    const items = new Set(this.armed);
    for (const id of items) this.save.items[id] = Math.max(0, (this.save.items[id] || 0) - 1);
    this.armed.clear();
    this.persist();
    this.ball = createBall(L, {
      dragMult: gear.ball.drag, liftMult: gear.ball.lift, rollMult: g.roll,
      rocket: items.has('rocket'), calm: items.has('calm'), bouncy: items.has('bouncy'),
      gMult: items.has('moon') ? 0.6 : 1,
    });
    this.ballIndex = this.run.used;
    this.ballColor = BALL_COLORS[this.ballIndex % BALL_COLORS.length];
    this.trailT = 0;
    this.acc = 0;
    this.ff = false;
    this.stage.camOffset.set(0, 4, 12);
    this.stage.setScope(null);
    this.setState('flight');
    this.refreshFlightBar();

    const q = res.pure ? 1 : res.kind === 'shank' ? 0 : 0.6;
    sfx.whack(q);
    this.stage.particles.burst({ x: 0.2, y: 0, z: 0 }, { count: 14, colors: ['#5bb84a', '#3f9637', '#7a4e2a'], speed: 3, up: 4, size: 0.18, life: 1 });
    if (res.pure) {
      this.stage.shake = 0.6;
      this.pop(res.power > 1.001 ? 'PURE OVERSWING!' : 'PURE!', '');
      this.stage.cheer = 1.2;
      $('meter').classList.add('pure');
    } else if (res.kind === 'shank') {
      sfx.shank();
      this.pop('SHANK!', 'hot');
      this.toast(pick(LINES.shank));
    } else {
      this.pop(res.label, res.kind === 'draw' || res.kind === 'fade' ? 'white' : 'hot');
      if (res.kind === 'hook' || res.kind === 'slice') this.toast(pick(LINES[res.kind]));
    }
    if (this.pendingOver && !res.pure) this.pop('OVERSWING', 'small hot');
    this.pendingOver = false;
  }

  fire() {
    if (this.state !== 'flight' || !this.ball?.rocket || this.ball.rocket.firing) return false;
    return fireRocket(this.ball);
  }

  // ---------- per frame ----------

  tick(dt) {
    this.clock += dt;
    const st = this.state;
    let simDt = dt;
    // Rolling along the ground is the least exciting part, so it plays at double speed.
    if (st === 'flight') simDt = dt * FLIGHT_SPEED * (this.ff ? 3 : 1) * (this.ball?.mode === 'roll' ? 2 : 1);
    if (st !== 'paused') {
      this.t += simDt;
      this.course.update(this.t, simDt);
    }

    switch (st) {
      case 'aim':
        this.meter.update(dt);
        if (this.meter.state === 'power') this.swingAngle = -Math.min(1, this.meter.pos / 1.15) * 2.75;
        else if (this.meter.state === 'idle') this.idleGolfer(dt);
        if (this.meter.state === 'done') this.startDownswing();
        this.stage.cameraAddress(this.aim, dt);
        this.stage.setAim(this.aim, this.meter.state === 'idle');
        this.refreshMeter();
        break;
      case 'swing': {
        const a = this.swingAnim;
        a.t += dt;
        const down = 0.11;
        if (a.t < down) this.swingAngle = a.from + (0 - a.from) * Math.pow(a.t / down, 2);
        else this.swingAngle = Math.min(2.7, ((a.t - down) / 0.32) * 2.7);
        if (a.t >= down && !a.launched) { a.launched = true; this.launch(); this.setState('flight'); }
        this.stage.cameraAddress(this.aim, dt);
        break;
      }
      case 'flight':
        this.stepFlight(simDt, dt);
        if (this.swingAngle < 2.7) this.swingAngle = Math.min(2.7, this.swingAngle + dt * 8);
        break;
      case 'settle':
        this.settleT -= dt;
        this.stage.cameraOrbit(this.ball.p, this.clock, 11, 4);
        if (this.settleT <= 0) this.showShot();
        break;
      case 'shot':
        if (this.ball) this.stage.cameraOrbit(this.ball.p, this.clock, 16, 6.5);
        this.shotT -= dt;
        if (this.shotT <= 0) this.nextBall();
        break;
      case 'end':
        this.stage.cameraOrbit(this.endFocus || { x: 0, z: 0 }, this.clock, 16, 6);
        break;
    }

    if (this.stage.golfer) this.stage.golfer.setSwing(this.swingAngle || 0);
    this.stage.sync(this.t, st === 'flight' ? simDt : dt, this.ball);
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.hideBanner(); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) $('toast').classList.remove('show'); }
    this.stage.render();
  }

  idleGolfer() {
    this.swingAngle = Math.sin(this.clock * 2.2) * 0.12 - 0.05;
  }

  stepFlight(simDt, dt) {
    const b = this.ball;
    const env = this.course.env;
    this.acc += simDt;
    while (this.acc >= STEP && b.mode !== 'rest' && b.mode !== 'lost') {
      stepBall(b, env, STEP);
      this.acc -= STEP;
      this.trailT += STEP;
      if (b.mode === 'air' && this.trailT > 0.035) {
        this.trailT = 0;
        this.stage.trail.add(b.p, this.ballColor, 0.34);
      }
    }
    if (b.rocket?.firing && b.rocket.fuel > 0) {
      this.stage.particles.burst(b.p, { count: 3, colors: ['#ff9a3d', '#ffc83d', '#ff4f6d'], speed: 2, up: 0.5, size: 0.5, life: 0.5, gravity: 0 });
    }
    for (const ev of b.events) this.onEvent(ev);
    b.events.length = 0;
    this.stage.cameraFollow(b, dt, !!b.carry && b.p.y < 3);
    if (b.mode === 'rest' || b.mode === 'lost') {
      this.setState('settle');
      this.settleT = b.mode === 'lost' ? 1.0 : 0.45;
    }
  }

  onEvent(ev) {
    const S = this.stage;
    const at = { x: ev.x, y: ev.y, z: ev.z };
    switch (ev.type) {
      case 'land':
      case 'bounce': {
        const surf = ev.surface;
        if (surf === 'bunker') { sfx.sand(); S.particles.burst(at, { count: 18, colors: ['#f2dfa0', '#e8d28c', '#ffffff'], speed: 4, up: 5, size: 0.3 }); }
        else if (surf === 'trampoline') { /* boing handles it */ }
        else {
          sfx.thud(ev.speed);
          const cols = surf === 'dust' ? ['#a3a5ab', '#8a8c93'] : surf === 'dirt' ? ['#b98a5c', '#8a6a4a'] : ['#5bb84a', '#3f9637', '#7a4e2a'];
          S.particles.burst(at, { count: ev.type === 'land' ? 10 : 4, colors: cols, speed: 2.5, up: 3, size: 0.25, life: 0.9 });
        }
        break;
      }
      case 'lost':
        if (ev.reason === 'water') {
          sfx.splash();
          this.pop('SPLASH!', 'blue');
          this.toast(pick(LINES.water));
          S.particles.burst(at, { count: 40, colors: ['#ffffff', '#7fd0ff', '#2f8fd6'], speed: 5, up: 12, size: 0.4, life: 1.4 });
        } else {
          sfx.sizzle();
          this.pop('MELTED!', 'hot');
          this.toast(pick(LINES.lava));
          S.particles.burst(at, { count: 40, colors: ['#ff5a1f', '#ffb340', '#3a2222'], speed: 4, up: 14, size: 0.5, life: 1.6 });
        }
        break;
      case 'hit':
        this.onHit(ev, at);
        break;
      case 'coin': {
        const v = Math.round(ev.value * this.golfer.coinMult);
        this.run.coins.pickups += v;
        this.save.coins += v;
        sfx.coin();
        S.particles.burst(at, { count: 10, colors: ['#ffd23d', '#fff8ec'], speed: 4, up: 3, size: 0.3, life: 0.7, gravity: 0.2 });
        this.persist();
        this.bumpCoins();
        break;
      }
      case 'crate': this.onCrate(ev, at); break;
      case 'ring':
        sfx.zoom();
        this.pop('BOOST!', 'blue');
        S.particles.burst(at, { count: 24, colors: ['#ffc83d', '#7fe3ff', '#ffffff'], speed: 8, up: 2, size: 0.4, life: 0.8, gravity: 0 });
        break;
      case 'boing':
        sfx.boing();
        this.pop('BOING!', 'green');
        break;
      case 'geyser':
        sfx.whoosh();
        this.pop('WHOOSH!', 'blue');
        break;
      case 'tornado':
        sfx.tornado();
        this.pop("TORNADO'D!", 'white');
        this.toast(pick(LINES.tornado));
        break;
      case 'ufo':
        sfx.ufo();
        this.pop('ABDUCTED!', 'green');
        break;
      case 'ufoEject':
        if (ev.good) { sfx.zoom(); this.pop('FREE BOOST!', 'green'); this.toast(pick(LINES.ufoGood)); }
        else { sfx.bad(); this.pop('RETURN TO SENDER', 'small hot'); this.toast(pick(LINES.ufoBad)); }
        break;
      case 'rocket':
        sfx.rocket();
        this.pop('ROCKET!', 'hot');
        $('rocketBtn').hidden = true;
        break;
    }
  }

  onHit(ev, at) {
    const S = this.stage;
    const k = ev.kind;
    const table = {
      goose: [() => sfx.honk(), 'HONK!', ['#8a7a66', '#ffffff', '#1f1f1f'], 'goose'],
      sheep: [() => sfx.baa(), 'BAA!', ['#ffffff', '#f7f5ef'], 'sheep'],
      cow: [() => sfx.moo(), 'MOO!', ['#ffffff', '#1b1b1b'], 'cow'],
      windmill: [() => sfx.bonk(), 'BONK!', ['#fff8ec', '#5a3a22'], 'windmill'],
      wreck: [() => sfx.wham(), 'WHAM!', ['#4a4f5c', '#ffc83d'], 'wreck'],
      tree: [() => sfx.thwack(), 'THWACK!', ['#3fa34d', '#4cb85a', '#ff8a3d', '#7a4e2a'], 'tree'],
      cart: [() => sfx.bonk(), 'DING!', ['#ffc83d', '#9aa3b5'], null],
      bomb: [() => sfx.wham(), 'KABOOM!', ['#ff5a1f', '#ffb340', '#3a2222'], null],
      asteroid: [() => sfx.bonk(), 'CLANG!', ['#8d847a', '#5f574f'], null],
    }[k];
    if (!table) return;
    const [sound, word, colors, line] = table;
    sound();
    this.pop(word, k === 'wreck' || k === 'bomb' ? 'hot' : 'white');
    if (line) this.toast(pick(LINES[line]));
    S.particles.burst(at, { count: 22, colors, speed: 6, up: 5, size: 0.35, life: 1.4, gravity: k === 'goose' ? 0.25 : 1, drag: 1.5 });
    if (k === 'wreck' || k === 'bomb') S.shake = 0.8;
  }

  onCrate(ev, at) {
    const S = this.stage;
    S.particles.burst(at, { count: 20, colors: ['#c47a2c', '#9c5a1c', '#ffd23d'], speed: 6, up: 4, size: 0.45, life: 1.2 });
    switch (ev.effect) {
      case 'boost': sfx.zoom(); this.pop('TURBO CRATE!', 'blue'); break;
      case 'feather': sfx.crate(); this.pop('FEATHER FALL!', 'white'); this.toast('Gravity is taking a short break.'); break;
      case 'coins': {
        const v = Math.round(40 * this.golfer.coinMult);
        this.run.coins.crates += v;
        this.save.coins += v;
        this.persist();
        this.bumpCoins();
        sfx.crate();
        this.pop(`+${v} COINS`, '');
        break;
      }
      case 'item': {
        const pool = ITEMS.filter((i) => i.id !== 'mulligan');
        const it = pick(pool);
        this.save.items[it.id] = (this.save.items[it.id] || 0) + 1;
        this.persist();
        sfx.crate();
        this.pop(`FREE ${it.name.toUpperCase()}!`, 'green');
        break;
      }
      case 'anvil': sfx.bad(); this.pop('ANVIL?!', 'hot'); this.toast('Who puts an anvil in a mystery crate?'); break;
    }
  }

  // ---------- results ----------

  showShot() {
    const r = this.run;
    const b = this.ball;
    const env = this.course.env;
    const score = scoreBall(b, env);
    const yards = Math.round(score.yards * 10) / 10;
    const res = this.lastResult;
    const prevBest = r.best;
    r.used++;
    r.results.push({ yards, reason: score.reason, label: res.label });
    r.best = Math.max(r.best, yards);
    const target = r.level.daily ? this.leader || r.level.stars[0] : r.level.stars[0];
    if (r.level.daily) {
      const prev = this.save.daily?.date === r.level.date ? this.save.daily : {};
      this.save.daily = { date: r.level.date, used: r.used, best: r.best, bestX: !score.reason && yards > prevBest ? b.p.x : prev.bestX || 0 };
    }
    const distCoins = Math.round(Math.floor(yards / 10) * this.golfer.coinMult);
    r.coins.dist += distCoins;
    this.save.coins += distCoins;
    this.persist();

    if (score.reason === 'oob') { sfx.groan(); this.pop('OUT OF BOUNDS', 'hot'); this.toast(pick(LINES.oob)); }
    else if (yards >= target && prevBest < target) { sfx.cheer(true); sfx.fanfare(); this.stage.cheer = 3; }
    else if (yards > prevBest && yards > 0) { sfx.cheer(false); this.stage.cheer = 2; }
    else if (yards > 0 && yards < target * 0.7) sfx.groan();

    if (!score.reason) this.postDrive(yards, b.p.x);
    if (score.reason !== 'water' && score.reason !== 'lava') {
      this.stage.addMarker(b.p.x, b.p.z, this.ballColor, score.reason === 'oob' ? 'OB' : `${yards.toFixed(1)}`);
    }

    let comment;
    if (score.reason === 'oob') comment = pick(LINES.oob);
    else if (score.reason) comment = pick(LINES[score.reason]);
    else if (yards >= target) comment = pick(LINES.big);
    else if (yards < target * 0.75) comment = pick(LINES.short);
    else comment = `${(target - yards).toFixed(1)} yards short of the target. So close.`;
    if (score.reason !== 'oob') this.toast(comment, SHOT_CARD_SECS);

    UI.renderShot(this, {
      yards, reason: score.reason, res, carry: b.carry ? Math.max(0, -b.carry.z) : 0,
      newBest: yards > prevBest && yards > 0, beatTarget: yards >= target, distCoins,
      ballsLeft: r.balls - r.used,
    });
    this.showScreen('shot');
    this.setState('shot');
    this.shotT = SHOT_CARD_SECS;
    this.refreshHud();
  }

  // Your best drives go to your local save and, on claude.ai, to the shared boards.
  postDrive(yards, x) {
    const r = this.run, lv = r.level, s = this.save;
    if (lv.daily) {
      Board.recordDaily(lv.date, yards, x, s.golfer);
      return;
    }
    if (yards > (s.best[lv.id] || 0)) {
      s.best[lv.id] = yards;
      s.bestX = { ...s.bestX, [lv.id]: Math.round(x * 10) / 10 };
      this.persist();
    }
    Board.recordLevelDrive(lv.id, yards, x, s.golfer).then((res) => {
      if (!res?.record || this.run !== r) return;
      this.pop('COURSE RECORD!', 'green');
      sfx.fanfare();
      this.ticker(`You hold the course record on ${lv.name}. For now.`);
    });
  }

  nextBall() {
    if (this.state !== 'shot') return;
    this.clearToast();
    $('meter').classList.remove('pure');
    if (this.run.used < this.run.balls) this.beginAiming();
    else this.finishLevel();
  }

  finishLevel() {
    if (this.run.level.daily) return this.finishDaily();
    const r = this.run;
    const lv = r.level;
    const s = this.save;
    const earned = starsFor(lv, r.best);
    const before = s.stars[lv.id] || 0;
    const cleared = earned > 0;
    const firstClear = cleared && before === 0;
    let bonus = 0, starBonus = 0;
    if (cleared) {
      bonus = firstClear ? 100 + 40 * (lv.id - 1) : 30;
      starBonus = Math.max(0, earned - before) * 40;
      s.stars[lv.id] = Math.max(before, earned);
      if (lv.id < LEVELS.length) s.unlocked = Math.max(s.unlocked, lv.id + 1);
      if (lv.id === LEVELS.length) s.beaten = true;
    }
    s.best[lv.id] = Math.max(s.best[lv.id] || 0, r.best);
    s.coins += bonus + starBonus;
    this.persist();
    Board.recordStars(Object.values(s.stars).reduce((a, b) => a + b, 0));
    const unlockedRex = firstClear && GOLFERS.some((g) => g.unlockAfter === lv.id);
    if (cleared) { sfx.fanfare(); this.stage.cheer = 4; } else sfx.groan();
    this.endFocus = { x: 0, z: -Math.max(30, r.best * 0.6) };
    const next = LEVELS.find((l) => l.id === lv.id + 1);
    this.endAction = cleared && next ? next.id : null;
    const roundCoins = r.coins.dist + r.coins.pickups + r.coins.crates + bonus + starBonus;
    UI.renderEnd(this, { level: lv, best: r.best, earned, cleared, firstClear, roundCoins, unlockedRex, next });
    this.showScreen('end');
    this.setState('end');
  }

  finishDaily() {
    const r = this.run;
    const bonus = 50;
    this.save.coins += bonus;
    this.persist();
    sfx.fanfare();
    this.stage.cheer = 4;
    this.endFocus = { x: 0, z: -Math.max(30, r.best * 0.6) };
    this.endAction = 'tour';
    const roundCoins = r.coins.dist + r.coins.pickups + r.coins.crates + bonus;
    UI.renderDailyEnd(this, { level: r.level, best: r.best, roundCoins });
    this.showScreen('end');
    this.setState('end');
  }

  // Space, Enter or the big button on the level-end card: next level if cleared, otherwise go again.
  endPrimary() {
    if (this.endAction === 'tour') this.startLevel(this.save.level || 1);
    else if (this.endAction) this.startLevel(this.endAction);
    else this.restartLevel();
  }

  // ---------- social ----------

  async onSocial(ev) {
    if (ev.type === 'peers') { this.refreshClubBtn(); return; }
    const people = await Board.names([ev.by]);
    const name = people[ev.by]?.name || 'Someone';
    if (ev.type === 'kudos') {
      sfx.crate();
      this.ticker(`${name} says: nice drive!`);
      return;
    }
    const where = ev.daily ? "today's Daily Drive" : LEVELS[ev.lv - 1]?.name || 'the tour';
    const yds = ev.yds.toFixed(1);
    const text = ev.tookMine
      ? `${name} just took your course record on ${where} with ${yds} yds!`
      : ev.record
        ? `${name} set a new course record on ${where}: ${yds} yds`
        : `${name} just hit ${yds} yds on ${where}`;
    if (ev.tookMine) sfx.bad(); else sfx.tick();
    this.ticker(text, ev.by);
  }

  ticker(text, kudosTo = null) {
    const el = $('ticker');
    $('tickerText').textContent = text;
    const btn = $('tickerKudos');
    btn.hidden = !kudosTo;
    btn.disabled = false;
    btn.textContent = 'Nice!';
    btn.onclick = (e) => {
      e.stopPropagation();
      Board.sendKudos(kudosTo);
      btn.textContent = 'Sent';
      btn.disabled = true;
      sfx.click();
    };
    el.hidden = false;
    el.classList.remove('in');
    void el.offsetWidth;
    el.classList.add('in');
    this.hideBanner();
    clearTimeout(this.tickerTimer);
    this.tickerTimer = setTimeout(() => { el.hidden = true; }, 7000);
  }

  refreshClubBtn() {
    const n = Board.onlineCount();
    const live = $('clubLive');
    live.hidden = !n;
    live.textContent = `${n} on`;
  }

  // Copy a brag line for the group chat. Clipboard access needs the click that called this.
  brag(text) {
    const url = window.claude?.use ? SHARE_URL : location.href.split('#')[0];
    const full = `${text} ${url}`;
    const done = () => { sfx.buy(); this.toast('Copied. Paste it in the group chat.', 2.2); };
    const fallback = () => UI.showCopyFallback(full);
    try {
      navigator.clipboard.writeText(full).then(done, fallback);
    } catch {
      fallback();
    }
  }

  bragLine() {
    const s = this.save;
    const r = this.run;
    if (r?.level.daily) return `Daily Drive ${prettyDate(r.level.date)}: ${r.best.toFixed(1)} yds on ${r.level.name.replace('Daily Drive: ', '')} in LONG DRIVE INSANITY. Same course, same wind, your move:`;
    const stars = Object.values(s.stars).reduce((a, b) => a + b, 0);
    const best = Math.max(0, ...Object.values(s.best));
    return `I'm ${stars} stars deep in LONG DRIVE INSANITY with a ${best.toFixed(1)}-yard bomb. Your move:`;
  }

  // ---------- HUD helpers ----------

  refreshHud() {
    const r = this.run;
    if (!r) return;
    $('hudLevel').textContent = r.level.daily ? r.level.name : `${r.level.id} · ${r.level.name}`;
    $('hudTargetLbl').textContent = r.level.daily ? 'Leader' : 'Target';
    $('hudTarget').textContent = r.level.daily ? (this.leader ? this.leader.toFixed(1) : '-') : `${r.level.stars[0]}`;
    $('hudBest').textContent = r.best ? r.best.toFixed(1) : '-';
    const balls = [];
    for (let i = 0; i < r.balls; i++) balls.push(`<i class="${i < r.used ? 'used' : i === r.used && this.state !== 'shot' ? 'now' : ''}"></i>`);
    $('hudBalls').innerHTML = balls.join('');
    this.refreshCoins();
    this.refreshWind();
  }

  refreshCoins() { $('hudCoins').textContent = this.save.coins; }
  bumpCoins() {
    const el = $('hudCoins').parentElement;
    el.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 250 });
  }

  refreshWind() {
    const w = this.wind;
    if (!w) return;
    const calm = this.armed.has('calm');
    const mph = calm ? 0 : w.mph;
    $('windMph').textContent = mph;
    const arrow = $('windArrow');
    arrow.style.transform = `rotate(${w.deg - this.aim}deg)`;
    arrow.style.opacity = mph ? 1 : 0.25;
    const tail = Math.cos((w.deg * Math.PI) / 180), cross = Math.sin((w.deg * Math.PI) / 180);
    let word = 'Calm';
    if (calm) word = 'Jar of Calm';
    else if (mph >= 3) {
      const parts = [];
      if (Math.abs(tail) > 0.38) parts.push(tail > 0 ? 'Helping' : 'Into you');
      if (Math.abs(cross) > 0.38) parts.push(cross > 0 ? 'L to R' : 'R to L');
      word = parts.join(' · ');
    }
    $('windWord').textContent = word;
  }

  refreshDock() {
    // Level 1 is just you and the meter. Aim and shot shape show up from level 2.
    $('dock').classList.toggle('basic', this.run?.level.id === 1);
    $('aimVal').textContent = `${this.aim > 0 ? 'R ' : this.aim < 0 ? 'L ' : ''}${Math.abs(this.aim)}°`;
    $('shapeVal').textContent = SHAPES[this.shapeIdx].name;
    const tray = $('tray');
    // Only power-ups you own show up here; the Pro Shop lists the rest.
    const daily = this.run?.level.daily;
    tray.innerHTML = ITEMS.filter((it) => !daily && (this.save.items[it.id] > 0 || this.armed.has(it.id))).map((it) => {
      const n = this.save.items[it.id] || 0;
      const on = this.armed.has(it.id);
      return `<button class="item ${on ? 'armed' : ''}" data-id="${it.id}" ${n ? '' : 'disabled'} title="${it.name} (${it.key}): ${it.desc}" aria-pressed="${on}">${icon(it.id, 30)}<span class="n">${n}</span><span class="k">${it.key}</span></button>`;
    }).join('');
    for (const b of tray.querySelectorAll('.item')) b.onclick = (e) => { e.stopPropagation(); this.toggleItem(b.dataset.id); };
    this.refreshHint();
    this.refreshWind();
    this.layoutMeter();
  }

  refreshHint() {
    const m = this.meter;
    const verbose = this.run?.level.id <= 2;
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    const txt = !m || m.state === 'idle'
      ? (touch ? '<b>Tap</b> to start your swing' : '<b>Tap</b> or <b>Space</b> to start your swing')
      : m.state === 'power'
        ? `<b>Tap</b> to set power${verbose ? '. Past 100 is an overswing' : ''}`
        : `<b>Tap</b> as the needle crosses the <b>white zone</b>`;
    $('hint').innerHTML = txt;
  }

  layoutMeter() {
    const m = this.meter;
    if (!m) return;
    const over = $('mOver');
    over.style.left = `${pct(1)}%`;
    over.style.width = `${pct(m.maxPower) - pct(1)}%`;
    $('mMark100').style.left = `${pct(1)}%`;
    this.refreshMeter();
  }

  refreshMeter() {
    const m = this.meter;
    if (!m) return;
    const w = m.sweet;
    const sw = $('mSweet');
    sw.style.left = `${pct(-w)}%`;
    sw.style.width = `${pct(w) - pct(-w)}%`;
    const fill = $('mFill');
    const p = m.state === 'power' ? m.pos : m.state === 'idle' ? 0 : m.power;
    fill.style.width = `${Math.max(0, pct(p) - pct(0))}%`;
    $('mNeedle').style.left = `${pct(m.state === 'idle' ? 0 : m.pos)}%`;
    const lock = $('mLock');
    lock.style.display = m.state === 'return' || m.state === 'done' ? 'block' : 'none';
    lock.style.left = `${pct(m.power)}%`;
  }

  refreshFlightBar() {
    const b = this.ball;
    $('rocketBtn').hidden = !(b?.rocket && !b.rocket.firing);
    $('ffHint').textContent = this.ff ? 'Fast forward · tap for normal speed' : 'Tap to speed up';
  }

  updateScope() {
    if (!this.armed.has('scope') || this.state !== 'aim') { this.stage.setScope(null); return; }
    const g = this.golfer, gear = this.gear;
    const L = makeLaunch({ result: { power: 1, pure: true, side: 0, start: 0, strike: 1.03, kind: 'pure' }, golfer: g, gear: { speed: gear.driver.speed }, shape: SHAPES[this.shapeIdx], aimDeg: this.aim });
    const b = createBall(L, {
      dragMult: gear.ball.drag, liftMult: gear.ball.lift, rollMult: g.roll,
      calm: this.armed.has('calm'), bouncy: this.armed.has('bouncy'), gMult: this.armed.has('moon') ? 0.6 : 1,
    });
    const env = { ...this.course.env, colliders: [], fields: [], triggers: [], rng: () => 0.5 };
    const path = simulate(b, env, { every: 10 }).filter((p) => p.mode === 'air' || p.mode === 'roll');
    this.stage.setScope(path);
  }

  pop(text, cls = '') {
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    $('pop').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  clearToast() { this.toastTimer = 0; $('toast').classList.remove('show'); }

  toast(text, secs = 2.6) {
    if (this.bannerT > 0) this.hideBanner();
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    this.toastTimer = secs;
  }
}

function shortName(name) {
  const first = String(name).trim().split(/\s+/)[0] || 'Someone';
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
}
