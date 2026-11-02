'use strict';

/* =========================================================
   Ludoka – Africa Ludo & Foreign (classic) Ludo
   ========================================================= */

/* ---------- Small helpers ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

/* ---------- Storage + cookie consent ---------- */
const CONSENT_KEY = 'ludoka.consent';   // essential: remembers the banner choice
const PROGRESS_KEY = 'ludoka.level';    // optional: only saved if the player accepts
const SOUND_KEY = 'ludoka.sound';       // optional: only saved if the player accepts
const RULES_KEY = 'ludoka.rules';       // optional: only saved if the player accepts

const store = {
    get(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
    }
};

let consent = store.get(CONSENT_KEY); // 'all' | 'essential' | null
let soundOn = !(consent === 'all' && store.get(SOUND_KEY) === 'off');

/* ---------- Sound (synthesised with Web Audio, no audio files) ---------- */
const sfx = (() => {
    let ctx = null;
    let master = null;
    const MASTER_VOLUME = 3.2;   // raise or lower the overall loudness here

    const ensure = () => {
        if (!soundOn) return null;
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try {
                ctx = new AC();
                // master volume boost, then a compressor so louder sounds don't distort
                master = ctx.createGain();
                master.gain.value = MASTER_VOLUME;
                const limiter = ctx.createDynamicsCompressor();
                limiter.threshold.value = -14;
                limiter.knee.value = 12;
                limiter.ratio.value = 8;
                limiter.attack.value = 0.003;
                limiter.release.value = 0.2;
                master.connect(limiter).connect(ctx.destination);
            } catch (e) { ctx = null; return null; }
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    };

    const tone = (freq, dur, opts = {}) => {
        const c = ensure();
        if (!c) return;
        const { type = 'sine', vol = 0.15, delay = 0, slideTo = null } = opts;
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
    };

    const noise = (dur, vol, delay = 0, freq = 2000) => {
        const c = ensure();
        if (!c) return;
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buffer = c.createBuffer(1, len, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buffer;
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 1.2;
        const gain = c.createGain();
        const t0 = c.currentTime + delay;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter).connect(gain).connect(master);
        src.start(t0);
    };

    const run = (notes, step, opts = {}) => {
        notes.forEach((freq, i) => tone(freq, opts.dur || step * 1.8, { ...opts, delay: (opts.delay || 0) + i * step }));
    };

    return {
        unlock() { ensure(); },
        click() { tone(720, 0.05, { type: 'triangle', vol: 0.06 }); },
        roll() {
            for (let i = 0; i < 6; i++) noise(0.05, 0.12, i * 0.08, 1200 + Math.random() * 1800);
            tone(150, 0.14, { vol: 0.18, delay: 0.5, slideTo: 80 });
        },
        step(i = 0) { tone(480 + i * 40, 0.06, { type: 'triangle', vol: 0.09 }); },
        enter() { tone(392, 0.18, { vol: 0.14, slideTo: 784 }); },
        capture() {
            tone(320, 0.35, { type: 'sawtooth', vol: 0.12, slideTo: 70 });
            noise(0.2, 0.1, 0, 600);
        },
        home() { run([523, 659, 784, 1047], 0.09, { vol: 0.14 }); },
        noMove() { tone(220, 0.18, { vol: 0.08, slideTo: 160 }); },
        turn() { tone(660, 0.09, { vol: 0.06 }); },
        place(n) {
            if (n === 1) {
                run([523, 659, 784, 1047], 0.12, { type: 'triangle', vol: 0.16 });
                [784, 1047, 1319, 1568].forEach((f) => tone(f, 0.9, { vol: 0.09, delay: 0.55 }));
            } else {
                run([523, 659, 784], 0.12, { type: 'triangle', vol: 0.14 });
            }
        }
    };
})();

function vibrate(pattern) {
    if (soundOn && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* not supported */ }
    }
}

/* ---------- Confetti ---------- */
function burstConfetti(count) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = $('confetti');
    const colors = ['#e53935', '#43a047', '#fdd835', '#1e88e5', '#ffffff'];
    for (let i = 0; i < count; i++) {
        const piece = el('i');
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.background = pick(colors);
        piece.style.setProperty('--dx', `${Math.round(Math.random() * 160 - 80)}px`);
        piece.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
        piece.style.animationDuration = `${(2.2 + Math.random() * 1.6).toFixed(2)}s`;
        piece.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
        layer.appendChild(piece);
        setTimeout(() => piece.remove(), 4600);
    }
}

/* ---------- Screens ---------- */
const mainMenu = $('main-menu');
const roadmapScreen = $('roadmap-screen');
const matchmakingScreen = $('matchmaking-screen');
const gameScreen = $('game-screen');
const winnerModal = $('winner-modal');
const placeModal = $('place-modal');

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach((s) => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    screen.classList.remove('hidden');
    screen.classList.add('active');
    document.body.classList.toggle('in-game', screen === gameScreen);
    window.scrollTo(0, 0);
}

/* ---------- Game constants ---------- */
const COLORS = ['Red', 'Green', 'Yellow', 'Blue'];            // clockwise from top-left
const START = { Red: 0, Green: 13, Yellow: 26, Blue: 39 };    // ring index of each start square
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);         // start squares + star squares
const RING_END = 50;   // last ring position a token visits (positions 0..50)
const FINISH = 56;     // 51..55 = home column, 56 = centre
const GRID = 15;
const ORD = ['1st', '2nd', '3rd', '4th'];
const MEDALS = ['🥇', '🥈', '🥉', '🏅'];

// The 52 squares of the shared track, clockwise, starting at Red's start square. [x, y]
const RING = [
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],              // 0-4
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],      // 5-10
    [7, 0], [8, 0],                                      // 11-12
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],              // 13-17  (Green start = 13)
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], // 18-23
    [14, 7], [14, 8],                                    // 24-25
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],          // 26-30  (Yellow start = 26)
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], // 31-36
    [7, 14], [6, 14],                                    // 37-38
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],          // 39-43  (Blue start = 39)
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],      // 44-49
    [0, 7], [0, 6]                                       // 50-51
];

// Home columns, positions 51..55 for each colour. [x, y]
const HOME_COLUMN = {
    Red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    Green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    Yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    Blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
};

// Where finished tokens rest, inside each colour's centre triangle. [x, y] in cell units
const FINISH_POINT = {
    Red: [6.85, 7.5],
    Green: [7.5, 6.85],
    Yellow: [8.15, 7.5],
    Blue: [7.5, 8.15]
};

// Token slots in each base. [x, y] in cell units
const BASE_SLOTS = {
    Red: [[2, 2], [4, 2], [2, 4], [4, 4]],
    Green: [[11, 2], [13, 2], [11, 4], [13, 4]],
    Yellow: [[11, 11], [13, 11], [11, 13], [13, 13]],
    Blue: [[2, 11], [4, 11], [2, 13], [4, 13]]
};

// The cell just before each colour's home column (gets an arrow). Ring indices.
const ARROW_CELLS = { 50: 'red', 11: 'green', 24: 'yellow', 37: 'blue' };

// Ring index of the last track square before each colour's home column
const LANE_ENTRY = {};
COLORS.forEach((c) => { LANE_ENTRY[c] = (START[c] + RING_END) % 52; });

/* ---------- Rule sets ---------- */
const RULES = {
    classic: {
        name: 'Foreign Ludo',
        desc: 'The classic rules: safe star squares, one lap around the board, then home.',
        safeSquares: true,
        blocks: false,
        backCapture: false,
        laneCapture: false
    },
    africa: {
        name: 'Africa Ludo',
        desc: 'No safe squares. Two tokens on a square form a wall nobody can pass. Move backwards to capture an opponent, or capture one inside a home lane and go straight home.',
        safeSquares: false,
        blocks: true,
        backCapture: true,
        laneCapture: true
    }
};

let rulesKey = (consent === 'all' && store.get(RULES_KEY) === 'classic') ? 'classic' : 'africa';
let rules = RULES[rulesKey];

const isSafe = (ringIdx) => rules.safeSquares && SAFE.has(ringIdx);

/* ---------- Game state ---------- */
const tokens = {};
COLORS.forEach((color) => {
    // edge: true marks a token standing on the track square just behind its own start (reached by a backward capture)
    // foreign: { c, lane } marks an intruder standing in another colour's home lane (Africa rules); its pos is then
    // its route position at that lane's entrance
    tokens[color] = [0, 1, 2, 3].map((i) => ({ id: `${color[0]}${i + 1}`, pos: -1, vis: null, edge: false, foreign: null }));
});

let mode = null;          // 'offline' (vs computer) | 'local' (pass & play)
let current = 0;          // index into COLORS
let diceValue = 1;
let phase = 'idle';       // idle | roll | rolling | move | animating | celebrate | over
let session = 0;          // bumped on every start/quit so stale async work stops
let playLevel = 1;        // difficulty of the computer players
let options = [];         // moves the current player may choose from after a roll
let finished = [];        // colours in the order they brought all four tokens home

const tokenEls = {};

/* ---------- Roadmap state ---------- */
const TOTAL_LEVELS = 10;
let unlockedLevel = 1;
if (consent === 'all') {
    unlockedLevel = Math.min(TOTAL_LEVELS, Math.max(1, Number(store.get(PROGRESS_KEY)) || 1));
}

function saveProgress() {
    if (consent === 'all') store.set(PROGRESS_KEY, String(unlockedLevel));
}

/* ---------- Board construction ---------- */
function buildBoard() {
    const board = $('board');
    const layer = $('tokens-layer');
    const frag = document.createDocumentFragment();

    // Bases: [row, col] of the top-left cell (1-indexed)
    const baseOrigin = { Red: [1, 1], Green: [1, 10], Yellow: [10, 10], Blue: [10, 1] };
    COLORS.forEach((color) => {
        const [row, col] = baseOrigin[color];
        const base = el('div', `base ${color.toLowerCase()}`);
        base.style.gridArea = `${row} / ${col} / ${row + 6} / ${col + 6}`;
        const inner = el('div', 'base-inner');
        for (let i = 0; i < 4; i++) inner.appendChild(el('span', 'slot'));
        base.appendChild(inner);
        frag.appendChild(base);
    });

    const addCell = (x, y, classes) => {
        const cell = el('div', `cell ${classes}`.trim());
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        frag.appendChild(cell);
    };

    // Shared track
    RING.forEach(([x, y], index) => {
        const classes = [];
        const startColor = COLORS.find((c) => START[c] === index);
        if (startColor) classes.push('start', `c-${startColor.toLowerCase()}`);
        else if (SAFE.has(index)) classes.push('star');
        if (ARROW_CELLS[index]) classes.push('arrow', `a-${ARROW_CELLS[index]}`);
        addCell(x, y, classes.join(' '));
    });

    // Home columns
    COLORS.forEach((color) => {
        HOME_COLUMN[color].forEach(([x, y]) => addCell(x, y, `home c-${color.toLowerCase()}`));
    });

    // Centre
    const center = el('div', 'center');
    ['red', 'green', 'yellow', 'blue'].forEach((c) => center.appendChild(el('div', `tri t-${c}`)));
    frag.appendChild(center);

    board.insertBefore(frag, layer);
}

function buildTokens() {
    const layer = $('tokens-layer');
    layer.innerHTML = '';
    COLORS.forEach((color) => {
        tokens[color].forEach((t, i) => {
            const btn = el('button', `token ${color.toLowerCase()}`);
            btn.type = 'button';
            btn.id = t.id;
            btn.disabled = true;
            btn.addEventListener('click', () => onTokenClick(color, i));
            layer.appendChild(btn);
            tokenEls[t.id] = btn;
        });
    });
}

/* ---------- Positions ---------- */
function ringIndex(color, pos) {
    return pos >= 0 && pos <= RING_END ? (pos + START[color]) % 52 : null;
}

const ringPoint = (idx) => [RING[idx][0] + 0.5, RING[idx][1] + 0.5];

// The track square a token stands on (null when it is in base, in a home lane or home)
function tokenRing(color, t) {
    if (t.foreign) return null;                                           // inside another colour's home lane
    if (t.pos === RING_END && t.edge) return (START[color] + 51) % 52;   // the square just behind its start
    return ringIndex(color, t.pos);
}

// Identifies where a token stands, so tokens on the same spot count as one choice
const locKey = (t) => (t.foreign ? `${t.pos}F${t.foreign.c}${t.foreign.lane}` : `${t.pos}${t.edge ? 'e' : ''}`);

function sendHome(t) {
    t.pos = -1;
    t.edge = false;
    t.foreign = null;
    t.vis = null;
}

// Point (in cell units) where a token should be drawn
function pointFor(color, index, t) {
    if (t.foreign) {
        const [fx, fy] = HOME_COLUMN[t.foreign.c][t.foreign.lane - 1];
        return [fx + 0.5, fy + 0.5];
    }
    if (t.pos === -1) return BASE_SLOTS[color][index];
    if (t.pos <= RING_END) return ringPoint(tokenRing(color, t));
    if (t.pos < FINISH) {
        const [x, y] = HOME_COLUMN[color][t.pos - 51];
        return [x + 0.5, y + 0.5];
    }
    return FINISH_POINT[color];
}

function updateBoard() {
    // Group tokens that share a square so they can be fanned out
    const groups = new Map();
    COLORS.forEach((color) => {
        tokens[color].forEach((t, i) => {
            const [px, py] = t.vis || pointFor(color, i, t);
            let key;
            if (t.vis) key = `${px},${py}`;
            else if (t.pos === -1) key = `base-${t.id}`;
            else if (t.pos === FINISH) key = `fin-${color}`;
            else key = `${px},${py}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ color, index: i, px, py });
        });
    });

    groups.forEach((members, key) => {
        const n = members.length;
        members.forEach((m, k) => {
            let ox = 0;
            let oy = 0;
            if (n > 1) {
                if (key.startsWith('fin-')) {
                    const spread = (k - (n - 1) / 2) * 0.2;
                    const vertical = m.color === 'Red' || m.color === 'Yellow';
                    ox = vertical ? 0 : spread;
                    oy = vertical ? spread : 0;
                } else {
                    const radius = n === 2 ? 0.17 : 0.22;
                    const angle = (2 * Math.PI * k) / n - Math.PI / 2;
                    ox = Math.cos(angle) * radius;
                    oy = Math.sin(angle) * radius;
                }
            }
            const t = tokens[m.color][m.index];
            const node = tokenEls[t.id];
            node.style.left = `${((m.px + ox) / GRID) * 100}%`;
            node.style.top = `${((m.py + oy) / GRID) * 100}%`;
        });
    });

    // Which tokens can be clicked right now
    const color = COLORS[current];
    const canAct = phase === 'move' && isHuman(current);
    const fwdFrom = new Set(options.filter((o) => o.kind === 'fwd' || o.kind === 'out').map((o) => o.fromKey));
    const targets = new Set(options.filter((o) => o.victim).map((o) => `${o.victim.c}:${o.victim.i}`));
    COLORS.forEach((c) => {
        tokens[c].forEach((t, i) => {
            const node = tokenEls[t.id];
            const movable = canAct && c === color && fwdFrom.has(locKey(t));
            const target = canAct && targets.has(`${c}:${i}`);
            node.disabled = !(movable || target);
            node.classList.toggle('movable', movable);
            node.classList.toggle('target', target);
            node.setAttribute('aria-label', tokenLabel(c, i, t, movable, target));
        });
    });
}

function tokenLabel(color, i, t, movable, target) {
    const pos = t.pos;
    let where = 'on the board';
    if (t.foreign) where = `in ${t.foreign.c}'s home lane`;
    else if (pos === -1) where = 'in base';
    else if (pos === FINISH) where = 'home';
    else if (pos > RING_END) where = 'in the home column';
    const extra = target ? ', can be captured' : movable ? ', can move' : '';
    return `${color} token ${i + 1}, ${where}${extra}`;
}

/* ---------- Players ---------- */
function isHuman(playerIndex) {
    return mode === 'local' || (mode === 'offline' && playerIndex === 0);
}

function displayName(color) {
    if (mode === 'offline') return color === 'Red' ? 'You' : `${color} (computer)`;
    return color;
}

function buildPlayers() {
    const wrap = $('players');
    wrap.innerHTML = '';
    COLORS.forEach((color) => {
        const chip = el('div', 'chip');
        chip.id = `chip-${color.toLowerCase()}`;
        chip.style.setProperty('--c', `var(--${color.toLowerCase()})`);
        const avatar = el('span', 'chip-token');
        avatar.setAttribute('aria-hidden', 'true');
        const body = el('span', 'chip-body');
        const name = el('span', 'chip-name');
        name.textContent = color;
        const role = el('span', 'chip-role');
        const dots = el('span', 'chip-dots');
        dots.setAttribute('aria-hidden', 'true');
        for (let d = 0; d < 4; d++) dots.appendChild(el('i'));
        body.append(name, role, dots);
        chip.append(avatar, body);
        wrap.appendChild(chip);
    });
}

function updatePlayers() {
    COLORS.forEach((color, i) => {
        const chip = $(`chip-${color.toLowerCase()}`);
        const place = finished.indexOf(color) + 1;
        const playing = phase !== 'over' && phase !== 'idle' && phase !== 'celebrate';
        chip.classList.toggle('active', i === current && place === 0 && playing);
        chip.classList.toggle('done', place > 0);
        chip.setAttribute('role', 'group');
        chip.querySelector('.chip-role').textContent = mode === 'offline' ? (i === 0 ? 'You' : 'Computer') : 'Player ' + (i + 1);
        const home = tokens[color].filter((t) => t.pos === FINISH).length;
        chip.querySelectorAll('.chip-dots i').forEach((dot, d) => dot.classList.toggle('on', d < home));
        chip.querySelector('.chip-token').textContent = place > 0 ? MEDALS[place - 1] : '';
        chip.setAttribute('aria-label', place > 0
            ? `${color}, finished ${ORD[place - 1]}`
            : `${color}, ${home} of 4 tokens home${i === current && playing ? ', playing now' : ''}`);
    });
}

function playerName(i) {
    const color = COLORS[i];
    if (mode === 'offline') return i === 0 ? `Your turn (${color})` : `${color} (computer)`;
    return `${color}'s turn`;
}

function updateIndicator() {
    const color = COLORS[current].toLowerCase();
    const node = $('turn-indicator');
    node.querySelector('.dot').style.setProperty('--c', `var(--${color})`);
    node.querySelector('.turn-text').textContent = playerName(current);
}

function setStatus(message) {
    $('status').textContent = message;
}

/* ---------- Dice ---------- */
const PIP_PATTERNS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

const diceEl = $('dice');
const rollBtn = $('btn-roll');

function buildDice() {
    diceEl.innerHTML = '';
    for (let i = 0; i < 9; i++) diceEl.appendChild(el('span', 'pip'));
}

function renderDice(value) {
    const pips = diceEl.children;
    const on = PIP_PATTERNS[value];
    for (let i = 0; i < 9; i++) pips[i].classList.toggle('on', on.includes(i));
    diceEl.setAttribute('aria-label', `Dice showing ${value}`);
}

function tintDice() {
    const color = COLORS[current].toLowerCase();
    diceEl.style.setProperty('--pip', `var(--${color}-d)`);
}

/* ---------- Rules engine ---------- */

// Every token of another colour standing on a track square
function oppTokensAt(color, ringIdx) {
    const hits = [];
    COLORS.forEach((c) => {
        if (c === color) return;
        tokens[c].forEach((t, i) => {
            if (tokenRing(c, t) === ringIdx) hits.push({ c, i, t });
        });
    });
    return hits;
}

// Africa rules: two or more tokens of one other colour on a square are a wall
function oppBlockOnRing(color, ringIdx) {
    if (!rules.blocks) return false;
    const counts = {};
    return oppTokensAt(color, ringIdx).some(({ c }) => {
        counts[c] = (counts[c] || 0) + 1;
        return counts[c] >= 2;
    });
}

// Everything standing on one square of a colour's home lane: its own tokens plus any intruders (Africa rules)
function laneOccupants(host, lane) {
    const res = [];
    tokens[host].forEach((t, i) => {
        if (t.pos === 50 + lane && !t.foreign) res.push({ c: host, i, t });
    });
    COLORS.forEach((c) => {
        if (c === host) return;
        tokens[c].forEach((t, i) => {
            if (t.foreign && t.foreign.c === host && t.foreign.lane === lane) res.push({ c, i, t });
        });
    });
    return res;
}

const oppLaneOccupants = (color, host, lane) => laneOccupants(host, lane).filter((o) => o.c !== color);

// A wall inside a home lane: two or more tokens of one other colour on the same lane square
function oppLaneWall(color, host, lane) {
    if (!rules.blocks) return false;
    const counts = {};
    return oppLaneOccupants(color, host, lane).some(({ c }) => {
        counts[c] = (counts[c] || 0) + 1;
        return counts[c] >= 2;
    });
}

// Position a token would reach by moving forward by the dice, or null if it can't
function forwardTarget(color, token) {
    if (token.foreign) return null;   // a token inside someone else's home lane can only retreat
    if (token.pos === -1) {
        if (diceValue !== 6) return null;
        if (oppBlockOnRing(color, START[color])) return null;
        return 0;
    }
    const target = token.pos + diceValue;
    if (target > FINISH) return null;
    if (rules.blocks) {
        for (let q = token.pos + 1; q <= target; q++) {
            if (q <= RING_END) {
                if (oppBlockOnRing(color, ringIndex(color, q))) return null;
            } else if (q < FINISH && oppLaneWall(color, color, q - 50)) {
                return null;   // an intruder wall in your own lane
            }
        }
    }
    return target;
}

// Africa: moving backwards by the dice is only allowed if it lands on (and captures) a lone opponent
function backVictim(color, token) {
    const r = tokenRing(color, token);
    if (r === null) return null;
    for (let k = 1; k < diceValue; k++) {
        if (oppBlockOnRing(color, (r - k + 52) % 52)) return null;   // can't pass over a wall
    }
    const hits = oppTokensAt(color, (r - diceValue + 52) % 52);
    return hits.length === 1 ? { c: hits[0].c, i: hits[0].i } : null;
}

// Africa: with the exact roll, a token can step into another colour's home lane and capture a token there.
// It does not win by doing so: it is then an intruder in that lane and has to retreat.
function laneVictim(color, token) {
    const r = tokenRing(color, token);
    if (r === null) return null;
    for (const host of COLORS) {
        if (host === color) continue;
        const dist = (LANE_ENTRY[host] - r + 52) % 52;    // track squares to the lane entrance
        if (token.pos + dist > RING_END) continue;        // that entrance is not on this token's route
        const lane = diceValue - dist;                     // which lane square the roll lands on (1..5)
        if (lane < 1 || lane > 5) continue;
        let blocked = false;
        for (let k = 1; k <= dist; k++) {
            if (oppBlockOnRing(color, (r + k) % 52)) { blocked = true; break; }
        }
        if (blocked) continue;
        for (let l = 1; l < lane; l++) {                   // a wall inside the lane stops the way
            if (oppLaneWall(color, host, l)) { blocked = true; break; }
        }
        if (blocked) continue;
        const there = oppLaneOccupants(color, host, lane);
        if (there.length === 1) return { c: there[0].c, i: there[0].i, host, dist, lane };
    }
    return null;
}

// Africa: a token in its own home lane may move back by the exact roll to remove an intruder standing behind it
function backLaneVictim(color, token) {
    if (token.foreign || token.pos <= RING_END || token.pos >= FINISH) return null;
    const lane = token.pos - 50;
    const to = lane - diceValue;
    if (to < 1) return null;
    for (let l = lane - 1; l > to; l--) {
        if (oppLaneWall(color, color, l)) return null;
    }
    const there = oppLaneOccupants(color, color, to);
    return there.length === 1 ? { c: there[0].c, i: there[0].i, lane: to } : null;
}

// Africa: an intruder in another colour's home lane moves backwards by the dice, along the lane and out onto the track
function intruderBack(color, token) {
    const host = token.foreign.c;
    const j = token.foreign.lane;
    const entry = LANE_ENTRY[host];
    const squares = [];
    for (let k = 1; k <= diceValue; k++) {
        if (k < j) squares.push({ type: 'lane', lane: j - k });
        else if (k === j) squares.push({ type: 'ring', ring: entry });
        else squares.push({ type: 'ring', ring: (entry - (k - j) + 52) % 52 });
    }
    for (let k = 0; k < squares.length - 1; k++) {
        const sq = squares[k];
        const walled = sq.type === 'lane' ? oppLaneWall(color, host, sq.lane) : oppBlockOnRing(color, sq.ring);
        if (walled) return null;
    }
    const last = squares[squares.length - 1];
    const there = last.type === 'lane' ? oppLaneOccupants(color, host, last.lane) : oppTokensAt(color, last.ring);
    if (there.length >= 2) return null;
    const victim = there.length === 1 ? { c: there[0].c, i: there[0].i } : null;
    let dest;
    if (last.type === 'lane') {
        dest = { type: 'lane', lane: last.lane };
    } else {
        const pos = (last.ring - START[color] + 52) % 52;
        dest = pos <= RING_END ? { type: 'ring', pos, edge: false } : { type: 'ring', pos: RING_END, edge: true };
    }
    return { squares, dest, victim, host };
}

// Where a token ends up after a backward capture: it takes the captured token's square.
// Going back past its own start puts it near the end of its lap, so it is close to home.
function backLanding(color, token) {
    const ring = (tokenRing(color, token) - diceValue + 52) % 52;
    const pos = (ring - START[color] + 52) % 52;
    if (pos <= RING_END) return { pos, edge: false };
    return { pos: RING_END, edge: true };   // the square just behind its own start
}

// All the different moves the current dice gives this colour
function listMoves(color) {
    const list = [];
    const seen = new Set();
    const add = (key, opt) => {
        if (!seen.has(key)) {
            seen.add(key);
            list.push(opt);
        }
    };
    tokens[color].forEach((t, i) => {
        const to = forwardTarget(color, t);
        const fromKey = locKey(t);
        if (t.foreign) {
            // an intruder can only retreat
            const ib = rules.laneCapture ? intruderBack(color, t) : null;
            if (ib) add(`o${fromKey}`, { kind: 'out', ti: i, fromPos: t.pos, fromKey, back: ib, victim: ib.victim });
            return;
        }
        if (to !== null) add(`f${fromKey}`, { kind: 'fwd', ti: i, fromPos: t.pos, fromKey, to });
        if (rules.backCapture && t.pos > RING_END && t.pos < FINISH) {
            const v = backLaneVictim(color, t);
            if (v) add(`bl${fromKey}`, { kind: 'backlane', ti: i, fromPos: t.pos, fromKey, victim: v });
        }
        if (t.pos >= 0 && t.pos <= RING_END) {
            if (rules.backCapture) {
                const v = backVictim(color, t);
                if (v) add(`b${fromKey}`, { kind: 'back', ti: i, fromPos: t.pos, fromKey, victim: v });
            }
            if (rules.laneCapture) {
                const v = laneVictim(color, t);
                if (v) add(`l${fromKey}${v.host}`, { kind: 'lane', ti: i, fromPos: t.pos, fromKey, victim: v, host: v.host, dist: v.dist, lane: v.lane });
            }
        }
    });
    return list;
}

function wouldCapture(color, pos) {
    const idx = ringIndex(color, pos);
    if (idx === null || isSafe(idx)) return false;
    return oppTokensAt(color, idx).length > 0;
}

function resolveCapture(color, token) {
    if (!token.foreign && token.pos > RING_END && token.pos < FINISH) {
        // moving forward onto an intruder standing in your own home lane
        const intruders = oppLaneOccupants(color, color, token.pos - 50);
        intruders.forEach((v) => sendHome(v.t));
        return intruders.length;
    }
    const idx = tokenRing(color, token);
    if (idx === null || isSafe(idx)) return 0;
    const victims = oppTokensAt(color, idx);
    victims.forEach((v) => sendHome(v.t));
    return victims.length;
}

function isThreatened(color, pos) {
    const idx = ringIndex(color, pos);
    if (idx === null || isSafe(idx)) return false;
    return COLORS.some((c) => c !== color && tokens[c].some((t) => {
        const oi = tokenRing(c, t);
        if (oi === null) return false;
        const gap = (idx - oi + 52) % 52;
        return gap >= 1 && gap <= 6;
    }));
}

function progress(color) {
    return tokens[color].reduce((sum, t) => sum + t.pos + 1, 0);
}

/* ---------- Computer player ---------- */
function scoreOption(color, o) {
    if (o.kind === 'lane') return 120 + Math.random() * 5;       // removes an opponent from its home lane
    if (o.kind === 'backlane') return 150 + Math.random() * 5;   // removes an intruder from our own home lane
    if (o.kind === 'out') return 40 + (o.victim ? 90 : 0) + Math.random() * 5;   // retreat from a foreign lane
    const t = tokens[color][o.ti];
    if (o.kind === 'back') {
        // a capture is good; going back past the start puts the token near home (bonus), going back along the lap costs progress
        const land = backLanding(color, t);
        return 85 + Math.max(-45, land.pos - t.pos) * 0.6 + Math.random() * 5;
    }
    const to = o.to;
    let score = to * 0.3;
    if (to === FINISH) score += 100;
    if (wouldCapture(color, to)) score += 90;
    if (to > RING_END && to < FINISH && oppLaneOccupants(color, color, to - 50).length) score += 90;
    if (t.pos === -1) score += 60;
    if (to > RING_END && to < FINISH) score += 35;
    const idx = ringIndex(color, to);
    if (idx !== null && isSafe(idx)) score += 30;
    if (t.pos >= 0 && isThreatened(color, t.pos)) score += 20;
    if (idx !== null && isThreatened(color, to)) score -= 15;
    if (rules.blocks && idx !== null && tokens[color].some((x) => x !== t && x.pos === to)) score += 25;   // build a wall
    return score + Math.random() * 5;
}

function aiChoose() {
    const color = COLORS[current];
    const smartness = Math.min(0.95, 0.25 + playLevel * 0.07);
    if (Math.random() > smartness) return pick(options);
    let best = options[0];
    let bestScore = -Infinity;
    options.forEach((o) => {
        const s = scoreOption(color, o);
        if (s > bestScore) { bestScore = s; best = o; }
    });
    return best;
}

/* ---------- Rule picker ---------- */
function applyRulesUI() {
    document.querySelectorAll('.mode-opt').forEach((btn) => {
        const on = btn.dataset.rules === rulesKey;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-checked', String(on));
    });
    $('mode-desc').textContent = rules.desc;
    $('rules-badge').textContent = rules.name;
    $('board').classList.toggle('no-safe', !rules.safeSquares);
    document.querySelectorAll('.rules-africa').forEach((n) => n.classList.toggle('hidden', rulesKey !== 'africa'));
}

function setRules(key) {
    if (!RULES[key]) return;
    rulesKey = key;
    rules = RULES[key];
    if (consent === 'all') store.set(RULES_KEY, key);
    applyRulesUI();
}

/* ---------- Turn flow ---------- */
function startGame(newMode, level) {
    session += 1;
    mode = newMode;
    playLevel = level || unlockedLevel;
    current = 0;
    diceValue = 1;
    phase = 'idle';
    options = [];
    finished = [];
    COLORS.forEach((c) => tokens[c].forEach(sendHome));

    winnerModal.classList.add('hidden');
    placeModal.classList.add('hidden');
    applyRulesUI();
    showScreen(gameScreen);
    buildTokens();
    buildPlayers();
    renderDice(1);
    beginTurn();
}

function beginTurn() {
    const s = session;
    phase = 'roll';
    options = [];
    updateIndicator();
    tintDice();
    updatePlayers();
    updateBoard();
    rollBtn.disabled = !isHuman(current);

    if (isHuman(current)) {
        setStatus(`${COLORS[current]}, roll the dice.`);
        sfx.turn();
    } else {
        setStatus(`${COLORS[current]} (computer) is thinking…`);
        sleep(900).then(() => { if (s === session) doRoll(); });
    }
}

function nextTurn() {
    for (let n = 0; n < 4; n++) {
        current = (current + 1) % 4;
        if (!finished.includes(COLORS[current])) break;
    }
    beginTurn();
}

async function doRoll() {
    if (phase !== 'roll') return;
    const s = session;
    phase = 'rolling';
    rollBtn.disabled = true;
    diceEl.classList.add('rolling');
    sfx.roll();
    vibrate(15);

    const finalValue = randInt(1, 6);
    for (let i = 0; i < 6; i++) {
        renderDice(randInt(1, 6));
        await sleep(80);
        if (s !== session) return;
    }
    diceEl.classList.remove('rolling');
    diceValue = finalValue;
    renderDice(diceValue);

    const color = COLORS[current];
    options = listMoves(color);

    if (options.length === 0) {
        setStatus(`${color} rolled a ${diceValue}. No moves available.`);
        sfx.noMove();
        await sleep(1000);
        if (s !== session) return;
        nextTurn();
        return;
    }

    phase = 'move';
    updateBoard();

    if (!isHuman(current)) {
        setStatus(`${color} rolled a ${diceValue}.`);
        await sleep(700);
        if (s !== session) return;
        doMove(aiChoose());
        return;
    }

    if (options.length === 1) {
        const only = options[0];
        setStatus(only.kind === 'fwd' ? `You rolled a ${diceValue}.` : `You rolled a ${diceValue}. Capture!`);
        await sleep(450);
        if (s !== session || phase !== 'move') return;
        doMove(only);
    } else if (options.some((o) => o.victim)) {
        setStatus(`You rolled a ${diceValue}. Tap a glowing token to move, or the red-ringed token to capture it.`);
    } else {
        setStatus(`You rolled a ${diceValue}. Choose a token to move.`);
    }
}

function onTokenClick(color, i) {
    if (phase !== 'move' || !isHuman(current)) return;
    const t = tokens[color][i];
    let opt = null;
    if (color === COLORS[current]) {
        opt = options.find((o) => (o.kind === 'fwd' || o.kind === 'out') && o.fromKey === locKey(t));
    } else {
        opt = options.find((o) => o.victim && o.victim.c === color && o.victim.i === i);
    }
    if (opt) doMove(opt);
}

// Move a token's drawing to a point for one animation step
async function hop(token, point) {
    token.vis = point;
    updateBoard();
    await sleep(170);
}

async function doMove(opt) {
    if (phase !== 'move') return;
    const s = session;
    const color = COLORS[current];
    const token = tokens[color][opt.ti];

    phase = 'animating';
    options = [];
    updateBoard();

    let captured = 0;
    let shortcut = false;      // true when the capture sends the token straight home
    let note = '';

    if (opt.kind === 'fwd') {
        token.edge = false;
        if (token.pos === -1) {
            token.pos = 0;
            sfx.enter();
            updateBoard();
            await sleep(280);
        } else {
            for (let step = 0; step < diceValue; step++) {
                token.pos += 1;
                sfx.step(step);
                updateBoard();
                await sleep(170);
                if (s !== session) return;
            }
        }
        if (s !== session) return;
        captured = resolveCapture(color, token);
    } else if (opt.kind === 'back') {
        const r0 = tokenRing(color, token);
        const land = backLanding(color, token);
        for (let k = 1; k <= diceValue; k++) {
            sfx.step(k);
            await hop(token, ringPoint((r0 - k + 52) % 52));
            if (s !== session) return;
        }
        sendHome(tokens[opt.victim.c][opt.victim.i]);
        // the token keeps the captured square and carries on with the dice from there
        token.vis = null;
        token.pos = land.pos;
        token.edge = land.edge;
        captured = 1;
        note = `${color} captured ${opt.victim.c} backwards!`;
    } else {
        const r0 = tokenRing(color, token);
        for (let k = 1; k <= opt.dist; k++) {
            sfx.step(k);
            await hop(token, ringPoint((r0 + k) % 52));
            if (s !== session) return;
        }
        for (let l = 1; l <= opt.lane; l++) {
            sfx.step(opt.dist + l);
            const [x, y] = HOME_COLUMN[opt.victim.c][l - 1];
            await hop(token, [x + 0.5, y + 0.5]);
            if (s !== session) return;
        }
        sendHome(tokens[opt.victim.c][opt.victim.i]);
        captured = 1;
        shortcut = true;
        note = `${color} captured ${opt.victim.c} in their home lane and goes straight home!`;
    }

    if (captured) {
        sfx.capture();
        vibrate([40, 30, 60]);
        updateBoard();
        updatePlayers();
        setStatus(note || `${color} captured ${captured === 1 ? 'a token' : captured + ' tokens'}!`);
        await sleep(shortcut ? 800 : 600);
        if (s !== session) return;
    }

    if (shortcut) {
        token.vis = null;
        token.pos = FINISH;
        sfx.home();
        updateBoard();
        await sleep(350);
        if (s !== session) return;
    }

    updatePlayers();

    if (tokens[color].every((t) => t.pos === FINISH)) {
        playerFinished(color);
        return;
    }

    const reachedHome = token.pos === FINISH;
    if (reachedHome && !shortcut) sfx.home();

    if (diceValue === 6 || captured || reachedHome) {
        const why = diceValue === 6 ? 'a 6' : captured ? 'a capture' : 'getting home';
        beginTurn();
        setStatus(`${COLORS[current]} gets another roll for ${why}.`);
    } else {
        nextTurn();
    }
}

/* ---------- Finishing places ---------- */
function placeCopy(color, place) {
    const ord = ORD[place - 1];
    if (mode === 'offline' && color === 'Red') {
        return {
            title: place === 1 ? 'Congratulations, you win!' : `Well done! You finished ${ord}`,
            sub: place === 1 ? 'You brought all four tokens home first.' : 'All four of your tokens are home.'
        };
    }
    if (mode === 'local') {
        return {
            title: `Congratulations, ${color}!`,
            sub: `${color} takes ${ord} place.`
        };
    }
    return {
        title: `${displayName(color)} finishes ${ord}`,
        sub: place === 1 ? 'Better luck next time.' : 'The game continues.'
    };
}

function playerFinished(color) {
    finished.push(color);
    const place = finished.length;
    phase = 'celebrate';
    rollBtn.disabled = true;
    updateBoard();
    updatePlayers();

    const copy = placeCopy(color, place);
    $('place-medal').textContent = MEDALS[place - 1];
    $('place-title').textContent = copy.title;
    $('place-sub').textContent = copy.sub;

    const remaining = COLORS.filter((c) => !finished.includes(c));
    const humanDone = mode === 'offline' && color === 'Red' && remaining.length > 1;
    $('btn-place-skip').classList.toggle('hidden', !humanDone);
    $('btn-place-continue').textContent = remaining.length <= 1 ? 'See results' : 'Continue';

    setStatus(`${displayName(color)} finished ${ORD[place - 1]}.`);
    placeModal.classList.remove('hidden');
    $('btn-place-continue').focus();
    sfx.place(place);
    vibrate(place === 1 ? [60, 40, 60, 40, 120] : [60, 40, 60]);
    burstConfetti(place === 1 ? 90 : 40);
}

function continueAfterPlace() {
    if (phase !== 'celebrate') return;
    placeModal.classList.add('hidden');
    const remaining = COLORS.filter((c) => !finished.includes(c));
    if (remaining.length <= 1) endGame();
    else nextTurn();
}

function endGame() {
    session += 1;
    phase = 'over';
    rollBtn.disabled = true;
    placeModal.classList.add('hidden');

    // Anyone still playing is ranked by how far along they are
    const rest = COLORS.filter((c) => !finished.includes(c)).sort((a, b) => progress(b) - progress(a));
    const order = finished.concat(rest);

    const list = $('standings');
    list.innerHTML = '';
    order.forEach((color, i) => {
        const li = el('li');
        li.style.setProperty('--c', `var(--${color.toLowerCase()})`);
        const medal = el('span', 'st-medal');
        medal.textContent = MEDALS[i];
        const who = el('span', 'st-who');
        who.textContent = displayName(color);
        const ord = el('span', 'st-ord');
        ord.textContent = ORD[i];
        li.append(medal, who, ord);
        list.appendChild(li);
    });

    const humanWon = mode === 'offline' && order[0] === 'Red';
    let sub = '';
    let title = 'Final standings';
    if (mode === 'offline') {
        const myPlace = order.indexOf('Red') + 1;
        if (humanWon) {
            title = 'You won!';
            sub = 'Great game.';
            if (playLevel === unlockedLevel && unlockedLevel < TOTAL_LEVELS) {
                unlockedLevel += 1;
                saveProgress();
                sub = `Level ${unlockedLevel} unlocked.`;
            } else if (playLevel >= TOTAL_LEVELS) {
                sub = 'You cleared the top level!';
            }
        } else {
            sub = `You finished ${ORD[myPlace - 1]}. Win the game to unlock the next level.`;
        }
    } else {
        sub = `${order[0]} won the game.`;
    }

    $('winner-text').textContent = title;
    $('winner-sub').textContent = sub;
    setStatus('Game over.');
    updatePlayers();
    winnerModal.classList.remove('hidden');
    $('btn-play-again').focus();
    if (humanWon) {
        sfx.place(1);
        burstConfetti(70);
    }
}

/* ---------- Roadmap ---------- */
function renderRoadmap() {
    const container = $('roadmap-list');
    container.innerHTML = '';
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
        const node = el('button', 'roadmap-node');
        node.type = 'button';
        node.textContent = i < unlockedLevel ? '✓' : String(i);
        node.style.setProperty('--x', `${Math.round(Math.sin(i * 1.5) * 60)}px`);

        if (i < unlockedLevel) {
            node.classList.add('completed');
            node.setAttribute('aria-label', `Level ${i}, completed. Play again`);
        } else if (i === unlockedLevel) {
            node.classList.add('current');
            node.setAttribute('aria-label', `Level ${i}, current. Play`);
        } else {
            node.classList.add('locked');
            node.disabled = true;
            node.setAttribute('aria-label', `Level ${i}, locked`);
        }
        node.addEventListener('click', () => startGame('offline', i));
        container.appendChild(node);
    }
}

/* ---------- Navigation ---------- */
$('btn-offline').addEventListener('click', () => startGame('offline'));
$('btn-local').addEventListener('click', () => startGame('local'));
$('btn-online').addEventListener('click', () => showScreen(matchmakingScreen));
$('btn-play-local').addEventListener('click', () => startGame('local'));
$('btn-cancel-matchmaking').addEventListener('click', () => showScreen(mainMenu));
$('btn-roadmap').addEventListener('click', () => { renderRoadmap(); showScreen(roadmapScreen); });
$('btn-back-from-roadmap').addEventListener('click', () => showScreen(mainMenu));

document.querySelectorAll('.mode-opt').forEach((btn) => {
    btn.addEventListener('click', () => setRules(btn.dataset.rules));
});

function leaveGame() {
    session += 1;
    phase = 'idle';
    winnerModal.classList.add('hidden');
    placeModal.classList.add('hidden');
    showScreen(mainMenu);
}

$('btn-back-to-menu').addEventListener('click', leaveGame);
$('btn-winner-menu').addEventListener('click', leaveGame);
$('btn-play-again').addEventListener('click', () => startGame(mode, playLevel));
$('btn-place-continue').addEventListener('click', continueAfterPlace);
$('btn-place-skip').addEventListener('click', () => { if (phase === 'celebrate') endGame(); });

rollBtn.addEventListener('click', () => { if (isHuman(current)) doRoll(); });
diceEl.addEventListener('click', () => { if (phase === 'roll' && isHuman(current)) doRoll(); });

/* ---------- Sound toggle ---------- */
const soundBtn = $('btn-sound');

function renderSoundButton() {
    soundBtn.classList.toggle('muted', !soundOn);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
}

soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (consent === 'all') store.set(SOUND_KEY, soundOn ? 'on' : 'off');
    renderSoundButton();
    if (soundOn) {
        sfx.unlock();
        sfx.click();
    }
});

// Browsers only allow audio after a user gesture
document.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });

// Light click feedback on menu buttons (the dice and roll button have their own sound)
document.addEventListener('click', (event) => {
    const target = event.target.closest('.btn, .roadmap-node, .link-btn, .mode-opt');
    if (target && target.id !== 'btn-roll' && target.id !== 'btn-sound') sfx.click();
});

/* ---------- Cookie banner ---------- */
const banner = $('cookie-banner');

function setConsent(value) {
    consent = value;
    store.set(CONSENT_KEY, value);
    if (value === 'all') {
        saveProgress();
        store.set(SOUND_KEY, soundOn ? 'on' : 'off');
        store.set(RULES_KEY, rulesKey);
    } else {
        store.remove(PROGRESS_KEY);
        store.remove(SOUND_KEY);
        store.remove(RULES_KEY);
    }
    banner.classList.add('hidden');
}

$('btn-cookie-accept').addEventListener('click', () => setConsent('all'));
$('btn-cookie-essential').addEventListener('click', () => setConsent('essential'));
$('btn-cookie-settings').addEventListener('click', () => {
    banner.classList.remove('hidden');
    $('btn-cookie-accept').focus();
});

if (!consent) banner.classList.remove('hidden');

/* ---------- PWA ---------- */
let installPrompt = null;
const installBtn = $('btn-install');

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* dismissed */ }
    installPrompt = null;
    installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installBtn.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { /* offline mode unavailable */ });
    });
}

/* ---------- Splash screen ---------- */
const splash = $('splash');
const splashStart = performance.now();
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPLASH_MIN_MS = reduceMotion ? 500 : 1900;   // how long the splash shows at least
let splashGone = false;

function hideSplash() {
    if (splashGone || !splash) return;
    splashGone = true;
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 700);
}

splash.addEventListener('click', hideSplash);   // tap to skip

function scheduleSplashHide() {
    const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
    setTimeout(hideSplash, wait);
}

if (document.readyState === 'complete') scheduleSplashHide();
else window.addEventListener('load', scheduleSplashHide);

/* ---------- Init ---------- */
$('year').textContent = String(new Date().getFullYear());
renderSoundButton();
buildBoard();
buildDice();
renderDice(1);
applyRulesUI();
