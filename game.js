'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_PALETTES = {
  retro: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#b0bec5'],
  neon: [null, '#00e5ff', '#fff176', '#e040fb', '#69f0ae', '#ff1744', '#40c4ff', '#ff9100', '#eceff1'],
  pastel: [null, '#a8dadc', '#ffe8a3', '#d8bfd8', '#b8e0c2', '#f4a9a8', '#aed4f0', '#ffcf9e', '#d6d6e0'],
  pixel: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#b0bec5'],
};

let currentSkin = 'retro';
let COLORS = SKIN_PALETTES[currentSkin];

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

const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const RECORDS_MAX = 5;

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
const themeToggle = document.getElementById('theme-toggle');
const gameoverBox = document.getElementById('gameover-box');
const pauseBox = document.getElementById('pause-box');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const restartMenuBtn = document.getElementById('restart-menu-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level');

const MAX_START_LEVEL = 10;
const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const gameoverForm = document.getElementById('gameover-form');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayRecordsEl = document.getElementById('overlay-records');
const skinSelect = document.getElementById('skin-select');

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let comboCount, maxComboGame;
let gridLineColor = '#22222e';
let startLevel = 1;
let records = loadRecords();
let stats = loadStats();
let pendingScore = null;

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY));
    return raw && typeof raw === 'object' ? { bestCombo: raw.bestCombo || 0, bestLines: raw.bestLines || 0 } : { bestCombo: 0, bestLines: 0 };
  } catch {
    return { bestCombo: 0, bestLines: 0 };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForRecords(s) {
  return s > 0 && (records.length < RECORDS_MAX || s > records[records.length - 1].score);
}

function renderRecordsInto(target, highlightIdx) {
  target.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'no-records';
    li.textContent = 'Sin récords aún';
    target.appendChild(li);
    return;
  }
  records.forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${r.name} — ${r.score.toLocaleString()} pts (L${r.lines} C${r.combo})`;
    if (i === highlightIdx) li.classList.add('highlight');
    target.appendChild(li);
  });
}

function renderStats() {
  bestComboEl.textContent = stats.bestCombo;
  bestLinesEl.textContent = stats.bestLines;
}

function renderRecordsSidebar() {
  renderRecordsInto(recordsListEl, -1);
  renderStats();
}

function saveScore() {
  if (!pendingScore) return;
  const name = (playerNameInput.value.trim() || 'AAA').slice(0, 10);
  const entry = { name, score: pendingScore.score, lines: pendingScore.lines, combo: pendingScore.combo };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  records = records.slice(0, RECORDS_MAX);
  saveRecords();
  renderRecordsSidebar();
  gameoverForm.classList.add('hidden');
  overlayRecordsEl.classList.remove('hidden');
  renderRecordsInto(overlayRecordsEl, records.indexOf(entry));
  pendingScore = null;
}

saveScoreBtn.addEventListener('click', saveScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScore();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = [];
  stats = { bestCombo: 0, bestLines: 0 };
  saveRecords();
  saveStats();
  renderRecordsSidebar();
});

function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function initTheme() {
  applyTheme(localStorage.getItem('tetris-theme') === 'light');
}

function applySkin(skin) {
  currentSkin = SKIN_PALETTES[skin] ? skin : 'retro';
  COLORS = SKIN_PALETTES[currentSkin];
  for (const s of Object.keys(SKIN_PALETTES)) document.body.classList.remove(`skin-${s}`);
  document.body.classList.add(`skin-${currentSkin}`);
  skinSelect.value = currentSkin;
  localStorage.setItem('tetris-skin', currentSkin);
}

function initSkin() {
  applySkin(localStorage.getItem('tetris-skin') || 'retro');
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
    updateHUD();
  }
  return cleared;
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
  const cleared = clearLines();
  if (cleared > 0) {
    comboCount++;
    maxComboGame = Math.max(maxComboGame, comboCount);
  } else {
    comboCount = 0;
  }
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
  switch (currentSkin) {
    case 'neon': drawBlockNeon(context, x, y, colorIndex, size, alpha); break;
    case 'pastel': drawBlockPastel(context, x, y, colorIndex, size, alpha); break;
    case 'pixel': drawBlockPixel(context, x, y, colorIndex, size, alpha); break;
    default: drawBlockRetro(context, x, y, colorIndex, size, alpha);
  }
}

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  context.fillStyle = '#0a0a12';
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.fillStyle = color;
  context.globalAlpha = (alpha ?? 1) * 0.35;
  context.fillRect(x * size + 4, y * size + 4, size - 8, size - 8);
  context.restore();
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  const r = size * 0.22;
  const px = x * size + 2, py = y * size + 2, w = size - 4, h = size - 4;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(px, py, w, h, r);
  } else {
    context.moveTo(px + r, py);
    context.arcTo(px + w, py, px + w, py + h, r);
    context.arcTo(px + w, py + h, px, py + h, r);
    context.arcTo(px, py + h, px, py, r);
    context.arcTo(px, py, px + w, py, r);
    context.closePath();
  }
  context.fill();
  context.globalAlpha = 1;
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  const cell = size / 6;
  context.fillStyle = 'rgba(0,0,0,0.15)';
  for (let ry = 0; ry < 6; ry++)
    for (let rx = 0; rx < 6; rx++)
      if ((rx + ry) % 2 === 0)
        context.fillRect(x * size + 1 + rx * cell, y * size + 1 + ry * cell, cell, cell);
  context.strokeStyle = 'rgba(0,0,0,0.25)';
  context.lineWidth = 1;
  context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
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
  gameoverBox.classList.remove('hidden');
  pauseBox.classList.add('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} | Líneas: ${lines} | Combo: ${maxComboGame}`;

  stats.bestLines = Math.max(stats.bestLines, lines);
  stats.bestCombo = Math.max(stats.bestCombo, maxComboGame);
  saveStats();
  renderStats();

  pendingScore = { score, lines, combo: maxComboGame };
  if (qualifiesForRecords(score)) {
    gameoverForm.classList.remove('hidden');
    overlayRecordsEl.classList.add('hidden');
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    gameoverForm.classList.add('hidden');
    overlayRecordsEl.classList.remove('hidden');
    renderRecordsInto(overlayRecordsEl, -1);
  }

  overlay.classList.remove('hidden');
}

function showPauseMain() {
  pauseMain.classList.remove('hidden');
  pauseControls.classList.add('hidden');
}

function showPauseControls() {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
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
    gameoverBox.classList.add('hidden');
    pauseBox.classList.remove('hidden');
    showPauseMain();
    overlay.classList.remove('hidden');
  }
}

function populateStartLevelSelect() {
  for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
    const opt = document.createElement('option');
    opt.value = lvl;
    opt.textContent = lvl;
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = startLevel;
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  comboCount = 0;
  maxComboGame = 0;
  pendingScore = null;
  lastTime = performance.now();
  queue = [randomPiece(), randomPiece(), randomPiece()];
  spawn();
  updateHUD();
  gameoverForm.classList.add('hidden');
  overlayRecordsEl.classList.add('hidden');
  overlay.classList.add('hidden');
  gameoverBox.classList.add('hidden');
  pauseBox.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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
resumeBtn.addEventListener('click', togglePause);
restartMenuBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', showPauseControls);
backBtn.addEventListener('click', showPauseMain);
startLevelSelect.addEventListener('change', () => { startLevel = Number(startLevelSelect.value); });
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

populateStartLevelSelect();
initTheme();
renderRecordsSidebar();
initSkin();
init();
