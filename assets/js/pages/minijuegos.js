/* minijuegos.js — Launcher de juegos 3D */
(function () {
    'use strict';

    const COINS_PER_EXCHANGE = 5000;
    const EMERALDS_PER_EXCHANGE = 50;

    const mgGuestNotice = document.getElementById('mgGuestNotice');
    const mgUserCoins = document.getElementById('mgUserCoins');
    const mgCoinValue = document.getElementById('mgCoinValue');
    const mgCoinUsd = document.getElementById('mgCoinUsd');
    const launchButtons = Array.from(document.querySelectorAll('.mg-play-btn'));

    function coinsToEmeralds(coins) {
        return Math.floor((Number(coins || 0) / COINS_PER_EXCHANGE) * EMERALDS_PER_EXCHANGE);
    }

    function pulseLaunchButtons() {
        launchButtons.forEach((button, index) => {
            setTimeout(() => {
                button.classList.add('is-ready');
            }, 140 * index);
        });
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            const ready = () => window.db && window.auth && window.getDoc && window.fsDoc && window.onAuthStateChanged;
            if (ready()) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (ready()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function readCoins(uid) {
        try {
            const snap = await window.getDoc(window.fsDoc(window.db, 'users', uid));
            return snap.exists() ? Number(snap.data()?.coins || 0) : 0;
        } catch {
            return 0;
        }
    }

    function renderBalance(coins) {
        if (mgCoinValue) mgCoinValue.textContent = String(coins);
        if (mgCoinUsd) mgCoinUsd.textContent = `≈ ${coinsToEmeralds(coins)} 💎`;
    }

    async function init() {
        pulseLaunchButtons();
        const ready = await waitForFirebase();
        if (!ready) return;

        window.onAuthStateChanged(window.auth, async (user) => {
            const loggedIn = Boolean(user);
            if (mgGuestNotice) mgGuestNotice.hidden = loggedIn;
            if (mgUserCoins) mgUserCoins.hidden = !loggedIn;
            const coins = loggedIn ? await readCoins(user.uid) : 0;
            renderBalance(coins);
        });
    }

    init();
})();
