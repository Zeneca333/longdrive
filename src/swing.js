// The classic three-click swing meter, plus turning its result into a launch.
// Meter units: 0 is the impact line (the sweet spot), 1 is 100% power.
// Click 1 starts the needle, click 2 locks power, click 3 sets accuracy as it comes back.

export const METER_MIN = -0.16;
export const METER_MAX = 1.22;
const POWER_SPEED = 0.95; // meter units per second, before tempo
const RETURN_SPEED = 1.0;
export const BASE_SWEET = 0.042; // half-width of the sweet spot

export const SHAPES = [
  { id: 'stinger', name: 'STINGER', launch: 9.5, spin: 0.62, roll: 1.6, hint: 'Low with topspin. Bullies a headwind.' },
  { id: 'stock', name: 'STOCK', launch: 12.5, spin: 0.85, roll: 1, hint: 'Your everyday bomb.' },
  { id: 'sky', name: 'SKY BALL', launch: 15.5, spin: 1.05, roll: 0.7, hint: 'Sky-high. Rides a tailwind forever.' },
];

export class SwingMeter {
  constructor({ sweet = BASE_SWEET, tempo = 1, maxPower = 1.15, wobble = 0 } = {}) {
    this.sweetBase = sweet;
    this.sweet = sweet;
    this.tempo = tempo;
    this.maxPower = maxPower;
    this.wobble = wobble;
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.raw = 0;
    this.pos = 0;
    this.t = 0;
    this.power = 0;
    this.sweet = this.sweetBase;
    this.result = null;
  }

  press() {
    if (this.state === 'idle') {
      this.state = 'power';
      this.raw = this.pos = 0;
      this.t = 0;
    } else if (this.state === 'power') {
      this.lock(this.raw);
    } else if (this.state === 'return') {
      this.finish(this.pos, false);
    }
    return this.state;
  }

  lock(p) {
    this.power = Math.max(0.05, p);
    const over = Math.max(0, this.power - 1);
    this.returnSpeed = RETURN_SPEED * this.tempo * (1 + over * 2.5);
    this.sweet = this.sweetBase * Math.max(0.35, 1 - over * 3.5);
    this.state = 'return';
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'power') {
      this.raw += POWER_SPEED * this.tempo * dt;
      if (this.raw >= this.maxPower) { this.raw = this.maxPower; this.lock(this.maxPower); }
      this.pos = this.raw;
    } else if (this.state === 'return') {
      this.raw -= this.returnSpeed * dt;
      this.pos = this.raw + this.wobble * Math.sin(this.t * 19) * Math.sin(this.t * 7.3);
      if (this.raw <= METER_MIN) this.finish(METER_MIN, true);
    }
  }

  finish(pos, shank) {
    this.state = 'done';
    this.result = { power: this.power, error: pos, ...judge(pos, this.sweet, shank) };
  }
}

// Early click (needle still right of the zone) hooks left; late click slices right.
export function judge(err, sweet, shank = false) {
  if (shank) return { label: 'SHANK!', kind: 'shank', pure: false, side: 1.8, start: 10, strike: 0.5 };
  const a = Math.abs(err);
  if (a <= sweet) return { label: 'PURE!', kind: 'pure', pure: true, side: 0, start: 0, strike: 1.03 };
  const u = Math.min(1, (a - sweet) / 0.2);
  const dir = err > 0 ? -1 : 1;
  const left = dir < 0;
  let label, kind;
  if (u < 0.2) { label = left ? 'DRAW' : 'FADE'; kind = left ? 'draw' : 'fade'; }
  else if (u < 0.6) { label = left ? 'HOOK' : 'SLICE'; kind = left ? 'hook' : 'slice'; }
  else { label = left ? 'DUCK HOOK!' : 'BANANA SLICE!'; kind = left ? 'hook' : 'slice'; }
  return {
    label,
    kind,
    pure: false,
    side: dir * (0.12 + 1.15 * u),
    start: dir * (0.6 + 5 * u),
    strike: 1 - 0.2 * u,
  };
}

export const BASE_SPEED = 72; // yards per second (~148 mph ball speed)

// Everything that turns a swing into a ball: golfer, gear, shot shape, aim and armed items.
export function makeLaunch({ result, golfer, gear, shape, aimDeg = 0 }) {
  const over = Math.max(0, result.power - 1);
  const powerFactor = Math.max(0.12, result.power);
  const speed = BASE_SPEED * golfer.power * gear.speed * powerFactor * result.strike;
  const launchDeg = shape.launch - (1 - result.strike) * 12 + over * 4;
  return {
    speed,
    launchDeg: Math.max(2, launchDeg),
    headingDeg: aimDeg + result.start,
    back: shape.spin * (1 + Math.abs(result.side) * 0.3),
    side: result.side,
    roll: shape.roll * (result.kind === 'draw' ? 1.15 : 1),
  };
}
