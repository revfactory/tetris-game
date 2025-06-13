const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const COLORS = {
    0: '#000000',
    1: '#00FFFF', // I - Cyan
    2: '#0000FF', // J - Blue
    3: '#FFA500', // L - Orange
    4: '#FFFF00', // O - Yellow
    5: '#00FF00', // S - Green
    6: '#FF00FF', // T - Purple
    7: '#FF0000'  // Z - Red
};

const SHAPES = [
    [], // empty
    [[1,1,1,1]], // I
    [[2,0,0],[2,2,2]], // J
    [[0,0,3],[3,3,3]], // L
    [[4,4],[4,4]], // O
    [[0,5,5],[5,5,0]], // S
    [[0,6,0],[6,6,6]], // T
    [[7,7,0],[0,7,7]] // Z
];

let board = [];
let currentPiece = null;
let currentX = 0;
let currentY = 0;
let currentRotation = 0;
let holdPiece = null;
let canHold = true;
let nextPieces = [];
let bag = [];
let bagIndex = 0;

let score = 0;
let lines = 0;
let level = 1;
let combo = 0;
let dropTimer = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameRunning = false;

let lastMoveWasRotation = false;
let tSpinCount = 0;

const WALL_KICKS = {
    '0->1': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
    '1->0': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    '1->2': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    '2->1': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
    '2->3': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
    '3->2': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    '3->0': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    '0->3': [[0,0], [1,0], [1,1], [0,-2], [1,-2]]
};

const I_WALL_KICKS = {
    '0->1': [[0,0], [-2,0], [1,0], [-2,-1], [1,2]],
    '1->0': [[0,0], [2,0], [-1,0], [2,1], [-1,-2]],
    '1->2': [[0,0], [-1,0], [2,0], [-1,2], [2,-1]],
    '2->1': [[0,0], [1,0], [-2,0], [1,-2], [-2,1]],
    '2->3': [[0,0], [2,0], [-1,0], [2,1], [-1,-2]],
    '3->2': [[0,0], [-2,0], [1,0], [-2,-1], [1,2]],
    '3->0': [[0,0], [1,0], [-2,0], [1,-2], [-2,1]],
    '0->3': [[0,0], [-1,0], [2,0], [-1,2], [2,-1]]
};

function init() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    tSpinCount = 0;
    holdPiece = null;
    canHold = true;
    nextPieces = [];
    bag = [];
    bagIndex = 0;
    
    fillBag();
    for (let i = 0; i < 5; i++) {
        nextPieces.push(getNextFromBag());
    }
    
    spawnPiece();
    gameRunning = true;
    lastTime = Date.now();
    updateDisplay();
    gameLoop();
}

function fillBag() {
    bag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    bagIndex = 0;
}

function getNextFromBag() {
    if (bagIndex >= bag.length) {
        fillBag();
    }
    return bag[bagIndex++];
}

function spawnPiece() {
    const pieceType = nextPieces.shift();
    nextPieces.push(getNextFromBag());
    
    currentPiece = SHAPES[pieceType].map(row => [...row]);
    currentRotation = 0;
    currentX = Math.floor((COLS - currentPiece[0].length) / 2);
    currentY = 0;
    canHold = true;
    lastMoveWasRotation = false;
    
    if (!isValidPosition(currentX, currentY, currentPiece)) {
        gameOver();
    }
    
    drawNext();
}

function isValidPosition(x, y, piece) {
    for (let row = 0; row < piece.length; row++) {
        for (let col = 0; col < piece[row].length; col++) {
            if (piece[row][col]) {
                const newX = x + col;
                const newY = y + row;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return false;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

function rotate() {
    const oldRotation = currentRotation;
    const rotated = currentPiece[0].map((_, i) => 
        currentPiece.map(row => row[i]).reverse()
    );
    
    const pieceType = getPieceType();
    const newRotation = (currentRotation + 1) % 4;
    const kickKey = `${oldRotation}->${newRotation}`;
    const kicks = pieceType === 1 ? I_WALL_KICKS[kickKey] : WALL_KICKS[kickKey];
    
    for (const [kickX, kickY] of kicks) {
        if (isValidPosition(currentX + kickX, currentY + kickY, rotated)) {
            currentPiece = rotated;
            currentX += kickX;
            currentY += kickY;
            currentRotation = newRotation;
            lastMoveWasRotation = true;
            return true;
        }
    }
    return false;
}

function getPieceType() {
    for (let row of currentPiece) {
        for (let cell of row) {
            if (cell > 0) return cell;
        }
    }
    return 0;
}

function move(dir) {
    const newX = currentX + dir;
    if (isValidPosition(newX, currentY, currentPiece)) {
        currentX = newX;
        lastMoveWasRotation = false;
        return true;
    }
    return false;
}

function drop() {
    const newY = currentY + 1;
    if (isValidPosition(currentX, newY, currentPiece)) {
        currentY = newY;
        lastMoveWasRotation = false;
        return true;
    }
    return false;
}

function hardDrop() {
    while (drop()) {}
    lockPiece();
}

function getGhostY() {
    let ghostY = currentY;
    while (isValidPosition(currentX, ghostY + 1, currentPiece)) {
        ghostY++;
    }
    return ghostY;
}

function lockPiece() {
    const pieceType = getPieceType();
    let isTSpin = false;
    
    if (pieceType === 6 && lastMoveWasRotation) {
        isTSpin = checkTSpin();
    }
    
    for (let row = 0; row < currentPiece.length; row++) {
        for (let col = 0; col < currentPiece[row].length; col++) {
            if (currentPiece[row][col]) {
                const boardY = currentY + row;
                const boardX = currentX + col;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece[row][col];
                }
            }
        }
    }
    
    const clearedLines = clearLines();
    updateScore(clearedLines, isTSpin);
    
    if (clearedLines > 0) {
        combo++;
    } else {
        combo = 0;
    }
    
    spawnPiece();
}

function checkTSpin() {
    const corners = [
        [currentY, currentX],
        [currentY, currentX + 2],
        [currentY + 2, currentX],
        [currentY + 2, currentX + 2]
    ];
    
    let filledCorners = 0;
    for (const [y, x] of corners) {
        if (y < 0 || y >= ROWS || x < 0 || x >= COLS || board[y][x]) {
            filledCorners++;
        }
    }
    
    return filledCorners >= 3;
}

function clearLines() {
    let linesCleared = 0;
    
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell > 0)) {
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            row++;
        }
    }
    
    return linesCleared;
}

function updateScore(clearedLines, isTSpin) {
    if (clearedLines === 0) return;
    
    let points = 0;
    
    if (isTSpin) {
        tSpinCount++;
        switch (clearedLines) {
            case 1: points = 800 * level; break;
            case 2: points = 1200 * level; break;
            case 3: points = 1600 * level; break;
        }
    } else {
        switch (clearedLines) {
            case 1: points = 100 * level; break;
            case 2: points = 300 * level; break;
            case 3: points = 500 * level; break;
            case 4: points = 800 * level; break;
        }
    }
    
    points += combo * 50 * level;
    
    score += points;
    lines += clearedLines;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
}

function hold() {
    if (!canHold) return;
    
    const pieceType = getPieceType();
    
    if (holdPiece === null) {
        holdPiece = pieceType;
        spawnPiece();
    } else {
        const temp = holdPiece;
        holdPiece = pieceType;
        currentPiece = SHAPES[temp].map(row => [...row]);
        currentRotation = 0;
        currentX = Math.floor((COLS - currentPiece[0].length) / 2);
        currentY = 0;
    }
    
    canHold = false;
    drawHold();
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(ctx, col, row, COLORS[board[row][col]], 1);
            }
        }
    }
    
    const ghostY = getGhostY();
    const pieceType = getPieceType();
    
    for (let row = 0; row < currentPiece.length; row++) {
        for (let col = 0; col < currentPiece[row].length; col++) {
            if (currentPiece[row][col]) {
                drawBlock(ctx, currentX + col, ghostY + row, COLORS[pieceType], 0.3);
            }
        }
    }
    
    for (let row = 0; row < currentPiece.length; row++) {
        for (let col = 0; col < currentPiece[row].length; col++) {
            if (currentPiece[row][col]) {
                drawBlock(ctx, currentX + col, currentY + row, COLORS[currentPiece[row][col]], 1);
            }
        }
    }
}

function drawBlock(context, x, y, color, alpha) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
    context.globalAlpha = 1;
}

function drawHold() {
    holdCtx.fillStyle = '#000';
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    
    if (holdPiece) {
        const piece = SHAPES[holdPiece];
        const blockSize = 20;
        const offsetX = (holdCanvas.width - piece[0].length * blockSize) / 2;
        const offsetY = (holdCanvas.height - piece.length * blockSize) / 2;
        
        for (let row = 0; row < piece.length; row++) {
            for (let col = 0; col < piece[row].length; col++) {
                if (piece[row][col]) {
                    holdCtx.fillStyle = COLORS[piece[row][col]];
                    holdCtx.fillRect(
                        offsetX + col * blockSize,
                        offsetY + row * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            }
        }
    }
}

function drawNext() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    for (let i = 0; i < 5; i++) {
        const piece = SHAPES[nextPieces[i]];
        const blockSize = 20;
        const offsetX = (nextCanvas.width - piece[0].length * blockSize) / 2;
        const offsetY = 10 + i * 80 + (60 - piece.length * blockSize) / 2;
        
        for (let row = 0; row < piece.length; row++) {
            for (let col = 0; col < piece[row].length; col++) {
                if (piece[row][col]) {
                    nextCtx.fillStyle = COLORS[piece[row][col]];
                    nextCtx.fillRect(
                        offsetX + col * blockSize,
                        offsetY + row * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            }
        }
    }
}

function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
    document.getElementById('combo').textContent = combo;
}

function gameLoop() {
    if (!gameRunning) return;
    
    const now = Date.now();
    const deltaTime = now - lastTime;
    
    dropTimer += deltaTime;
    if (dropTimer >= dropInterval) {
        if (!drop()) {
            lockPiece();
        }
        dropTimer = 0;
    }
    
    draw();
    updateDisplay();
    
    lastTime = now;
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('finalScore').textContent = score;
    
    const leaderboardData = {
        userId: 'player_' + Date.now(),
        finalScore: score,
        maxCombo: combo,
        tSpinCount: tSpinCount,
        timestamp: new Date().toISOString()
    };
    
    console.log('Leaderboard Data:', JSON.stringify(leaderboardData));
}

function resetGame() {
    document.getElementById('gameOver').style.display = 'none';
    init();
}

function shareToKakao() {
    const shareData = {
        title: 'Tetris Game Score',
        description: `I scored ${score} points with ${lines} lines cleared!`,
        imageUrl: window.location.origin + '/share-image.png',
        link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href
        }
    };
    
    console.log('KakaoTalk Share Data:', JSON.stringify(shareData));
    alert('Share data has been logged to console. KakaoTalk SDK integration required.');
}

document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            move(-1);
            break;
        case 'ArrowRight':
            move(1);
            break;
        case 'ArrowDown':
            drop();
            dropTimer = 0;
            break;
        case 'ArrowUp':
            rotate();
            break;
        case ' ':
            hardDrop();
            break;
        case 'c':
        case 'C':
            hold();
            break;
    }
});

init();