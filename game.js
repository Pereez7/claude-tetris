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

const NEON_COLORS = [
  null,
  '#00e5ff', // I - cyan neón
  '#ffea00', // O - amarillo neón
  '#e040fb', // T - magenta neón
  '#00e676', // S - verde neón
  '#ff1744', // Z - rojo neón
  '#448aff', // J - azul neón
  '#ff9100', // L - naranja neón
  '#eceff1', // N - tuerca (blanco frío)
];

const PASTEL_COLORS = [
  null,
  '#b3e5fc', // I - celeste pastel
  '#fff9c4', // O - amarillo pastel
  '#e1bee7', // T - lila pastel
  '#c8e6c9', // S - verde pastel
  '#ffcdd2', // Z - rosa pastel
  '#bbdefb', // J - azul pastel
  '#ffe0b2', // L - durazno pastel
  '#e0e0e0', // N - tuerca (gris claro)
];

const PIXEL_COLORS = [
  null,
  '#26a69a', // I - teal
  '#fbc02d', // O - mostaza
  '#8e24aa', // T - violeta
  '#66bb6a', // S - verde
  '#d32f2f', // Z - rojo ladrillo
  '#5c6bc0', // J - índigo
  '#f57c00', // L - naranja quemado
  '#90a4ae', // N - tuerca (gris pizarra)
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
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor = '#22222e';
let currentSkin = 'retro';

function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function initTheme() {
  applyTheme(localStorage.getItem('tetris-theme') === 'light');
}

// ---- Skins visuales ----

function adjustColor(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

function drawBlockRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, color, size) {
  context.shadowColor = color;
  context.shadowBlur = size * 0.35;
  context.fillStyle = color;
  context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.strokeRect(x * size + 2.5, y * size + 2.5, size - 5, size - 5);
}

function drawBlockPastel(context, x, y, color, size) {
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  context.fillStyle = color;
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(px, py, s, s, 6);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.roundRect(px, py, s, Math.max(2, s * 0.35), 6);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(px, py, s, Math.max(2, s * 0.35));
  }
}

function drawBlockPixel(context, x, y, color, size) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  const cell = Math.max(2, Math.floor(s / 3));
  const light = adjustColor(color, 28);
  const dark = adjustColor(color, -28);
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  let row = 0;
  for (let gy = py; gy < py + s; gy += cell) {
    let col = 0;
    for (let gx = px; gx < px + s; gx += cell) {
      const w = Math.min(cell, px + s - gx);
      const h = Math.min(cell, py + s - gy);
      if ((row + col) % 2 === 0) {
        context.fillStyle = (row + col) % 4 === 0 ? light : dark;
        context.fillRect(gx, gy, w, h);
      }
      col++;
    }
    row++;
  }
}

const SKINS = {
  retro: { label: 'Retro', colors: COLORS, drawBlock: drawBlockRetro },
  neon: { label: 'Neón', colors: NEON_COLORS, drawBlock: drawBlockNeon },
  pastel: { label: 'Pastel', colors: PASTEL_COLORS, drawBlock: drawBlockPastel },
  pixel: { label: 'Pixel art', colors: PIXEL_COLORS, drawBlock: drawBlockPixel },
};

function applySkin(skin, redraw = true) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  if (skinSelect) skinSelect.value = currentSkin;
  localStorage.setItem('tetris-skin', currentSkin);
  if (redraw) {
    draw();
    drawNext();
  }
}

function initSkin() {
  applySkin(localStorage.getItem('tetris-skin') || 'retro', false);
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
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x, y, color, size);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

function drawHole(context, x, y, size, alpha) {
  const skin = SKINS[currentSkin];
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = skin.colors[NUT];
  context.lineWidth = currentSkin === 'pixel' ? 2 : 3;
  if (currentSkin === 'neon') {
    context.shadowColor = skin.colors[NUT];
    context.shadowBlur = size * 0.4;
  }
  context.beginPath();
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.32, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
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

function drawSkinBackground(context, width, height) {
  if (currentSkin === 'neon') {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSkinBackground(ctx, canvas.width, canvas.height);
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
  drawSkinBackground(nextCtx, nextCanvas.width, nextCanvas.height);
  drawPreviewPiece(nextCtx, queue[0], 0, 0, 120, 30);
  if (score > 0) {
    drawPreviewPiece(nextCtx, queue[1], 20, 120, 80, 20);
    drawPreviewPiece(nextCtx, queue[2], 20, 200, 80, 20);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
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

document.addEventListener('keydown', e => {
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
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));
if (skinSelect) skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

initTheme();
initSkin();
init();
