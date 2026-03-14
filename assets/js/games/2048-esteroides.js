// ════════════════════════════════════
//   2048 CON ESTEROIDES — Lógica
// ════════════════════════════════════

(() => {
  'use strict';

  // ── Estado ──────────────────────────────────────────────
  let SIZE        = 4;
  let grid        = [];      // matriz SIZE×SIZE de valores
  let score       = 0;
  let best        = parseInt(localStorage.getItem('2048-best') || '0');
  let moves       = 0;
  let combo       = 0;
  let history     = [];      // para deshacer
  let gameOver    = false;
  let won         = false;
  let activePU    = null;    // powerup activo
  let puCounts    = { bomb: 3, shuffle: 2, double: 1 };

  // ── DOM ──────────────────────────────────────────────────
  const container   = document.getElementById('game-container');
  const scoreEl     = document.getElementById('score');
  const bestEl      = document.getElementById('best');
  const movesEl     = document.getElementById('moves');
  const comboEl     = document.getElementById('combo');
  const undoBtn     = document.getElementById('undo-btn');
  const overlay     = document.getElementById('overlay');
  const overlayTitle= document.getElementById('overlay-title');
  const overlayScore= document.getElementById('overlay-score');
  const overlayBtn  = document.getElementById('overlay-btn');

  // ── INIT ─────────────────────────────────────────────────
  function init() {
    grid     = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score    = 0;
    moves    = 0;
    combo    = 0;
    history  = [];
    gameOver = false;
    won      = false;
    activePU = null;
    puCounts = { bomb: 3, shuffle: 2, double: 1 };

    overlay.classList.add('hidden');
    undoBtn.disabled = true;

    updateBoardCSS();
    spawnTile();
    spawnTile();
    renderAll();
    updateScoreDisplay();
    updatePUButtons();
  }

  // ── TABLERO CSS ─────────────────────────────────────────
  function updateBoardCSS() {
    const w = Math.min(340, window.innerWidth - 32);
    container.style.width  = w + 'px';
    container.style.height = w + 'px';
    container.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    container.style.gridTemplateRows    = `repeat(${SIZE}, 1fr)`;
    // Ajuste de tamaño de fuente dinámico
    const base = Math.floor(w / SIZE / 2);
    container.style.setProperty('--tile-font', base + 'px');
  }

  // ── RENDER ───────────────────────────────────────────────
  function renderAll(newPos = [], mergePos = []) {
    container.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val  = grid[r][c];
        const tile = document.createElement('div');
        const key  = r * SIZE + c;
        tile.className = 'tile ' + tileClass(val);
        tile.textContent = val > 0 ? val : '';

        if (newPos.includes(key))   tile.classList.add('new-tile');
        if (mergePos.includes(key)) tile.classList.add('merge-tile');

        // Powerup click
        tile.addEventListener('click', () => onTileClick(r, c));
        container.appendChild(tile);
      }
    }
  }

  function tileClass(val) {
    if (val === 0)    return 't-0';
    if (val <= 8192)  return 't-' + val;
    return 't-high';
  }

  // ── SPAWN ────────────────────────────────────────────────
  function spawnTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 0) empty.push([r, c]);

    if (empty.length === 0) return null;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.85 ? 2 : 4;
    return r * SIZE + c;
  }

  // ── MOVER ────────────────────────────────────────────────
  function move(dir) {
    if (gameOver) return;

    saveHistory();

    let moved   = false;
    let mergePos = [];
    let gained   = 0;

    // Transponer / voltear para reutilizar lógica de "mover izquierda"
    let g = copyGrid();
    if (dir === 'up'   || dir === 'down') g = transpose(g);
    if (dir === 'right'|| dir === 'down') g = g.map(r => r.reverse());

    for (let r = 0; r < SIZE; r++) {
      const { row, score: s, merges } = slideLeft(g[r]);
      merges.forEach(c => {
        let realR = r, realC = c;
        if (dir === 'right' || dir === 'down') realC = SIZE - 1 - c;
        if (dir === 'up' || dir === 'down') [realR, realC] = [realC, realR];
        mergePos.push(realR * SIZE + realC);
      });
      if (row.join() !== g[r].join()) moved = true;
      g[r] = row;
      gained += s;
    }

    if (dir === 'right'|| dir === 'down') g = g.map(r => r.reverse());
    if (dir === 'up'   || dir === 'down') g = transpose(g);

    if (!moved) {
      history.pop();
      return;
    }

    grid = g;
    score += gained;
    moves++;

    // Combo
    if (gained > 0) {
      combo++;
      score += gained * (combo - 1); // bonus combo
    } else {
      combo = 0;
    }

    if (score > best) {
      best = score;
      localStorage.setItem('2048-best', best);
    }

    const newIdx = spawnTile();
    renderAll(newIdx !== null ? [newIdx] : [], mergePos);
    updateScoreDisplay();

    if (gained > 0) {
      floatParticle('+' + gained, '#f7c948');
      if (combo > 2) floatParticle('🔥 x' + combo, '#ff6b6b');
    }

    checkWin();
    if (!won) checkLose();

    undoBtn.disabled = history.length === 0;
  }

  function slideLeft(row) {
    let arr    = row.filter(v => v !== 0);
    let score  = 0;
    let merges = [];

    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i]   *= 2;
        score    += arr[i];
        merges.push(i);
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return { row: arr, score, merges };
  }

  function transpose(g) {
    return g[0].map((_, c) => g.map(r => r[c]));
  }

  function copyGrid() {
    return grid.map(r => [...r]);
  }

  // ── HISTORIAL (deshacer) ─────────────────────────────────
  function saveHistory() {
    history.push({
      grid:  copyGrid(),
      score, moves, combo
    });
    if (history.length > 5) history.shift();
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history.pop();
    grid  = prev.grid;
    score = prev.score;
    moves = prev.moves;
    combo = prev.combo;
    gameOver = false;
    won      = false;
    overlay.classList.add('hidden');
    renderAll();
    updateScoreDisplay();
    undoBtn.disabled = history.length === 0;
  }

  // ── PUNTUACIÓN ───────────────────────────────────────────
  function updateScoreDisplay() {
    animVal(scoreEl, score);
    animVal(bestEl,  best);
    movesEl.textContent = moves;
    comboEl.textContent = combo > 1 ? 'x' + combo : 'x1';
  }

  function animVal(el, val) {
    el.textContent = val;
    el.classList.remove('score-bump');
    void el.offsetWidth;
    el.classList.add('score-bump');
  }

  // ── WIN / LOSE ───────────────────────────────────────────
  function checkWin() {
    if (won) return;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 2048) {
          won = true;
          showOverlay('🏆 ¡Ganaste!', '¡Llegaste a 2048! Puedes seguir jugando.');
          return;
        }
  }

  function checkLose() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return;
        if (c < SIZE-1 && grid[r][c] === grid[r][c+1]) return;
        if (r < SIZE-1 && grid[r][c] === grid[r+1][c]) return;
      }
    gameOver = true;
    showOverlay('💀 Game Over', `Puntuación final: ${score}`);
  }

  function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlayScore.textContent = sub;
    overlay.classList.remove('hidden');
  }

  // ── POWERUPS ─────────────────────────────────────────────
  function updatePUButtons() {
    ['bomb', 'shuffle', 'double'].forEach(pu => {
      const btn   = document.getElementById('pu-' + pu);
      const count = document.getElementById('pu-' + pu + '-count');
      count.textContent = puCounts[pu];
      btn.disabled = puCounts[pu] <= 0;
      btn.classList.toggle('active-pu', activePU === pu);
    });
  }

  function activatePU(pu) {
    if (puCounts[pu] <= 0) return;
    activePU = activePU === pu ? null : pu;

    if (pu === 'shuffle' && activePU === 'shuffle') {
      doShuffle();
      activePU = null;
    }
    updatePUButtons();
  }

  function onTileClick(r, c) {
    if (!activePU) return;

    if (activePU === 'bomb') {
      if (grid[r][c] === 0) return;
      saveHistory();
      grid[r][c] = 0;
      puCounts.bomb--;
      floatParticle('💣', '#ff6b6b');
    }

    if (activePU === 'double') {
      if (grid[r][c] === 0) return;
      saveHistory();
      grid[r][c] *= 2;
      score += grid[r][c];
      puCounts.double--;
      floatParticle('✖2 ' + grid[r][c], '#34d399');
    }

    activePU = null;
    renderAll();
    updateScoreDisplay();
    updatePUButtons();
    undoBtn.disabled = false;
  }

  function doShuffle() {
    saveHistory();
    const vals = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] > 0) vals.push(grid[r][c]);

    // Fisher-Yates
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }

    let idx = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] > 0) grid[r][c] = vals[idx++];

    puCounts.shuffle--;
    floatParticle('🔀', '#38bdf8');
    renderAll();
    undoBtn.disabled = false;
  }

  // ── PARTÍCULAS ───────────────────────────────────────────
  function floatParticle(text, color) {
    const p = document.createElement('div');
    p.className   = 'particle';
    p.textContent = text;
    p.style.color = color;
    p.style.left  = (container.getBoundingClientRect().left +
                     Math.random() * container.offsetWidth) + 'px';
    p.style.top   = (container.getBoundingClientRect().top  + 20) + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  // ── TECLADO ──────────────────────────────────────────────
  const keyMap = {
    ArrowUp   : 'up',
    ArrowDown : 'down',
    ArrowLeft : 'left',
    ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  document.addEventListener('keydown', e => {
    const dir = keyMap[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  });

  // ── TOUCH / SWIPE ────────────────────────────────────────
  let touchStart = null;

  container.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  container.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const minSwipe = 30;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipe) move(dx > 0 ? 'right' : 'left');
    } else {
      if (Math.abs(dy) > minSwipe) move(dy > 0 ? 'down' : 'up');
    }
    touchStart = null;
  }, { passive: true });

  // ── TAMAÑOS ──────────────────────────────────────────────
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SIZE = parseInt(btn.dataset.size);
      document.querySelectorAll('.size-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      init();
    });
  });

  // ── BOTONES ──────────────────────────────────────────────
  document.getElementById('restart-btn').addEventListener('click', init);
  undoBtn.addEventListener('click', undo);
  overlayBtn.addEventListener('click', init);

  document.getElementById('pu-bomb')   .addEventListener('click', () => activatePU('bomb'));
  document.getElementById('pu-shuffle').addEventListener('click', () => activatePU('shuffle'));
  document.getElementById('pu-double') .addEventListener('click', () => activatePU('double'));

  // ── RESIZE ───────────────────────────────────────────────
  window.addEventListener('resize', () => {
    updateBoardCSS();
    renderAll();
  });

  // ── ARRANCAR ─────────────────────────────────────────────
  bestEl.textContent = best;
  init();

})();