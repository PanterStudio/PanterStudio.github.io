import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const mount = document.getElementById('gameMount');
const timerEl = document.getElementById('gTimer');
const shieldEl = document.getElementById('gShield');
const waveEl = document.getElementById('gWave');
const coinsEl = document.getElementById('gCoins');
const earnedEl = document.getElementById('gEarned');
const overlay = document.getElementById('gOverlay');
const titleEl = document.getElementById('gTitle');
const subEl = document.getElementById('gSubtitle');
const startBtn = document.getElementById('gStartBtn');

let authUser = null;
let userCoins = 0;

async function waitForFirebase(timeout = 7000) {
    return new Promise((resolve) => {
        const ready = () => window.auth && window.db && window.onAuthStateChanged && window.getDoc && window.fsDoc && window.setDoc && window.addDoc && window.collection;
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

async function fetchCoins(uid) {
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'users', uid));
        return snap.exists() ? Number(snap.data()?.coins || 0) : 0;
    } catch {
        return 0;
    }
}

async function awardCoins(amount) {
    if (!authUser || amount <= 0) return;
    try {
        const now = new Date().toISOString();
        const newTotal = userCoins + amount;
        await window.setDoc(window.fsDoc(window.db, 'users', authUser.uid), {
            coins: newTotal,
            updatedAt: now
        }, { merge: true });
        await window.addDoc(window.collection(window.db, 'users', authUser.uid, 'activity'), {
            type: 'minigame_3d',
            description: `Orbital Survivor 3D: +${amount} monedas`,
            coins: amount,
            gameId: 'orbital-survivor-3d',
            createdAt: now
        });
        userCoins = newTotal;
    } catch {}
}

function updateCoinHud(earned = 0) {
    coinsEl.textContent = `Monedas: ${userCoins}`;
    earnedEl.textContent = `Ganadas: +${earned}`;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040915');
scene.fog = new THREE.Fog('#040915', 40, 160);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 14, 24);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0x95dbff, 0x02050d, 1.0));
const dir = new THREE.DirectionalLight(0xb9e4ff, 1.15);
dir.position.set(10, 16, 9);
scene.add(dir);

const ring = new THREE.Mesh(
    new THREE.TorusGeometry(10.3, 0.32, 12, 100),
    new THREE.MeshStandardMaterial({ color: 0x2e6fd3, emissive: 0x15356b, emissiveIntensity: 0.9 })
);
ring.rotation.x = Math.PI / 2;
scene.add(ring);

const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 22, 22),
    new THREE.MeshStandardMaterial({ color: 0x8ddcff, emissive: 0x2b7ba1, emissiveIntensity: 1.2 })
);
scene.add(core);

const player = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xa5eeff, emissive: 0x2c6079, emissiveIntensity: 0.7 })
);
scene.add(player);

const drones = [];
let running = false;
let timeLeft = 75;
let shields = 5;
let wave = 1;
let angle = 0;
let turn = 0;
let boost = false;
let boostCooldown = 0;
let spawnTimer = 0;
let earnedThisRun = 0;
let lastFrame = performance.now();

function setOverlay(title, subtitle, buttonText = 'Reintentar') {
    titleEl.textContent = title;
    subEl.textContent = subtitle;
    startBtn.textContent = buttonText;
    overlay.hidden = false;
}

function updateHud() {
    timerEl.textContent = `Tiempo: ${Math.ceil(timeLeft)}`;
    shieldEl.textContent = `Escudos: ${shields}`;
    waveEl.textContent = `Oleada: ${wave}`;
}

function rewardFromResult() {
    const survived = 75 - Math.max(0, timeLeft);
    const raw = Math.floor(survived * 1.8) + wave * 8 + shields * 4;
    return Math.max(14, Math.min(240, raw));
}

function resetPlayer() {
    player.position.set(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
    player.lookAt(0, 0, 0);
}

function startGame() {
    drones.forEach((d) => scene.remove(d));
    drones.length = 0;
    running = true;
    timeLeft = 75;
    shields = 5;
    wave = 1;
    angle = 0;
    turn = 0;
    boost = false;
    boostCooldown = 0;
    spawnTimer = 0;
    earnedThisRun = 0;
    resetPlayer();
    overlay.hidden = true;
    updateHud();
    updateCoinHud(0);
}

async function endGame(victory) {
    if (!running) return;
    running = false;
    earnedThisRun = rewardFromResult();
    await awardCoins(earnedThisRun);
    updateCoinHud(earnedThisRun);
    const authText = authUser
        ? `Ganaste +${earnedThisRun} monedas.`
        : `Ganarias +${earnedThisRun} monedas al iniciar sesion.`;
    setOverlay(
        victory ? 'Sobreviviste la orbita' : 'Escudos agotados',
        `Resultado: ${victory ? 'Victoria' : 'Derrota'} · Oleada ${wave} · ${authText}`,
        'Jugar otra vez'
    );
}

function spawnDrone() {
    const theta = Math.random() * Math.PI * 2;
    const radius = 26 + Math.random() * 12;
    const d = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.1),
        new THREE.MeshStandardMaterial({ color: 0xff6a7d, emissive: 0x7a1f35, emissiveIntensity: 0.85 })
    );
    d.position.set(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
    d.userData.spin = (Math.random() - 0.5) * 0.08;
    scene.add(d);
    drones.push(d);
}

function updateDrones(dt) {
    const speed = (2.6 + wave * 0.3) * dt;
    for (let i = drones.length - 1; i >= 0; i--) {
        const d = drones[i];
        d.rotation.x += d.userData.spin;
        d.rotation.y += 0.04;

        const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), d.position).normalize();
        d.position.addScaledVector(toCenter, speed);

        const distPlayer = d.position.distanceTo(player.position);
        if (distPlayer < (boost ? 1.1 : 1.6)) {
            scene.remove(d);
            drones.splice(i, 1);
            if (!boost) {
                shields -= 1;
                if (shields <= 0) {
                    shields = 0;
                    updateHud();
                    endGame(false);
                    return;
                }
            }
        } else if (d.position.length() < 1.8) {
            scene.remove(d);
            drones.splice(i, 1);
        }
    }
}

function tick(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    ring.rotation.z += dt * 0.25;
    core.rotation.y += dt * 0.55;

    if (running) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            updateHud();
            endGame(true);
        }

        wave = Math.min(9, 1 + Math.floor((75 - timeLeft) / 9));

        const rotationSpeed = (boost ? 2.9 : 1.8) * dt;
        angle += turn * rotationSpeed;
        boostCooldown = Math.max(0, boostCooldown - dt);

        if (boost && boostCooldown <= 0) {
            boost = false;
            player.scale.set(1, 1, 1);
        }

        spawnTimer += dt;
        const cadence = Math.max(0.24, 0.85 - wave * 0.065);
        if (spawnTimer > cadence) {
            spawnTimer = 0;
            spawnDrone();
        }

        resetPlayer();
        player.scale.setScalar(boost ? 1.25 : 1);

        updateDrones(dt);
        updateHud();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function setTurn(value) {
    turn = value;
}

function triggerBoost() {
    if (!running) return;
    if (boost || boostCooldown > 0) return;
    boost = true;
    boostCooldown = 0.65;
}

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'a' || event.key === 'ArrowLeft') setTurn(-1);
    if (key === 'd' || event.key === 'ArrowRight') setTurn(1);
    if (key === ' ' || event.code === 'Space') triggerBoost();
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'a' || key === 'd' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') setTurn(0);
});

function bindTurnButton(id, value) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = () => setTurn(value);
    const off = () => { if (turn === value) setTurn(0); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
}

bindTurnButton('moveLeft', -1);
bindTurnButton('moveRight', 1);
document.getElementById('boost')?.addEventListener('pointerdown', triggerBoost);

startBtn.addEventListener('click', startGame);
setOverlay('Orbital Survivor 3D', 'Rota alrededor del nucleo y evita drones en oleadas.', 'Empezar');
updateHud();
updateCoinHud(0);

(async () => {
    const ready = await waitForFirebase();
    if (!ready) return;
    window.onAuthStateChanged(window.auth, async (user) => {
        authUser = user || null;
        userCoins = authUser ? await fetchCoins(authUser.uid) : 0;
        updateCoinHud(0);
    });
})();

requestAnimationFrame(tick);
