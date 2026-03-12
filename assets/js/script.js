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
    if (typeof emailjs === 'undefined') return false;
    if (EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY') return false;
    try {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                to_email: userEmail,
                game_name: 'Nuestra Tierra Job Simulator',
                user_pos: position,
            }
        );
        return true;
    } catch (err) {
        console.warn('EmailJS error:', err);
        return false;
    }
}

/* ===== MODAL PROMOCIONAL PRE-REGISTRO ===== */

const MAX_PREREGISTROS = 1000;
let preregistrosActuales = 0;
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    // Agrega aqui correos admin, por ejemplo: 'tu-correo@gmail.com'
];

// Mostrar modal automáticamente al cargar
window.addEventListener('load', () => {
    const modal = document.getElementById('preregistroModal');
    if (modal) {
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

/* ===== BASE DE DATOS LOCAL (localStorage) ===== */
// Cambiar a false para usar solo localStorage
const USE_FIREBASE = true;

const LS_KEY = 'panterRegistros';

function getRegistrosLS() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveRegistroLS(email) {
    const registros = getRegistrosLS();
    const emailNorm = email.trim().toLowerCase();
    if (registros.some(r => r.email === emailNorm)) {
        throw new Error('Email duplicado');
    }
    registros.push({ email: emailNorm, date: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(registros));
}

/* ===== CÓDIGO ORIGINAL ===== */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Panter Studio System: Online");
    let userAuthInitialized = false;

    function getConfiguredAdminEmails() {
        const fromStorage = localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '';
        const storageEmails = fromStorage
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);

        const defaultEmails = DEFAULT_ADMIN_EMAILS
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean);

        return Array.from(new Set([...defaultEmails, ...storageEmails]));
    }

    function isAdminEmail(email) {
        if (!email) return false;
        const admins = getConfiguredAdminEmails();
        return admins.includes(String(email).toLowerCase());
    }

    function getAuthErrorMessage(err) {
        const code = err?.code || '';
        const map = {
            'auth/operation-not-allowed': 'Esta accion no esta habilitada en Firebase. Activa el metodo correspondiente (Google o Email/Password).',
            'auth/unauthorized-domain': 'Este dominio no esta autorizado en Firebase Authentication.',
            'auth/popup-blocked': 'El navegador bloqueo la ventana emergente. Permite popups para este sitio.',
            'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar el acceso.',
            'auth/invalid-credential': 'Credenciales invalidas. Intenta nuevamente.',
            'auth/user-not-found': 'No existe una cuenta con ese correo.',
            'auth/wrong-password': 'Contrasena incorrecta.',
            'auth/invalid-email': 'El correo no tiene un formato valido.',
            'auth/email-already-in-use': 'Este correo ya esta registrado.',
            'auth/weak-password': 'La contrasena es muy debil. Usa al menos 6 caracteres.',
            'auth/network-request-failed': 'Error de red. Revisa tu conexion e intenta de nuevo.'
        };

        const message = map[code] || 'No fue posible completar la autenticacion.';
        return code ? `${message} (${code})` : message;
    }

    async function waitForFirebaseAuth(timeout = 7000) {
        return new Promise((resolve) => {
            if (
                window.auth &&
                window.onAuthStateChanged &&
                window.GoogleAuthProvider &&
                window.signInWithPopup &&
                window.signOut &&
                window.signInWithRedirect &&
                window.getRedirectResult &&
                window.signInWithEmailAndPassword &&
                window.createUserWithEmailAndPassword &&
                window.updateProfile
            ) {
                return resolve(true);
            }
            const start = Date.now();
            const timer = setInterval(() => {
                if (
                    window.auth &&
                    window.onAuthStateChanged &&
                    window.GoogleAuthProvider &&
                    window.signInWithPopup &&
                    window.signOut &&
                    window.signInWithRedirect &&
                    window.getRedirectResult &&
                    window.signInWithEmailAndPassword &&
                    window.createUserWithEmailAndPassword &&
                    window.updateProfile
                ) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    function updateAuthUi(user) {
        const authLabel = document.getElementById('authUserLabel');
        const registerBtn = document.getElementById('registerAuthBtn');
        const loginBtn = document.getElementById('loginAuthBtn');
        const logoutBtn = document.getElementById('logoutAuthBtn');
        const authSignalDot = document.getElementById('authSignalDot');
        const authSignalText = document.getElementById('authSignalText');
        const authRoleBadge = document.getElementById('authRoleBadge');
        const adminNavLink = document.getElementById('adminNavLink');
        const adminSideLink = document.getElementById('adminPanelSideLink');

        if (!authLabel || !registerBtn || !loginBtn || !logoutBtn) return;

        const email = user?.email || '';
        const displayName = user?.displayName || '';
        const isAdmin = isAdminEmail(email);

        if (user) {
            authLabel.textContent = displayName
                ? `${displayName} (${email})`
                : email;
            registerBtn.hidden = true;
            loginBtn.hidden = true;
            logoutBtn.hidden = false;

            if (authSignalDot) {
                authSignalDot.classList.remove('auth-signal-guest', 'auth-signal-online', 'auth-signal-admin');
                authSignalDot.classList.add(isAdmin ? 'auth-signal-admin' : 'auth-signal-online');
            }
            if (authSignalText) {
                authSignalText.textContent = isAdmin ? 'Conectado (Admin)' : 'Conectado';
            }
            if (authRoleBadge) authRoleBadge.hidden = !isAdmin;
        } else {
            authLabel.textContent = 'Invitado';
            registerBtn.hidden = false;
            loginBtn.hidden = false;
            logoutBtn.hidden = true;

            if (authSignalDot) {
                authSignalDot.classList.remove('auth-signal-online', 'auth-signal-admin');
                authSignalDot.classList.add('auth-signal-guest');
            }
            if (authSignalText) {
                authSignalText.textContent = 'Invitado';
            }
            if (authRoleBadge) authRoleBadge.hidden = true;
        }

        if (adminNavLink) adminNavLink.hidden = !isAdmin;
        if (adminSideLink) adminSideLink.hidden = !isAdmin;
    }

    function setupAuthModal() {
        const modal = document.getElementById('authModal');
        const closeBtn = document.getElementById('authModalCloseBtn');
        const registerOpenBtn = document.getElementById('registerAuthBtn');
        const tabRegister = document.getElementById('authTabRegister');
        const tabLogin = document.getElementById('authTabLogin');
        const registerForm = document.getElementById('authRegisterForm');
        const loginForm = document.getElementById('authLoginForm');
        const message = document.getElementById('authModalMessage');

        if (!modal || !registerOpenBtn || !tabRegister || !tabLogin || !registerForm || !loginForm || !message) return;

        function setMode(mode) {
            const isRegister = mode === 'register';
            tabRegister.classList.toggle('active', isRegister);
            tabLogin.classList.toggle('active', !isRegister);
            registerForm.hidden = !isRegister;
            loginForm.hidden = isRegister;
            message.textContent = '';
        }

        function openModal(mode) {
            setMode(mode);
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            modal.hidden = true;
            if (!document.getElementById('preregistroModal')?.classList.contains('active')) {
                document.body.style.overflow = 'auto';
            }
        }

        registerOpenBtn.addEventListener('click', () => openModal('register'));
        const loginOpenBtn = document.getElementById('loginAuthBtn');
        if (loginOpenBtn) loginOpenBtn.addEventListener('click', () => openModal('login'));
        tabRegister.addEventListener('click', () => setMode('register'));
        tabLogin.addEventListener('click', () => setMode('login'));

        modal.addEventListener('click', (event) => {
            const closeByOverlay = event.target instanceof HTMLElement && event.target.dataset.authClose === 'true';
            if (closeByOverlay) closeModal();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        modal.dataset.closeAuthModal = 'true';
    }

    async function setupUserAuth() {
        if (userAuthInitialized) return;
        const modal = document.getElementById('authModal');
        const registerForm = document.getElementById('authRegisterForm');
        const loginForm = document.getElementById('authLoginForm');
        const message = document.getElementById('authModalMessage');
        const googleBtn = document.getElementById('googleAuthModalBtn');
        const logoutBtn = document.getElementById('logoutAuthBtn');
        if (!logoutBtn || !registerForm || !loginForm || !message || !googleBtn) return;
        userAuthInitialized = true;
        let authObserverBound = false;

        const ensureAuthReady = async (showUserHint = false) => {
            const authReady = await waitForFirebaseAuth();
            if (!authReady) {
                const hint = 'Firebase Auth aun no esta listo. Recarga la pagina e intenta nuevamente.';
                if (showUserHint) {
                    message.textContent = hint;
                }
                return false;
            }

            if (!authObserverBound) {
                try {
                    await window.getRedirectResult(window.auth);
                } catch (err) {
                    console.error('Error recuperando redirect de Google:', err);
                }

                window.onAuthStateChanged(window.auth, (user) => {
                    updateAuthUi(user || null);
                });
                authObserverBound = true;
            }

            return true;
        };

        ensureAuthReady(false);

        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!(await ensureAuthReady(true))) return;
            const nameInput = document.getElementById('authRegisterName');
            const emailInput = document.getElementById('authRegisterEmail');
            const passInput = document.getElementById('authRegisterPassword');
            const username = nameInput?.value.trim() || '';
            const email = emailInput?.value.trim() || '';
            const password = passInput?.value || '';

            if (!username) {
                message.textContent = 'Ingresa un nombre de usuario.';
                return;
            }

            try {
                message.textContent = 'Creando cuenta...';
                const credential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                if (credential?.user) {
                    await window.updateProfile(credential.user, { displayName: username });
                }
                message.textContent = 'Cuenta creada correctamente.';
                registerForm.reset();
                if (modal) modal.hidden = true;
                document.body.style.overflow = 'auto';
            } catch (err) {
                console.error('Error en registro:', err);
                message.textContent = `Error: ${getAuthErrorMessage(err)}`;
            }
        });

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!(await ensureAuthReady(true))) return;
            const emailInput = document.getElementById('authLoginEmail');
            const passInput = document.getElementById('authLoginPassword');
            const email = emailInput?.value.trim() || '';
            const password = passInput?.value || '';

            try {
                message.textContent = 'Ingresando...';
                await window.signInWithEmailAndPassword(window.auth, email, password);
                message.textContent = 'Sesion iniciada.';
                loginForm.reset();
                if (modal) modal.hidden = true;
                document.body.style.overflow = 'auto';
            } catch (err) {
                console.error('Error en login:', err);
                message.textContent = `Error: ${getAuthErrorMessage(err)}`;
            }
        });

        const startGoogleSignIn = async (useModalMessage = false) => {
            if (!(await ensureAuthReady(useModalMessage))) {
                if (!useModalMessage) alert('Firebase Auth aun no esta listo. Recarga la pagina e intenta nuevamente.');
                return;
            }
            try {
                if (useModalMessage) message.textContent = 'Conectando con Google...';
                const provider = new window.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                if (useModalMessage) message.textContent = 'Redirigiendo a Google...';
                await window.signInWithRedirect(window.auth, provider);
            } catch (err) {
                console.error('Error en login con Google:', err);
                if (useModalMessage) message.textContent = `Error: ${getAuthErrorMessage(err)}`;
                else alert(getAuthErrorMessage(err));
            }
        };

        googleBtn.addEventListener('click', async () => {
            await startGoogleSignIn(true);
        });

        logoutBtn.addEventListener('click', async () => {
            if (!(await ensureAuthReady(false))) return;
            try {
                await window.signOut(window.auth);
            } catch (err) {
                console.error('Error al cerrar sesion:', err);
            }
        });
    }

    function waitForFirebase(timeout = 6000) {
        return new Promise((resolve) => {
            if (window.db && window.addDoc) return resolve(true);
            const start = Date.now();
            const interval = setInterval(() => {
                if (window.db && window.addDoc) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function saveRegistro(email) {
        const emailNorm = email.trim().toLowerCase();
        if (USE_FIREBASE) {
            const ready = await waitForFirebase();
            if (ready) {
                try {
                    // Usar email como ID del documento para prevenir duplicados
                    const docRef = window.fsDoc(window.db, 'preregistros', emailNorm);
                    await window.setDoc(docRef, {
                        email: emailNorm,
                        date: new Date().toISOString()
                    }, { merge: false });
                    return;
                } catch (e) {
                    console.error('Firebase error al guardar:', e);
                    if (e.code === 'permission-denied' || e.code === 'already-exists') throw e;
                    // Sino cae a local
                }
            }
        }
        saveRegistroLS(emailNorm);
    }

    async function getRegistros(callback) {
        if (USE_FIREBASE) {
            const ready = await waitForFirebase(3000);
            if (ready) {
                try {
                    const snapshot = await window.getDocs(window.collection(window.db, 'preregistros'));
                    return callback(snapshot.docs.map(d => d.data()));
                } catch (e) {
                    console.warn('Firebase error al leer, usando local:', e);
                }
            }
        }
        callback(getRegistrosLS());
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
    const enlacesNav = document.querySelectorAll('nav > a');

    enlacesNav.forEach(enlace => {
        const rutaEnlace = enlace.getAttribute('href');
        if (rutaEnlace === rutaActual) {
            enlace.classList.add('active');
            enlace.style.borderBottom = "2px solid white"; // Extra visual
        }
    });

    const appRoutes = ['juegos.html', 'aplicaciones.html'];
    const navDropdowns = document.querySelectorAll('.nav-dropdown');

    navDropdowns.forEach((dropdown) => {
        const toggle = dropdown.querySelector('.nav-dropdown-toggle');
        const menuLinks = dropdown.querySelectorAll('.nav-dropdown-menu a');
        if (!toggle) return;

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = dropdown.classList.contains('open');
            navDropdowns.forEach((item) => {
                item.classList.remove('open');
                const itemToggle = item.querySelector('.nav-dropdown-toggle');
                if (itemToggle) itemToggle.setAttribute('aria-expanded', 'false');
            });
            if (!isOpen) {
                dropdown.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });

        if (appRoutes.includes(rutaActual)) {
            toggle.classList.add('active');
            menuLinks.forEach((link) => {
                if (link.getAttribute('href') === rutaActual) {
                    link.classList.add('active');
                }
            });
        }
    });

    document.addEventListener('click', (event) => {
        navDropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('open');
                const toggle = dropdown.querySelector('.nav-dropdown-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
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
                const msgEl = document.getElementById('message');
                msgEl.textContent = '¡Pre-registro exitoso! Enviando correo de confirmación...';
                preregistroForm.reset();
                const emailSent = await sendConfirmationEmail(email, position);
                msgEl.textContent = emailSent
                    ? '¡Listo! Revisa tu correo, te enviamos la confirmación.'
                    : '¡Pre-registro exitoso! (Correo de confirmación no disponible en este momento)';
            } catch (error) {
                document.getElementById('message').textContent = 'Este email ya está registrado.';
            }
        });
    }

    updateCounter();

    // Cuando Firebase termine de cargar, refrescar el contador con datos reales
    document.addEventListener('firebaseReady', () => {
        updateCounter();
        setupUserAuth();
    });

    setupAuthModal();
    setupUserAuth();
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
    // Acceso alterno discreto: Ctrl + Shift + A
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        window.location.href = 'admin.html';
        return;
    }

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
