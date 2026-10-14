import { Game } from './game.js';
import { initBoard } from './board.js';

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

initBoard();

window.__game = game;
