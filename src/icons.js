// Tiny pixel-art icons drawn as SVG, so the UI matches the voxel world.
const PAL = {
  k: '#1b2340', w: '#ffffff', r: '#ff4f6d', o: '#ff9a3d', y: '#ffc83d', g: '#4cc24a', b: '#2f8cff',
  p: '#9b6bff', s: '#9aa3b5', n: '#8a5a2b', c: '#7fe3ff', d: '#e09a00', l: '#c9e88a',
};

const ART = {
  rocket: ['...rr...', '..rwwr..', '..wbbw..', '..wwww..', '.rwwwwr.', '.r.ww.r.', '...oo...', '...yy...'],
  scope: ['....r....', '..rrrrr..', '.r..r..r.', '.r.....r.', 'rrr.r.rrr', '.r.....r.', '.r..r..r.', '..rrrrr..', '....r....'],
  butter: ['........', '...wwwww', '..yyyyyw', '.yyyyyyw', 'yyyyyyyw', 'yyyyyyy.', 'ddddddd.', '........'],
  calm: ['.kkkkkk.', '..kssk..', '.k....k.', 'k.cccc.k', 'k.c.bc.k', 'k.cbbc.k', 'k......k', '.kkkkkk.'],
  bouncy: ['..rrrr..', '.rwrrrr.', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '.k.kk.k.'],
  moon: ['...ss...', '...ss...', '..pppp..', '.pyyppp.', '.pyyppp.', '.ppppyp.', '.pppppp.', '..pppp..'],
  mulligan: ['..kkkk..', '.kwwwwk.', 'kwwgwwwk', 'kwgggwsk', 'kwwgwwwk', 'kwswwswk', '.kwwwwk.', '..kkkk..'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyywyydk', 'kywyyydk', 'kyyyyydk', 'kyyyyddk', '.kddddk.', '..kkkk..'],
  driver: ['......kk', '.....kk.', '....kk..', '...kk...', '..kk....', '.ssk....', 'ssss....', 'sss.....'],
  ball: ['..kkkk..', '.kwwwwk.', 'kwwswwwk', 'kwwwwswk', 'kwswwwwk', 'kwwwswwk', '.kwwwwk.', '..kkkk..'],
  grip: ['...kk...', '..kgk...', '..kgk...', '..kgk...', '..kgk...', '..kgk...', '..kgk...', '...s....'],
  lock: ['..kkkk..', '.k....k.', '.k....k.', 'kkkkkkkk', 'kyyyyyyk', 'kyykkyyk', 'kyyyyyyk', 'kkkkkkkk'],
  star: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yyyyyy.', '.yy..yy.', 'y......y'],
};

export function icon(name, size = 32) {
  const rows = ART[name];
  if (!rows) return '';
  const h = rows.length, w = rows[0].length;
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (PAL[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[ch]}"/>`;
  }));
  return `<svg class="px" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
