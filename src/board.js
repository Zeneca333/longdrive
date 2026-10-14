// Which scoreboard this copy of the game talks to:
// - on claude.ai: the artifact's own database and live room (board-claude.js)
// - anywhere else: the public high-score table (board-public.js), if one is configured
// Both expose the same functions, so the rest of the game doesn't care which it got.
import * as onClaude from './board-claude.js';
import * as publicTable from './board-public.js';

const B = typeof window !== 'undefined' && window.claude?.use ? onClaude : publicTable;

export const {
  live, initBoard, boardReady, onSocial, setPresence, sendKudos, onlineNow, onlineCount, names,
  setNick, myBoardNick, suggestedNick, tidyFeed, recordLevelDrive, recordStars, recordDaily,
  levelTop, dailyTop, tourTop, recentBombs,
} = B;
export { cleanNick } from './nick.js';
