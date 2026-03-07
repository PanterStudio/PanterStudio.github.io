/* script.js - Lógica y efectos para Panter Studio Game Dev */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Panter Studio System: Online");

    // IndexedDB setup
    let db;
    const request = indexedDB.open('PreregistrosDB', 1);
    request.onerror = () => console.error('Error opening DB');
    request.onsuccess = (event) => {
        db = event.target.result;
        updateCounter();
    };
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        const store = db.createObjectStore('registros', { keyPath: 'email' });
    };

    function saveRegistro(email) {
        const transaction = db.transaction(['registros'], 'readwrite');
        const store = transaction.objectStore('registros');
        store.add({ email, date: new Date().toISOString() });
        return transaction;
    }

    function getRegistros(callback) {
        const transaction = db.transaction(['registros'], 'readonly');
        const store = transaction.objectStore('registros');
        const request = store.getAll();
        request.onsuccess = () => callback(request.result);
    }

    function updateCounter() {
        if (!db) return;
        getRegistros((registros) => {
            const countElement = document.getElementById('registro-count');
            if (countElement) {
                countElement.textContent = `Pre-registros totales: ${registros.length}`;
            }
            // Also update index counter
            const indexCount = document.getElementById('preregistro-count');
            if (indexCount) {
                indexCount.textContent = `Pre-registros: ${registros.length}`;
            }
        });
    }

    // Particles container
    let particlesContainer;

    // 3. Funcionalidad para todos los botones ".btn"
    const botones = document.querySelectorAll('.btn');

    botones.forEach(boton => {
        boton.addEventListener('click', (e) => {
            // Si el botón es solo un enlace '#' (demo), prevenimos la acción y mostramos alerta
            const destino = boton.getAttribute('href');
            
            if (boton.tagName === 'A' && (!destino || destino === '#')) {
                e.preventDefault();
                alert("🚀 ¡Esta función estará disponible próximamente en Panter Studio!");
            } 
            // Si es un botón de "Descargar", confirmamos la acción
            else if (boton.textContent.includes('Descargar')) {
                const confirmacion = confirm("¿Estás listo para descargar Mystery Panter?");
                if (!confirmacion) {
                    e.preventDefault(); // Cancela si el usuario dice "No"
                } else {
                    alert("Iniciando descarga... (Simulación)");
                }
            }

            // Emit particles on button click
            if (particlesContainer) {
                const rect = e.target.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                for (let i = 0; i < 5; i++) {
                    particlesContainer.particles.addParticle({
                        position: { x: centerX, y: centerY },
                        color: { value: "#1e70c8" },
                        size: { value: 3 },
                        opacity: { value: 0.8 },
                        move: { speed: 2, direction: "none", outModes: { default: "destroy" } },
                        life: { duration: { value: 2 } }
                    });
                }
            }
        });
    });

    // 4. Efecto especial para el Logo: Pequeño rebote al hacer clic
    const logo = document.querySelector('.logo-img');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            logo.style.transform = 'scale(0.95)';
            setTimeout(() => {
                logo.style.transform = 'scale(1)';
            }, 150);
            console.log("Click en el logo detectado.");
        });
    }

    // 5. Detectar en qué página estamos para resaltar el menú (Fallback)
    // Aunque ya lo hicimos manualmente en el HTML con class="active", esto asegura que funcione
    // si agregas más páginas en el futuro.
    const rutaActual = window.location.pathname.split("/").pop();
    const enlacesNav = document.querySelectorAll('nav a');

    enlacesNav.forEach(enlace => {
        const rutaEnlace = enlace.getAttribute('href');
        if (rutaEnlace === rutaActual) {
            enlace.classList.add('active');
            enlace.style.borderBottom = "2px solid white"; // Extra visual
        }
    });

    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        const body = document.body;

        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            body.classList.add('dark-mode');
            darkModeToggle.textContent = '☀️';
        }

        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            darkModeToggle.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // Particles effect
    tsParticles.load("tsparticles", {
        background: {
            color: {
                value: "transparent",
            },
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onClick: {
                    enable: false,  // Disabled global click, now handled per button
                },
                onHover: {
                    enable: true,
                    mode: "repulse",
                },
                resize: true,
            },
            modes: {
                push: {
                    quantity: 4,
                },
                repulse: {
                    distance: 200,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: "#1e70c8",
            },
            links: {
                color: "#1e70c8",
                distance: 150,
                enable: true,
                opacity: 0.5,
                width: 1,
            },
            collisions: {
                enable: true,
            },
            move: {
                direction: "none",
                enable: true,
                outModes: {
                    default: "bounce",
                },
                random: false,
                speed: 2,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                    area: 800,
                },
                value: 80,
            },
            opacity: {
                value: 0.5,
            },
            shape: {
                type: "circle",
            },
            size: {
                value: { min: 1, max: 5 },
            },
        },
        detectRetina: true,
    }).then(container => {
        particlesContainer = container;
    });

    // Pre-registro form
    const preregistroForm = document.getElementById('preregistro-form');
    if (preregistroForm) {
        preregistroForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const transaction = saveRegistro(email);
            transaction.oncomplete = () => {
                updateCounter();
                document.getElementById('message').textContent = '¡Pre-registro exitoso! Gracias por tu interés.';
                preregistroForm.reset();
            };
            transaction.onerror = () => {
                document.getElementById('message').textContent = 'Este email ya está registrado.';
            };
        });
    }

    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            getRegistros((registros) => {
                const dataStr = JSON.stringify(registros, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'preregistros.json';
                link.click();
            });
        });
    }

    // Update counter
    function updateCounter() {
        const registros = JSON.parse(localStorage.getItem('preregistros')) || [];
        const countElement = document.getElementById('preregistro-count');
        if (countElement) {
            countElement.textContent = `Pre-registros: ${registros.length}`;
        }
    }

    updateCounter();
});
