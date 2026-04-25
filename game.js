(() => {
  'use strict';

  const KEY_PREFIX = 'ns6-';
  const $ = id => document.getElementById(id);
  const screens = { menu: $('menu-screen'), setup: $('setup-screen'), game: $('game-screen') };
  const MODES = {
    antimagic: {
      name: 'Anti-Magic Squares',
      badge: 'Unique Sums',
      subtitle: 'Make every line sum unique and sequential.'
    },
    alphamagic: {
      name: 'Alphanametics',
      badge: 'Word-Magic',
      subtitle: 'Magic in numbers and in English letter counts.'
    }
  };
  const DIFFS = ['easy', 'medium', 'hard'];
  const ANTI_SOLUTIONS = {
    easy: [[7,13,1,9],[3,11,15,6],[16,8,4,10],[5,2,12,14]],
    medium: [[9,23,13,20,3],[16,12,5,21,15],[10,2,11,17,22],[25,19,14,8,1],[6,7,18,4,24]],
    hard: [[4,36,13,15,18,21],[27,32,6,23,20,2],[19,12,5,22,25,34],[33,11,35,29,3,1],[26,7,30,10,14,24],[9,8,16,17,28,31]]
  };
  const ALPHA_PUZZLES = [
    { difficulty:'easy', title:'Thousand Step', solution:[[2745,1667,2437],[1975,2283,2591],[2129,2899,1821]], numberMagicSum:6849, wordLengthMagicSum:105 },
    { difficulty:'easy', title:'Even Chorus', solution:[[7661,4196,6671],[5186,6176,7166],[5681,8156,4691]], numberMagicSum:18528, wordLengthMagicSum:102 },
    { difficulty:'easy', title:'Twin Lights', solution:[[7663,4198,6673],[5188,6178,7168],[5683,8158,4693]], numberMagicSum:18534, wordLengthMagicSum:108 },
    { difficulty:'medium', title:'Green Meridian', solution:[[5913,3589,5249],[4253,4917,5581],[4585,6245,3921]], numberMagicSum:14751, wordLengthMagicSum:105 },
    { difficulty:'medium', title:'Gold Count', solution:[[7762,4297,6772],[5287,6277,7267],[5782,8257,4792]], numberMagicSum:18831, wordLengthMagicSum:108 },
    { difficulty:'medium', title:'Ninefold', solution:[[7861,4396,6871],[5386,6376,7366],[5881,8356,4891]], numberMagicSum:19128, wordLengthMagicSum:108 },
    { difficulty:'hard', title:'Long Names', solution:[[7863,4398,6873],[5388,6378,7368],[5883,8358,4893]], numberMagicSum:19134, wordLengthMagicSum:114 },
    { difficulty:'hard', title:'Silver Count', solution:[[7963,4498,6973],[5488,6478,7468],[5983,8458,4993]], numberMagicSum:19434, wordLengthMagicSum:111 },
    { difficulty:'hard', title:'Close Sequence', solution:[[7964,4499,6974],[5489,6479,7469],[5984,8459,4994]], numberMagicSum:19437, wordLengthMagicSum:108 }
  ];
  const LINES_3 = [[0,0,0,1,0,2,'R1'],[1,0,1,1,1,2,'R2'],[2,0,2,1,2,2,'R3'],[0,0,1,0,2,0,'C1'],[0,1,1,1,2,1,'C2'],[0,2,1,2,2,2,'C3'],[0,0,1,1,2,2,'D1'],[0,2,1,1,2,0,'D2']];

  let gameMode = 'antimagic';
  let difficulty = 'medium';
  let gridSize = 5;
  let solution = [], puzzle = [], playerGrid = [];
  let currentAlphaPuzzle = null;
  let selectedCell = null, selectedTray = null;
  let moveHistory = [];
  let timerStart = 0, timerRAF = 0, moveCount = 0, hintsUsed = 0, checksUsed = 0, gameSerial = 0;
  let dragState = null;
  let suppressTrayClickUntil = 0;
  let audioCtx = null;
  let soundEnabled = localStorage.getItem(KEY_PREFIX + 'sound') !== 'off';
  let darkMode = localStorage.getItem(KEY_PREFIX + 'theme') === 'dark';

  function cloneGrid(g) { return g.map(row => row.slice()); }
  function flat(g) { return g.reduce((a, r) => a.concat(r), []); }
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function showScreen(name) { Object.values(screens).forEach(s => s.classList.remove('active')); screens[name].classList.add('active'); if (name !== 'game') stopTimer(); }
  function storageJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(KEY_PREFIX + key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function saveJSON(key, value) { localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value)); }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
    $('theme-toggle').textContent = darkMode ? 'Moon' : 'Sun';
    localStorage.setItem(KEY_PREFIX + 'theme', darkMode ? 'dark' : 'light');
  }
  function updateMuteBtn() { $('mute-toggle').textContent = soundEnabled ? 'Sound' : 'Mute'; }
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function tone(freq, dur = .08, type = 'sine', vol = .08) {
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + .006);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + dur);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + dur + .03);
  }
  const sfx = {
    tap: () => tone(660, .05, 'triangle', .07),
    place: () => { tone(260, .08, 'sine', .1); setTimeout(() => tone(390, .06, 'triangle', .06), 45); },
    error: () => tone(140, .18, 'sawtooth', .06),
    hint: () => { [880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, .11, 'sine', .07), i * 60)); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .22, 'sine', .1), i * 110))
  };

  function getModeStats(mode) { return storageJSON(`stats-${mode}`, {}); }
  function saveModeStats(mode, stats) { saveJSON(`stats-${mode}`, stats); }
  function getScoreKey() { return `score-${gameMode}-${difficulty}`; }
  function getBestScore() { return parseInt(localStorage.getItem(KEY_PREFIX + getScoreKey()) || '0', 10); }
  function saveBestScore(score) { const best = getBestScore(); if (score > best) { localStorage.setItem(KEY_PREFIX + getScoreKey(), String(score)); return true; } return false; }
  function recordWin(score, stars) {
    const stats = getModeStats(gameMode);
    stats.totalWins = (stats.totalWins || 0) + 1;
    stats.totalStars = (stats.totalStars || 0) + stars;
    stats.overallBest = Math.max(stats.overallBest || 0, score);
    saveModeStats(gameMode, stats);
  }
  function getBasePoints() {
    const diffMult = { easy: 1, medium: 1.8, hard: 3 };
    const modeMult = gameMode === 'antimagic' ? gridSize * .55 : 2.2;
    return Math.round(520 * diffMult[difficulty] * modeMult);
  }
  function calculateScore() {
    const elapsed = Math.floor((performance.now() - timerStart) / 1000);
    const base = getBasePoints();
    const timePenalty = Math.min(base * .45, Math.floor(elapsed / 12) * Math.round(base * .015));
    const hintPenalty = hintsUsed * Math.round(base * .12);
    const checkPenalty = Math.max(0, checksUsed - 1) * Math.round(base * .04);
    const movePenalty = Math.max(0, moveCount - countEmptyInPuzzle()) * Math.round(base * .01);
    return { base, elapsed, timePenalty, hintPenalty, checkPenalty, movePenalty, total: Math.max(0, Math.round(base - timePenalty - hintPenalty - checkPenalty - movePenalty)) };
  }
  function getStars(score) { const ratio = score / getBasePoints(); return ratio >= .78 ? 3 : ratio >= .5 ? 2 : 1; }
  function countEmptyInPuzzle() { return flat(puzzle).filter(v => v === 0).length; }
  function updateLiveScore() { $('live-score').textContent = calculateScore().total.toLocaleString(); }
  function startTimer() {
    timerStart = performance.now();
    const serial = gameSerial;
    const tick = () => {
      if (serial !== gameSerial) return;
      const s = Math.floor((performance.now() - timerStart) / 1000);
      $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      updateLiveScore();
      timerRAF = requestAnimationFrame(tick);
    };
    timerRAF = requestAnimationFrame(tick);
  }
  function stopTimer() { gameSerial++; if (timerRAF) cancelAnimationFrame(timerRAF); timerRAF = 0; }

  function updateMenuScores() {
    ['antimagic', 'alphamagic'].forEach(mode => {
      const stats = getModeStats(mode);
      $(`menu-${mode}-best`).textContent = stats.overallBest ? stats.overallBest.toLocaleString() : '-';
      $(`menu-${mode}-wins`).textContent = stats.totalWins || 0;
      $(`menu-${mode}-stars`).textContent = stats.totalStars || 0;
    });
  }
  function updateSetupBest() {
    const best = getBestScore();
    $('setup-best').innerHTML = best
      ? `<div class="setup-best-label">Best for this setup</div><div class="setup-best-value">${best.toLocaleString()}</div>`
      : '<div class="setup-best-label">No score yet</div>';
  }
  function openSetup(mode) {
    gameMode = mode;
    $('setup-title').textContent = MODES[mode].name;
    $('setup-subtitle').textContent = MODES[mode].subtitle;
    updateSetupBest();
    showScreen('setup');
  }

  function generateAntiMagic(diff) {
    const base = cloneGrid(ANTI_SOLUTIONS[diff]);
    const n = base.length;
    const transforms = [
      b => b,
      b => b.map(row => row.slice().reverse()),
      b => b.slice().reverse(),
      b => b[0].map((_, c) => b.map(row => row[c])),
      b => b[0].map((_, c) => b.map(row => row[n - 1 - c])),
      b => b.slice().reverse()[0].map((_, c) => b.slice().reverse().map(row => row[c]))
    ];
    solution = cloneGrid(transforms[Math.floor(Math.random() * transforms.length)](base));
    gridSize = n;
    const ratio = { easy: .35, medium: .25, hard: .15 }[diff];
    const keep = Math.max(2, Math.round(n * n * ratio));
    const cells = shuffle([...Array(n * n).keys()]).slice(0, keep);
    puzzle = Array.from({ length: n }, () => Array(n).fill(0));
    cells.forEach(i => { const r = Math.floor(i / n), c = i % n; puzzle[r][c] = solution[r][c]; });
    playerGrid = cloneGrid(puzzle);
  }
  function renderAntiMagicGrid() {
    const grid = document.createElement('div');
    grid.className = `grid size-${gridSize}`;
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    const errors = getAntiMagicErrors();
    for (let r = 0; r < gridSize; r++) for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      const val = playerGrid[r][c];
      if (puzzle[r][c]) cell.classList.add('given');
      else if (val) cell.classList.add('filled');
      if (selectedCell && selectedCell.r === r && selectedCell.c === c) cell.classList.add('selected');
      if (errors.cells.has(`${r},${c}`)) cell.classList.add('error');
      cell.textContent = val || '';
      cell.addEventListener('click', () => selectCell(r, c));
      cell.addEventListener('dragover', ev => ev.preventDefault());
      cell.addEventListener('drop', ev => { ev.preventDefault(); const num = parseInt(ev.dataTransfer.getData('text/plain'), 10); if (num) placeNumber(r, c, num); });
      grid.appendChild(cell);
    }
    $('grid-container').replaceChildren(grid);
  }
  function renderAntiMagicTray() {
    const used = new Set(flat(playerGrid).filter(Boolean));
    const tray = $('tray'); tray.innerHTML = '';
    for (let n = 1; n <= gridSize * gridSize; n++) {
      const btn = makeTrayButton(n, used.has(n));
      tray.appendChild(btn);
    }
  }
  function getAntiMagicLineSums() {
    const lines = [];
    for (let r = 0; r < gridSize; r++) lines.push({ key:`R${r + 1}`, cells:[...Array(gridSize)].map((_, c) => [r, c]) });
    for (let c = 0; c < gridSize; c++) lines.push({ key:`C${c + 1}`, cells:[...Array(gridSize)].map((_, r) => [r, c]) });
    lines.push({ key:'D1', cells:[...Array(gridSize)].map((_, i) => [i, i]) });
    lines.push({ key:'D2', cells:[...Array(gridSize)].map((_, i) => [i, gridSize - 1 - i]) });
    return lines.map(line => {
      const values = line.cells.map(([r, c]) => playerGrid[r][c]);
      return { ...line, complete: values.every(Boolean), sum: values.every(Boolean) ? values.reduce((a, b) => a + b, 0) : values.reduce((a, b) => a + (b || 0), 0) };
    });
  }
  function getAntiMagicErrors() {
    const cells = new Set(), lineStates = {};
    const counts = {};
    flat(playerGrid).filter(Boolean).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    playerGrid.forEach((row, r) => row.forEach((v, c) => { if (v && (v < 1 || v > gridSize * gridSize || counts[v] > 1)) cells.add(`${r},${c}`); }));
    const sums = getAntiMagicLineSums();
    const complete = sums.filter(s => s.complete);
    const sumCounts = {};
    complete.forEach(s => { sumCounts[s.sum] = (sumCounts[s.sum] || 0) + 1; });
    complete.forEach(s => {
      if (sumCounts[s.sum] > 1) { lineStates[s.key] = 'duplicate'; s.cells.forEach(([r, c]) => cells.add(`${r},${c}`)); }
    });
    if (complete.length === sums.length) {
      const sorted = complete.map(s => s.sum).sort((a, b) => a - b);
      const ok = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
      if (!ok) {
        const good = new Set();
        for (let i = 0; i < sorted.length; i++) {
          if ((i === 0 || sorted[i] === sorted[i - 1] + 1) && (i === sorted.length - 1 || sorted[i + 1] === sorted[i] + 1)) good.add(sorted[i]);
        }
        complete.forEach(s => { if (!good.has(s.sum) && lineStates[s.key] !== 'duplicate') lineStates[s.key] = 'sequence'; });
      }
    }
    return { cells, lineStates };
  }
  function isAntiMagicComplete() {
    const nums = flat(playerGrid);
    if (nums.some(v => !v)) return false;
    const set = new Set(nums);
    if (set.size !== gridSize * gridSize || nums.some(v => v < 1 || v > gridSize * gridSize)) return false;
    const sums = getAntiMagicLineSums().map(x => x.sum).sort((a, b) => a - b);
    return new Set(sums).size === sums.length && sums.every((v, i) => i === 0 || v === sums[i - 1] + 1);
  }

  function numberToWordsBritish(n) {
    const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    if (!Number.isInteger(n) || n < 0 || n > 999999) throw new Error(`Unsupported number: ${n}`);
    if (n === 0) return 'zero';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberToWordsBritish(n % 100) : '');
    return numberToWordsBritish(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberToWordsBritish(n % 1000) : '');
  }
  function wordLength(n) { return numberToWordsBritish(n).replace(/[\s-]/g, '').length; }
  function validateAlphamagicPuzzle(p) {
    const vals = flat(p.solution);
    if (vals.length !== 9 || new Set(vals).size !== 9) return false;
    const numberSums = alphaLineSums(p.solution, n => n);
    const wordSums = alphaLineSums(p.solution, wordLength);
    return numberSums.every(x => x.sum === p.numberMagicSum) && wordSums.every(x => x.sum === p.wordLengthMagicSum);
  }
  function loadAlphamagicPuzzle(diff) {
    const bank = ALPHA_PUZZLES.filter(p => p.difficulty === diff);
    currentAlphaPuzzle = bank[Math.floor(Math.random() * bank.length)];
    solution = cloneGrid(currentAlphaPuzzle.solution);
    gridSize = 3;
    puzzle = Array.from({ length: 3 }, () => Array(3).fill(0));
    playerGrid = cloneGrid(puzzle);
  }
  function renderAlphamagicGrid() {
    const grid = document.createElement('div');
    grid.className = 'grid size-3';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    const errors = getAlphamagicErrors();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      if (playerGrid[r][c]) cell.classList.add('filled');
      if (selectedCell && selectedCell.r === r && selectedCell.c === c) cell.classList.add('selected');
      if (errors.cells.has(`${r},${c}`)) cell.classList.add('error');
      cell.textContent = playerGrid[r][c] || '';
      cell.addEventListener('click', () => selectCell(r, c));
      cell.addEventListener('dragover', ev => ev.preventDefault());
      cell.addEventListener('drop', ev => { ev.preventDefault(); const num = parseInt(ev.dataTransfer.getData('text/plain'), 10); if (num) placeNumber(r, c, num); });
      grid.appendChild(cell);
    }
    $('grid-container').replaceChildren(grid);
  }
  function renderAlphamagicTray() {
    const used = new Set(flat(playerGrid).filter(Boolean));
    const tray = $('tray'); tray.innerHTML = '';
    shuffle(flat(solution)).forEach(num => tray.appendChild(makeTrayButton(num, used.has(num))));
  }
  function alphaLineSums(grid, mapper) {
    return LINES_3.map(line => {
      const cells = [[line[0], line[1]], [line[2], line[3]], [line[4], line[5]]];
      const values = cells.map(([r, c]) => grid[r][c]);
      return { key: line[6], cells, complete: values.every(Boolean), sum: values.every(Boolean) ? values.map(mapper).reduce((a, b) => a + b, 0) : values.reduce((a, b) => a + (b ? mapper(b) : 0), 0) };
    });
  }
  function getAlphamagicErrors() {
    const cells = new Set(), lineStates = {};
    const allowed = new Set(flat(solution)), counts = {};
    flat(playerGrid).filter(Boolean).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    playerGrid.forEach((row, r) => row.forEach((v, c) => { if (v && (!allowed.has(v) || counts[v] > 1)) cells.add(`${r},${c}`); }));
    const nSums = alphaLineSums(playerGrid, n => n);
    const wSums = alphaLineSums(playerGrid, wordLength);
    nSums.forEach((line, i) => {
      if (!line.complete) return;
      const bad = line.sum !== currentAlphaPuzzle.numberMagicSum || wSums[i].sum !== currentAlphaPuzzle.wordLengthMagicSum;
      if (bad) { lineStates[line.key] = 'sequence'; line.cells.forEach(([r, c]) => cells.add(`${r},${c}`)); }
    });
    return { cells, lineStates };
  }
  function isAlphamagicComplete() {
    if (flat(playerGrid).some(v => !v)) return false;
    const errors = getAlphamagicErrors();
    return errors.cells.size === 0 && validateAlphamagicPuzzle({ ...currentAlphaPuzzle, solution: playerGrid });
  }

  function makeTrayButton(num, used) {
    const btn = document.createElement('button');
    btn.className = 'tray-num' + (used ? ' used' : '') + (selectedTray === num ? ' selected' : '');
    btn.textContent = num;
    btn.draggable = false;
    btn.addEventListener('click', () => { if (!used && performance.now() > suppressTrayClickUntil) selectTray(num); });
    btn.addEventListener('pointerdown', ev => {
      if (!used) startPointerDrag(ev, num);
    });
    return btn;
  }
  function startPointerDrag(ev, num) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = num;
    document.body.appendChild(ghost);
    dragState = { num, ghost, startX: ev.clientX, startY: ev.clientY, active: false, over: null };
    movePointerDrag(ev);
    window.addEventListener('pointermove', movePointerDrag);
    window.addEventListener('pointerup', endPointerDrag, { once: true });
    window.addEventListener('pointercancel', cancelPointerDrag, { once: true });
  }
  function movePointerDrag(ev) {
    if (!dragState) return;
    const dx = ev.clientX - dragState.startX, dy = ev.clientY - dragState.startY;
    if (Math.hypot(dx, dy) > 6) dragState.active = true;
    dragState.ghost.style.left = `${ev.clientX}px`;
    dragState.ghost.style.top = `${ev.clientY}px`;
    dragState.ghost.style.display = dragState.active ? 'flex' : 'none';
    document.querySelectorAll('.cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
    dragState.ghost.style.visibility = 'hidden';
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.cell');
    dragState.ghost.style.visibility = 'visible';
    dragState.over = target || null;
    if (dragState.active && target) target.classList.add('drag-over');
    if (dragState.active) ev.preventDefault();
  }
  function endPointerDrag(ev) {
    if (!dragState) return;
    window.removeEventListener('pointermove', movePointerDrag);
    document.querySelectorAll('.cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
    const state = dragState;
    dragState = null;
    state.ghost.remove();
    if (!state.active) return;
    suppressTrayClickUntil = performance.now() + 350;
    const target = state.over || document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.cell');
    if (!target) return;
    const r = parseInt(target.dataset.r, 10), c = parseInt(target.dataset.c, 10);
    if (Number.isInteger(r) && Number.isInteger(c)) placeNumber(r, c, state.num);
  }
  function cancelPointerDrag() {
    if (!dragState) return;
    window.removeEventListener('pointermove', movePointerDrag);
    document.querySelectorAll('.cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
    dragState.ghost.remove();
    dragState = null;
  }
  function selectCell(r, c) {
    if (puzzle[r][c]) return;
    selectedCell = { r, c };
    if (selectedTray) placeNumber(r, c, selectedTray);
    else renderAll();
    sfx.tap();
  }
  function selectTray(num) {
    selectedTray = selectedTray === num ? null : num;
    if (selectedCell && selectedTray) placeNumber(selectedCell.r, selectedCell.c, selectedTray);
    else renderAll();
    sfx.tap();
  }
  function placeNumber(r, c, num) {
    if (puzzle[r][c]) return;
    const allowed = gameMode === 'antimagic' ? num >= 1 && num <= gridSize * gridSize : flat(solution).includes(num);
    if (!allowed) return;
    const old = playerGrid[r][c];
    if (old === num) return;
    moveHistory.push(cloneGrid(playerGrid));
    playerGrid[r][c] = num;
    moveCount++;
    selectedTray = null;
    selectedCell = { r, c };
    renderAll();
    const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (el) el.classList.add('pop-in');
    sfx.place();
    if ((gameMode === 'antimagic' && isAntiMagicComplete()) || (gameMode === 'alphamagic' && isAlphamagicComplete())) setTimeout(showWin, 240);
  }
  function renderTracker() {
    const tracker = $('tracker');
    tracker.innerHTML = '';
    const errors = gameMode === 'antimagic' ? getAntiMagicErrors() : getAlphamagicErrors();
    const sums = gameMode === 'antimagic' ? getAntiMagicLineSums() : alphaLineSums(playerGrid, n => n);
    sums.forEach((line, i) => {
      const item = document.createElement('div');
      const state = !line.complete ? 'incomplete' : errors.lineStates[line.key] || 'valid';
      item.className = `track-item ${state}`;
      const extra = gameMode === 'alphamagic' ? ` / ${alphaLineSums(playerGrid, wordLength)[i].sum}` : '';
      item.innerHTML = `<span class="track-label">${line.key}</span><span class="track-value">${line.sum}${extra}</span>`;
      tracker.appendChild(item);
    });
    $('target-strip').innerHTML = gameMode === 'alphamagic'
      ? `<span class="target-pill">${currentAlphaPuzzle.title}</span><span class="target-pill">Number target <strong>${currentAlphaPuzzle.numberMagicSum}</strong></span><span class="target-pill">Word target <strong>${currentAlphaPuzzle.wordLengthMagicSum}</strong></span>`
      : '<span class="target-pill">Line sums must be unique and consecutive</span>';
  }
  function renderAll() {
    if (gameMode === 'antimagic') { renderAntiMagicGrid(); renderAntiMagicTray(); }
    else { renderAlphamagicGrid(); renderAlphamagicTray(); }
    renderTracker();
  }

  function startGame() {
    stopTimer();
    selectedCell = null; selectedTray = null; moveHistory = []; moveCount = 0; hintsUsed = 0; checksUsed = 0;
    if (gameMode === 'antimagic') generateAntiMagic(difficulty);
    else loadAlphamagicPuzzle(difficulty);
    $('game-mode-label').textContent = `${MODES[gameMode].name} - ${difficulty.toUpperCase()}`;
    $('win-overlay').classList.remove('active');
    renderAll();
    showScreen('game');
    gameSerial++;
    startTimer();
  }
  function hint() {
    const empties = [];
    for (let r = 0; r < gridSize; r++) for (let c = 0; c < gridSize; c++) if (!playerGrid[r][c]) empties.push([r, c]);
    if (!empties.length) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    moveHistory.push(cloneGrid(playerGrid));
    playerGrid[r][c] = solution[r][c];
    hintsUsed++; moveCount++; selectedCell = { r, c };
    renderAll();
    document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`)?.classList.add('hint-glow');
    sfx.hint();
  }
  function check() {
    checksUsed++;
    const errors = gameMode === 'antimagic' ? getAntiMagicErrors() : getAlphamagicErrors();
    renderAll();
    if (errors.cells.size) {
      document.querySelectorAll('.cell.error').forEach(el => el.classList.add('shake'));
      sfx.error();
    } else sfx.tap();
    if ((gameMode === 'antimagic' && isAntiMagicComplete()) || (gameMode === 'alphamagic' && isAlphamagicComplete())) showWin();
  }
  function undo() {
    const prev = moveHistory.pop();
    if (!prev) return;
    playerGrid = prev; selectedCell = null; selectedTray = null; moveCount++;
    renderAll(); sfx.tap();
  }
  function clearGrid() {
    moveHistory.push(cloneGrid(playerGrid));
    playerGrid = cloneGrid(puzzle);
    selectedCell = null; selectedTray = null; moveCount++;
    renderAll(); sfx.error();
  }
  function showWin() {
    stopTimer();
    const score = calculateScore();
    const stars = getStars(score.total);
    const isBest = saveBestScore(score.total);
    recordWin(score.total, stars);
    updateMenuScores();
    $('win-stars').textContent = '***'.slice(0, stars) + '---'.slice(0, 3 - stars);
    $('win-score').textContent = score.total.toLocaleString();
    $('win-message').textContent = isBest ? 'New best score.' : `Best: ${getBestScore().toLocaleString()}`;
    $('score-breakdown').innerHTML = `
      <div class="score-line">Time<strong>${Math.floor(score.elapsed / 60)}:${String(score.elapsed % 60).padStart(2, '0')}</strong></div>
      <div class="score-line">Moves<strong>${moveCount}</strong></div>
      <div class="score-line">Hints<strong>${hintsUsed}</strong></div>
      <div class="score-line">Checks<strong>${checksUsed}</strong></div>`;
    $('win-overlay').classList.add('active');
    const ripple = document.createElement('div');
    ripple.className = 'win-ripple'; ripple.style.left = 'calc(50% - 60px)'; ripple.style.top = '74px';
    $('win-overlay').querySelector('.overlay-card').appendChild(ripple);
    setTimeout(() => ripple.remove(), 900);
    sfx.win();
  }

  function wireEvents() {
    $('theme-toggle').addEventListener('click', () => { darkMode = !darkMode; applyTheme(); });
    $('mute-toggle').addEventListener('click', () => { soundEnabled = !soundEnabled; localStorage.setItem(KEY_PREFIX + 'sound', soundEnabled ? 'on' : 'off'); updateMuteBtn(); if (soundEnabled) ensureAudio(); });
    document.addEventListener('touchstart', ensureAudio, { once:true });
    document.addEventListener('mousedown', ensureAudio, { once:true });
    document.querySelectorAll('.mode-card').forEach(card => {
      const run = () => { sfx.tap(); openSetup(card.dataset.mode); };
      card.addEventListener('click', run);
      card.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') run(); });
    });
    document.querySelectorAll('.diff-btn').forEach(btn => btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('selected', b === btn));
      updateSetupBest(); sfx.tap();
    }));
    $('setup-back').addEventListener('click', () => { updateMenuScores(); showScreen('menu'); });
    $('start-btn').addEventListener('click', startGame);
    $('back-btn').addEventListener('click', () => { updateMenuScores(); showScreen('menu'); });
    $('howto-btn').addEventListener('click', () => $('howto-overlay').classList.add('active'));
    $('close-howto').addEventListener('click', () => $('howto-overlay').classList.remove('active'));
    $('hint-btn').addEventListener('click', hint);
    $('check-btn').addEventListener('click', check);
    $('undo-btn').addEventListener('click', undo);
    $('clear-btn').addEventListener('click', clearGrid);
    $('play-again').addEventListener('click', startGame);
    $('win-menu').addEventListener('click', () => { $('win-overlay').classList.remove('active'); updateMenuScores(); showScreen('menu'); });
    document.addEventListener('keydown', ev => {
      if (!screens.game.classList.contains('active')) return;
      if (/^\d$/.test(ev.key) && selectedCell) {
        const digit = parseInt(ev.key, 10);
        if (gameMode === 'antimagic') placeNumber(selectedCell.r, selectedCell.c, digit);
      }
      if (ev.key === 'Backspace' && selectedCell && !puzzle[selectedCell.r][selectedCell.c]) {
        moveHistory.push(cloneGrid(playerGrid)); playerGrid[selectedCell.r][selectedCell.c] = 0; renderAll();
      }
    });
  }

  function validateAtLoad() {
    ALPHA_PUZZLES.forEach(p => {
      if (!validateAlphamagicPuzzle(p)) console.error('[Number Squarez 6] Invalid alphamagic puzzle:', p.title, p);
    });
    Object.entries(ANTI_SOLUTIONS).forEach(([diff, board]) => {
      const old = { solution, puzzle, playerGrid, gridSize };
      solution = cloneGrid(board); puzzle = cloneGrid(board); playerGrid = cloneGrid(board); gridSize = board.length;
      if (!isAntiMagicComplete()) console.error('[Number Squarez 6] Invalid anti-magic board:', diff);
      solution = old.solution; puzzle = old.puzzle; playerGrid = old.playerGrid; gridSize = old.gridSize;
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('[SW] registration failed', err)));
  }
  window.numberSquarez6Debug = { numberToWordsBritish, wordLength, validateAlphamagicPuzzle, loadAlphamagicPuzzle, generateAntiMagic, getAntiMagicLineSums, getAntiMagicErrors, isAntiMagicComplete, getAlphamagicErrors, isAlphamagicComplete };

  validateAtLoad();
  applyTheme();
  updateMuteBtn();
  updateMenuScores();
  updateSetupBest();
  wireEvents();
})();
