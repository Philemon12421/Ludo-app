// Screen Elements
const mainMenu = document.getElementById('main-menu');
const roadmapScreen = document.getElementById('roadmap-screen');
const matchmakingScreen = document.getElementById('matchmaking-screen');
const gameScreen = document.getElementById('game-screen');
const winnerModal = document.getElementById('winner-modal');

// Buttons
const btnOffline = document.getElementById('btn-offline');
const btnOnline = document.getElementById('btn-online');
const btnRoadmap = document.getElementById('btn-roadmap');
const btnBackFromRoadmap = document.getElementById('btn-back-from-roadmap');
const btnCancelMatchmaking = document.getElementById('btn-cancel-matchmaking');
const btnBackToMenu = document.getElementById('btn-back-to-menu');
const btnWinnerMenu = document.getElementById('btn-winner-menu');
const btnPlayAgain = document.getElementById('btn-play-again');

// Game State
let currentMode = null; // 'offline' or 'online'
let currentPlayer = 0; // 0: Red, 1: Green, 2: Yellow, 3: Blue
const players = ['Red', 'Green', 'Yellow', 'Blue'];
let isGameActive = false;

// Roadmap State
let unlockedLevel = 1;
const totalLevels = 10;

// Navigation Logic
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    screen.classList.remove('hidden');
    screen.classList.add('active');
}

btnOffline.addEventListener('click', () => {
    currentMode = 'offline';
    startGame();
});

btnOnline.addEventListener('click', () => {
    currentMode = 'online';
    showScreen(matchmakingScreen);
    // Mock Matchmaking Sequence
    setTimeout(() => {
        if (currentMode === 'online') {
            startGame();
        }
    }, 3000); // Wait 3 seconds then start game
});

btnCancelMatchmaking.addEventListener('click', () => {
    currentMode = null;
    showScreen(mainMenu);
});

btnRoadmap.addEventListener('click', () => {
    renderRoadmap();
    showScreen(roadmapScreen);
});

btnBackFromRoadmap.addEventListener('click', () => {
    showScreen(mainMenu);
});

btnBackToMenu.addEventListener('click', () => {
    isGameActive = false;
    showScreen(mainMenu);
});

btnWinnerMenu.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    isGameActive = false;
    showScreen(mainMenu);
});

btnPlayAgain.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    startGame();
});

// Roadmap Logic
function renderRoadmap() {
    const container = document.querySelector('.roadmap-container');
    container.innerHTML = '';
    for (let i = totalLevels; i >= 1; i--) {
        const node = document.createElement('div');
        node.classList.add('roadmap-node');
        node.textContent = i;

        if (i < unlockedLevel) {
            node.classList.add('completed');
        } else if (i === unlockedLevel) {
            node.classList.add('current');
            node.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.8)';
        } else {
            node.classList.add('locked');
        }

        // Add pseudo-random horizontal offset for curved path
        const offset = Math.sin(i * 1.5) * 60;
        node.style.transform = `translateX(${offset}px)`;

        container.appendChild(node);
    }
}

// --- Ludo Game Logic ---
let diceValue = 1;
let canRoll = true;
const tokens = {
    Red: [ {id: 'R1', pos: -1}, {id: 'R2', pos: -1}, {id: 'R3', pos: -1}, {id: 'R4', pos: -1} ],
    Green: [ {id: 'G1', pos: -1}, {id: 'G2', pos: -1}, {id: 'G3', pos: -1}, {id: 'G4', pos: -1} ],
    Yellow: [ {id: 'Y1', pos: -1}, {id: 'Y2', pos: -1}, {id: 'Y3', pos: -1}, {id: 'Y4', pos: -1} ],
    Blue: [ {id: 'B1', pos: -1}, {id: 'B2', pos: -1}, {id: 'B3', pos: -1}, {id: 'B4', pos: -1} ]
};

// Safe zones on the common path
const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];

// Paths definition for 52 common squares
const START_POSITIONS = { Red: 0, Green: 13, Yellow: 26, Blue: 39 };

const DOMPaths = {
    left: document.getElementById('path-left'),
    top: document.getElementById('path-top'),
    right: document.getElementById('path-right'),
    bottom: document.getElementById('path-bottom')
};

let cells = []; // Array to hold references to all 52 common path cell DOM elements
let homePaths = { Red: [], Green: [], Yellow: [], Blue: [] }; // Array to hold home path cell DOM elements

function buildBoardGrid() {
    // Clear paths
    for (let key in DOMPaths) DOMPaths[key].innerHTML = '';

    // We will simulate a board. For simplicity in this logical layer, we define coordinates.
    // Ludo path consists of 52 cells around the edge of the center cross.
    // To position tokens cleanly, we use absolutely positioned div elements overlaid on the grid based on index.
}

// Generate coordinates for the 52 common path cells relative to the board
const pathCoordinates = [
    // Left arm top row (Red start area) - 0 to 4
    {x: 1, y: 6}, {x: 2, y: 6}, {x: 3, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
    // Top arm left col - 5 to 10
    {x: 6, y: 5}, {x: 6, y: 4}, {x: 6, y: 3}, {x: 6, y: 2}, {x: 6, y: 1}, {x: 6, y: 0},
    // Top arm top row (Green start) - 11 to 12
    {x: 7, y: 0}, {x: 8, y: 0},
    // Top arm right col - 13 to 17
    {x: 8, y: 1}, {x: 8, y: 2}, {x: 8, y: 3}, {x: 8, y: 4}, {x: 8, y: 5},
    // Right arm top row - 18 to 23
    {x: 9, y: 6}, {x: 10, y: 6}, {x: 11, y: 6}, {x: 12, y: 6}, {x: 13, y: 6}, {x: 14, y: 6},
    // Right arm right col (Yellow start) - 24 to 25
    {x: 14, y: 7}, {x: 14, y: 8},
    // Right arm bottom row - 26 to 30
    {x: 13, y: 8}, {x: 12, y: 8}, {x: 11, y: 8}, {x: 10, y: 8}, {x: 9, y: 8},
    // Bottom arm right col - 31 to 36
    {x: 8, y: 9}, {x: 8, y: 10}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13}, {x: 8, y: 14},
    // Bottom arm bottom row (Blue start) - 37 to 38
    {x: 7, y: 14}, {x: 6, y: 14},
    // Bottom arm left col - 39 to 43
    {x: 6, y: 13}, {x: 6, y: 12}, {x: 6, y: 11}, {x: 6, y: 10}, {x: 6, y: 9},
    // Left arm bottom row - 44 to 49
    {x: 5, y: 8}, {x: 4, y: 8}, {x: 3, y: 8}, {x: 2, y: 8}, {x: 1, y: 8}, {x: 0, y: 8},
    // Left arm left col - 50 to 51
    {x: 0, y: 7}, {x: 0, y: 6} // Adjusted to match grid
];

// Generate coordinates for Home Paths (6 steps total)
const homeCoordinates = {
    Red: [{x: 1, y: 7}, {x: 2, y: 7}, {x: 3, y: 7}, {x: 4, y: 7}, {x: 5, y: 7}, {x: 6, y: 7}],
    Green: [{x: 7, y: 1}, {x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}],
    Yellow: [{x: 13, y: 7}, {x: 12, y: 7}, {x: 11, y: 7}, {x: 10, y: 7}, {x: 9, y: 7}, {x: 8, y: 7}],
    Blue: [{x: 7, y: 13}, {x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8}]
};

// Base positions
const baseCoordinates = {
    Red: [{x: 2, y: 2}, {x: 3, y: 2}, {x: 2, y: 3}, {x: 3, y: 3}],
    Green: [{x: 11, y: 2}, {x: 12, y: 2}, {x: 11, y: 3}, {x: 12, y: 3}],
    Yellow: [{x: 11, y: 11}, {x: 12, y: 11}, {x: 11, y: 12}, {x: 12, y: 12}],
    Blue: [{x: 2, y: 11}, {x: 3, y: 11}, {x: 2, y: 12}, {x: 3, y: 12}]
};


function startGame() {
    isGameActive = true;
    currentPlayer = 0; // Red starts
    canRoll = true;

    // Reset tokens
    for(let color in tokens) {
        tokens[color].forEach(t => t.pos = -1);
    }

    updateTurnIndicator();
    showScreen(gameScreen);
    initializeBoard();
}

function initializeBoard() {
    const tokensLayer = document.getElementById('tokens-layer');
    tokensLayer.innerHTML = '';

    // Draw cells physically into the DOM to render path background correctly
    drawPathCells();

    // Create token elements
    for(let color in tokens) {
        tokens[color].forEach((t, index) => {
            const tokenEl = document.createElement('div');
            tokenEl.className = `token ${color.toLowerCase()}`;
            tokenEl.id = t.id;
            tokenEl.addEventListener('click', () => handleTokenClick(color, index));
            tokensLayer.appendChild(tokenEl);
        });
    }
    updateBoard();
}

function drawPathCells() {
    // Fill left path (Red arm)
    const leftPath = document.getElementById('path-left');
    leftPath.innerHTML = '';
    for(let i=0; i<18; i++) {
        let cell = document.createElement('div');
        cell.className = 'cell';
        if (i === 1) cell.classList.add('red-path'); // Start square
        if (i >= 6 && i <= 11) cell.classList.add('red-path'); // Home run
        leftPath.appendChild(cell);
    }
    // Fill top path (Green arm)
    const topPath = document.getElementById('path-top');
    topPath.innerHTML = '';
    for(let i=0; i<18; i++) {
        let cell = document.createElement('div');
        cell.className = 'cell';
        if (i === 4) cell.classList.add('green-path');
        if (i % 3 === 1 && i > 0 && i < 17) cell.classList.add('green-path');
        topPath.appendChild(cell);
    }
    // Fill right path (Yellow arm)
    const rightPath = document.getElementById('path-right');
    rightPath.innerHTML = '';
    for(let i=0; i<18; i++) {
        let cell = document.createElement('div');
        cell.className = 'cell';
        if (i === 16) cell.classList.add('yellow-path');
        if (i >= 6 && i <= 11) cell.classList.add('yellow-path');
        rightPath.appendChild(cell);
    }
    // Fill bottom path (Blue arm)
    const bottomPath = document.getElementById('path-bottom');
    bottomPath.innerHTML = '';
    for(let i=0; i<18; i++) {
        let cell = document.createElement('div');
        cell.className = 'cell';
        if (i === 13) cell.classList.add('blue-path');
        if (i % 3 === 1 && i > 0 && i < 17) cell.classList.add('blue-path');
        bottomPath.appendChild(cell);
    }
}

function getGridPosition(color, index, pos) {
    const boardSize = 15; // 15x15 grid logic
    let coord = {x: 0, y: 0};

    if (pos === -1) {
        // Base
        coord = baseCoordinates[color][index];
    } else if (pos >= 52) {
        // Home path
        let homeIndex = pos - 51; // Changed to 51 so pos 51 gives index 0
        if(homeIndex > 5) homeIndex = 5;
        coord = homeCoordinates[color][homeIndex];
    } else {
        // Common path
        let offsetPos = (pos + START_POSITIONS[color]) % 52;
        if (offsetPos >= pathCoordinates.length) offsetPos = pathCoordinates.length - 1; // Fallback
        coord = pathCoordinates[offsetPos] || {x:0, y:0};
    }

    return {
        left: `calc((${coord.x} + 0.5) * (100% / ${boardSize}))`,
        top: `calc((${coord.y} + 0.5) * (100% / ${boardSize}))`
    };
}

function updateBoard() {
    // Keep track of counts per square to offset tokens
    const counts = {};

    for(let color in tokens) {
        tokens[color].forEach((t, index) => {
            const posKey = `${t.pos}_${color}`; // Distinguish base positions by color
            const globalPos = t.pos === -1 ? posKey : (t.pos >= 51 ? `home_${t.pos}_${color}` : `path_${(t.pos + START_POSITIONS[color]) % 52}`);
            counts[globalPos] = (counts[globalPos] || 0) + 1;
        });
    }

    const currentCounts = {};

    for(let color in tokens) {
        tokens[color].forEach((t, index) => {
            const el = document.getElementById(t.id);
            const pos = getGridPosition(color, index, t.pos);

            const posKey = `${t.pos}_${color}`;
            const globalPos = t.pos === -1 ? posKey : (t.pos >= 51 ? `home_${t.pos}_${color}` : `path_${(t.pos + START_POSITIONS[color]) % 52}`);

            currentCounts[globalPos] = (currentCounts[globalPos] || 0) + 1;

            let offsetX = 0;
            let offsetY = 0;

            // Only offset if in path or home (not base)
            if (t.pos !== -1 && counts[globalPos] > 1) {
                const total = counts[globalPos];
                const i = currentCounts[globalPos] - 1;

                // Simple circular distribution around the center
                const angle = (2 * Math.PI * i) / total;
                const radius = 5; // 5px offset
                offsetX = Math.cos(angle) * radius;
                offsetY = Math.sin(angle) * radius;
            }

            el.style.left = `calc(${pos.left} + ${offsetX}px)`;
            el.style.top = `calc(${pos.top} + ${offsetY}px)`;

            el.classList.remove('active-token');
            if(color === players[currentPlayer] && canRoll === false) {
                if(t.pos !== -1 || diceValue === 6) {
                   el.classList.add('active-token');
                }
            }
        });
    }
}

// Dice Logic
const btnRoll = document.getElementById('btn-roll');
const diceEl = document.getElementById('dice');

btnRoll.addEventListener('click', rollDice);

function rollDice() {
    if (!canRoll || !isGameActive) return;
    canRoll = false;

    diceEl.classList.add('rolling');
    setTimeout(() => {
        diceValue = Math.floor(Math.random() * 6) + 1;
        diceEl.textContent = diceValue;
        diceEl.classList.remove('rolling');

        checkMovableTokens();
    }, 500);
}

function checkMovableTokens() {
    const currentColor = players[currentPlayer];
    const myTokens = tokens[currentColor];

    const canMove = myTokens.some(t => {
        if (t.pos === -1) return diceValue === 6;
        if (t.pos + diceValue <= 57) return true; // 57 is max (51 path + 6 home)
        return false;
    });

    if (canMove) {
        updateBoard(); // Highlight movable tokens
    } else {
        nextTurn();
    }
}

function handleTokenClick(color, index) {
    if (color !== players[currentPlayer] || canRoll) return;

    const token = tokens[color][index];

    if (token.pos === -1) {
        if (diceValue === 6) {
            token.pos = 0; // Move to start
            finalizeMove();
        }
    } else {
        if (token.pos + diceValue <= 57) {
            token.pos += diceValue;
            checkCapture(color, token);
            finalizeMove();
        }
    }
}

function checkCapture(myColor, myToken) {
    if (myToken.pos >= 52) return; // In home path

    let myGlobalPos = (myToken.pos + START_POSITIONS[myColor]) % 52;
    if (safeZones.includes(myGlobalPos)) return;

    for(let c in tokens) {
        if (c !== myColor) {
            tokens[c].forEach(t => {
                if (t.pos >= 0 && t.pos < 52) {
                    let theirGlobalPos = (t.pos + START_POSITIONS[c]) % 52;
                    if (myGlobalPos === theirGlobalPos) {
                        t.pos = -1; // Send back to base
                    }
                }
            });
        }
    }
}

function finalizeMove() {
    updateBoard();
    checkWinCondition();

    if (diceValue !== 6) {
        nextTurn();
    } else {
        canRoll = true;
        updateBoard();

        // If AI rolled a 6, it needs to roll again
        if (currentMode === 'offline' && currentPlayer !== 0) {
            setTimeout(playAI, 1000);
        }
    }
}

function nextTurn() {
    currentPlayer = (currentPlayer + 1) % 4;
    canRoll = true;
    updateTurnIndicator();
    updateBoard();

    // If playing against computer and it's not Red's turn
    if (currentMode === 'offline' && currentPlayer !== 0) {
        setTimeout(playAI, 1000);
    }
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    indicator.textContent = `Player ${currentPlayer + 1}'s Turn (${players[currentPlayer]})`;
    indicator.style.color = `var(--${players[currentPlayer].toLowerCase()})`;
}

function checkWinCondition() {
    const currentColor = players[currentPlayer];
    const hasWon = tokens[currentColor].every(t => t.pos === 57);
    if (hasWon) {
        isGameActive = false;
        document.getElementById('winner-text').textContent = `${currentColor} Wins!`;
        document.getElementById('winner-modal').classList.remove('hidden');
        if(currentColor === 'Red') {
            unlockedLevel = Math.min(totalLevels, unlockedLevel + 1);
        }
    }
}

function playAI() {
    if (!isGameActive) return;

    // AI acts like it clicks the roll button
    rollDice();

    // Wait for roll animation to finish (500ms) then decide move
    setTimeout(() => {
        if (canRoll) return; // Means no valid moves were found in checkMovableTokens

        const currentColor = players[currentPlayer];
        const myTokens = tokens[currentColor];

        // Find valid tokens to move
        let validTokens = [];
        myTokens.forEach((t, index) => {
            if (t.pos === -1 && diceValue === 6) validTokens.push(index);
            else if (t.pos !== -1 && t.pos + diceValue <= 57) validTokens.push(index);
        });

        if (validTokens.length > 0) {
            // Simple heuristic: Try to move tokens that are furthest along, but prioritize taking out pieces if possible
            // For now, random selection from valid tokens
            const randomIndex = validTokens[Math.floor(Math.random() * validTokens.length)];

            // Wait slightly before moving token to simulate thinking
            setTimeout(() => {
                handleTokenClick(currentColor, randomIndex);
            }, 500);
        }
    }, 800);
}
