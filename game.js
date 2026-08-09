'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (steel)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HOLE = -1; // celda de hueco de tuerca: transparente en colisión, cuenta llena al limpiar líneas
const NUT = 8;
const PIECE_HOLES = { [NUT]: [[1, 1]] }; // tipo → lista de [fila, col] hueco dentro de la matriz de la pieza

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const themeToggle = document.getElementById('theme-toggle');
const recordsList = document.getElementById('records-list');
const bestStats = document.getElementById('best-stats');
const recordEntry = document.getElementById('record-entry');
const playerNameInput = document.getElementById('player-name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsSection = document.getElementById('records-section');

const RECORDS_KEY = 'tetris-records';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';
const MAX_RECORDS = 5;

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo;
let gridLineColor = '#22222e';
let started = false;

function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function initTheme() {
  applyTheme(localStorage.getItem('tetris-theme') === 'light');
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function getBestCombo() {
  return Number(localStorage.getItem(BEST_COMBO_KEY)) || 0;
}

function getMaxLines() {
  return Number(localStorage.getItem(MAX_LINES_KEY)) || 0;
}

function updateBestStats() {
  if (maxCombo > getBestCombo()) localStorage.setItem(BEST_COMBO_KEY, maxCombo);
  if (lines > getMaxLines()) localStorage.setItem(MAX_LINES_KEY, lines);
}

function qualifiesForRecords(value) {
  const records = loadRecords();
  if (value <= 0) return false;
  if (records.length < MAX_RECORDS) return true;
  return value > records[records.length - 1].score;
}

function addRecord(name, value, linesCleared, comboValue) {
  const records = loadRecords();
  records.push({ name: name || 'ANON', score: value, lines: linesCleared, combo: comboValue });
  records.sort((a, b) => b.score - a.score);
  records.length = Math.min(records.length, MAX_RECORDS);
  saveRecords(records);
  return records;
}

function renderRecords(highlightRecord) {
  const records = loadRecords();
  recordsList.innerHTML = '';
  if (!records.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin récords todavía';
    recordsList.appendChild(li);
  } else {
    records.forEach((r, i) => {
      const li = document.createElement('li');
      if (highlightRecord && r === highlightRecord) li.classList.add('highlight');
      const name = document.createElement('span');
      name.textContent = `${i + 1}. ${r.name}`;
      const val = document.createElement('span');
      val.textContent = r.score.toLocaleString();
      li.appendChild(name);
      li.appendChild(val);
      recordsList.appendChild(li);
    });
  }
  bestStats.textContent = `Mejor combo: ${getBestCombo()} · Máx líneas: ${getMaxLines()}`;
}

function resetRecords() {
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  renderRecords();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] > 0) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
  for (const [hr, hc] of PIECE_HOLES[current.type] ?? []) {
    const y = current.y + hr, x = current.x + hc;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS && board[y][x] === 0) board[y][x] = HOLE;
  }
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = queue.shift();
  queue.push(randomPiece());
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  drawNext();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (colorIndex === HOLE) { drawHole(context, x, y, size, alpha); return; }
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawHole(context, x, y, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = COLORS[NUT];
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.32, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
}

function drawPieceHoles(context, type, ox, oy, size, alpha) {
  for (const [hr, hc] of PIECE_HOLES[type] ?? [])
    drawHole(context, ox + hc, oy + hr, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
    drawPieceHoles(ctx, current.type, current.x, gy, BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
    drawPieceHoles(ctx, current.type, current.x, current.y, BLOCK);
  }
}

function drawPreviewPiece(context, piece, pxOffsetX, pxOffsetY, boxPx, size) {
  const cells = boxPx / size;
  const shape = piece.shape;
  const offX = Math.floor((cells - shape[0].length) / 2);
  const offY = Math.floor((cells - shape.length) / 2);
  context.save();
  context.translate(pxOffsetX, pxOffsetY);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
  drawPieceHoles(context, piece.type, offX, offY, size);
  context.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawPreviewPiece(nextCtx, queue[0], 0, 0, 120, 30);
  if (score > 0) {
    drawPreviewPiece(nextCtx, queue[1], 20, 120, 80, 20);
    drawPreviewPiece(nextCtx, queue[2], 20, 200, 80, 20);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateBestStats();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  recordsSection.classList.remove('hidden');
  startBtn.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  if (qualifiesForRecords(score)) {
    recordEntry.classList.remove('hidden');
    playerNameInput.value = '';
    renderRecords();
    playerNameInput.focus();
  } else {
    recordEntry.classList.add('hidden');
    renderRecords();
  }
  overlay.classList.remove('hidden');
}

function saveCurrentRecord() {
  const record = addRecord(playerNameInput.value.trim().slice(0, 10), score, lines, maxCombo)
    .find(r => r.score === score);
  recordEntry.classList.add('hidden');
  renderRecords(record);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    recordEntry.classList.add('hidden');
    recordsSection.classList.add('hidden');
    startBtn.classList.add('hidden');
    restartBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (paused || gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  queue = [randomPiece(), randomPiece(), randomPiece()];
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  recordEntry.classList.add('hidden');
  recordsSection.classList.remove('hidden');
  startBtn.classList.remove('hidden');
  restartBtn.classList.add('hidden');
  renderRecords();
  overlay.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
startBtn.addEventListener('click', init);
saveRecordBtn.addEventListener('click', saveCurrentRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentRecord();
});
resetRecordsBtn.addEventListener('click', resetRecords);
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));

initTheme();
showStartScreen();
