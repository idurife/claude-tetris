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
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // TUERCA - gris metálico
  '#ef5350', // BOMBA - rojo
  '#fff176', // RAYO - amarillo eléctrico
  '#f06292', // TINTE - rosa
  '#4db6ac', // GRAVEDAD - verde agua
  '#64b5f6', // CONGELAR - azul hielo
  '#ce93d8', // COMODÍN - violeta (solo existe como celda del tablero)
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // TUERCA
  [[9]],                                      // BOMBA
  [[10]],                                     // RAYO
  [[11]],                                     // TINTE
  [[12]],                                     // GRAVEDAD
  [[13]],                                     // CONGELAR
  null,                                       // COMODÍN: no es una pieza
];

// La tuerca es la pieza de reto: al fijarse, su celda central vacía deja un
// hueco que ninguna otra pieza puede rellenar (el anillo lo tapa por completo),
// así que solo desaparece si se completa y se limpia esa fila. Por eso sale con
// menos frecuencia que las 7 estándar.
const NUT = 8;
const NUT_CHANCE = 0.12;

// Los power-ups son piezas de 1x1 que NO se fijan en el tablero: al aterrizar
// se consumen ejecutando su efecto sobre las celdas ya fijadas (applyPowerUp).
// Como cualquier otra pieza, su tipo es a la vez su índice en PIECES y COLORS.
const BOMB = 9;
const BOLT = 10;
const DYE = 11;
const GRAVITY = 12;
const FREEZE = 13;
// El comodín que deja el tinte no es una pieza, solo un valor de celda: las
// piezas lo atraviesan (collide) pero cuenta como celda llena (clearLines).
const WILD = 14;

const POWERUPS = [BOMB, BOLT, DYE, GRAVITY, FREEZE];
const POWERUP_EVERY = 1;   // líneas entre power-ups
const POWERUP_SCORE = 20;  // puntos por bloque destruido (x nivel)
const FREEZE_MS = 5000;

const POWER_GLYPHS = {
  [BOMB]: '💣',
  [BOLT]: '⚡',
  [DYE]: '🎨',
  [GRAVITY]: '⬇',
  [FREEZE]: '❄',
};

const POWER_NAMES = {
  [BOMB]: 'Bomba',
  [BOLT]: 'Rayo',
  [DYE]: 'Tinte',
  [GRAVITY]: 'Gravedad',
  [FREEZE]: 'Congelar',
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#d0d0dc' };
const HIGHLIGHT_COLORS = { dark: 'rgba(255,255,255,0.12)', light: 'rgba(0,0,0,0.10)' };
// Tinta de los símbolos de power-up: van encima de un bloque de color vivo, así
// que el mismo oscuro funciona en los dos temas.
const GLYPH_INK = '#15151f';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const powerEl = document.getElementById('power-status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startRecords = document.getElementById('start-records');
const startBest = document.getElementById('start-best');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsPanel = document.getElementById('records-panel');
const recordsBest = document.getElementById('records-best');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const menuBtn = document.getElementById('menu-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let pendingPowerUp, nextPowerUpLines, freezeMs, powerLabel;
let theme = 'dark';
// Estado de la tabla de records: racha actual, mejor racha de la partida, si el
// juego ya arrancó (antes solo se ve la pantalla de inicio) y si falta guardar
// la puntuación recién conseguida.
let combo = 0, bestCombo = 0, started = false, recordPending = false, storageOk = true;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function isPowerUp(type) {
  return type >= BOMB && type <= FREEZE;
}

function randomPiece() {
  if (pendingPowerUp) {
    pendingPowerUp = false;
    return makePiece(POWERUPS[Math.floor(Math.random() * POWERUPS.length)]);
  }
  return makePiece(Math.random() < NUT_CHANCE ? NUT : Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] && board[ny][nx] !== WILD) return true;
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
    // Combo: racha de piezas consecutivas que limpian al menos una fila (sube
    // una vez por pieza, no una por fila).
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    // cada POWERUP_EVERY líneas, la siguiente pieza generada es un power-up
    if (lines >= nextPowerUpLines) {
      pendingPowerUp = true;
      nextPowerUpLines = (Math.floor(lines / POWERUP_EVERY) + 1) * POWERUP_EVERY;
    }
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
  const linesBefore = lines;
  const wasPowerUp = isPowerUp(current.type);
  // un power-up se gasta en vez de fijarse: nunca llega al tablero
  if (isPowerUp(current.type)) applyPowerUp(current.type, current.x, current.y);
  else merge();
  clearLines();
  // La racha solo la rompe una pieza que se FIJA sin completar filas. Un
  // power-up se consume en vez de fijarse, así que nunca corta el combo; pero
  // si su efecto completa filas, clearLines() lo alarga igual que una pieza.
  if (!wasPowerUp && lines === linesBefore) combo = 0;
  spawn();
}

// ---- Efectos de los power-ups ----
// Se ejecutan con la pieza ya en su posición final (cx, cy). clearLines() corre
// justo después, así que un efecto que complete filas las limpia igualmente.
function applyPowerUp(type, cx, cy) {
  let n = 0;
  switch (type) {
    case BOMB: n = blast(cx, cy); break;
    case BOLT: n = bolt(cx, cy); break;
    case DYE: n = dye(); break;
    case GRAVITY: n = compact(); break;
    case FREEZE: freezeMs = FREEZE_MS; break;
  }
  if (type === BOMB || type === BOLT) score += n * POWERUP_SCORE * level;
  powerLabel = `${POWER_GLYPHS[type]} ${POWER_NAMES[type]}` + (type === FREEZE ? '' : ` ×${n}`);
}

// Bomba: vacía el área 3x3 centrada en la celda donde aterrizó.
function blast(cx, cy) {
  let removed = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) removed++;
      board[r][c] = 0;
    }
  }
  return removed;
}

// Rayo: vacía la fila y la columna completas de la celda donde aterrizó. Los
// bloques que quedan flotando no caen solos; para eso está la gravedad.
function bolt(cx, cy) {
  let removed = 0;
  for (let c = 0; c < COLS; c++) {
    if (board[cy][c]) removed++;
    board[cy][c] = 0;
  }
  for (let r = 0; r < ROWS; r++) {
    if (board[r][cx]) removed++;
    board[r][cx] = 0;
  }
  return removed;
}

// Tinte: convierte en comodines todos los bloques del color más abundante del
// tablero. Un comodín sigue contando para completar la línea, pero las piezas
// lo atraviesan y lo sobrescriben, así que abre paso dentro de la pila.
function dye() {
  const count = new Array(COLORS.length).fill(0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] && board[r][c] !== WILD) count[board[r][c]]++;
  let target = 0;
  for (let t = 1; t < count.length; t++) if (count[t] > count[target]) target = t;
  if (!target) return 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === target) board[r][c] = WILD;
  return count[target];
}

// Gravedad: baja cada columna hasta el fondo eliminando los huecos, incluidos
// los que dejan las tuercas fijadas. Devuelve cuántos bloques se movieron.
function compact() {
  let moved = 0;
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!board[r][c]) continue;
      if (write !== r) {
        board[write][c] = board[r][c];
        board[r][c] = 0;
        moved++;
      }
      write--;
    }
  }
  return moved;
}

function spawn() {
  current = next;
  next = randomPiece();
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
  updatePowerStatus();
}

// Mientras el congelado está activo el panel muestra la cuenta atrás; el resto
// del tiempo, el último power-up usado.
function updatePowerStatus() {
  powerEl.textContent = freezeMs > 0
    ? `${POWER_GLYPHS[FREEZE]} ${(freezeMs / 1000).toFixed(1)} s`
    : (powerLabel || '—');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = HIGHLIGHT_COLORS[theme];
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Dibuja la celda central de la tuerca como un anillo: rellena el cuadrado y le
// recorta un círculo con la regla 'evenodd', así el agujero deja ver el fondo
// del tablero sin depender del color del tema. Solo se pinta mientras la pieza
// cae (y en la vista previa); una vez fijada, el centro es una celda vacía más.
function drawNutHole(context, x, y, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = COLORS[NUT];
  context.beginPath();
  context.rect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.34, 0, Math.PI * 2);
  context.fill('evenodd');
  context.globalAlpha = 1;
}

// Comodín: bloque translúcido con un rombo dentro, para distinguir de un vistazo
// las celdas que las piezas pueden atravesar.
function drawWild(context, x, y, size) {
  const px = x * size, py = y * size;
  context.globalAlpha = 0.4;
  context.fillStyle = COLORS[WILD];
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.globalAlpha = 1;
  context.strokeStyle = COLORS[WILD];
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(px + size / 2, py + 5);
  context.lineTo(px + size - 5, py + size / 2);
  context.lineTo(px + size / 2, py + size - 5);
  context.lineTo(px + 5, py + size / 2);
  context.closePath();
  context.stroke();
}

// Símbolo del power-up sobre su celda (la pieza es 1x1, así que siempre va en
// la esquina de su matriz).
function drawGlyph(context, x, y, type, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  // drawBlock deja el fillStyle en el color del brillo: hay que fijarlo aquí o
  // los glifos monocromos (⬇, ❄) se pintan casi transparentes.
  context.fillStyle = GLYPH_INK;
  context.font = `${Math.floor(size * 0.6)}px system-ui, -apple-system, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(POWER_GLYPHS[type], x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[theme];
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
      if (board[r][c] === WILD) drawWild(ctx, c, r, BLOCK);
      else drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  // el agujero siempre cae en el centro de la matriz 3x3 (la tuerca es simétrica)
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);
  if (isPowerUp(current.type)) drawGlyph(ctx, current.x, gy, current.type, BLOCK, 0.35);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
  if (isPowerUp(current.type)) drawGlyph(ctx, current.x, current.y, current.type, BLOCK);

  // marco de hielo mientras dura el congelado
  if (freezeMs > 0) {
    ctx.strokeStyle = COLORS[FREEZE];
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === NUT) drawNutHole(nextCtx, offX + 1, offY + 1, NB);
  if (isPowerUp(next.type)) drawGlyph(nextCtx, offX, offY, next.type, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function setTheme(mode) {
  theme = mode;
  document.body.classList.toggle('light-theme', mode === 'light');
  themeToggle.checked = mode === 'light';
  localStorage.setItem('tetris-theme', mode);
  if (board) draw();
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
  const dt = ts - lastTime;
  lastTime = ts;
  // Congelar detiene solo la caída automática: el jugador sigue moviendo,
  // rotando y soltando la pieza mientras dura el efecto.
  if (freezeMs > 0) {
    freezeMs = Math.max(0, freezeMs - dt);
    dropAccum = 0;
    updatePowerStatus();
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  // spawn() puede haber terminado la partida dentro de lockPiece(): en ese caso
  // cancelAnimationFrame() no sirve (el frame actual ya se está ejecutando),
  // así que hay que cortar aquí para no encadenar otro frame.
  if (gameOver || paused) {
    animId = null;
    return;
  }
  animId = requestAnimationFrame(loop);
}

// ---- Tabla de records ----
// Los records viven en localStorage: 'tetris-records' guarda la tabla top 5
// ([{ name, score, lines, level, combo, date }] ordenada por score desc) y
// 'tetris-records-best' el mejor combo y las líneas máximas históricas. Todo lo
// que sale de localStorage es entrada no confiable: se valida entrada por
// entrada y el nombre del jugador se pinta siempre con textContent.
const RECORDS_KEY = 'tetris-records';
const RECORDS_BEST_KEY = 'tetris-records-best';
const MAX_RECORDS = 5;
const MAX_NAME = 12;
const DEFAULT_NAME = 'Jugador';

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidRecord(r) {
  return !!r && typeof r === 'object' && !Array.isArray(r)
    && typeof r.name === 'string'
    && typeof r.date === 'string'
    && isFiniteNumber(r.score) && isFiniteNumber(r.lines)
    && isFiniteNumber(r.level) && isFiniteNumber(r.combo);
}

function toCount(v) {
  return Math.max(0, Math.floor(v));
}

// Acceso crudo a localStorage: en navegación privada o con el almacenamiento
// bloqueado, hasta getItem lanza. Eso (y no un JSON corrupto) es lo que marca
// storageOk a false, para poder avisar de que no se pueden guardar records.
function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    storageOk = false;
    return null;
  }
}

// Lee la tabla descartando cualquier cosa que no encaje en el formato.
function loadRecords() {
  let raw;
  try {
    raw = JSON.parse(readRaw(RECORDS_KEY));
  } catch (e) {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isValidRecord)
    .map(r => ({
      name: r.name.trim().slice(0, MAX_NAME) || DEFAULT_NAME,
      score: toCount(r.score),
      lines: toCount(r.lines),
      level: toCount(r.level),
      combo: toCount(r.combo),
      date: r.date.slice(0, 10),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

// Records globales (no por partida): mejor combo y líneas máximas.
function loadBest() {
  let raw;
  try {
    raw = JSON.parse(readRaw(RECORDS_BEST_KEY));
  } catch (e) {
    raw = null;
  }
  const ok = !!raw && typeof raw === 'object' && !Array.isArray(raw);
  return {
    combo: ok && isFiniteNumber(raw.combo) ? toCount(raw.combo) : 0,
    lines: ok && isFiniteNumber(raw.lines) ? toCount(raw.lines) : 0,
  };
}

// localStorage puede fallar (cuota llena, modo privado): si pasa, los records
// se pierden pero la partida sigue. Devuelve si se llegó a guardar, porque la
// tabla no debe resaltar una fila que en realidad no se ha escrito.
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    storageOk = false;
    return false;
  }
}

// Fecha local (no UTC): con toISOString, una partida terminada por la noche se
// guardaría con la fecha del día siguiente.
function todayISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function qualifiesForTop(sc, records) {
  if (sc <= 0) return false;
  return records.length < MAX_RECORDS || sc > records[records.length - 1].score;
}

// Pinta la tabla dentro de un contenedor. highlight es el índice de la fila de
// la partida recién guardada (-1 = ninguna). Solo textContent: el nombre lo
// escribe el jugador y nunca debe interpretarse como HTML.
function renderRecordsInto(container, records, highlight) {
  container.textContent = '';
  if (!records.length) {
    const vacio = document.createElement('p');
    vacio.className = 'records-empty';
    vacio.textContent = storageOk
      ? 'Todavía no hay records. ¡Juega una partida!'
      : 'Este navegador no permite guardar records.';
    container.appendChild(vacio);
    return;
  }
  const table = document.createElement('table');
  table.className = 'records-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const titulo of ['#', 'Nombre', 'Puntos', 'Líneas', 'Niv', 'Combo', 'Fecha']) {
    const th = document.createElement('th');
    th.textContent = titulo;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  records.forEach((rec, i) => {
    const tr = document.createElement('tr');
    if (i === highlight) tr.className = 'records-highlight';
    const celdas = [
      String(i + 1),
      rec.name,
      rec.score.toLocaleString(),
      String(rec.lines),
      String(rec.level),
      `×${rec.combo}`,
      rec.date,
    ];
    celdas.forEach((texto, j) => {
      const td = document.createElement('td');
      if (j === 1) {
        td.className = 'records-name';
        td.title = texto;
      }
      td.textContent = texto;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// Refresca las dos pantallas a la vez (inicio y game over) para que ninguna
// quede con datos viejos.
function refreshRecords(highlight) {
  const records = loadRecords();
  const best = loadBest();
  const resumen = `Mejor combo: ×${best.combo}  ·  Líneas máximas: ${best.lines}`;
  renderRecordsInto(startRecords, records, highlight);
  renderRecordsInto(recordsPanel, records, highlight);
  startBest.textContent = resumen;
  recordsBest.textContent = resumen;
}

// El overlay lo comparten PAUSA y GAME OVER: la tabla y el formulario solo
// deben verse al terminar la partida, así que init() los vuelve a ocultar.
function hideRecordsOverlay() {
  recordPending = false;
  nameForm.classList.add('hidden');
  recordsPanel.classList.add('hidden');
  recordsBest.classList.add('hidden');
  menuBtn.classList.add('hidden');
}

// Al terminar la partida: actualiza los records globales, muestra la tabla y
// pide el nombre solo si la puntuación entra en el top 5.
function showGameOverRecords() {
  const best = loadBest();
  const guardado = saveJSON(RECORDS_BEST_KEY, {
    combo: Math.max(best.combo, bestCombo),
    lines: Math.max(best.lines, lines),
  });
  const records = loadRecords();
  // Si no se puede escribir en localStorage no tiene sentido pedir el nombre:
  // el guardado sería un no-op y la tabla seguiría igual.
  recordPending = guardado && qualifiesForTop(score, records);
  nameForm.classList.toggle('hidden', !recordPending);
  recordsPanel.classList.remove('hidden');
  recordsBest.classList.remove('hidden');
  menuBtn.classList.remove('hidden');
  refreshRecords(-1);
  if (recordPending) {
    nameInput.value = DEFAULT_NAME;
    nameInput.focus();
    nameInput.select();
  }
}

// Guarda la partida recién terminada con el nombre escrito y resalta su fila.
function saveCurrentRecord() {
  if (!recordPending) return;
  recordPending = false;
  const entrada = {
    name: nameInput.value.trim().slice(0, MAX_NAME) || DEFAULT_NAME,
    score,
    lines,
    level,
    combo: bestCombo, // el mejor combo de esa partida
    date: todayISO(),
  };
  const records = loadRecords();
  records.push(entrada);
  records.sort((a, b) => b.score - a.score);
  const top = records.slice(0, MAX_RECORDS);
  // refreshRecords() vuelve a leer de localStorage: si la escritura falló, la
  // tabla pintada es la vieja y no debe resaltarse ninguna fila.
  const guardado = saveJSON(RECORDS_KEY, top);
  nameForm.classList.add('hidden');
  refreshRecords(guardado ? top.indexOf(entrada) : -1);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(RECORDS_BEST_KEY);
  } catch (e) {
    /* sin persistencia: la tabla se repinta vacía igualmente */
  }
  recordPending = false;
  nameForm.classList.add('hidden');
  refreshRecords(-1);
}

function showStartScreen() {
  refreshRecords(-1);
  startScreen.classList.remove('hidden');
}

// Vuelta al menú desde el game over: sin esto, la tabla completa y el botón de
// borrar records solo se verían al recargar la página. El botón solo está
// visible con la partida terminada, así que no hay ninguna en curso que cortar.
function backToStart() {
  saveCurrentRecord();
  hideRecordsOverlay();
  overlay.classList.add('hidden');
  started = false;
  showStartScreen();
}

function startGame() {
  startScreen.classList.add('hidden');
  init();
}

function init() {
  // Reiniciar sin pulsar Guardar no debe tirar la puntuación: si quedaba un
  // record pendiente se guarda con el nombre escrito (o 'Jugador'). Va lo
  // primero, antes de que score/lines/level se pongan a cero.
  saveCurrentRecord();
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  pendingPowerUp = false;
  nextPowerUpLines = POWERUP_EVERY;
  freezeMs = 0;
  powerLabel = '';
  combo = 0;
  bestCombo = 0;
  started = true;
  hideRecordsOverlay();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started) return; // aún se ve la pantalla de inicio: no hay partida que controlar
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

themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked ? 'light' : 'dark');
});

setTheme(localStorage.getItem('tetris-theme') === 'light' ? 'light' : 'dark');

startBtn.addEventListener('click', startGame);
resetRecordsBtn.addEventListener('click', resetRecords);
saveScoreBtn.addEventListener('click', saveCurrentRecord);
menuBtn.addEventListener('click', backToStart);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveCurrentRecord();
});

// La partida ya no arranca sola: primero se ve la pantalla de inicio con la
// tabla de records. init() sigue siendo el handler de #restart-btn.
showStartScreen();
