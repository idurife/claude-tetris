# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Power-ups](#power-ups)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- La **tuerca**: una pieza extra de 3 × 3 con un agujero circular en el centro que aparece de vez en cuando (≈12 % de las piezas). Al fijarse deja un hueco imposible de rellenar, así que obliga a planificar la línea para poder limpiarla.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Power-ups**: cada 5 líneas aparece una pieza especial de 1 × 1 con un efecto (bomba, rayo, tinte, gravedad, congelar). Ver [Power-ups](#power-ups).
- **Pausa** y **Game Over** con opción de reinicio.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |

---

## Power-ups

Cada **5 líneas** (`POWERUP_EVERY`) la siguiente pieza generada es un power-up: una celda única con un símbolo, que ya se ve en la vista previa `NEXT`. No se fija en el tablero — al aterrizar se **gasta** ejecutando su efecto sobre los bloques ya fijados. El panel lateral muestra en `POWER-UP` el último efecto usado y cuántas celdas afectó.

| Símbolo | Power-up     | Efecto                                                                                              |
| ------- | ------------ | --------------------------------------------------------------------------------------------------- |
| 💣      | **Bomba**    | Vacía el área **3 × 3** centrada en la celda donde aterrizó (recortada si toca un borde).           |
| ⚡      | **Rayo**     | Vacía por completo la **fila y la columna** de la celda donde aterrizó.                             |
| 🎨      | **Tinte**    | Convierte en **comodines** todos los bloques del color más abundante del tablero.                   |
| ⬇       | **Gravedad** | **Compacta** el tablero: cada columna cae hasta el fondo y desaparecen los huecos.                  |
| ❄       | **Congelar** | **Detiene la caída automática 5 s**; mientras dura, sigues moviendo, rotando y soltando la pieza.    |

La bomba y el rayo suman **20 puntos × nivel** por cada bloque destruido. Los demás no puntúan por sí mismos: su premio son las líneas que te dejan completar (la gravedad, de hecho, puede cerrar filas al compactar y se limpian al instante).

**Los comodines** (celdas violetas con un rombo) son la parte interesante del tinte: cuentan como celda llena para completar una línea, pero **las piezas los atraviesan y los sobrescriben**, así que abren paso dentro de una pila mal hecha — incluso hacia los huecos que dejan las tuercas fijadas.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, `POWER-UP`, vista de la siguiente pieza, la lista de controles y la leyenda de power-ups.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8 para las piezas, 14 para un comodín) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`). La tuerca (`PIECES[8]`) es el anillo `3 × 3` con el centro a `0`: es simétrica, así que rotarla no cambia nada.
- **Agujero de la tuerca** (`drawNutHole`): la celda central se pinta como un anillo (rectángulo con un círculo recortado mediante `fill('evenodd')`) mientras la pieza cae y en la vista previa; una vez fijada, el centro es simplemente una celda vacía del tablero.
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Power-ups** (`applyPowerUp`): `clearLines` marca `pendingPowerUp` cada `POWERUP_EVERY` líneas y `randomPiece` devuelve entonces una pieza especial. `lockPiece` llama a `applyPowerUp` **en lugar de** `merge`, así que su valor nunca llega al tablero: solo queda el efecto (`blast`, `bolt`, `dye`, `compact` o `freezeMs`). El congelado se descuenta con el `dt` del bucle, de modo que pausar no lo consume.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~570 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 8 colores             |
| `NUT_CHANCE`   | Probabilidad de que salga una tuerca     | `0.12`                |
| `POWERUP_EVERY`| Líneas entre power-ups                   | `5`                   |
| `POWERUP_SCORE`| Puntos por bloque destruido (× nivel)    | `20`                  |
| `FREEZE_MS`    | Duración del congelado en ms             | `5000`                |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Skins visuales

El panel lateral tiene un selector **SKIN** que cambia el aspecto completo del juego
sin recargar la página ni perder la partida en curso: se cambian la paleta y la
función que dibuja cada bloque, y se repintan el tablero y la vista previa.

| Skin          | Aspecto                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| **Retro**     | Bloques cuadrados y colores planos con una franja de brillo. Es el de siempre. |
| **Neón**      | Fondo de tablero negro, relleno tenue y contorno luminoso (halo en el canvas). |
| **Pastel**    | Colores suaves y esquinas redondeadas.                                        |
| **Pixel art** | Colores saturados, bisel de un píxel y una trama de puntos sobre cada bloque.  |

La elección se guarda en `localStorage` bajo la clave `tetris-skin`. Si el valor
guardado no es una de las cuatro claves (`retro`, `neon`, `pastel`, `pixel`), se
usa `retro`.

**Skin y tema son independientes.** El interruptor *modo claro* sigue funcionando
igual y sigue guardándose en `tetris-theme`: cada skin define sus colores de
rejilla para los dos temas. La única excepción es **Neón**, que fuerza el fondo
oscuro del tablero también en modo claro (clase `body.skin-neon` en `style.css`),
porque el efecto de glow solo se ve sobre negro.

Para añadir un skin nuevo hacen falta cuatro cosas, todas con la misma clave:

1. Una paleta en `SKIN_PALETTES` con **exactamente los mismos 15 índices que
   `COLORS`** (`null` en el 0 y un color por tipo de pieza hasta el comodín, 14).
   El índice del color es el tipo de pieza, así que reordenarla recolorea piezas.
2. Una función `drawBlock<Nombre>(context, x, y, colorIndex, size, alpha)`
   registrada en `SKIN_RENDERERS`, que **debe dejar el contexto limpio** al salir
   (`globalAlpha`, `shadowBlur`, `lineWidth`).
3. Una entrada en `SKIN_GRIDS` con sus variantes `dark` y `light`.
4. Una `<option>` en el `<select id="skin-select">` de `index.html` (y, si el
   tablero necesita otro fondo, una regla `body.skin-<clave>` en `style.css`).

Opcionalmente, una entrada en `SKIN_GLYPH_INK` (tinta de los símbolos de
power-up) y otra en `SKIN_NUT_ALPHA` (opacidad del anillo de la tuerca). Si se
omiten se usan los valores por defecto (`GLYPH_INK` y `1`).

---

## Menú de pausa

Al pausar (<kbd>P</kbd> o <kbd>Esc</kbd>) el overlay deja de ser un simple cartel de `PAUSA` y
muestra un menú navegable con cuatro opciones:

| Opción | Qué hace |
| ------- | --------- |
| **Reanudar** | Vuelve a la partida, igual que pulsar <kbd>P</kbd> otra vez. |
| **Reiniciar** | Empieza una partida nueva sin recargar la página. |
| **Ver controles** | Despliega la lista de teclas dentro del propio menú. |
| **Nivel inicial** | Selector de 1 a 10 que se aplica a la **próxima** partida. |

Detalles:

- Se abre y se cierra con <kbd>P</kbd> o <kbd>Esc</kbd>, y con el ratón desde las opciones.
  <kbd>↑</kbd> y <kbd>↓</kbd> mueven el foco entre los botones y <kbd>Tab</kbd> recorre todo el
  menú sin salirse de él; al selector de nivel se llega con <kbd>Tab</kbd> o con el ratón, y
  allí las flechas cambian el valor.
- Mientras el menú está abierto el juego no recibe teclas: no se mueve, ni rota, ni cae la
  pieza. Al reanudar se le quita el foco al botón pulsado, para que <kbd>Space</kbd> o
  <kbd>Enter</kbd> no lo vuelvan a activar sin querer.
- El nivel inicial se guarda en `localStorage` bajo la clave `tetris-start-level` y se
  recupera al cargar la página. La partida arranca en ese nivel con su velocidad de caída
  correspondiente, y a partir de ahí sube una vez cada 10 líneas
  (`nivel = nivel de inicio de la partida + líneas / 10`). Cambiar el selector con una
  partida en marcha no la altera: el nivel de arranque se copia al empezar.
- El menú solo aparece en pausa: en *game over* el overlay sigue mostrando la puntuación y
  el botón **Reiniciar** de siempre.

## Tabla de records local

Las mejores partidas se guardan en el navegador con `localStorage`, así que sobreviven a recargas y cierres del navegador (son locales: no se comparten entre equipos ni navegadores).

- **Pantalla de inicio**: al abrir el juego ya no empieza la partida sola. Primero aparece la pantalla de inicio con el **top 5**, el **mejor combo** y las **líneas máximas** históricas, y dos botones: **Jugar** y **Borrar records**.
- **Top 5 con nombre**: al terminar la partida, si la puntuación entra en el top 5 aparece un campo para escribir el nombre (por defecto `Jugador`, máximo 12 caracteres). Se guarda con **Guardar** o pulsando <kbd>Enter</kbd>.
- **Fila resaltada**: tras guardar, la fila de la partida recién terminada se marca en color en la tabla del game over. Si pulsas **Reiniciar** sin guardar, la puntuación se guarda igualmente con el nombre que hubiera en el campo.
- **Menú**: el botón **Menú** del game over vuelve a la pantalla de inicio (es la forma de volver a ver la tabla completa y el botón de borrar sin recargar).
- **Combo**: racha de piezas consecutivas que limpian al menos una línea. Sube una vez por pieza (no una por línea) y se rompe cuando una pieza se fija sin completar ninguna. Los power-ups se consumen en vez de fijarse, así que **no rompen la racha**; si su efecto completa filas, la alargan igual que una pieza normal. De cada partida se guarda su mejor racha.
- **Borrar records**: pide confirmación y vacía las claves de `localStorage`, refrescando la tabla en pantalla.

Claves usadas (mismo prefijo que el tema, `tetris-`):

| Clave                  | Contenido                                                                     |
| ---------------------- | ----------------------------------------------------------------------------- |
| `tetris-records`       | `[{ name, score, lines, level, combo, date }]` ordenado por `score` desc, máx. 5 |
| `tetris-records-best`  | `{ combo, lines }`: mejor combo y líneas máximas de todas las partidas         |

Si el navegador no deja escribir en `localStorage` (modo privado, cuota llena), el juego lo detecta: no pide el nombre —guardar no haría nada— y la tabla lo dice en vez de fingir que no hay records.

Lo que se lee de `localStorage` se trata como **entrada no confiable**: el `JSON.parse` va en `try/catch`, se descarta cualquier entrada que no tenga los campos y tipos esperados, y el nombre del jugador se pinta siempre con `textContent` (nunca con `innerHTML`) y recortado a 12 caracteres.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
