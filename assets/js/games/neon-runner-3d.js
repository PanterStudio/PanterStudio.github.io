import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const mount = document.getElementById('gameMount');
const scoreEl = document.getElementById('gScore');
const speedEl = document.getElementById('gSpeed');
const overlay = document.getElementById('gOverlay');
const titleEl = document.getElementById('gTitle');
const subEl = document.getElementById('gSubtitle');
const startBtn = document.getElementById('gStartBtn');

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

const hemi = new THREE.HemisphereLight(0x7ad1ff, 0x030712, 1.25);
scene.add(hemi);

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
    running = true;
    currentLane = 1;
    targetX = laneXs[currentLane];
    player.position.x = targetX;
    overlay.hidden = true;
}

function endGame() {
    running = false;
    setOverlay('Partida terminada', `Puntaje final: ${Math.floor(score)} · Toca para volver a correr`);
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
requestAnimationFrame(tick);
