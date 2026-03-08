// Donaciones/Patrocinio - Panter Studio
(function () {
    const tiersGrid = document.getElementById('donationsTiersGrid');
    const sponsorsWall = document.getElementById('sponsorsWall');
    const paypalLink = document.getElementById('paypalLink');
    const kofiLink = document.getElementById('kofiLink');
    const patreonLink = document.getElementById('patreonLink');
    const mercadopagoLink = document.getElementById('mercadopagoLink');
    const progressCircle = document.getElementById('donationProgressCircle');
    const progressPercent = document.getElementById('donationProgressPercent');
    const goalAmount = document.getElementById('donationGoalAmount');
    const currentAmount = document.getElementById('donationCurrentAmount');

    function esc(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function loadSettings() {
        try {
            const docRef = window.fsDoc(window.db, 'settings', 'site');
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return {};
            return snapshot.data() || {};
        } catch (err) {
            console.warn('No se pudo leer settings', err);
            return {};
        }
    }

    async function loadDonationSettings() {
        try {
            const docRef = window.fsDoc(window.db, 'settings', 'donations');
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return {};
            return snapshot.data() || {};
        } catch (err) {
            console.warn('No se pudo leer donation settings', err);
            return {};
        }
    }

    async function loadTiers() {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'donation_tiers'));
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn('No se pudieron leer niveles', err);
            return [];
        }
    }

    async function loadDonations() {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'donations'));
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn('No se pudieron leer donaciones', err);
            return [];
        }
    }

    async function loadSponsors() {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'sponsors'));
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn('No se pudieron leer patrocinadores', err);
            return [];
        }
    }

    function renderTiers(tiers) {
        if (!tiers.length) {
            tiersGrid.innerHTML = `
                <div class="donation-tier-card tier-default">
                    <div class="tier-badge">💝</div>
                    <h3>Apoyo Libre</h3>
                    <p class="tier-amount">Cualquier monto</p>
                    <p>Tu aporte, sin importar el tamaño, impulsa el desarrollo.</p>
                    <ul class="tier-benefits">
                        <li>Nombre en agradecimientos</li>
                        <li>10 monedas por cada $1</li>
                    </ul>
                </div>
            `;
            return;
        }

        const sorted = tiers
            .filter((t) => t.active !== false)
            .sort((a, b) => (a.amount || 0) - (b.amount || 0));

        tiersGrid.innerHTML = sorted
            .map((tier) => {
                const benefits = String(tier.description || '')
                    .split('\n')
                    .filter(Boolean)
                    .map((b) => `<li>${esc(b)}</li>`)
                    .join('');

                const featuredClass = tier.featured ? 'tier-featured' : '';
                const badgeStyle = tier.color ? `background: ${tier.color};` : '';

                return `
                    <div class="donation-tier-card ${featuredClass}">
                        <div class="tier-badge" style="${badgeStyle}">${esc(tier.badge || '⭐')}</div>
                        ${tier.featured ? '<span class="tier-featured-tag">Recomendado</span>' : ''}
                        <h3>${esc(tier.name)}</h3>
                        <p class="tier-amount">$${Number(tier.amount || 0).toFixed(2)} USD</p>
                        <ul class="tier-benefits">${benefits}</ul>
                        <p class="tier-coins">+${tier.coins || 0} 🪙 monedas</p>
                    </div>
                `;
            })
            .join('');
    }

    function renderSponsors(sponsors) {
        if (!sponsors.length) {
            sponsorsWall.innerHTML = '<p>Se el primero en apoyar el desarrollo y aparecer aqui!</p>';
            return;
        }

        const sorted = sponsors
            .filter((s) => s.visible !== false)
            .sort((a, b) => (b.amount || 0) - (a.amount || 0));

        sponsorsWall.innerHTML = sorted
            .map((s) => {
                const badgeStyle = s.color ? `border-color: ${s.color};` : '';
                return `
                    <div class="sponsor-card" style="${badgeStyle}">
                        <span class="sponsor-badge">${esc(s.badge || '💖')}</span>
                        <span class="sponsor-name">${esc(s.displayName || 'Anonimo')}</span>
                        ${s.tierName ? `<span class="sponsor-tier">${esc(s.tierName)}</span>` : ''}
                    </div>
                `;
            })
            .join('');
    }

    function updateProgress(donations, goal) {
        const total = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const goalVal = Number(goal) || 500;
        const percent = Math.min((total / goalVal) * 100, 100);
        const circumference = 2 * Math.PI * 45; // r=45
        const offset = circumference - (percent / 100) * circumference;

        if (progressCircle) {
            progressCircle.style.strokeDasharray = circumference;
            progressCircle.style.strokeDashoffset = offset;
        }
        if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
        if (goalAmount) goalAmount.textContent = `$${goalVal}`;
        if (currentAmount) currentAmount.textContent = `$${total.toFixed(2)}`;
    }

    function updatePaymentLinks(settings) {
        if (settings.paypalLink && paypalLink) {
            paypalLink.href = settings.paypalLink;
            paypalLink.classList.remove('disabled');
        } else if (paypalLink) {
            paypalLink.classList.add('disabled');
        }

        if (settings.kofiLink && kofiLink) {
            kofiLink.href = settings.kofiLink;
            kofiLink.classList.remove('disabled');
        } else if (kofiLink) {
            kofiLink.classList.add('disabled');
        }

        if (settings.patreonLink && patreonLink) {
            patreonLink.href = settings.patreonLink;
            patreonLink.classList.remove('disabled');
        } else if (patreonLink) {
            patreonLink.classList.add('disabled');
        }

        if (settings.mercadopagoLink && mercadopagoLink) {
            mercadopagoLink.href = settings.mercadopagoLink;
            mercadopagoLink.classList.remove('disabled');
        } else if (mercadopagoLink) {
            mercadopagoLink.classList.add('disabled');
        }
    }

    async function init() {
        const ready = await waitForFirebase();
        if (!ready) {
            if (tiersGrid) tiersGrid.innerHTML = '<p>No se pudo conectar con la base de datos.</p>';
            return;
        }

        const [settings, donationSettings, tiers, donations, sponsors] = await Promise.all([
            loadSettings(),
            loadDonationSettings(),
            loadTiers(),
            loadDonations(),
            loadSponsors()
        ]);

        const mergedSettings = { ...settings, ...donationSettings };

        renderTiers(tiers);
        renderSponsors(sponsors);
        updateProgress(donations, mergedSettings.donationGoal || 500);
        updatePaymentLinks(mergedSettings);
    }

    init();
})();
