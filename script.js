/* script.js - Lógica y efectos para Panter Studio Game Dev */

/* ===== CONFIGURACIÓN EMAILJS ===================================
   1. Crea tu cuenta gratis en https://www.emailjs.com
   2. Conecta tu servicio de correo (Gmail, Outlook, etc.)
   3. Crea una plantilla de correo (ver instrucciones abajo)
   4. Reemplaza los tres valores de abajo con tus credenciales
================================================================ */
const EMAILJS_PUBLIC_KEY  = 'iMeAQSEDDe8WDiiWV';
const EMAILJS_SERVICE_ID  = 'service_h9jiigs';
const EMAILJS_TEMPLATE_ID = 'template_2uro1hc';

/* Envía el correo de confirmación al usuario que se registró.
   Variables disponibles en tu plantilla EmailJS:
     {{to_email}}  → correo del usuario
     {{game_name}} → nombre del juego
     {{user_pos}}  → número de posición en la lista */
async function sendConfirmationEmail(userEmail, position) {
    if (typeof emailjs === 'undefined') return;
    if (EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY') return; // No configurado aún
    try {
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                to_email: userEmail,
                game_name: 'Nuestra Tierra Job Simulator',
                user_pos: position,
            },
            EMAILJS_PUBLIC_KEY
        );
    } catch (err) {
        console.warn('EmailJS: no se pudo enviar el correo de confirmación.', err);
    }
}

/* ===== MODAL PROMOCIONAL PRE-REGISTRO ===== */

const MAX_PREREGISTROS = 1000;
let preregistrosActuales = 0;

// Mostrar modal automáticamente al cargar
window.addEventListener('load', () => {
    const modal = document.getElementById('preregistroModal');
    const hasSeenPromo = sessionStorage.getItem('promoSeen');
    
    // Mostrar modal solo si no lo ha visto en esta sesión
    if (!hasSeenPromo && modal) {
        setTimeout(() => {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            updatePromoCapacityDisplay(preregistrosActuales);
        }, 1500); // Aparece después de 1.5 segundos
    }
});

// Función para cerrar el modal promocional
function closePromoModal() {
    const modal = document.getElementById('preregistroModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        sessionStorage.setItem('promoSeen', 'true');
    }
}

// Función para ir a pre-registro
function goToPreregistro() {
    closePromoModal();
    window.location.href = 'preregistro.html';
}

// Actualiza el bloque visual del modal usando cupos reales.
function updatePromoCapacityDisplay(totalRegistros) {
    const total = Math.max(0, Number(totalRegistros) || 0);
    const disponibles = Math.max(MAX_PREREGISTROS - total, 0);

    const registradosEl = document.getElementById('promoRegistrados');
    const cupoEl = document.getElementById('promoCupoTotal');
    const disponiblesEl = document.getElementById('promoDisponibles');
    const registrosElement = document.getElementById('promoRegistros');

    if (registradosEl) {
        registradosEl.textContent = String(total);
    }
    if (cupoEl) {
        cupoEl.textContent = String(MAX_PREREGISTROS);
    }
    if (disponiblesEl) {
        disponiblesEl.textContent = String(disponibles);
    }
    if (registrosElement) {
        registrosElement.textContent = String(total);
    }
}

/* ===== CÓDIGO ORIGINAL ===== */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Panter Studio System: Online");

    // IndexedDB setup (fallback)
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

    function saveRegistroLocal(email) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('Base de datos local no disponible'));
                return;
            }

            const transaction = db.transaction(['registros'], 'readwrite');
            const store = transaction.objectStore('registros');
            store.add({ email, date: new Date().toISOString() });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el registro'));
        });
    }

    function getRegistrosLocal(callback) {
        const transaction = db.transaction(['registros'], 'readonly');
        const store = transaction.objectStore('registros');
        const request = store.getAll();
        request.onsuccess = () => callback(request.result);
    }

    async function saveRegistro(email) {
        if (window.db) {
            try {
                await addDoc(collection(window.db, "preregistros"), {
                    email: email,
                    date: new Date().toISOString()
                });
                console.log("Registro guardado en Firebase");
            } catch (e) {
                console.error("Error adding document: ", e);
                // Fallback to local
                await saveRegistroLocal(email);
            }
        } else {
            await saveRegistroLocal(email);
        }
    }

    async function getRegistros(callback) {
        if (window.db) {
            try {
                const querySnapshot = await getDocs(collection(window.db, "preregistros"));
                callback(querySnapshot.docs.map(doc => doc.data()));
            } catch (e) {
                console.error("Error getting documents: ", e);
                // Fallback to local
                getRegistrosLocal(callback);
            }
        } else {
            getRegistrosLocal(callback);
        }
    }

    async function updateCounter() {
        getRegistros((registros) => {
            const totalRegistros = registros.length;
            preregistrosActuales = totalRegistros;
            const disponibles = Math.max(MAX_PREREGISTROS - totalRegistros, 0);
            const porcentaje = Math.min((totalRegistros / MAX_PREREGISTROS) * 100, 100);

            const countElement = document.getElementById('registro-count');
            if (countElement) {
                countElement.textContent = `Pre-registros totales: ${totalRegistros}/${MAX_PREREGISTROS}`;
            }

            const disponiblesElement = document.getElementById('registro-disponibles');
            if (disponiblesElement) {
                disponiblesElement.textContent = `Cupos disponibles: ${disponibles}`;
            }

            const porcentajeElement = document.getElementById('registro-porcentaje');
            if (porcentajeElement) {
                porcentajeElement.textContent = `${porcentaje.toFixed(1)}%`;
            }

            const progressFill = document.getElementById('registro-progress-fill');
            if (progressFill) {
                progressFill.style.width = `${porcentaje}%`;
            }

            const statusElement = document.getElementById('registro-status');
            if (statusElement) {
                statusElement.textContent = totalRegistros >= MAX_PREREGISTROS
                    ? 'Cupo completo: lista de espera cerrada por ahora.'
                    : 'Meta comunitaria en marcha';
            }

            // Also update index counter
            const indexCount = document.getElementById('preregistro-count');
            if (indexCount) {
                indexCount.textContent = `Pre-registros: ${totalRegistros}/${MAX_PREREGISTROS}`;
            }

            updatePromoCapacityDisplay(totalRegistros);
            updatePreregistroButtonState(totalRegistros);
        });
    }

    function updatePreregistroButtonState(totalRegistros) {
        const preregistroBtn = document.getElementById('preregistro-btn');
        const emailInput = document.getElementById('email');
        const messageElement = document.getElementById('message');
        const cupoLleno = totalRegistros >= MAX_PREREGISTROS;

        if (preregistroBtn) {
            preregistroBtn.disabled = cupoLleno;
            preregistroBtn.textContent = cupoLleno ? 'Cupo lleno' : 'Pre-registrarme';
            preregistroBtn.style.opacity = cupoLleno ? '0.6' : '1';
            preregistroBtn.style.cursor = cupoLleno ? 'not-allowed' : 'pointer';
        }

        if (emailInput) {
            emailInput.disabled = cupoLleno;
        }

        if (messageElement && cupoLleno) {
            messageElement.textContent = 'Se alcanzo el limite de 1000 pre-registros.';
        }
    }

    // Particles container
    let particlesContainer;

    // 3. Funcionalidad para todos los botones ".btn" EXCEPTO pre-registro
    const botones = document.querySelectorAll('.btn:not(#preregistro-btn)');

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
        preregistroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (preregistrosActuales >= MAX_PREREGISTROS) {
                document.getElementById('message').textContent = 'Se alcanzo el limite de 1000 pre-registros.';
                return;
            }

            const email = document.getElementById('email').value;
            try {
                await saveRegistro(email);
                preregistrosActuales++;
                updateCounter();
                const position = preregistrosActuales;
                document.getElementById('message').textContent = '¡Pre-registro exitoso! Revisa tu correo para confirmar.';
                preregistroForm.reset();
                sendConfirmationEmail(email, position);
            } catch (error) {
                document.getElementById('message').textContent = 'Este email ya está registrado.';
            }
        });
    }

    updateCounter();
});

/* ===== FUNCIONES PARA VENTANAS LATERALES ===== */

// Función para abrir/cerrar paneles
function togglePanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    
    if (panel.classList.contains('active')) {
        closePanel(side);
    } else {
        openPanel(side);
    }
}

// Función para abrir panel
function openPanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    panel.classList.add('active');
    
    // Efecto de sonido simulado (opcional)
    console.log(`Panel ${side} abierto con efecto de garras de pantera 🐾`);
}

// Función para cerrar panel
function closePanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    panel.classList.remove('active');
    
    console.log(`Panel ${side} cerrado`);
}

// Cerrar paneles al hacer clic fuera de ellos
document.addEventListener('click', (e) => {
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    const leftTrigger = document.querySelector('.left-trigger');
    const rightTrigger = document.querySelector('.right-trigger');
    
    // Cerrar panel izquierdo si se hace clic fuera
    if (leftPanel && leftPanel.classList.contains('active')) {
        if (!leftPanel.contains(e.target) && !leftTrigger.contains(e.target)) {
            closePanel('left');
        }
    }
    
    // Cerrar panel derecho si se hace clic fuera
    if (rightPanel && rightPanel.classList.contains('active')) {
        if (!rightPanel.contains(e.target) && !rightTrigger.contains(e.target)) {
            closePanel('right');
        }
    }
});

// Cerrar paneles con tecla ESC (solo si el modal no está abierto)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Prioridad al modal promocional
        const modal = document.getElementById('preregistroModal');
        if (modal && modal.classList.contains('active')) {
            closePromoModal();
            return;
        }
        
        // Si no hay modal, cerrar paneles
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        
        if (leftPanel && leftPanel.classList.contains('active')) {
            closePanel('left');
        }
        if (rightPanel && rightPanel.classList.contains('active')) {
            closePanel('right');
        }
    }
});

// NO abrir paneles automáticamente (el modal promocional tiene prioridad)
// Los paneles están disponibles a través de los botones flotantes

// Prevenir scroll cuando los paneles están abiertos (opcional para móviles)
function preventScroll(side, isOpen) {
    if (window.innerWidth <= 768) {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            const leftPanel = document.getElementById('leftPanel');
            const rightPanel = document.getElementById('rightPanel');
            const modal = document.getElementById('preregistroModal');
            
            // Solo permitir scroll si todo está cerrado
            if (!leftPanel.classList.contains('active') && 
                !rightPanel.classList.contains('active') &&
                (!modal || !modal.classList.contains('active'))) {
                document.body.style.overflow = 'auto';
            }
        }
    }
}
