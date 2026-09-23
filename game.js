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

// ---- Skins ----
// Cada skin aporta una paleta y una forma de dibujar el bloque. CRÍTICO: el
// índice del color ES el tipo de pieza (y el valor que se guarda en board), así
// que toda paleta tiene que repetir exactamente los 15 índices de COLORS: null
// en el 0 y un color por tipo hasta el comodín (14). Solo cambian los valores;
// reordenarlos recolorea piezas en silencio.
const SKIN_PALETTES = {
  retro: COLORS,
  neon: [
    null,
    '#00f0ff', // I
    '#ffee00', // O
    '#c04dff', // T
    '#39ff5e', // S
    '#ff2d55', // Z
    '#2f8bff', // J
    '#ff9f1c', // L
    '#9fd8ff', // TUERCA
    '#ff3b3b', // BOMBA
    '#fdff6a', // RAYO
    '#ff4fd8', // TINTE
    '#00ffc8', // GRAVEDAD
    '#4fd8ff', // CONGELAR
    '#d36bff', // COMODÍN
  ],
  pastel: [
    null,
    '#a8e6e2', // I
    '#ffe6a7', // O
    '#d7c4f2', // T
    '#bfe3c0', // S
    '#f5b7b1', // Z
    '#bcd6f5', // J
    '#f9d3a8', // L
    '#d6dbe0', // TUERCA
    '#f3a6a0', // BOMBA
    '#fbf1a8', // RAYO
    '#f6c1d9', // TINTE
    '#a9ddd4', // GRAVEDAD
    '#b7d4f2', // CONGELAR
    '#ddc2ec', // COMODÍN
  ],
  pixel: [
    null,
    '#00b8c4', // I
    '#f0c000', // O
    '#8c3cd8', // T
    '#3cb043', // S
    '#d83030', // Z
    '#2050d8', // J
    '#f07818', // L
    '#909890', // TUERCA
    '#e02020', // BOMBA
    '#f8e000', // RAYO
    '#e05098', // TINTE
    '#20a080', // GRAVEDAD
    '#38a0e8', // CONGELAR
    '#a050d8', // COMODÍN
  ],
};

// Skin y tema son independientes: theme sigue siendo 'dark'/'light' y cada skin
// define sus dos variantes de rejilla. La excepción es neón, que fuerza fondo
// de tablero oscuro en los dos temas (clase body.skin-neon en el CSS), así que
// sus dos variantes son iguales a propósito.
const SKIN_GRIDS = {
  retro: GRID_COLORS,
  neon: { dark: '#221a4a', light: '#221a4a' },
  pastel: { dark: '#2c2c3c', light: '#e6e0f0' },
  pixel: { dark: '#2a2a38', light: '#c9c9b8' },
};

// Tinta de los glifos por skin: sobre los bloques oscuros del neón, el oscuro
// de GLYPH_INK sería invisible. Se lee con valor por defecto, porque SKIN_NAMES
// sale solo de SKIN_RENDERERS y un skin nuevo podría olvidarse de este mapa.
const SKIN_GLYPH_INK = { retro: GLYPH_INK, neon: '#eaf6ff', pastel: GLYPH_INK, pixel: GLYPH_INK };

// El anillo de la tuerca se atenúa en neón, donde el resto de bloques son
// translúcidos y un cuadrado opaco desentonaría (también con valor por defecto).
const SKIN_NUT_ALPHA = { retro: 1, neon: 0.55, pastel: 1, pixel: 1 };

// Brillo del bloque pastel (dos variantes de tema) y trama del pixel art (va
// siempre sobre el color del bloque, así que el mismo valor sirve en los dos).
const PASTEL_GLOSS = { dark: 'rgba(255,255,255,0.40)', light: 'rgba(255,255,255,0.55)' };
const PIXEL_LIGHT = 'rgba(255,255,255,0.32)';
const PIXEL_DARK = 'rgba(0,0,0,0.28)';
// Puntos de la trama en "píxeles" de textura: fijos, no aleatorios, o el bloque
// parpadearía en cada frame.
const PIXEL_DOTS = [[2, 2], [5, 3], [3, 5], [6, 6], [4, 7]];

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
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let pendingPowerUp, nextPowerUpLines, freezeMs, powerLabel;
let theme = 'dark';
let skin = 'retro', colors = SKIN_PALETTES.retro, drawBlockSkin = drawBlockRetro;

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
  // un power-up se gasta en vez de fijarse: nunca llega al tablero
  if (isPowerUp(current.type)) applyPowerUp(current.type, current.x, current.y);
  else merge();
  clearLines();
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

// Punto de entrada único: todas las llamadas siguen pasando por aquí y el skin
// activo decide cómo se pinta la celda.
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  drawBlockSkin(context, x, y, colorIndex, size, alpha);
}

// ---- Bloques por skin ----
// Todos comparten la firma (context, x, y, colorIndex, size, alpha) y TIENEN que
// dejar el contexto limpio al salir (globalAlpha, shadowBlur, lineWidth): lo que
// se dibuje después — rejilla, fantasma, glifos, marco de hielo — hereda el
// estado que dejen.

// Retro: cuadrado plano con una franja de brillo arriba (el aspecto original).
function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = HIGHLIGHT_COLORS[theme];
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Neón: relleno tenue del propio color y contorno luminoso con halo
// (shadowBlur + shadowColor). El halo se apaga antes de salir.
function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = colors[colorIndex];
  const a = alpha ?? 1;
  const px = x * size, py = y * size;
  context.globalAlpha = a * 0.28;
  context.fillStyle = color;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.globalAlpha = a;
  context.shadowColor = color;
  context.shadowBlur = size * 0.45;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.lineWidth = 1;
  context.globalAlpha = 1;
}

// Rectángulo de esquinas redondeadas a mano (nada de ctx.roundRect, que no está
// en todos los navegadores). Deja el trazado listo para fill() o stroke().
function roundedRectPath(context, px, py, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(px + rr, py);
  context.arcTo(px + w, py, px + w, py + h, rr);
  context.arcTo(px + w, py + h, px, py + h, rr);
  context.arcTo(px, py + h, px, py, rr);
  context.arcTo(px, py, px + w, py, rr);
  context.closePath();
}

// Pastel: colores suaves y esquinas redondeadas, con un brillo tenue arriba.
function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const px = x * size + 1.5, py = y * size + 1.5;
  const s = size - 3;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = colors[colorIndex];
  roundedRectPath(context, px, py, s, s, size * 0.28);
  context.fill();
  context.fillStyle = PASTEL_GLOSS[theme];
  roundedRectPath(context, px + 3, py + 3, s - 6, s * 0.3, size * 0.12);
  context.fill();
  context.globalAlpha = 1;
}

// Pixel art: color plano, bisel de un "píxel" de textura y una trama fija de
// puntos encima, para que el bloque parezca dibujado a baja resolución.
function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const px = x * size, py = y * size;
  const u = Math.max(2, Math.round(size / 10)); // lado del píxel de textura
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = colors[colorIndex];
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // bisel claro arriba/izquierda
  context.fillStyle = PIXEL_LIGHT;
  context.fillRect(px + 1, py + 1, size - 2, u);
  context.fillRect(px + 1, py + 1, u, size - 2);
  // bisel oscuro abajo/derecha y trama de puntos
  context.fillStyle = PIXEL_DARK;
  context.fillRect(px + 1, py + size - 1 - u, size - 2, u);
  context.fillRect(px + size - 1 - u, py + 1, u, size - 2);
  for (const [dx, dy] of PIXEL_DOTS)
    context.fillRect(px + 1 + dx * u, py + 1 + dy * u, u, u);
  context.globalAlpha = 1;
}

// Dibuja la celda central de la tuerca como un anillo: rellena el cuadrado y le
// recorta un círculo con la regla 'evenodd', así el agujero deja ver el fondo
// del tablero sin depender del color del tema. Solo se pinta mientras la pieza
// cae (y en la vista previa); una vez fijada, el centro es una celda vacía más.
function drawNutHole(context, x, y, size, alpha) {
  context.globalAlpha = (alpha ?? 1) * (SKIN_NUT_ALPHA[skin] ?? 1);
  context.fillStyle = colors[NUT];
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
  context.fillStyle = colors[WILD];
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.globalAlpha = 1;
  context.strokeStyle = colors[WILD];
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
  // drawBlock deja el fillStyle en el color del brillo (o del propio bloque): hay
  // que fijarlo aquí o los glifos monocromos (⬇, ❄) se pintan casi transparentes.
  context.fillStyle = SKIN_GLYPH_INK[skin] ?? GLYPH_INK;
  context.font = `${Math.floor(size * 0.6)}px system-ui, -apple-system, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(POWER_GLYPHS[type], x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKIN_GRIDS[skin][theme];
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
    ctx.strokeStyle = colors[FREEZE];
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
}

function setTheme(mode) {
  theme = mode;
  document.body.classList.toggle('light-theme', mode === 'light');
  themeToggle.checked = mode === 'light';
  localStorage.setItem('tetris-theme', mode);
  // la vista previa también depende del tema (brillo del bloque), así que se
  // repinta con el tablero o se queda con los colores del tema anterior
  if (board) {
    draw();
    drawNext();
  }
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

// ---- Skins ----
// Registro de skins: la clave es la misma en el <select>, en SKIN_PALETTES y en
// la clase body.skin-<clave> del CSS.
const SKIN_RENDERERS = {
  retro: drawBlockRetro,
  neon: drawBlockNeon,
  pastel: drawBlockPastel,
  pixel: drawBlockPixel,
};
const SKIN_NAMES = Object.keys(SKIN_RENDERERS);

// Cambia de skin en caliente: nueva paleta, nuevo dibujante de bloque, clase en
// el body para el CSS del tablero y repintado. No pasa por init(), así que la
// partida en curso se mantiene.
function setSkin(name) {
  // lo que venga de localStorage no es de fiar: cualquier valor desconocido cae a retro
  skin = SKIN_NAMES.includes(name) ? name : 'retro';
  colors = SKIN_PALETTES[skin];
  drawBlockSkin = SKIN_RENDERERS[skin];
  for (const s of SKIN_NAMES) document.body.classList.toggle(`skin-${s}`, s === skin);
  skinSelect.value = skin;
  localStorage.setItem('tetris-skin', skin);
  if (board) {
    draw();
    drawNext();
  }
}

skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  // devolver el foco al juego: si el <select> se lo queda, la siguiente flecha
  // cambiaría de skin en vez de mover la pieza.
  skinSelect.blur();
});

// Mientras el <select> tiene el foco, sus teclas son suyas: cortamos la
// propagación para que no lleguen al keydown del documento (y al revés, el juego
// no se mueve mientras se está eligiendo skin con el teclado).
skinSelect.addEventListener('keydown', e => e.stopPropagation());

setSkin(localStorage.getItem('tetris-skin'));

function init() {
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
  lastTime = performance.now();
  next = randomPiece();
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

themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked ? 'light' : 'dark');
});

setTheme(localStorage.getItem('tetris-theme') === 'light' ? 'light' : 'dark');

init();
