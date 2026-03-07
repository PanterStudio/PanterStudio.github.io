/* script.js - Lógica y efectos para Panter Studio Game Dev */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Panter Studio System: Online");

    // 1. Efecto de aparición suave (Fade-in) al cargar la página
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.8s ease-in';
    
    // Pequeño retraso para asegurar que el navegador procese el estilo inicial
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);

    // 2. Saludo dinámico en la consola basado en la hora
    const hora = new Date().getHours();
    let saludo;
    if (hora < 12) {
        saludo = "¡Buenos días, gamer!";
    } else if (hora < 18) {
        saludo = "¡Buenas tardes, desarrollador!";
    } else {
        saludo = "¡Buenas noches, noctámbulo!";
    }
    console.log(saludo);

    // 3. Funcionalidad para todos los botones ".btn"
    const botones = document.querySelectorAll('.btn');

    botones.forEach(boton => {
        boton.addEventListener('click', (e) => {
            // Si el botón es solo un enlace '#' (demo), prevenimos la acción y mostramos alerta
            const destino = boton.getAttribute('href');
            
            if (!destino || destino === '#') {
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
});
