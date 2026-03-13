import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const mount = document.getElementById('gameMount');
const scoreEl = document.getElementById('gScore');
const shieldEl = document.getElementById('gShield');
const timerEl = document.getElementById('gTimer');
const overlay = document.getElementById('gOverlay');
const titleEl = document.getElementById('gTitle');
const subEl = document.getElementById('gSubtitle');
const startBtn = document.getElementById('gStartBtn');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050b19');
scene.fog = new THREE.Fog('#050b19', 45, 120);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 5, 17);
camera.lookAt(0, 0, -30);

scene.add(new THREE.HemisphereLight(0x8fe8ff, 0x02040a, 1.1));
const dir = new THREE.DirectionalLight(0xb3dfff, 1.1);
dir.position.set(12, 16, 8);
scene.add(dir);

const player = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x80d6ff, emissive: 0x1f3e6b, emissiveIntensity: 0.55 })
);
player.rotation.x = Math.PI / 2;
player.position.set(0, 0, 8);
scene.add(player);

const stars = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0x98c8ff, size: 0.14 })
);
{
    const count = 900;
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        points[i * 3] = (Math.random() - 0.5) * 120;
        points[i * 3 + 1] = (Math.random() - 0.5) * 80;
        points[i * 3 + 2] = -Math.random() * 180;
    }
    stars.geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
}
scene.add(stars);

let running = false;
let score = 0;
let shield = 3;
let timeLeft = 60;
let spawnTimer = 0;
let move = { x: 0, y: 0 };
let lastFrame = performance.now();

const crystals = [];
const mines = [];

function setOverlay(title, subtitle, buttonText = 'Reintentar') {
    titleEl.textContent = title;
    subEl.textContent = subtitle;
    startBtn.textContent = buttonText;
    overlay.hidden = false;
}

function startGame() {
    [...crystals, ...mines].forEach((item) => scene.remove(item));
    crystals.length = 0;
    mines.length = 0;
    score = 0;
    shield = 3;
    timeLeft = 60;
    spawnTimer = 0;
    player.position.set(0, 0, 8);
    running = true;
    overlay.hidden = true;
    updateHud();
}

function endGame(won) {
    running = false;
    setOverlay(won ? 'Ronda completada' : 'Nave destruida', `Cristales recolectados: ${score}`, 'Jugar otra vez');
}

function updateHud() {
    scoreEl.textContent = `Cristales: ${score}`;
    shieldEl.textContent = `Escudo: ${shield}`;
    timerEl.textContent = `Tiempo: ${Math.ceil(timeLeft)}`;
}

function spawnCrystal() {
    const obj = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9),
        new THREE.MeshStandardMaterial({ color: 0x7ee5ff, emissive: 0x1f6c8c, emissiveIntensity: 0.75 })
    );
    obj.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, -95);
    crystals.push(obj);
    scene.add(obj);
}

function spawnMine() {
    const obj = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05, 0),
        new THREE.MeshStandardMaterial({ color: 0xff5c6c, emissive: 0x711f30, emissiveIntensity: 0.8 })
    );
    obj.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, -95);
    mines.push(obj);
    scene.add(obj);
}

function collide(a, b, dist) {
    return a.distanceTo(b) <= dist;
}

function updateList(list, speed, onHit) {
    for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        item.position.z += speed;
        item.rotation.x += 0.03;
        item.rotation.y += 0.04;

        if (collide(player.position, item.position, 1.45)) {
            onHit(item);
            scene.remove(item);
            list.splice(i, 1);
            continue;
        }

        if (item.position.z > 20) {
            scene.remove(item);
            list.splice(i, 1);
        }
    }
}

function tick(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (running) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            updateHud();
            endGame(true);
        }

        spawnTimer += dt;
        if (spawnTimer >= 0.42) {
            spawnTimer = 0;
            if (Math.random() < 0.68) spawnCrystal();
            else spawnMine();
        }

        player.position.x = THREE.MathUtils.clamp(player.position.x + move.x * dt * 15, -10, 10);
        player.position.y = THREE.MathUtils.clamp(player.position.y + move.y * dt * 12, -6, 6);
        player.rotation.z = -move.x * 0.25;
        player.rotation.x = Math.PI / 2 + move.y * 0.12;

        const flow = 0.92 + (score / 3200);
        updateList(crystals, dt * 42 * flow, () => {
            score += 1;
            updateHud();
        });

        updateList(mines, dt * 39 * flow, () => {
            shield -= 1;
            updateHud();
            if (shield <= 0) endGame(false);
        });

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

window.addEventListener('keydown', (event) => {
    const k = event.key.toLowerCase();
    if (k === 'a' || event.key === 'ArrowLeft') move.x = -1;
    if (k === 'd' || event.key === 'ArrowRight') move.x = 1;
    if (k === 'w' || event.key === 'ArrowUp') move.y = 1;
    if (k === 's' || event.key === 'ArrowDown') move.y = -1;
});

window.addEventListener('keyup', (event) => {
    const k = event.key.toLowerCase();
    if (k === 'a' || k === 'd' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') move.x = 0;
    if (k === 'w' || k === 's' || event.key === 'ArrowUp' || event.key === 'ArrowDown') move.y = 0;
});

function bindTouchButton(id, axis, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = () => { move[axis] = value; };
    const off = () => {
        if (move[axis] === value) move[axis] = 0;
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
}

bindTouchButton('moveLeft', 'x', -1);
bindTouchButton('moveRight', 'x', 1);
bindTouchButton('moveUp', 'y', 1);
bindTouchButton('moveDown', 'y', -1);

startBtn.addEventListener('click', startGame);
setOverlay('Sky Collector 3D', 'Recoge cristales azules y evita minas rojas en 60 segundos.', 'Empezar');
updateHud();
requestAnimationFrame(tick);
