import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const mount = document.getElementById('gameMount');
const scoreEl = document.getElementById('gScore');
const speedEl = document.getElementById('gSpeed');
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
            description: `Neon Runner 3D: +${amount} monedas`,
            coins: amount,
            gameId: 'neon-runner-3d',
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
scene.background = new THREE.Color('#060a14');
scene.fog = new THREE.Fog('#060a14', 35, 95);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 7, 14);
camera.lookAt(0, 1.8, -24);

scene.add(new THREE.HemisphereLight(0x7ad1ff, 0x030712, 1.25));
const dir = new THREE.DirectionalLight(0x9ed9ff, 1.4);
dir.position.set(7, 12, 4);
scene.add(dir);

const track = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 260),
    new THREE.MeshStandardMaterial({ color: 0x0d1424, roughness: 0.75, metalness: 0.2 })
);
track.rotation.x = -Math.PI / 2;
track.position.z = -55;
scene.add(track);

const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1e70c8, emissive: 0x123d74, emissiveIntensity: 0.9 });
for (let i = 0; i < 18; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 6.2), stripeMat);
    stripe.position.set(0, 0.03, -i * 13);
    scene.add(stripe);
}

const laneXs = [-4, 0, 4];
let currentLane = 1;
let targetX = laneXs[currentLane];

const player = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x5cc9ff, emissive: 0x164f73, emissiveIntensity: 0.6 })
);
body.position.y = 1.1;
player.add(body);

const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.65, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.45 })
);
cabin.position.set(0, 1.6, -0.05);
player.add(cabin);

player.position.set(targetX, 0, 4);
scene.add(player);

const obstacles = [];
let spawnTimer = 0;
let speed = 22;
let score = 0;
let earnedThisRun = 0;
let running = false;
let lastFrame = performance.now();

function spawnObstacle() {
    const lane = Math.floor(Math.random() * laneXs.length);
    const obs = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 2.1, 2.3),
        new THREE.MeshStandardMaterial({ color: 0xff5f6d, emissive: 0x6f1c2e, emissiveIntensity: 0.65 })
    );
    obs.position.set(laneXs[lane], 1.1, -90);
    scene.add(obs);
    obstacles.push(obs);
}

function rewardFromScore() {
    return Math.max(10, Math.min(180, Math.floor(score / 35)));
}

function moveLeft() {
    currentLane = Math.max(0, currentLane - 1);
    targetX = laneXs[currentLane];
}

function moveRight() {
    currentLane = Math.min(laneXs.length - 1, currentLane + 1);
    targetX = laneXs[currentLane];
}

function setOverlay(title, subtitle, buttonText = 'Reintentar') {
    titleEl.textContent = title;
    subEl.textContent = subtitle;
    startBtn.textContent = buttonText;
    overlay.hidden = false;
}

function startGame() {
    for (const obs of obstacles) scene.remove(obs);
    obstacles.length = 0;
    spawnTimer = 0;
    speed = 22;
    score = 0;
    earnedThisRun = 0;
    running = true;
    currentLane = 1;
    targetX = laneXs[currentLane];
    player.position.x = targetX;
    overlay.hidden = true;
    updateCoinHud(0);
}

async function endGame() {
    if (!running) return;
    running = false;
    earnedThisRun = rewardFromScore();
    await awardCoins(earnedThisRun);
    updateCoinHud(earnedThisRun);
    const authText = authUser
        ? `Ganaste +${earnedThisRun} monedas.`
        : `Ganarias +${earnedThisRun} monedas al iniciar sesion.`;
    setOverlay('Partida terminada', `Puntaje final: ${Math.floor(score)} · ${authText}`);
}

function checkCollision(a, b) {
    return Math.abs(a.x - b.x) < 1.8 && Math.abs(a.z - b.z) < 2.1;
}

function updateHUD() {
    scoreEl.textContent = `Puntaje: ${Math.floor(score)}`;
    speedEl.textContent = `Velocidad: ${(speed / 20).toFixed(1)}x`;
}

function tick(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (running) {
        speed += dt * 0.9;
        score += dt * speed;
        spawnTimer += dt;

        if (spawnTimer > Math.max(0.55, 1.35 - score / 650)) {
            spawnTimer = 0;
            spawnObstacle();
        }

        player.position.x += (targetX - player.position.x) * Math.min(1, dt * 12);
        player.rotation.z = (targetX - player.position.x) * -0.08;

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.position.z += speed * dt;
            obs.rotation.x += dt * 1.25;
            obs.rotation.y += dt * 0.85;
            if (checkCollision(player.position, obs.position)) {
                endGame();
                break;
            }
            if (obs.position.z > 18) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        camera.position.x += (player.position.x - camera.position.x) * Math.min(1, dt * 7);
        camera.lookAt(player.position.x, 1.8, -24);

        updateHUD();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') moveLeft();
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') moveRight();
});

document.getElementById('moveLeft')?.addEventListener('pointerdown', moveLeft);
document.getElementById('moveRight')?.addEventListener('pointerdown', moveRight);
startBtn.addEventListener('click', startGame);

setOverlay('Neon Runner 3D', 'Esquiva obstaculos en una pista infinita. Compatible con movil y PC.', 'Empezar');
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
