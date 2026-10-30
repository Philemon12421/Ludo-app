'use strict';

/* =========================================================
   Ludoka – classic Ludo
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

/* ---------- Game state ---------- */
const tokens = {};
COLORS.forEach((color) => {
    tokens[color] = [0, 1, 2, 3].map((i) => ({ id: `${color[0]}${i + 1}`, pos: -1 }));
});

let mode = null;          // 'offline' (vs computer) | 'local' (pass & play)
let current = 0;          // index into COLORS
let diceValue = 1;
let phase = 'idle';       // idle | roll | rolling | move | animating | celebrate | over
let session = 0;          // bumped on every start/quit so stale async work stops
let playLevel = 1;        // difficulty of the computer players
let validIdx = [];        // token indexes the current player may move
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

// Point (in cell units) where a token should be drawn
function pointFor(color, index, pos) {
    if (pos === -1) return BASE_SLOTS[color][index];
    if (pos <= RING_END) {
        const [x, y] = RING[ringIndex(color, pos)];
        return [x + 0.5, y + 0.5];
    }
    if (pos < FINISH) {
        const [x, y] = HOME_COLUMN[color][pos - 51];
        return [x + 0.5, y + 0.5];
    }
    return FINISH_POINT[color];
}

function updateBoard() {
    // Group tokens that share a square so they can be fanned out
    const groups = new Map();
    COLORS.forEach((color) => {
        tokens[color].forEach((t, i) => {
            const [px, py] = pointFor(color, i, t.pos);
            let key;
            if (t.pos === -1) key = `base-${t.id}`;
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
    COLORS.forEach((c) => {
        tokens[c].forEach((t, i) => {
            const node = tokenEls[t.id];
            const can = phase === 'move' && isHuman(current) && c === color && validIdx.includes(i);
            node.disabled = !can;
            node.classList.toggle('movable', can);
            node.setAttribute('aria-label', tokenLabel(c, i, t.pos, can));
        });
    });
}

function tokenLabel(color, i, pos, can) {
    let where = 'on the board';
    if (pos === -1) where = 'in base';
    else if (pos === FINISH) where = 'home';
    else if (pos > RING_END) where = 'in the home column';
    return `${color} token ${i + 1}, ${where}${can ? ', can move' : ''}`;
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
        chip.setAttribute('role', 'group');
        chip.classList.toggle('done', place > 0);
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

/* ---------- Rules helpers ---------- */
function targetPos(token) {
    if (token.pos === -1) return diceValue === 6 ? 0 : null;
    const target = token.pos + diceValue;
    return target <= FINISH ? target : null;
}

function validMoves(color) {
    const list = [];
    tokens[color].forEach((t, i) => {
        if (targetPos(t) !== null) list.push(i);
    });
    return list;
}

// Tokens still in base are interchangeable, so only offer the first one as a distinct choice
function uniqueMoves(color) {
    let baseSeen = false;
    return validMoves(color).filter((i) => {
        if (tokens[color][i].pos !== -1) return true;
        if (baseSeen) return false;
        baseSeen = true;
        return true;
    });
}

function firstBaseToken(color) {
    return tokens[color].findIndex((t) => t.pos === -1);
}

function opponentsAt(color, ringIdx) {
    const hits = [];
    COLORS.forEach((c) => {
        if (c === color) return;
        tokens[c].forEach((t) => {
            if (ringIndex(c, t.pos) === ringIdx) hits.push(t);
        });
    });
    return hits;
}

function wouldCapture(color, pos) {
    const idx = ringIndex(color, pos);
    if (idx === null || SAFE.has(idx)) return false;
    return opponentsAt(color, idx).length > 0;
}

function resolveCapture(color, token) {
    const idx = ringIndex(color, token.pos);
    if (idx === null || SAFE.has(idx)) return 0;
    const victims = opponentsAt(color, idx);
    victims.forEach((v) => { v.pos = -1; });
    return victims.length;
}

function isThreatened(color, pos) {
    const idx = ringIndex(color, pos);
    if (idx === null || SAFE.has(idx)) return false;
    return COLORS.some((c) => c !== color && tokens[c].some((t) => {
        const oi = ringIndex(c, t.pos);
        if (oi === null) return false;
        const gap = (idx - oi + 52) % 52;
        return gap >= 1 && gap <= 6;
    }));
}

function progress(color) {
    return tokens[color].reduce((sum, t) => sum + t.pos + 1, 0);
}

/* ---------- Computer player ---------- */
function scoreMove(color, i) {
    const t = tokens[color][i];
    const to = targetPos(t);
    let score = to * 0.3;
    if (to === FINISH) score += 100;
    if (wouldCapture(color, to)) score += 90;
    if (t.pos === -1) score += 60;
    if (to > RING_END && to < FINISH) score += 35;
    const idx = ringIndex(color, to);
    if (idx !== null && SAFE.has(idx)) score += 30;
    if (t.pos >= 0 && isThreatened(color, t.pos)) score += 20;
    if (idx !== null && isThreatened(color, to)) score -= 15;
    return score + Math.random() * 5;
}

function aiChoose() {
    const color = COLORS[current];
    const options = uniqueMoves(color);
    const smartness = Math.min(0.95, 0.25 + playLevel * 0.07);
    if (Math.random() > smartness) return pick(options);
    let best = options[0];
    let bestScore = -Infinity;
    options.forEach((i) => {
        const s = scoreMove(color, i);
        if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
}

/* ---------- Turn flow ---------- */
function startGame(newMode, level) {
    session += 1;
    mode = newMode;
    playLevel = level || unlockedLevel;
    current = 0;
    diceValue = 1;
    phase = 'idle';
    validIdx = [];
    finished = [];
    COLORS.forEach((c) => tokens[c].forEach((t) => { t.pos = -1; }));

    winnerModal.classList.add('hidden');
    placeModal.classList.add('hidden');
    showScreen(gameScreen);
    buildTokens();
    buildPlayers();
    renderDice(1);
    beginTurn();
}

function beginTurn() {
    const s = session;
    phase = 'roll';
    validIdx = [];
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
    validIdx = validMoves(color);
    const unique = uniqueMoves(color);

    if (validIdx.length === 0) {
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

    if (unique.length === 1) {
        setStatus(`You rolled a ${diceValue}.`);
        await sleep(450);
        if (s !== session || phase !== 'move') return;
        doMove(unique[0]);
    } else {
        setStatus(`You rolled a ${diceValue}. Choose a token to move.`);
    }
}

function onTokenClick(color, i) {
    if (phase !== 'move' || !isHuman(current) || color !== COLORS[current]) return;
    if (!validIdx.includes(i)) return;
    const t = tokens[color][i];
    doMove(t.pos === -1 ? firstBaseToken(color) : i);
}

async function doMove(index) {
    if (phase !== 'move') return;
    const s = session;
    const color = COLORS[current];
    const token = tokens[color][index];

    phase = 'animating';
    validIdx = [];
    updateBoard();

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

    const captured = resolveCapture(color, token);
    if (captured) {
        sfx.capture();
        vibrate([40, 30, 60]);
        updateBoard();
        updatePlayers();
        setStatus(`${color} captured ${captured === 1 ? 'a token' : captured + ' tokens'}!`);
        await sleep(600);
        if (s !== session) return;
    }

    updatePlayers();

    if (tokens[color].every((t) => t.pos === FINISH)) {
        playerFinished(color);
        return;
    }

    const reachedHome = token.pos === FINISH;
    if (reachedHome) sfx.home();

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
    const target = event.target.closest('.btn, .roadmap-node, .link-btn');
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
    } else {
        store.remove(PROGRESS_KEY);
        store.remove(SOUND_KEY);
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
