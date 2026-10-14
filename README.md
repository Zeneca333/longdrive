# LONG DRIVE INSANITY

A goofy voxel golf game that is only the long drive. Three clicks, three balls per level, and a grid that gets narrower and weirder the further you go. It starts at Grandpa's driving range and ends on the Moon.

Built with plain JavaScript and [three.js](https://threejs.org/). No build step and no assets: every model is made of code-generated voxels and every sound is synthesised in the browser.

## Play it locally

Any static file server works. Browsers block ES modules from `file://`, so you can't just double-click `index.html`.

```bash
npm start                  # serves on http://localhost:5173
# or
python3 -m http.server 5173
```

three.js and the fonts load from public CDNs, so you need an internet connection the first time.

To host it, turn on GitHub Pages for this repo (Settings → Pages → deploy from the branch, root folder). Everything uses relative paths.

## How to play

The page opens straight onto the first tee, and your first tap is your first swing. Each shot's result shows for a couple of seconds, then you're back on the tee. Clear a level and the big button (or `Space`) takes you to the next one. Everything else lives behind **Menu**: levels, the Pro Shop, golfers, sound and how to play. Coming back later drops you on the level you were last playing.

**The swing is the classic three-click meter:**

1. **Tap** (click, tap or `Space`) to start. The needle races right.
2. **Tap** again to lock power. Past 100 is an **overswing**: more distance, but the sweet spot shrinks and the needle comes back faster.
3. **Tap** as the needle comes back through the **white zone**. Nail it for a PURE strike, which adds 3% ball speed. Early hooks left, late slices right. Miss it completely and you shank it.

**The grid.** Like real long drive contests, the ball has to finish inside the grid (the white lines) or it scores zero. You get three balls per level and your best one counts. Beat the target for one star, then hit the next two marks for two and three stars.

**Shot shape** (`↑` `↓`, from level 2):
- **Stinger:** low, with topspin. Use it into a headwind.
- **Stock:** your everyday drive.
- **Sky Ball:** high and floaty. Use it with a tailwind.

**Aim** with `←` `→` (also from level 2), which is handy for curving around hazards or lining up a boost ring.

### Getting stuff

- **Coins** float along the flight paths. You also earn coins for distance, for clearing a level and for new stars.
- **Mystery crates** usually help: a turbo boost, feather-light gravity, a coin shower or a free power-up. One in ten is an anvil.
- **Sal's Pro Shop** (Menu, or the link on the level-end card) sells permanent gear and one-shot power-ups.

| Gear | What it does |
| --- | --- |
| Driver (4 upgrades) | More ball speed, up to +27% with the INSANITY-9000 |
| Ball (3 upgrades) | Less drag and a bit more lift, so more carry |
| Grip (3 upgrades) | A bigger sweet spot and a calmer needle |

| Power-up | Key | What it does |
| --- | --- | --- |
| Rocket Ball | `1` | Tap again mid-flight to fire a booster. Fire it early in the flight for the biggest gain |
| Laser Scope | `2` | Shows your full predicted flight path while you aim |
| Butter Grip | `3` | Doubles the sweet spot for one swing |
| Jar of Calm | `4` | Switches the wind off for one shot |
| Super Bouncy Ball | `5` | Huge bounces and extra roll |
| Moon Juice | `6` | 40% less gravity for one shot |
| Mulligan | `7` | One extra ball this round |

### The golfers

- **Chip McGee:** balanced, and earns 25% more coins.
- **Big Tony:** big power, but a tiny sweet spot and a fast needle.
- **Granny Divot:** huge sweet spot, slow needle and extra roll, but shorter off the tee.
- **Rex:** an actual T. rex. Massive power, but his tiny arms make the needle wobble. Clear level 4 to unlock him.

### The tour

| # | Level | Target | What's in your way |
| --- | --- | --- | --- |
| 1 | Grandpa's Driving Range | 230 | A ball-picker cart |
| 2 | Blustery Links | 255 | 10–20 mph wind, pot bunkers, sheep |
| 3 | Goose Migration Open | 280 | A pond to carry and three flocks of angry geese |
| 4 | Windmill Meadows | 300 | Spinning windmill sails, boost rings, cows |
| 5 | Construction Chaos | 335 | Wrecking balls, trampolines, wet cement |
| 6 | Volcano Open | 380 | Two lava rivers, geysers, flying lava rocks |
| 7 | Tornado Alley | 430 | Two roaming tornadoes full of cows, plus a huge tailwind |
| 8 | Alien Abduction Invitational | 515 | UFO tractor beams and boost rings. The star marks are the real records: Mike Austin (515), Mike Dobbyn (551) and Kyle Berkshire (579.66) |
| 9 | THE INSANITY | 900 | The Moon. Low gravity, asteroids, craters |

## Code map

| File | What's in it |
| --- | --- |
| `src/physics.js` | Ball flight (drag, lift, sidespin, wind that gets stronger with height), bounce, roll, collisions, triggers. Pure logic |
| `src/swing.js` | The three-click meter and how a swing becomes a launch |
| `src/course.js` | Turns a level spec into moving hazards, coins and crates |
| `src/config.js` | Golfers, gear, power-ups, levels and announcer lines |
| `src/scene.js` | three.js stage: themes, sky, the grid, scenery, hazard visuals, camera |
| `src/models.js` | Every voxel model, from the golfers to the UFO |
| `src/vox.js` | Merges thousands of boxes into one mesh with vertex colours |
| `src/game.js` | The state machine and game loop |
| `src/ui.js` | Menus: golfer select, tour map, Pro Shop, results |
| `src/audio.js` | Synthesised sound effects |
| `src/board.js` | Leaderboards, live ticker and presence on claude.ai (no-op elsewhere) |
| `src/daily.js` | The Daily Drive: today's course and wind from the date |

Physics, the swing and the level layouts don't touch three.js, so they're unit tested in Node:

```bash
npm test
```

One of those tests simulates a pure drive with fair gear on every level, so if you change the physics or a target it will tell you whether the level can still be beaten.

Progress is saved in your browser's `localStorage`.

## Play it

- **claude.ai (with leaderboards):** https://claude.ai/artifact/UfJ3fMHwP2eaCE2Vhs4tbD
- **Standalone (no sign-in, no leaderboards):** https://raw.githack.com/Zeneca333/longdrive/HEAD/index.html. It's served straight from this repo's default branch and picks up each push within a few minutes.

## Social

**These work everywhere:**
- **Daily Drive.** Everyone gets the same course, the same wind for each ball and the same starter gear, with one three-ball attempt per day. The date comes from UTC, so the whole world shares one course. Open it from Menu.
- **Your flag.** Your best drive on each course stands on the fairway as a flag, so you always know what to beat.

**These light up on the claude.ai version (`src/board.js`):**
- **Clubhouse** (HUD button): today's Daily Drive board, top 10 per level, tour standings (most stars, then longest drive), a feed of recent bombs and who's on the course right now.
- **Rival flags.** The top three drives on each course show as name flags where those balls stopped.
- **Live ticker.** When someone online hits a personal best or sets a course record, everyone online sees it. If they took *your* record, you hear about it. Tap **Nice!** to send them kudos.
- **Copy brag.** Copies a one-liner with your score and the link, ready to paste into a chat.
- **Your leaderboard name.** The first round-end card asks for a name (up to 14 letters or numbers), prefilled with your first name. It's used on every board, flag and shout-out, and you can change it from Menu or the Clubhouse.

How it's stored: one document per player at `drives/<player id>` holding their best per level, where it stopped, total stars, longest drive and today's Daily Drive and their chosen name. Everyone can read every row, and each player can only write their own. Live events (`drive`, `kudos`) go over the artifact's room and are never stored. Signed-out visitors can play everything, but they don't post scores. The swing controls also lift above claude.ai's sign-in bar for them.
