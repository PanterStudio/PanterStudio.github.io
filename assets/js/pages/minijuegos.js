/* minijuegos.js — Panter Studio minigames page
 * 3 daily games with coin rewards, persisted to Firestore if logged in.
 * Cooldown stored in localStorage per uid.
 */
(function () {
    'use strict';

    const COOLDOWN_HOURS = 24;
    const COINS_PER_EXCHANGE = 5000;
    const EMERALDS_PER_EXCHANGE = 50;

    // ── DOM ───────────────────────────────────────────────────────────────────
    const mgGuestNotice = document.getElementById('mgGuestNotice');
    const mgUserCoins   = document.getElementById('mgUserCoins');
    const mgCoinValue   = document.getElementById('mgCoinValue');
    const mgCoinUsd     = document.getElementById('mgCoinUsd');

    let currentUser = null;
    let userCoins   = 0;

    // ── Firebase wait ─────────────────────────────────────────────────────────
    function waitForFirebase(timeout = 7000) {
        return new Promise(resolve => {
            const check = () => window.db && window.auth && window.getDoc && window.fsDoc && window.setDoc && window.addDoc && window.collection && window.onAuthStateChanged;
            if (check()) return resolve(true);
            const start = Date.now();
            const t = setInterval(() => {
                if (check()) { clearInterval(t); resolve(true); }
                else if (Date.now() - start >= timeout) { clearInterval(t); resolve(false); }
            }, 100);
        });
    }

    // ── Firestore coin helpers ────────────────────────────────────────────────
    async function fetchUserCoins(uid) {
        try {
            const snap = await window.getDoc(window.fsDoc(window.db, 'users', uid));
            return snap.exists() ? Number(snap.data()?.coins || 0) : 0;
        } catch { return 0; }
    }

    async function awardCoins(uid, amount, gameId) {
        if (!uid || amount <= 0) return;
        try {
            const snap = await window.getDoc(window.fsDoc(window.db, 'users', uid));
            const prev = snap.exists() ? Number(snap.data()?.coins || 0) : 0;
            await window.setDoc(window.fsDoc(window.db, 'users', uid), {
                coins: prev + amount,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            await window.addDoc(window.collection(window.db, 'users', uid, 'activity'), {
                type: 'minigame',
                description: `Minijuego (${gameId}): +${amount} monedas`,
                coins: amount,
                gameId,
                createdAt: new Date().toISOString()
            });
            userCoins = prev + amount;
            updateCoinDisplay();
        } catch (err) {
            console.warn('No se pudieron guardar monedas:', err);
        }
    }

    function updateCoinDisplay() {
        if (mgCoinValue) mgCoinValue.textContent = String(userCoins);
        if (mgCoinUsd) {
            const emeralds = Math.floor((userCoins / COINS_PER_EXCHANGE) * EMERALDS_PER_EXCHANGE);
            mgCoinUsd.textContent = `≈ ${emeralds} 💎`;
        }
        if (mgUserCoins) mgUserCoins.hidden = !currentUser;
    }

    // ── Cooldown helpers ──────────────────────────────────────────────────────
    function ckKey(gameId) {
        return `panterMG_${gameId}_${currentUser?.uid || 'guest'}`;
    }

    function isOnCooldown(gameId) {
        try {
            const stored = localStorage.getItem(ckKey(gameId));
            if (!stored) return false;
            return (Date.now() - new Date(stored).getTime()) < COOLDOWN_HOURS * 3600000;
        } catch { return false; }
    }

    function setCooldown(gameId) {
        try { localStorage.setItem(ckKey(gameId), new Date().toISOString()); } catch {}
    }

    function cooldownRemainingText(gameId) {
        try {
            const stored = localStorage.getItem(ckKey(gameId));
            if (!stored) return '';
            const ms = COOLDOWN_HOURS * 3600000 - (Date.now() - new Date(stored).getTime());
            if (ms <= 0) return '';
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return h > 0 ? `Disponible en ${h}h ${m}m` : `Disponible en ${m}m`;
        } catch { return ''; }
    }

    function refreshAllBadges() {
        [1, 2, 3].forEach(id => {
            const badge   = document.getElementById(`game${id}Badge`);
            const btn     = document.getElementById(`playGame${id}`);
            const cdEl    = document.getElementById(`cooldown${id}`);
            const onCD    = isOnCooldown(`game${id}`) && Boolean(currentUser);
            if (badge)  { badge.textContent = onCD ? 'Jugado hoy' : 'Disponible'; badge.className = onCD ? 'mg-daily-badge mg-daily-badge--done' : 'mg-daily-badge'; }
            if (btn)    btn.disabled = onCD;
            if (cdEl)   cdEl.textContent = onCD ? cooldownRemainingText(`game${id}`) : (currentUser ? 'Premio disponible' : 'Inicia sesion para ganar monedas');
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GAME 1 — Adivina el numero
    // ═══════════════════════════════════════════════════════════════════════════
    let g1Secret = 0, g1Tries = 7, g1Active = false;

    function coinsG1(triesUsed) {
        return [50, 40, 30, 20, 15, 10, 5][triesUsed - 1] || 5;
    }

    function startGame1() {
        g1Secret = Math.floor(Math.random() * 100) + 1;
        g1Tries  = 7;
        g1Active = true;

        const area   = document.getElementById('gameArea1');
        const hint   = document.getElementById('guessHint');
        const result = document.getElementById('guessResult');
        const left   = document.getElementById('guessAttemptsLeft');
        const input  = document.getElementById('guessInput');
        const btn    = document.getElementById('guessBtn');
        const play   = document.getElementById('playGame1');

        if (area)   area.hidden = false;
        if (hint)   { hint.textContent = ''; hint.className = 'mg-game-hint'; }
        if (result) { result.textContent = ''; result.className = 'mg-game-result'; }
        if (left)   left.textContent = '7';
        if (input)  { input.value = ''; input.disabled = false; input.focus(); }
        if (btn)    btn.disabled = false;
        if (play)   play.textContent = 'Reiniciar';
    }

    async function processGuess() {
        if (!g1Active) return;
        const input  = document.getElementById('guessInput');
        const hint   = document.getElementById('guessHint');
        const result = document.getElementById('guessResult');
        const left   = document.getElementById('guessAttemptsLeft');
        const btn    = document.getElementById('guessBtn');

        const guess = parseInt(input?.value || '0', 10);
        if (isNaN(guess) || guess < 1 || guess > 100) {
            if (hint) { hint.textContent = 'Ingresa un numero entre 1 y 100.'; hint.className = 'mg-game-hint error'; }
            return;
        }

        g1Tries--;
        if (left) left.textContent = String(g1Tries);
        if (input) input.value = '';

        if (guess === g1Secret) {
            const used   = 7 - g1Tries;
            const earned = coinsG1(used);
            if (hint) { hint.textContent = `¡Correcto! El numero era ${g1Secret}.`; hint.className = 'mg-game-hint success'; }
            g1Active = false;
            if (input) input.disabled = true;
            if (btn)   btn.disabled   = true;
            if (currentUser) {
                setCooldown('game1');
                await awardCoins(currentUser.uid, earned, 'game1');
                if (result) { result.textContent = `+${earned} monedas ganadas 🎉`; result.className = 'mg-game-result success'; }
            } else {
                if (result) { result.textContent = `Bien! Inicia sesion para ganar ${earned} monedas.`; result.className = 'mg-game-result'; }
            }
            refreshAllBadges();
            return;
        }

        if (g1Tries <= 0) {
            if (hint) { hint.textContent = `Sin intentos. El numero era ${g1Secret}.`; hint.className = 'mg-game-hint error'; }
            if (input) input.disabled = true;
            if (btn)   btn.disabled   = true;
            if (result) { result.textContent = 'Sin monedas esta vez. ¡Intentalo mañana!'; result.className = 'mg-game-result error'; }
            g1Active = false;
            if (currentUser) setCooldown('game1');
            refreshAllBadges();
            return;
        }

        const dir = guess < g1Secret ? 'Es mas alto ↑' : 'Es mas bajo ↓';
        if (hint) { hint.textContent = dir; hint.className = 'mg-game-hint'; }
    }

    document.getElementById('playGame1')?.addEventListener('click', startGame1);
    document.getElementById('guessBtn')?.addEventListener('click', processGuess);
    document.getElementById('guessInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') processGuess(); });

    // ═══════════════════════════════════════════════════════════════════════════
    // GAME 2 — Memory Match
    // ═══════════════════════════════════════════════════════════════════════════
    const MEM_EMOJIS = ['🎮', '🕹️', '🏆', '⭐', '🎯', '🔥'];
    let memCards = [], memFlipped = [], memMatched = 0, memStart = 0, memInterval = null, memLocked = false, g2Active = false;

    function coinsG2(secs) {
        if (secs <= 20) return 60;
        if (secs <= 35) return 50;
        if (secs <= 50) return 40;
        if (secs <= 70) return 30;
        if (secs <= 90) return 20;
        return 10;
    }

    function buildDeck() {
        const deck = MEM_EMOJIS.flatMap((e, i) => [{ id: i * 2, emoji: e }, { id: i * 2 + 1, emoji: e }]);
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function renderDeck() {
        const grid = document.getElementById('memoryGrid');
        if (!grid) return;
        grid.innerHTML = '';
        memCards.forEach((card, idx) => {
            const el = document.createElement('div');
            el.className = 'mg-memory-card';
            el.dataset.index = String(idx);
            el.innerHTML = `<div class="mg-card-inner"><div class="mg-card-front">?</div><div class="mg-card-back">${card.emoji}</div></div>`;
            el.addEventListener('click', () => flipCard(idx));
            grid.appendChild(el);
        });
    }

    function flipCard(idx) {
        if (!g2Active || memLocked) return;
        if (memFlipped.includes(idx) || memCards[idx].matched) return;
        const el = document.querySelector(`.mg-memory-card[data-index="${idx}"]`);
        if (!el) return;
        el.classList.add('flipped');
        memFlipped.push(idx);

        if (memFlipped.length === 2) {
            memLocked = true;
            const [a, b] = memFlipped;
            if (memCards[a].emoji === memCards[b].emoji) {
                memCards[a].matched = true;
                memCards[b].matched = true;
                memMatched++;
                document.querySelectorAll(`.mg-memory-card[data-index="${a}"], .mg-memory-card[data-index="${b}"]`).forEach(e => e.classList.add('matched'));
                memFlipped = [];
                memLocked  = false;
                const pEl = document.getElementById('memoryPairs');
                if (pEl) pEl.textContent = String(memMatched);
                if (memMatched === MEM_EMOJIS.length) endGame2();
            } else {
                setTimeout(() => {
                    document.querySelectorAll(`.mg-memory-card[data-index="${a}"], .mg-memory-card[data-index="${b}"]`).forEach(e => e.classList.remove('flipped'));
                    memFlipped = [];
                    memLocked  = false;
                }, 900);
            }
        }
    }

    function startGame2() {
        clearInterval(memInterval);
        memCards   = buildDeck();
        memFlipped = [];
        memMatched = 0;
        memStart   = Date.now();
        memLocked  = false;
        g2Active   = true;

        const area   = document.getElementById('gameArea2');
        const result = document.getElementById('memoryResult');
        const timer  = document.getElementById('memoryTimer');
        const pairs  = document.getElementById('memoryPairs');
        const play   = document.getElementById('playGame2');

        if (area)   area.hidden = false;
        if (result) { result.textContent = ''; result.className = 'mg-game-result'; }
        if (timer)  timer.textContent = '0';
        if (pairs)  pairs.textContent = '0';
        if (play)   play.textContent = 'Reiniciar';

        renderDeck();
        memInterval = setInterval(() => {
            if (!g2Active) { clearInterval(memInterval); return; }
            const elapsed = Math.floor((Date.now() - memStart) / 1000);
            if (timer) timer.textContent = String(elapsed);
        }, 500);
    }

    async function endGame2() {
        g2Active = false;
        clearInterval(memInterval);
        const secs   = Math.floor((Date.now() - memStart) / 1000);
        const earned = coinsG2(secs);
        const result = document.getElementById('memoryResult');
        if (currentUser) {
            setCooldown('game2');
            await awardCoins(currentUser.uid, earned, 'game2');
            if (result) { result.textContent = `Completado en ${secs}s — +${earned} monedas 🎉`; result.className = 'mg-game-result success'; }
        } else {
            if (result) { result.textContent = `Completado en ${secs}s! Inicia sesion para ganar ${earned} monedas.`; result.className = 'mg-game-result'; }
        }
        if (currentUser) setCooldown('game2');
        refreshAllBadges();
    }

    document.getElementById('playGame2')?.addEventListener('click', startGame2);

    // ═══════════════════════════════════════════════════════════════════════════
    // GAME 3 — Reflejos
    // ═══════════════════════════════════════════════════════════════════════════
    const REFLEX_TOTAL = 5;
    let rxRound = 0, rxTimes = [], rxGreen = false, rxWaiting = false, rxTimer = null, rxStart = 0, g3Active = false;

    function coinsG3(avgMs) {
        if (avgMs < 200) return 40;
        if (avgMs < 300) return 35;
        if (avgMs < 400) return 30;
        if (avgMs < 500) return 25;
        if (avgMs < 700) return 20;
        if (avgMs < 1000) return 15;
        return 10;
    }

    function nextRound() {
        if (!g3Active) return;
        const circle = document.getElementById('reflexCircle');
        const prompt = document.getElementById('reflexPrompt');
        const status = document.getElementById('reflexStatus');

        rxGreen   = false;
        rxWaiting = true;
        if (circle) { circle.className = 'mg-reflex-circle'; circle.style.display = 'none'; }
        if (prompt) prompt.textContent = 'Espera el verde...';
        if (status) status.textContent = `Ronda ${rxRound + 1} de ${REFLEX_TOTAL}`;

        const delay = 1200 + Math.random() * 3000;
        rxTimer = setTimeout(() => {
            if (!g3Active) return;
            rxGreen   = true;
            rxStart   = Date.now();
            if (circle) { circle.className = 'mg-reflex-circle active'; circle.style.display = 'flex'; }
            if (prompt) prompt.textContent = '¡AHORA! Toca el circulo';
        }, delay);
    }

    function startGame3() {
        clearTimeout(rxTimer);
        rxRound   = 0;
        rxTimes   = [];
        rxGreen   = false;
        rxWaiting = false;
        g3Active  = true;

        const area   = document.getElementById('gameArea3');
        const result = document.getElementById('reflexResult');
        const status = document.getElementById('reflexStatus');
        const circle = document.getElementById('reflexCircle');
        const play   = document.getElementById('playGame3');
        const prompt = document.getElementById('reflexPrompt');

        if (area)   area.hidden = false;
        if (result) { result.textContent = ''; result.className = 'mg-game-result'; }
        if (status) status.textContent = '';
        if (circle) { circle.className = 'mg-reflex-circle'; circle.style.display = 'none'; }
        if (play)   play.textContent = 'Reiniciar';
        if (prompt) prompt.textContent = 'Preparate...';

        setTimeout(nextRound, 800);
    }

    document.getElementById('reflexCircle')?.addEventListener('click', async () => {
        if (!g3Active) return;
        const circle = document.getElementById('reflexCircle');
        const prompt = document.getElementById('reflexPrompt');
        const status = document.getElementById('reflexStatus');

        // Clicked before green — penalty
        if (rxWaiting && !rxGreen) {
            clearTimeout(rxTimer);
            if (prompt) prompt.textContent = 'Demasiado pronto! Espera el verde.';
            if (circle) circle.style.display = 'none';
            setTimeout(nextRound, 1500);
            return;
        }

        if (!rxGreen) return;

        rxGreen   = false;
        rxWaiting = false;
        clearTimeout(rxTimer);

        const reaction = Date.now() - rxStart;
        rxTimes.push(reaction);
        rxRound++;

        if (circle) { circle.style.display = 'none'; circle.className = 'mg-reflex-circle'; }
        if (status) status.textContent = `Ronda ${rxRound}/${REFLEX_TOTAL} — ${reaction} ms`;
        if (prompt) prompt.textContent = `${reaction} ms ✓`;

        if (rxRound >= REFLEX_TOTAL) {
            await endGame3();
        } else {
            setTimeout(nextRound, 900);
        }
    });

    async function endGame3() {
        g3Active = false;
        clearTimeout(rxTimer);
        const avg    = Math.round(rxTimes.reduce((a, b) => a + b, 0) / rxTimes.length);
        const earned = coinsG3(avg);
        const result = document.getElementById('reflexResult');
        const prompt = document.getElementById('reflexPrompt');
        if (prompt) prompt.textContent = `Promedio: ${avg} ms`;
        if (currentUser) {
            setCooldown('game3');
            await awardCoins(currentUser.uid, earned, 'game3');
            if (result) { result.textContent = `Promedio ${avg}ms — +${earned} monedas 🎉`; result.className = 'mg-game-result success'; }
        } else {
            if (result) { result.textContent = `Promedio ${avg}ms. Inicia sesion para ganar ${earned} monedas.`; result.className = 'mg-game-result'; }
        }
        if (currentUser) setCooldown('game3');
        refreshAllBadges();
    }

    document.getElementById('playGame3')?.addEventListener('click', startGame3);

    // ── Auth init ─────────────────────────────────────────────────────────────
    async function init() {
        const ready = await waitForFirebase();
        if (!ready) return;

        window.onAuthStateChanged(window.auth, async user => {
            currentUser = user;
            if (mgGuestNotice) mgGuestNotice.hidden = Boolean(user);
            userCoins = user ? await fetchUserCoins(user.uid) : 0;
            updateCoinDisplay();
            refreshAllBadges();
        });
    }

    init();
})();
