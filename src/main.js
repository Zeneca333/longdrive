import { Game } from './game.js';
import { initBoard } from './board.js';

// Start the (optional) leaderboard connection before the game asks whether it's there.
initBoard();

const canvas = document.getElementById('game');
const game = new Game(canvas);

function resize() {
  game.stage.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// Signs in the world are drawn with the display font, so give it a moment to load first.
const fontsReady = document.fonts
  ? Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 2500))])
  : Promise.resolve();
fontsReady.catch(() => {}).finally(() => game.start());

// Inside claude.ai, signed-out visitors get a sign-in bar along the bottom of the frame.
// Start with the controls lifted above it and drop them back once a signed-in viewer is confirmed.
if (window.claude?.use) {
  document.body.classList.add('guest');
  window.claude.use('user')
    .then(async (u) => { if (u && (await u.id())) document.body.classList.remove('guest'); })
    .catch(() => {});
}

window.__game = game;
