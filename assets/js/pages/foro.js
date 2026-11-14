/**
 * foro.js — Motor del apartado FORO de Panter Studio
 * ============================================================
 * · Índice de secciones y temas + vista de hilo estilo XenForo.
 * · Crear temas, responder, citar, compartir, reportar, suscribirse
 *   y marcadores, barra BBCode, vista previa y emojis/pegatinas.
 * · Columna de autor con rango REAL (PanterRoles.badgeHtml + `equipo`).
 * · Sidebar: "Leyendo ahora", "Participantes", "Más en esta sección".
 * · Persistencia calcada de soporte.js / imagenes.js:
 *     Firestore `foro_temas/{id}` + `foro_temas/{id}/mensajes/{id}`
 *     + copia local (ps_foro_temas_local / ps_foro_mensajes_local)
 *     + onSnapshot + evento `storage` + `firebaseReady` + `psForoLocal`.
 *   Nunca bloquea la escritura por `permission-denied`: si la nube
 *   falla, se guarda en localStorage y se muestra de inmediato.
 *
 * Este archivo es autónomo: no modifica ningún otro módulo.
 */
(function () {
    'use strict';

    /* ── Constantes ─────────────────────────────────────────── */
    const COLLECTION = 'foro_temas';
    const LS_TOPICS = 'ps_foro_temas_local';
    const LS_MESSAGES = 'ps_foro_mensajes_local';
    const LS_SUBS = 'ps_foro_suscripciones';
    const LS_BOOKMARKS = 'ps_foro_marcadores';
    const LS_REPORTS = 'ps_foro_reportes';
    const LOCAL_EVENT = 'psForoLocal';
    const PRESENCE_PREFIX = 'ps_foro_lectores_';
    const PRESENCE_TTL = 3 * 60 * 1000;

    /* Contenido EXCLUSIVO de Nuestra Tierra Job Simulator (simulador de
       transporte, carga pesada y mundo abierto en Latinoamérica para PC
       y móviles). La sección «Comunidad y Futuros Proyectos» deja espacio
       flexible para los próximos proyectos de Panter Studio Game Dev. */
    const SECTIONS = [
        { id: 'anuncios', label: 'Anuncios y Novedades', desc: 'Parches, avances de desarrollo y comunicados oficiales del estudio.', icon: 'fa-solid fa-bullhorn', color: '#f1c40f' },
        { id: 'general', label: 'Discusión General', desc: 'Presentaciones, rutas, capturas y charla entre conductores.', icon: 'fa-solid fa-comments', color: '#00b0ff' },
        { id: 'nuestra-tierra', label: 'Nuestra Tierra Job Simulator', desc: 'Transporte, carga pesada y mundo abierto en Latinoamérica para PC y móviles.', icon: 'fa-solid fa-truck', color: '#e67e22' },
        { id: 'soporte', label: 'Soporte y Ayuda', desc: 'Guías, dudas técnicas y soluciones de la comunidad.', icon: 'fa-solid fa-headset', color: '#00a715' },
        { id: 'sugerencias', label: 'Sugerencias e Ideas', desc: 'Propón rutas, vehículos, trabajos y mejoras para el simulador.', icon: 'fa-solid fa-lightbulb', color: '#9d00ff' },
        { id: 'offtopic', label: 'Comunidad y Futuros Proyectos', desc: 'Charla de la comunidad y espacio para los próximos proyectos del estudio.', icon: 'fa-solid fa-diagram-project', color: '#ff7ddf' }
    ];


    const EMOJIS = ['😀','😂','😍','😎','🤔','👍','👎','🔥','🎮','🚗','💎','🎉','🙏','👀','💬','🛠️','⚡','❤️','✅','❗','🤝','🏁','🗺️','📸','🎨','🛡️','👑','🚀','🌟','🐾','☕','🎯'];

    const D = (n) => new Date(Date.UTC(2026, 10, 14) - n * 86400000).toISOString();

    /* Temas semilla: garantizan que el foro nunca quede vacío, incluso
       sin conexión a Firestore. No se escriben en la BD hasta que alguien
       interactúa con ellos (se "materializan" entonces). */
    const SEED_TOPICS = [
        {
            id: 't_nuestra_tierra', seccion: 'nuestra-tierra', prefijo: 'OFICIAL', fijado: true, cerrado: false,
            titulo: 'Nuestra Tierra Job Simulator — Rutas, Carga y Mundo Abierto',
            autorNombre: 'PanterGameY', autorUid: 'founder_pantergamey', autorEmail: '',
            autorRol: 'founder_ceo', autorAvatar: '', autorMensajes: 54, autorDesde: '2026',
            creadoEn: D(46), actualizadoEn: D(2), ultimaRespuestaEn: D(2), ultimaRespuestaAutor: 'Fénix',
            respuestas: 54, vistas: 8421, reacciones: 128,
            etiquetas: ['nuestra-tierra', 'transporte', 'carga-pesada'],
            cuerpo: [
                '[h2]Nuestra Tierra Job Simulator — Ficha oficial del proyecto[/h2]',
                '[b]Bienvenidos al hilo oficial del simulador.[/b] Aquí reunimos la información clave sobre conducción, carga pesada y el mundo abierto en Latinoamérica para [i]PC y móviles[/i].',
                '',
                '[h3]📋 Qué puedes hacer en el simulador[/h3]',
                '[list]',
                '[*]Conducir camiones, vans y vehículos de reparto por carreteras de montaña y ciudades.',
                '[*]Gestionar cargas pesadas con físicas de peso, inercia y suspensión dinámica.',
                '[*]Completar trabajos de mensajería, paquetería y transporte de mercancías.',
                '[*]Personalizar tu vehículo en el garaje: pintura, llantas, luces y motor.',
                '[*]Conducir de noche y bajo lluvia con ciclo día/noche y clima dinámico.',
                '[/list]',
                '',
                '[h3]🚛 Flota y vehículos[/h3]',
                '[list=1]',
                '[*][b]Van Sprinter de Carga[/b] — reparto urbano y mensajería urgente.',
                '[*][b]Camiones de carga pesada[/b] — rutas de montaña y larga distancia.',
                '[*][b]Vehículos de apoyo[/b] — grúa, asistencia en carretera y servicios.',
                '[/list]',
                '',
                '[h3]📝 Ficha técnica[/h3]',
                'Copia esta ficha si quieres proponer una ruta o un vehículo nuevo:',
                '[code]PROYECTO: Nuestra Tierra Job Simulator\nGENERO: Simulador de transporte y carga pesada\nESCENARIO: Mundo abierto en Latinoamerica\nPLATAFORMAS: PC y moviles\nESTADO: En desarrollo\nESTUDIO: Panter Studio Game Dev\nRUTA / VEHICULO PROPUESTO: [/code]',
                '',
                '[quote=PanterGameY]Queremos que cada ruta se sienta real: el peso de la carga, el clima y la carretera deben importar de verdad.[/quote]',
                '',
                '[center][i]Este hilo se actualizará con cada avance del desarrollo. 🐾[/i][/center]'
            ].join('\n')
        },
        {
            id: 't_bienvenida', seccion: 'anuncios', prefijo: 'ANUNCIO', fijado: true, cerrado: false,
            titulo: 'Bienvenida al Foro de Panter Studio',
            autorNombre: 'Fénix', autorUid: 'team_fenix', autorEmail: '',
            autorRol: 'administrador', autorAvatar: '', autorMensajes: 27, autorDesde: '2026',
            creadoEn: D(30), actualizadoEn: D(1), ultimaRespuestaEn: D(1), ultimaRespuestaAutor: 'Carlos Dev',
            respuestas: 12, vistas: 3110, reacciones: 64, etiquetas: ['bienvenida'],
            cuerpo: [
                '[h2]¡Bienvenido al FORO![/h2]',
                'Este es el punto de encuentro oficial de la comunidad de [b]Panter Studio[/b]. Aquí puedes crear temas, responder, compartir capturas y proponer ideas.',
                '',
                '[h3]Antes de publicar[/h3]',
                '[list]',
                '[*]Sé respetuoso con los demás miembros y con el equipo.',
                '[*]Usa la sección correcta para cada tema.',
                '[*]No publiques enlaces sospechosos ni contenido que infrinja las normas de Discord.',
                '[*]Busca antes de crear un tema: quizá tu duda ya tiene respuesta.',
                '[/list]',
                '',
                '[center][b]¡Disfruta del foro y bienvenido a la familia! 🐾[/b][/center]'
            ].join('\n')
        },
        {
            id: 't_roadmap', seccion: 'anuncios', prefijo: 'ANUNCIO', fijado: false, cerrado: false,
            titulo: 'Hoja de ruta · Temporada 1 de Nuestra Tierra',
            autorNombre: 'Carlos Dev', autorUid: 'team_carlos', autorEmail: '',
            autorRol: 'programador', autorAvatar: '', autorMensajes: 41, autorDesde: '2026',
            creadoEn: D(18), actualizadoEn: D(4), ultimaRespuestaEn: D(4), ultimaRespuestaAutor: 'PanterGameY',
            respuestas: 23, vistas: 1980, reacciones: 91, etiquetas: ['roadmap', 'desarrollo'],
            cuerpo: [
                '[h2]Temporada 1 — Roadmap público[/h2]',
                'Compartimos el estado de desarrollo para que la comunidad sepa en qué estamos trabajando.',
                '',
                '[h3]En curso[/h3]',
                '[list][*]Físicas de carga pesada y suspensión dinámica.[*]Ciclo día/noche con clima dinámico.[*]Sistema de trabajos de mensajería y paquetería.[/list]',
                '',
                '[h3]A continuación[/h3]',
                '[list][*]Garaje interactivo con pintura y accesorios.[*]Peajes y carreteras de montaña.[*]Integración del foro con el panel de personal.[/list]',
                '',
                '[i]Las fechas son orientativas y pueden cambiar según las pruebas internas.[/i]'
            ].join('\n')
        },
        {
            id: 't_presentaciones', seccion: 'general', prefijo: 'DEBATE', fijado: false, cerrado: false,
            titulo: 'Preséntate aquí 👋 Cuéntanos quién eres',
            autorNombre: 'Albert Acosta', autorUid: 'team_albert', autorEmail: '',
            autorRol: 'moderador', autorAvatar: '', autorMensajes: 18, autorDesde: '2026',
            creadoEn: D(25), actualizadoEn: D(0), ultimaRespuestaEn: D(0), ultimaRespuestaAutor: 'Laura',
            respuestas: 37, vistas: 2640, reacciones: 52, etiquetas: ['comunidad'],
            cuerpo: '[h2]¡Preséntate![/h2]\nNos encanta conocer a la gente que juega con nosotros.\n\n[list][*]¿Cómo te llamas?[*]¿De dónde nos visitas?[*]¿Qué trabajo te gusta más en el juego?[/list]\n\n[b]¡Bienvenido a la comunidad! 🐾[/b]'
        },
        {
            id: 't_capturas', seccion: 'general', prefijo: 'DEBATE', fijado: false, cerrado: false,
            titulo: 'Comparte tus mejores capturas del mapa 📸',
            autorNombre: 'Laura', autorUid: 'user_laura', autorEmail: '',
            autorRol: 'usuario', autorAvatar: '', autorMensajes: 9, autorDesde: '2026',
            creadoEn: D(9), actualizadoEn: D(3), ultimaRespuestaEn: D(3), ultimaRespuestaAutor: 'Miguel',
            respuestas: 16, vistas: 1120, reacciones: 44, etiquetas: ['capturas', 'imgur'],
            cuerpo: '[h2]Galería de la comunidad[/h2]\nSube tu imagen a Imgur y pégala con el botón [b]Imagen[/b] de la barra de herramientas.\n\n[center][i]Los atardeceres en la carretera de montaña son los mejores 🌄[/i][/center]'
        },
        {
            id: 't_guia_tickets', seccion: 'soporte', prefijo: 'GUÍA', fijado: true, cerrado: false,
            titulo: 'Guía: cómo abrir un ticket de soporte',
            autorNombre: 'Soporte PS', autorUid: 'team_soporte', autorEmail: '',
            autorRol: 'soporte', autorAvatar: '', autorMensajes: 63, autorDesde: '2026',
            creadoEn: D(22), actualizadoEn: D(6), ultimaRespuestaEn: D(6), ultimaRespuestaAutor: 'Soporte PS',
            respuestas: 8, vistas: 1870, reacciones: 33, etiquetas: ['guia', 'soporte'],
            cuerpo: '[h2]Abrir un ticket[/h2]\n[list=1][*]Entra en [b]Soporte[/b] e inicia sesión con Discord.[*]Pulsa [b]Nuevo ticket[/b] y elige la categoría.[*]Describe el problema con el mayor detalle posible.[*]Si tienes una captura, pega el enlace de Imgur en el mensaje.[/list]\n\n[quote]Un ticket bien descrito se resuelve mucho más rápido. 🙌[/quote]'
        },
        {
            id: 't_error_movil', seccion: 'soporte', prefijo: 'AYUDA', fijado: false, cerrado: false,
            titulo: 'Error al cargar el garaje en dispositivo móvil',
            autorNombre: 'Miguel', autorUid: 'user_miguel', autorEmail: '',
            autorRol: 'usuario', autorAvatar: '', autorMensajes: 4, autorDesde: '2026',
            creadoEn: D(3), actualizadoEn: D(1), ultimaRespuestaEn: D(1), ultimaRespuestaAutor: 'Carlos Dev',
            respuestas: 5, vistas: 420, reacciones: 7, etiquetas: ['bug', 'movil'],
            cuerpo: '[h2]Problema[/h2]\nAl abrir el garaje en móvil la pantalla se queda en negro durante unos segundos.\n\n[b]Dispositivo:[/b] Android 14 · [b]Versión:[/b] 0.9.2\n\n¿Alguien más lo ha notado?'
        },
        {
            id: 't_ideas', seccion: 'sugerencias', prefijo: 'DEBATE', fijado: false, cerrado: false,
            titulo: 'Ideas para nuevos trabajos y vehículos 💡',
            autorNombre: 'Valentina', autorUid: 'user_vale', autorEmail: '',
            autorRol: 'vip', autorAvatar: '', autorMensajes: 21, autorDesde: '2026',
            creadoEn: D(12), actualizadoEn: D(2), ultimaRespuestaEn: D(2), ultimaRespuestaAutor: 'PanterGameY',
            respuestas: 29, vistas: 1540, reacciones: 76, etiquetas: ['ideas'],
            cuerpo: '[h2]Buzón de ideas[/h2]\n¿Qué te gustaría ver en el juego? Deja tu propuesta con un título claro y una descripción corta.\n\n[list][*]Reparto de comida a domicilio.[*]Grúa y rescate en carretera.[*]Transporte escolar.[/list]\n\n[b]¡Las mejores ideas se revisan en equipo cada semana![/b]'
        },
        {
            id: 't_normativa_comunidad', seccion: 'anuncios', prefijo: 'OFICIAL', fijado: false, cerrado: true,
            titulo: 'Normas de la comunidad y del foro (lectura obligatoria)',
            autorNombre: 'Fénix', autorUid: 'team_fenix', autorEmail: '',
            autorRol: 'administrador', autorAvatar: '', autorMensajes: 27, autorDesde: '2026',
            creadoEn: D(28), actualizadoEn: D(11), ultimaRespuestaEn: D(11), ultimaRespuestaAutor: 'Fénix',
            respuestas: 0, vistas: 5230, reacciones: 112, etiquetas: ['normativa', 'comunidad'],
            cuerpo: '[h2]Normas de la comunidad[/h2]\n[h3]1. Respeto[/h3]\nTrata a todos los conductores y al equipo con respeto. No se tolera el acoso ni el lenguaje discriminatorio.\n\n[h3]2. Contenido del proyecto[/h3]\nPublica en la sección correcta y centrado en [b]Nuestra Tierra Job Simulator[/b] y los proyectos de Panter Studio. Nada de spam ni enlaces sospechosos.\n\n[h3]3. Reportes[/h3]\nUsa el botón [b]Reportar[/b] o abre un ticket en Soporte ante cualquier incidencia.\n\n[center][b]El incumplimiento puede conllevar sanciones.[/b][/center]'
        },
        {
            id: 't_musica', seccion: 'offtopic', prefijo: 'DEBATE', fijado: false, cerrado: false,
            titulo: '¿Qué música escuchan mientras juegan? 🎧',
            autorNombre: 'Andrés', autorUid: 'user_andres', autorEmail: '',
            autorRol: 'usuario', autorAvatar: '', autorMensajes: 12, autorDesde: '2026',
            creadoEn: D(5), actualizadoEn: D(1), ultimaRespuestaEn: D(1), ultimaRespuestaAutor: 'Laura',
            respuestas: 19, vistas: 780, reacciones: 25, etiquetas: ['offtopic'],
            cuerpo: '[h2]Playlist de la comunidad[/h2]\n¡Comparte tu lista de reproducción! La nuestra tiene mucho synthwave y algo de champeta para las rutas de montaña. 🎶\n\n[center]🐾[/center]'
        }
    ];

    const SEED_MESSAGES = [
        { id: 'm_rutas_1', temaId: 't_nuestra_tierra', autorNombre: 'Fénix', autorUid: 'team_fenix', autorRol: 'administrador', autorAvatar: '', creadoEn: D(20),
          cuerpo: '[quote=PanterGameY]Queremos que cada ruta se sienta real: el peso de la carga, el clima y la carretera deben importar de verdad.[/quote]\n\nRecordatorio: [b]las rutas de montaña con lluvia ya están en pruebas internas[/b]. Publicad vuestras propuestas de ruta como respuesta a este hilo. 🚚' },
        { id: 'm_rutas_2', temaId: 't_nuestra_tierra', autorNombre: 'Albert Acosta', autorUid: 'team_albert', autorRol: 'moderador', autorAvatar: '', creadoEn: D(9),
          cuerpo: '[h3]Propuesta de ruta[/h3]\n[code]PROYECTO: Nuestra Tierra Job Simulator\nRUTA: Corredor cafetero - tramo de montaña\nVEHICULO: Camion de carga pesada\nCARGA: 8 toneladas\nPLATAFORMAS: PC y moviles[/code]\n\n¡Quedo atento a las pruebas! 🗺️' },
        { id: 'm_rutas_3', temaId: 't_nuestra_tierra', autorNombre: 'Fénix', autorUid: 'team_fenix', autorRol: 'administrador', autorAvatar: '', creadoEn: D(2),
          cuerpo: 'Recibida, [b]Albert[/b]. La añadimos al listado de rutas de la Temporada 1 para probar físicas de carga. ¡Gracias! ✅' },
        { id: 'm_bien_1', temaId: 't_bienvenida', autorNombre: 'Carlos Dev', autorUid: 'team_carlos', autorRol: 'programador', autorAvatar: '', creadoEn: D(1),
          cuerpo: '¡Genial tener el foro en marcha! 🐾 Si encontráis cualquier fallo, reportadlo aquí mismo o en Soporte.' },
        { id: 'm_pres_1', temaId: 't_presentaciones', autorNombre: 'Laura', autorUid: 'user_laura', autorRol: 'usuario', autorAvatar: '', creadoEn: D(0),
          cuerpo: '¡Hola a todos! Soy Laura, de Medellín 🇨🇴. Mi trabajo favorito es el de mensajería, me encanta conducir de noche con lluvia. 🌧️🚚' },
        { id: 'm_cap_1', temaId: 't_capturas', autorNombre: 'Miguel', autorUid: 'user_miguel', autorRol: 'usuario', autorAvatar: '', creadoEn: D(3),
          cuerpo: 'Aquí va una de la carretera de montaña al atardecer. La luz del juego es una locura 🌄' },
        { id: 'm_err_1', temaId: 't_error_movil', autorNombre: 'Carlos Dev', autorUid: 'team_carlos', autorRol: 'programador', autorAvatar: '', creadoEn: D(1),
          cuerpo: 'Gracias por el reporte, [b]Miguel[/b]. Estamos revisando la carga de texturas en móvil; quedará corregido en el próximo parche. 🛠️' },
        { id: 'm_ideas_1', temaId: 't_ideas', autorNombre: 'PanterGameY', autorUid: 'founder_pantergamey', autorRol: 'founder_ceo', autorAvatar: '', creadoEn: D(2),
          cuerpo: '¡Buenísimas ideas! La [b]grúa y rescate en carretera[/b] ya está en el backlog de la Temporada 1. 🚀' }
    ];

    /* ── Utilidades ─────────────────────────────────────────── */
    const $ = (id) => document.getElementById(id);
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function decodeEntities(str) {
        return String(str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    }
    function readJson(key, fallback) {
        try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
        catch (e) { return fallback; }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
    }
    function notifyLocal() {
        try { document.dispatchEvent(new CustomEvent(LOCAL_EVENT)); } catch (e) { /* noop */ }
    }
    /* Compatibilidad silenciosa: cualquier id de sección antiguo o
       desconocido se resuelve a la sección del proyecto, de modo que los
       temas ya guardados nunca desaparecen ni rompen la navegación. */
    function secDef(id) {
        return SECTIONS.find(s => s.id === String(id || '')) || SECTIONS[2];
    }
    function escAttr(v) { return esc(decodeEntities(v)); }

    function fmtDate(value, withTime) {
        if (!value) return '—';
        const d = new Date(value);
        if (isNaN(d.getTime())) return esc(value);
        const opts = { day: '2-digit', month: 'short', year: 'numeric' };
        if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
        return esc(d.toLocaleDateString('es-ES', opts));
    }
    function timeAgo(value) {
        const t = new Date(value).getTime();
        if (!t) return '—';
        const mins = Math.floor((Date.now() - t) / 60000);
        if (mins < 1) return 'ahora mismo';
        if (mins < 60) return `hace ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `hace ${hrs} h`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `hace ${days} d`;
        return fmtDate(value);
    }
    function toast(message, type) {
        const el = $('foroToast');
        if (!el) return;
        el.textContent = message;
        el.className = `foro-toast show${type ? ' ' + type : ''}`;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { el.className = 'foro-toast'; }, 3200);
    }

    /* ── BBCode (seguro: se escapa TODO y luego se aplican tags) ─ */
    function normalizeImageUrl(raw) {
        let u = String(raw || '').trim().replace(/[.,;:!?)]+$/, '');
        if (!/^https?:\/\//i.test(u)) return '';
        const page = u.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,12})\/?(?:[?#].*)?$/i);
        if (page) return `https://i.imgur.com/${page[1]}.jpg`;
        if (/^https?:\/\/(?:www\.)?imgur\.com\/(?:a|gallery|t)\//i.test(u)) return '';
        return u;
    }

    function renderBB(raw) {
        let s = esc(String(raw == null ? '' : raw));
        const blocks = [];
        const stash = (html) => { blocks.push(html); return `\u0001B${blocks.length - 1}\u0001`; };
        const urlOk = (u) => /^https?:\/\//i.test(decodeEntities(String(u)).trim());

        // Bloques primero (se guardan como marcadores para que los saltos
        // de línea no se conviertan en <br> dentro de ellos).
        s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (m, c) =>
            stash(`<pre class="foro-code"><code>${String(c).replace(/^\n/, '')}</code></pre>`));

        s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (m, u) => {
            const clean = decodeEntities(u).trim();
            const norm = normalizeImageUrl(clean);
            if (!norm) return m;
            return stash(`<img class="foro-img" src="${esc(norm)}" alt="Imagen adjunta" loading="lazy" decoding="async" data-foro-img data-name="Imagen adjunta">`);
        });

        s = s.replace(/\[list(?:=(?:1|a))?\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
            const tag = /\[list=(?:1|a)\]/i.test(m) ? 'ol' : 'ul';
            const items = String(inner).split(/\[\*\]/g).map(x => x.trim()).filter(Boolean)
                .map(x => `<li>${x}</li>`).join('');
            return stash(`<${tag} class="foro-list">${items}</${tag}>`);
        });

        s = s.replace(/\[quote(?:=[^\]]+)?\]([\s\S]*?)\[\/quote\]/gi, (m, body) => {
            const who = (m.match(/^\[quote=([^\]]+)\]/i) || [])[1] || '';
            return stash(`<blockquote>${who ? `<cite>${esc(decodeEntities(who))} dijo:</cite>` : ''}${body}</blockquote>`);
        });

        s = s.replace(/\[(center|left|right)\]([\s\S]*?)\[\/\1\]/gi, (m, al, inner) =>
            stash(`<div class="foro-${al.toLowerCase()}">${inner}</div>`));
        s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, (m, c) => stash(`<h2>${c}</h2>`));
        s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, (m, c) => stash(`<h3>${c}</h3>`));
        s = s.replace(/\[hr\]/gi, () => stash('<hr>'));

        // Enlaces (sólo http/https; el resto se deja como texto).
        s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (m, u, label) => {
            if (!urlOk(u)) return label;
            const href = escAttr(u);
            return `<a href="${href}" target="_blank" rel="noopener nofollow">${label}</a>`;
        });
        s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, u) => {
            if (!urlOk(u)) return m;
            const href = escAttr(u);
            return `<a href="${href}" target="_blank" rel="noopener nofollow">${href}</a>`;
        });

        // Formato en línea.
        s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
        s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
        s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
        s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');
        s = s.replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi, (m, n, t) => {
            const map = { 1: '.72rem', 2: '.8rem', 3: '.88rem', 4: '1rem', 5: '1.15rem', 6: '1.35rem', 7: '1.6rem' };
            return `<span style="font-size:${map[n] || map[3]}">${t}</span>`;
        });
        s = s.replace(/\[color=(#[0-9a-f]{3,8}|[a-z]+)\]([\s\S]*?)\[\/color\]/gi, (m, c, t) =>
            `<span style="color:${escAttr(c)}">${t}</span>`);
        s = s.replace(/\[font=([a-z0-9 ,'\-]+)\]([\s\S]*?)\[\/font\]/gi, (m, f, t) =>
            `<span style="font-family:${escAttr(f)},sans-serif">${t}</span>`);

        // Saltos de línea y restauración de bloques.
        s = s.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
        s = s.replace(/\u0001B(\d+)\u0001/g, (m, i) => blocks[Number(i)] || '');
        // Limpia <br> pegados a bloques para no duplicar espacios.
        s = s.replace(/<br>\s*(<(?:pre|blockquote|ul|ol|h2|h3|div|hr|img)\b)/gi, '$1');
        s = s.replace(/(<\/(?:pre|blockquote|ul|ol|h2|h3|div)>|<hr>)\s*<br>/gi, '$1');
        return s;
    }

    /* ── Estado ─────────────────────────────────────────────── */
    let currentUser = null;
    let userRole = 'usuario';
    let searchTerm = '';
    let filterMode = 'all';           // 'all' | 'subs' | 'bookmarks'
    let routeState = { view: 'indice' };
    let remoteTopics = [];
    let remoteMessages = [];
    let topicsUnsub = null;
    let messagesUnsub = null;
    let currentMessagesTopic = null;
    let renderPending = false;
    let authTimer = null;
    let moreOpen = false;   // estado del menú «...» que sobrevive a los re-renders

    let subs = new Set((readJson(LS_SUBS, []) || []).map(String));
    let bookmarks = new Set((readJson(LS_BOOKMARKS, []) || []).map(String));

    /* ── Persistencia local ─────────────────────────────────── */
    function localTopics() {
        const v = readJson(LS_TOPICS, []);
        return Array.isArray(v) ? v.filter(t => t && t.id) : [];
    }
    function localMessages() {
        const v = readJson(LS_MESSAGES, []);
        return Array.isArray(v) ? v.filter(m => m && m.id) : [];
    }
    function upsertLocalTopic(t) {
        writeJson(LS_TOPICS, localTopics().filter(x => x.id !== t.id).concat([t]));
        notifyLocal();
    }
    function upsertLocalMessage(m) {
        writeJson(LS_MESSAGES, localMessages().filter(x => x.id !== m.id).concat([m]));
        notifyLocal();
    }
    function stripForFirestore(obj) {
        const out = {};
        Object.keys(obj || {}).forEach(k => {
            if (k.charAt(0) !== '_' && obj[k] !== undefined) out[k] = obj[k];
        });
        return out;
    }

    /* Mezcla remoto + local por id, conservando el más reciente y
       tomando el MAYOR de los contadores para no perder respuestas. */
    function mergeById(remote, local) {
        const map = new Map();
        (Array.isArray(remote) ? remote : []).forEach(x => {
            if (x && x.id) map.set(String(x.id), Object.assign({}, x));
        });
        (Array.isArray(local) ? local : []).forEach(x => {
            if (!x || !x.id) return;
            const k = String(x.id);
            const prev = map.get(k);
            if (!prev) { map.set(k, Object.assign({}, x)); return; }
            const a = new Date(prev.actualizadoEn || prev.creadoEn || 0).getTime() || 0;
            const b = new Date(x.actualizadoEn || x.creadoEn || 0).getTime() || 0;
            const base = b >= a ? Object.assign({}, x) : Object.assign({}, prev);
            const other = b >= a ? prev : x;
            Object.keys(other).forEach(key => {
                if (base[key] == null || base[key] === '') base[key] = other[key];
            });
            ['respuestas', 'vistas'].forEach(f => {
                base[f] = Math.max(Number(prev[f] || 0), Number(x[f] || 0));
            });
            const ta = new Date(prev.ultimaRespuestaEn || 0).getTime() || 0;
            const tb = new Date(x.ultimaRespuestaEn || 0).getTime() || 0;
            if (tb < ta) {
                base.ultimaRespuestaEn = prev.ultimaRespuestaEn;
                base.ultimaRespuestaAutor = prev.ultimaRespuestaAutor;
            }
            map.set(k, base);
        });
        return Array.from(map.values());
    }
    function mergeWithSeed(seed, over) {
        const out = Object.assign({}, seed, over);
        Object.keys(seed).forEach(k => { if (out[k] == null || out[k] === '') out[k] = seed[k]; });
        ['respuestas', 'vistas'].forEach(f => {
            out[f] = Math.max(Number(seed[f] || 0), Number(over[f] || 0));
        });
        const ta = new Date(seed.ultimaRespuestaEn || 0).getTime() || 0;
        const tb = new Date(over.ultimaRespuestaEn || 0).getTime() || 0;
        if (tb < ta) { out.ultimaRespuestaEn = seed.ultimaRespuestaEn; out.ultimaRespuestaAutor = seed.ultimaRespuestaAutor; }
        return out;
    }
    /* Seeds de contenido retirado al enfocar el foro exclusivamente en
       Nuestra Tierra Job Simulator. El contador de vistas había podido
       persistirlos en `ps_foro_temas_local` / Firestore en visitas
       anteriores; se descartan SOLO estos ids de semilla (nunca temas
       creados por usuarios) para que no reaparezcan. */
    const RETIRED_SEED_IDS = new Set(['t_srpd', 't_normativa_rp']);
    const RETIRED_MESSAGE_IDS = new Set(['m_srpd_1', 'm_srpd_2', 'm_srpd_3']);

    function allTopics() {
        const merged = mergeById(remoteTopics, localTopics())
            .filter(t => !RETIRED_SEED_IDS.has(String(t.id)));
        const map = new Map(merged.map(t => [String(t.id), t]));
        SEED_TOPICS.forEach(s => {
            const k = String(s.id);
            map.set(k, map.has(k) ? mergeWithSeed(s, map.get(k)) : Object.assign({}, s));
        });
        return Array.from(map.values());
    }
    function replyCount(t) {
        const local = localMessages().filter(m => m.temaId === t.id && !RETIRED_MESSAGE_IDS.has(String(m.id))).length;
        const seed = SEED_MESSAGES.filter(m => m.temaId === t.id).length;
        return Math.max(Number(t.respuestas || 0), local + seed);
    }
    function allMessages(temaId) {
        const map = new Map();
        const add = (m) => { if (m && m.id) map.set(String(m.id), Object.assign({ temaId }, m)); };
        SEED_MESSAGES.filter(m => m.temaId === temaId).forEach(add);
        remoteMessages.filter(m => m.temaId === temaId && !RETIRED_MESSAGE_IDS.has(String(m.id))).forEach(add);
        localMessages().filter(m => m.temaId === temaId && !RETIRED_MESSAGE_IDS.has(String(m.id))).forEach(m => {
            map.set(String(m.id), Object.assign({}, map.get(String(m.id)) || {}, m, { temaId }));
        });
        return Array.from(map.values()).sort((a, b) =>
            String(a.creadoEn || '').localeCompare(String(b.creadoEn || '')));
    }

    /* ── Firestore (local-first, nunca bloquea) ─────────────── */
    function firebaseReady() {
        return Boolean(window.db && window.collection && window.fsDoc && window.setDoc
            && window.onSnapshot && window.getDoc && window.updateDoc);
    }
    function waitForFirebase(timeout) {
        return new Promise(resolve => {
            if (firebaseReady()) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (firebaseReady()) { clearInterval(timer); resolve(true); }
                else if (Date.now() - start >= (timeout || 10000)) { clearInterval(timer); resolve(false); }
            }, 150);
        });
    }
    function startTopicsFeed() {
        if (topicsUnsub || !firebaseReady()) return;
        try {
            topicsUnsub = window.onSnapshot(
                window.collection(window.db, COLLECTION),
                snap => {
                    remoteTopics = snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
                    scheduleRender();
                },
                err => console.warn('[Foro] Sincronización de temas no disponible:', err && err.message)
            );
        } catch (e) { console.warn('[Foro] No se pudo iniciar la sincronización:', e); }
    }
    function setMessagesFeed(temaId) {
        if (currentMessagesTopic === temaId) return;
        if (messagesUnsub) { try { messagesUnsub(); } catch (e) { /* noop */ } messagesUnsub = null; }
        currentMessagesTopic = temaId || null;
        remoteMessages = [];
        if (!temaId || !firebaseReady()) return;
        try {
            messagesUnsub = window.onSnapshot(
                window.collection(window.db, COLLECTION, temaId, 'mensajes'),
                snap => {
                    remoteMessages = snap.docs.map(d => Object.assign({ id: d.id, temaId }, d.data() || {}));
                    scheduleRender();
                },
                err => console.warn('[Foro] Mensajes no disponibles:', err && err.message)
            );
        } catch (e) { console.warn('[Foro] Suscripción a mensajes:', e); }
    }
    function reattachFeeds() {
        const tid = currentMessagesTopic;
        currentMessagesTopic = null;
        if (messagesUnsub) { try { messagesUnsub(); } catch (e) { /* noop */ } messagesUnsub = null; }
        setMessagesFeed(tid);
        startTopicsFeed();
    }

    // La escritura remota nunca puede retrasar la copia local: si la red
    // o las reglas fallan, el contenido ya está a salvo en localStorage.
    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms || 4000))
        ]);
    }

    async function saveTopic(t) {
        // 1) Local PRIMERO (inmediato, sin depender de la red).
        upsertLocalTopic(t);
        if (!firebaseReady()) return false;
        try {
            await withTimeout(
                window.setDoc(window.fsDoc(window.db, COLLECTION, t.id), stripForFirestore(t)), 4000);
            return true;
        } catch (e) {
            console.warn('[Foro] Tema guardado en copia local:', e && e.message);
            return false;
        }
    }

    async function saveMessage(m, updatedTopic) {
        // 1) Local PRIMERO: el mensaje y los contadores nunca se pierden.
        upsertLocalMessage(m);
        upsertLocalTopic(updatedTopic);
        if (!firebaseReady()) return false;

        let remoteOk = false;
        try {
            await withTimeout(
                window.setDoc(
                    window.fsDoc(window.db, COLLECTION, m.temaId, 'mensajes', m.id),
                    stripForFirestore(m)
                ), 4000);
            remoteOk = true;
        } catch (e) {
            console.warn('[Foro] Respuesta guardada en copia local:', e && e.message);
        }

        // 2) Contadores del tema en la nube: updateDoc si existe,
        //    setDoc si es un tema semilla que aún no se ha materializado.
        try {
            await withTimeout(
                window.updateDoc(window.fsDoc(window.db, COLLECTION, m.temaId), {
                    respuestas: window.increment ? window.increment(1) : Number(updatedTopic.respuestas || 0),
                    ultimaRespuestaEn: m.creadoEn,
                    ultimaRespuestaAutor: m.autorNombre,
                    actualizadoEn: m.creadoEn
                }), 3000);
        } catch (e) {
            try {
                await withTimeout(
                    window.setDoc(window.fsDoc(window.db, COLLECTION, m.temaId), stripForFirestore(updatedTopic)),
                    3000);
            } catch (e2) { /* la copia local ya está garantizada */ }
        }
        return remoteOk;
    }

    /* ── Usuario / rangos ───────────────────────────────────── */
    function syncUser() {
        currentUser = (window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function')
            ? window.DiscordAuth.getUser() : null;
        computeRole();
    }
    function applyRole(role) {
        userRole = role || 'usuario';
        scheduleRender();
    }
    async function computeRole() {
        const R = window.PanterRoles;
        if (!currentUser) { applyRole('usuario'); return; }
        // Misma fuente que el Panel Admin, Soporte y Personal.
        const S = window.PanterStaff;
        if (S && typeof S.resolveRoleFor === 'function') {
            applyRole(S.resolveRoleFor(currentUser));
            return;
        }
        const profile = { email: String(currentUser.email || '').trim().toLowerCase() };
        applyRole(R ? R.resolveRole(currentUser, profile) : 'usuario');
        if (window.db && window.getDoc && window.fsDoc) {
            try {
                const snap = await window.getDoc(window.fsDoc(window.db, 'equipo', currentUser.uid));
                if (snap && snap.exists()) {
                    const team = snap.data() || {};
                    if (team.archivado !== true && team.role) profile.teamRole = team.role;
                    if (team.email) profile.email = String(team.email).trim().toLowerCase();
                }
                applyRole(R ? R.resolveRole(currentUser, profile) : 'usuario');
            } catch (e) { /* roster opcional */ }
        }
    }
    function authorData() {
        const u = currentUser || {};
        let avatarUrl = String(u.photoURL || u.avatarUrl || '').trim();
        if (!avatarUrl && window.DiscordAuth && typeof window.DiscordAuth.getAvatarUrl === 'function') {
            try { avatarUrl = window.DiscordAuth.getAvatarUrl(u) || ''; } catch (e) { /* noop */ }
        }
        return {
            autorNombre: String(u.displayName || u.username || u.globalName || (u.email ? String(u.email).split('@')[0] : 'Miembro')).slice(0, 60),
            autorUid: String(u.uid || u.id || ''),
            autorEmail: String(u.email || '').trim().toLowerCase(),
            autorRol: userRole,
            autorAvatar: avatarUrl,
            autorMensajes: 1,
            autorDesde: String(new Date().getFullYear())
        };
    }
    function roleDef(role) {
        const R = window.PanterRoles;
        if (R && typeof R.get === 'function') {
            try {
                const def = R.get(typeof R.normalize === 'function' ? R.normalize(role) : role);
                if (def) return def;
            } catch (e) { /* noop */ }
        }
        return { id: 'usuario', label: 'Usuario', color: '#0055ff', icon: 'fa-solid fa-user' };
    }
    function badgeHtml(role) {
        const R = window.PanterRoles;
        if (R && typeof R.badgeHtml === 'function') {
            try { return R.badgeHtml(role); } catch (e) { /* noop */ }
        }
        return `<span class="foro-chip">${esc(role)}</span>`;
    }
    /**
     * Rango en vivo de un autor: se consulta la MISMA fuente que el Panel
     * Admin / Soporte / Personal. Si el rango cambia en Personal, los
     * mensajes ya publicados del foro se repintan con el rango nuevo.
     * No se inventa ningún rango: se usan sólo los ids oficiales.
     */
    function liveRole(a) {
        const S = window.PanterStaff;
        if (S && typeof S.roleForAuthor === 'function') {
            const rol = S.roleForAuthor({
                uid: a && a.autorUid,
                email: a && a.autorEmail,
                nombre: a && a.autorNombre
            });
            if (rol) return rol;
        }
        return (a && a.autorRol) || 'usuario';
    }
    function avatar(url, name, cls) {
        const clean = String(url || '').trim();
        const initial = esc(String(name || '?').charAt(0).toUpperCase());
        if (/^https?:\/\//i.test(clean)) {
            return `<div class="${cls}"><img src="${esc(clean)}" alt="${esc(name)}" data-name="${esc(name)}" loading="lazy" decoding="async" data-foro-avatar></div>`;
        }
        return `<div class="${cls}">${initial}</div>`;
    }

    /* ── Presencia "Leyendo ahora" ──────────────────────────── */
    function visitorInfo() {
        let id = sessionStorage.getItem('ps_foro_visitor');
        if (!id) {
            id = 'v_' + Math.random().toString(36).slice(2, 10);
            try { sessionStorage.setItem('ps_foro_visitor', id); } catch (e) { /* noop */ }
        }
        const a = authorData();
        return {
            id: currentUser ? (a.autorUid || id) : id,
            nombre: currentUser ? a.autorNombre : 'Invitado',
            avatar: currentUser ? a.autorAvatar : ''
        };
    }
    function markReading(temaId) {
        if (!temaId) return;
        try {
            const key = PRESENCE_PREFIX + temaId;
            const now = Date.now();
            const me = visitorInfo();
            let list = readJson(key, []);
            if (!Array.isArray(list)) list = [];
            list = list.filter(x => x && x.id !== me.id && (now - (x.at || 0)) < PRESENCE_TTL);
            list.push({ id: me.id, nombre: me.nombre, avatar: me.avatar, at: now });
            writeJson(key, list.slice(-40));
        } catch (e) { /* noop */ }
    }
    function readersFor(temaId) {
        try {
            const now = Date.now();
            const list = readJson(PRESENCE_PREFIX + temaId, []);
            return (Array.isArray(list) ? list : []).filter(x => x && (now - (x.at || 0)) < PRESENCE_TTL);
        } catch (e) { return []; }
    }
    function allReaders() {
        const seen = new Map();
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || k.indexOf(PRESENCE_PREFIX) !== 0) continue;
                readersFor(k.slice(PRESENCE_PREFIX.length)).forEach(r => {
                    if (!seen.has(r.id)) seen.set(r.id, r);
                });
            }
        } catch (e) { /* noop */ }
        return Array.from(seen.values());
    }

    /* ── Editor BBCode ──────────────────────────────────────── */
    const BB_TAGS = {
        b: ['[b]', '[/b]', 'texto'], i: ['[i]', '[/i]', 'texto'],
        u: ['[u]', '[/u]', 'texto'], s: ['[s]', '[/s]', 'texto'],
        h2: ['[h2]', '[/h2]', 'Encabezado'], h3: ['[h3]', '[/h3]', 'Subtítulo'],
        quote: ['[quote]', '[/quote]', 'Cita'], code: ['[code]', '[/code]', 'código'],
        list: ['[list]\n[*]', '\n[/list]', 'Primer elemento'],
        center: ['[center]', '[/center]', 'texto'],
        left: ['[left]', '[/left]', 'texto'],
        right: ['[right]', '[/right]', 'texto'],
        hr: ['[hr]', '', '']
    };

    function toolbarHtml(target) {
        const t = esc(target);
        const btn = (key, label, title) =>
            `<button type="button" class="foro-tool" data-foro-bb="${key}" data-foro-target="${t}" title="${esc(title)}" aria-label="${esc(title)}">${label}</button>`;
        return `
        <div class="foro-toolbar" role="toolbar" aria-label="Herramientas de formato">
            ${btn('b', '<b>B</b>', 'Negrita')}
            ${btn('i', '<i>I</i>', 'Cursiva')}
            ${btn('u', '<u>U</u>', 'Subrayado')}
            ${btn('s', '<s>S</s>', 'Tachado')}
            <span class="foro-tool-sep"></span>
            <select class="foro-tool-select" data-foro-select="font" data-foro-target="${t}" aria-label="Fuente" title="Fuente">
                <option value="">Fuente</option>
                <option value="Inter">Inter</option><option value="Georgia">Georgia</option>
                <option value="Courier New">Monoespacio</option><option value="Arial">Arial</option>
            </select>
            <select class="foro-tool-select" data-foro-select="size" data-foro-target="${t}" aria-label="Tamaño" title="Tamaño">
                <option value="">Tamaño</option>
                <option value="1">Muy pequeño</option><option value="2">Pequeño</option>
                <option value="3">Normal</option><option value="5">Grande</option><option value="7">Muy grande</option>
            </select>
            <select class="foro-tool-select" data-foro-select="color" data-foro-target="${t}" aria-label="Color" title="Color">
                <option value="">Color</option>
                <option value="#7dd3fc">Cian</option><option value="#f1c40f">Oro</option>
                <option value="#22c55e">Verde</option><option value="#f87171">Rojo</option>
                <option value="#c4b5fd">Violeta</option>
            </select>
            <span class="foro-tool-sep"></span>
            ${btn('h2', 'H2', 'Encabezado')}
            ${btn('h3', 'H3', 'Subtítulo')}
            ${btn('list', '<i class="fa-solid fa-list-ul"></i>', 'Lista con viñetas')}
            ${btn('left', '<i class="fa-solid fa-align-left"></i>', 'Alinear a la izquierda')}
            ${btn('center', '<i class="fa-solid fa-align-center"></i>', 'Centrar')}
            ${btn('right', '<i class="fa-solid fa-align-right"></i>', 'Alinear a la derecha')}
            <span class="foro-tool-sep"></span>
            ${btn('code', '<i class="fa-solid fa-code"></i>', 'Bloque de código')}
            ${btn('quote', '<i class="fa-solid fa-quote-right"></i>', 'Cita')}
            ${btn('url', '<i class="fa-solid fa-link"></i>', 'Enlace')}
            ${btn('img', '<i class="fa-regular fa-image"></i>', 'Imagen (Imgur o URL directa)')}
            ${btn('hr', '<i class="fa-solid fa-minus"></i>', 'Línea horizontal')}
            <span class="foro-tool-sep"></span>
            <div class="foro-emoji-wrap">
                <button type="button" class="foro-tool" data-foro-emoji-toggle="${t}" title="Emojis y pegatinas" aria-label="Emojis y pegatinas"><i class="fa-regular fa-face-smile"></i></button>
                <div class="foro-emoji-panel" id="${t}_emojis" hidden>
                    ${EMOJIS.map(x => `<button type="button" data-foro-emoji="${esc(x)}" data-foro-target="${t}" aria-label="Insertar ${esc(x)}">${esc(x)}</button>`).join('')}
                </div>
            </div>
            <button type="button" class="foro-tool" data-foro-raw="${t}" title="Ver código BB" style="font-size:.66rem;">Código BB</button>
        </div>`;
    }

    function editorHtml(target, opts) {
        const o = opts || {};
        const t = esc(target);
        return `
        <div class="foro-editor">
            ${toolbarHtml(target)}
            <div class="foro-editor-body">
                <textarea id="${t}" class="foro-textarea" rows="${o.rows || 6}" placeholder="${esc(o.placeholder || 'Escribe tu mensaje... Usa la barra de herramientas para dar formato.')}"></textarea>
            </div>
            <div class="foro-preview" id="${t}_preview" hidden>
                <div class="foro-preview-label" id="${t}_preview_label">Vista previa</div>
                <div class="foro-content" id="${t}_preview_body"></div>
            </div>
            <div class="foro-editor-foot">
                <span class="foro-hint">BBCode · negrita, listas, código, enlaces e imágenes Imgur.</span>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
                    <button type="button" class="foro-btn foro-btn-sm" data-foro-preview="${t}"><i class="fa-solid fa-eye" aria-hidden="true"></i> Vista Previa</button>
                    ${o.submitLabel ? `<button type="button" class="foro-btn foro-btn-primary foro-btn-sm" data-foro-submit="${t}"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ${esc(o.submitLabel)}</button>` : ''}
                </div>
            </div>
        </div>`;
    }

    function wrapSelection(ta, open, close, fallback) {
        if (!ta) return;
        const start = ta.selectionStart, end = ta.selectionEnd;
        const selected = ta.value.slice(start, end) || fallback;
        ta.value = ta.value.slice(0, start) + open + selected + close + ta.value.slice(end);
        ta.focus();
        const caret = start + open.length + selected.length;
        try { ta.setSelectionRange(caret, caret); } catch (e) { /* noop */ }
    }
    function insertAtCaret(ta, text) {
        if (!ta) return;
        const start = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        ta.focus();
        try { ta.setSelectionRange(start + text.length, start + text.length); } catch (e) { /* noop */ }
    }
    function applyTag(target, key) {
        const ta = $(target);
        if (!ta) return;
        if (key === 'url' || key === 'img') {
            const raw = window.prompt(
                key === 'img' ? 'Pega el enlace de la imagen (Imgur o URL directa https://...):' : 'Enlace (https://...):',
                'https://'
            );
            if (!raw) return;
            const url = String(raw).trim();
            if (!/^https?:\/\//i.test(url)) { toast('El enlace debe empezar por https://', 'error'); return; }
            if (key === 'img') wrapSelection(ta, '[img]', '[/img]', url);
            else wrapSelection(ta, `[url=${url}]`, '[/url]', url);
            return;
        }
        const pair = BB_TAGS[key];
        if (pair) wrapSelection(ta, pair[0], pair[1], pair[2]);
    }
    function applySelect(target, kind, value) {
        if (!value) return;
        const ta = $(target);
        const map = {
            font: [`[font=${value}]`, '[/font]'],
            size: [`[size=${value}]`, '[/size]'],
            color: [`[color=${value}]`, '[/color]']
        };
        if (map[kind]) wrapSelection(ta, map[kind][0], map[kind][1], 'texto');
    }
    function showPreview(target, mode) {
        const box = $(target + '_preview');
        const body = $(target + '_preview_body');
        const label = $(target + '_preview_label');
        const ta = $(target);
        if (!box || !body || !ta) return;
        if (!box.hidden && box.dataset.mode === mode) {
            box.hidden = true; box.dataset.mode = ''; return;
        }
        box.hidden = false; box.dataset.mode = mode;
        label.textContent = mode === 'raw' ? 'Código BB' : 'Vista previa';
        body.innerHTML = mode === 'raw'
            ? `<pre class="foro-code"><code>${esc(ta.value || '(vacío)')}</code></pre>`
            : (ta.value.trim() ? renderBB(ta.value) : '<p class="foro-hint">Nada que previsualizar todavía.</p>');
    }

    /* ── Navegación por hash ────────────────────────────────── */
    function parseRoute() {
        const raw = decodeURIComponent(String(location.hash || '').replace(/^#/, ''));
        const eq = raw.indexOf('=');
        const key = eq === -1 ? raw : raw.slice(0, eq);
        const val = eq === -1 ? '' : raw.slice(eq + 1);
        if (key === 'tema' && val) return { view: 'tema', id: val };
        if (key === 'seccion' && val) return { view: 'seccion', id: val };
        if (key === 'crear') return { view: 'crear' };
        return { view: 'indice' };
    }
    function go(hash) {
        const next = '#' + String(hash || '').replace(/^#/, '');
        if (location.hash === next) { render(); return; }
        location.hash = next;
    }

    /* ── Render: piezas comunes ─────────────────────────────── */
    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        // setTimeout en lugar de requestAnimationFrame: Chromium SUSPENDE
        // rAF en pestañas en segundo plano, lo que dejaba los cambios
        // locales (respuestas, suscripciones, sesión) sin repintar.
        setTimeout(() => { renderPending = false; render(); }, 16);
    }
    function setView(which) {
        const idx = $('foroIndexView');
        const thr = $('foroThreadView');
        if (idx) idx.hidden = which !== 'indice';
        if (thr) thr.hidden = which !== 'tema';
    }
    function breadcrumb(parts) {
        const el = $('foroBreadcrumb');
        if (!el) return;
        let html = `<a href="#indice"><i class="fa-solid fa-house" aria-hidden="true"></i> Foros</a>`;
        parts.forEach((p, i) => {
            html += `<span class="sep"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>`;
            if (p.href && i < parts.length - 1) html += `<a href="${esc(p.href)}">${esc(p.label)}</a>`;
            else html += `<span class="current">${esc(p.label)}</span>`;
        });
        el.innerHTML = html;
    }
    function renderHeroStats() {
        const el = $('foroHeroStats');
        if (!el) return;
        const topics = allTopics();
        const total = topics.reduce((n, t) => n + replyCount(t), 0);
        el.innerHTML = `
            <div class="foro-hero-stat"><b>${topics.length}</b><span>Temas</span></div>
            <div class="foro-hero-stat"><b>${total}</b><span>Mensajes</span></div>
            <div class="foro-hero-stat"><b>${SECTIONS.length}</b><span>Secciones</span></div>
            <div class="foro-hero-stat"><b>${subs.size}</b><span>Suscritos</span></div>`;
    }

    /* ── Render: ÍNDICE ─────────────────────────────────────── */
    function renderIndex(sectionFilter) {
        setView('indice');
        setMessagesFeed(null);
        renderHeroStats();
        moreOpen = false;   // al volver al índice se cierra el menú del hilo
        closeCreateModal();

        // Normaliza también enlaces antiguos: cualquier id desconocido
        // aterriza en la sección del proyecto sin dejar rastros visibles.
        const activeSection = sectionFilter ? secDef(sectionFilter) : null;
        const sec = activeSection;
        breadcrumb(sec ? [{ label: sec.label, href: `#seccion=${esc(sec.id)}` }] : []);
        $('foroStickyActions').innerHTML = `
            <button type="button" class="foro-btn foro-btn-sm" data-foro-action="buscar"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Buscar</button>
            <button type="button" class="foro-btn foro-btn-sm${filterMode === 'subs' ? ' is-on' : ''}" data-foro-action="suscripciones"><i class="fa-solid fa-bell" aria-hidden="true"></i> Suscripciones</button>
            <button type="button" class="foro-btn foro-btn-sm${filterMode === 'bookmarks' ? ' is-on' : ''}" data-foro-action="marcadores"><i class="fa-solid fa-bookmark" aria-hidden="true"></i> Marcadores</button>
            <button type="button" class="foro-btn foro-btn-primary foro-btn-sm" data-foro-action="crear"><i class="fa-solid fa-plus" aria-hidden="true"></i> Crear tema</button>`;

        const topics = allTopics();
        const sectionsHtml = SECTIONS.map(s => {
            const list = topics.filter(t => secDef(t.seccion).id === s.id);
            const mensajes = list.reduce((n, t) => n + replyCount(t), 0);
            const last = list.slice().sort((a, b) =>
                String(b.ultimaRespuestaEn || b.creadoEn || '').localeCompare(String(a.ultimaRespuestaEn || a.creadoEn || '')))[0];
            return `
            <a class="foro-section" href="#seccion=${esc(s.id)}" style="--sec-color:${esc(s.color)}${activeSection && activeSection.id === s.id ? ';border-color:' + esc(s.color) : ''}">
                <span class="foro-section-icon"><i class="${esc(s.icon)}" aria-hidden="true"></i></span>
                <span>
                    <span class="foro-section-name">${esc(s.label)}</span>
                    <span class="foro-section-desc">${esc(s.desc)}</span>
                </span>
                <span class="foro-section-stats"><b>${list.length}</b><span>temas · ${mensajes} mensajes</span></span>
                <span class="foro-section-last">${last ? `Último: ${esc(last.titulo)} · ${esc(timeAgo(last.ultimaRespuestaEn || last.creadoEn))}` : 'Sin temas todavía'}</span>
            </a>`;
        }).join('');
        $('foroSections').innerHTML = sectionsHtml;

        let list = topics.slice();
        if (activeSection) list = list.filter(t => secDef(t.seccion).id === activeSection.id);
        if (filterMode === 'subs') list = list.filter(t => subs.has(String(t.id)));
        if (filterMode === 'bookmarks') list = list.filter(t => bookmarks.has(String(t.id)));
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t =>
                String(t.titulo || '').toLowerCase().includes(q) ||
                String(t.cuerpo || '').toLowerCase().includes(q) ||
                String(t.autorNombre || '').toLowerCase().includes(q) ||
                String(secDef(t.seccion).label).toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            if (Boolean(a.fijado) !== Boolean(b.fijado)) return a.fijado ? -1 : 1;
            return String(b.ultimaRespuestaEn || b.creadoEn || '').localeCompare(String(a.ultimaRespuestaEn || a.creadoEn || ''));
        });

        const panelTitle = searchTerm ? `Resultados para «${searchTerm}»`
            : filterMode === 'subs' ? 'Mis suscripciones'
            : filterMode === 'bookmarks' ? 'Mis marcadores'
            : activeSection ? `Temas de ${activeSection.label}` : 'Temas recientes';

        $('foroIndexTitle').textContent = panelTitle;
        $('foroIndexCount').textContent = `${list.length} tema${list.length === 1 ? '' : 's'}`;
        $('foroTopicList').innerHTML = list.length ? list.map(t => {
            const s = secDef(t.seccion);
            return `
            <a class="foro-topic-row" href="#tema=${esc(t.id)}">
                <span class="foro-topic-ico${t.fijado ? ' fijado' : ''}"><i class="${t.fijado ? 'fa-solid fa-thumbtack' : 'fa-regular fa-comment-dots'}" aria-hidden="true"></i></span>
                <span>
                    <span class="foro-topic-title">
                        ${t.prefijo ? `<span class="foro-chip prefijo">${esc(t.prefijo)}</span>` : ''}
                        ${t.fijado ? '<span class="foro-chip fijado">Fijado</span>' : ''}
                        ${t.cerrado ? '<span class="foro-chip cerrado">Cerrado</span>' : ''}
                        ${esc(t.titulo)}
                        <small>por ${esc(t.autorNombre)} · ${esc(s.label)} · ${esc(fmtDate(t.creadoEn))}</small>
                    </span>
                </span>
                <span class="foro-topic-cell"><b>${replyCount(t)}</b><br>respuestas</span>
                <span class="foro-topic-cell vistas"><b>${Number(t.vistas || 0)}</b><br>vistas</span>
                <span class="foro-topic-last"><span>${esc(t.ultimaRespuestaAutor || t.autorNombre)}</span>${esc(timeAgo(t.ultimaRespuestaEn || t.creadoEn))}</span>
            </a>`;
        }).join('') : `<div class="foro-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i>No hay temas que coincidan con tu búsqueda.<br><button type="button" class="foro-btn foro-btn-sm" data-foro-action="limpiar" style="margin-top:.8rem;">Ver todos los temas</button></div>`;

        renderIndexSide(topics);
    }

    function renderIndexSide(topics) {
        const readers = allReaders();
        const popular = topics.slice().sort((a, b) => Number(b.vistas || 0) - Number(a.vistas || 0)).slice(0, 4);
        $('foroIndexSide').innerHTML = `
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-eye" aria-hidden="true"></i> Leyendo ahora</h3><span class="count">${readers.length}</span></div>
                <div class="foro-side-body">
                    <div class="foro-readers">${readers.slice(0, 8).map(r => avatar(r.avatar, r.nombre, 'foro-avatar')).join('') || '<span class="foro-readers-text">Solo tú por ahora.</span>'}</div>
                    <p class="foro-readers-text" style="margin:.6rem 0 0;">${readers.length} ${readers.length === 1 ? 'persona está' : 'personas están'} recorriendo el foro.</p>
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-fire" aria-hidden="true"></i> Temas destacados</h3></div>
                <div class="foro-side-body foro-related">
                    ${popular.map(t => `<a href="#tema=${esc(t.id)}">${esc(t.titulo)}<span>${Number(t.vistas || 0)} vistas · ${replyCount(t)} respuestas</span></a>`).join('')}
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Normas del foro</h3></div>
                <div class="foro-side-body">
                    <p class="foro-side-note">Respeta a los demás, publica en la sección correcta y busca antes de abrir un tema. Los enlaces sospechosos y el spam se eliminan. Para incidencias, usa el botón <b>Reportar</b> o abre un ticket en Soporte. 🐾</p>
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-bolt" aria-hidden="true"></i> Accesos rápidos</h3></div>
                <div class="foro-side-body foro-related">
                    <a href="../pages/actualizaciones.html">Actualizaciones del desarrollo<span>Novedades y parches</span></a>
                    <a href="../pages/soporte.html">Centro de Soporte<span>Abrir un ticket</span></a>
                    <a href="../pages/personal.html">Nuestro Personal<span>Equipo y rangos</span></a>
                    <a href="../pages/donaciones.html">Apóyanos<span>Impulsa el proyecto</span></a>
                </div>
            </div>`;
    }

    /* ── Render: HILO ───────────────────────────────────────── */
    function renderThread(temaId) {
        const t = allTopics().find(x => String(x.id) === String(temaId));
        if (!t) {
            setView('indice');
            renderIndex(null);
            toast('No encontramos ese tema. Mostrando el índice del foro.', 'error');
            return;
        }
        setView('tema');
        closeCreateModal();
        markReading(t.id);
        setMessagesFeed(t.id);
        renderHeroStats();

        const sec = secDef(t.seccion);
        breadcrumb([
            { label: sec.label, href: `#seccion=${esc(sec.id)}` },
            { label: t.titulo }
        ]);

        const isSub = subs.has(String(t.id));
        const isBook = bookmarks.has(String(t.id));
        $('foroStickyActions').innerHTML = `
            <button type="button" class="foro-btn foro-btn-sm${isSub ? ' is-on' : ''}" data-foro-action="suscribirse" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-bell" aria-hidden="true"></i> ${isSub ? 'Suscrito' : 'Suscribirse'}</button>
            <button type="button" class="foro-btn foro-btn-sm${isBook ? ' is-on' : ''}" data-foro-action="marcador" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-bookmark" aria-hidden="true"></i> ${isBook ? 'Guardado' : 'Marcador'}</button>
            <button type="button" class="foro-btn foro-btn-primary foro-btn-sm" data-foro-action="responder"><i class="fa-solid fa-reply" aria-hidden="true"></i> Responder</button>
            <div class="foro-more-wrap">
                <button type="button" class="foro-btn foro-btn-sm" data-foro-action="more" aria-label="Más opciones"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
                <div class="foro-more-menu" id="foroMoreMenu"${moreOpen ? '' : ' hidden'}>
                    <button type="button" data-foro-action="compartir"><i class="fa-solid fa-link" aria-hidden="true"></i> Copiar enlace del tema</button>
                    <button type="button" data-foro-action="reportar" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-flag" aria-hidden="true"></i> Reportar tema</button>
                    <button type="button" data-foro-action="limpiar"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver al índice</button>
                </div>
            </div>`;

        const opDef = roleDef(liveRole(t));
        $('foroThreadTitle').innerHTML = `
            <div class="foro-thread-title">
                ${t.prefijo ? `<span class="foro-chip prefijo">${esc(t.prefijo)}</span>` : ''}
                ${t.fijado ? '<span class="foro-chip fijado">Fijado</span>' : ''}
                ${t.cerrado ? '<span class="foro-chip cerrado">Cerrado</span>' : ''}
                ${esc(t.titulo)}
            </div>`;
        $('foroThreadMeta').innerHTML = `
            ${avatar(t.autorAvatar, t.autorNombre, 'foro-avatar')}
            <span>por <b style="color:#fff;">${esc(t.autorNombre)}</b></span>
            <span class="foro-chip">${esc(sec.label)}</span>
            <span><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${esc(fmtDate(t.creadoEn, true))}</span>
            <span><i class="fa-regular fa-comments" aria-hidden="true"></i> ${replyCount(t)} respuestas</span>
            <span><i class="fa-regular fa-eye" aria-hidden="true"></i> ${Number(t.vistas || 0)} vistas</span>`;
        $('foroThreadActions').innerHTML = `
            <button type="button" class="foro-btn foro-btn-sm${isSub ? ' is-on' : ''}" data-foro-action="suscribirse" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-bell" aria-hidden="true"></i> ${isSub ? 'Suscrito' : 'Suscribirse'}</button>
            <button type="button" class="foro-btn foro-btn-sm${isBook ? ' is-on' : ''}" data-foro-action="marcador" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-bookmark" aria-hidden="true"></i> ${isBook ? 'Guardado' : 'Marcador'}</button>
            <button type="button" class="foro-btn foro-btn-sm" data-foro-action="responder"><i class="fa-solid fa-reply" aria-hidden="true"></i> Responder</button>
            <a class="foro-btn foro-btn-sm" href="#seccion=${esc(sec.id)}"><i class="fa-solid fa-folder" aria-hidden="true"></i> ${esc(sec.label)}</a>`;
        $('foroThreadTitle').style.setProperty('--author-color', opDef.color || '#00b0ff');

        const messages = allMessages(t.id);
        const postsHtml = [postHtml(t, null, true, 1)].concat(
            messages.map((m, i) => postHtml(t, m, false, i + 2))
        ).join('');
        $('foroPosts').innerHTML = postsHtml;

        // Respuesta rápida: el editor es estático (se construye una vez),
        // así que no se pierde lo escrito al re-renderizar.
        const gate = $('foroReplyGate');
        const host = $('foroReplyEditorHost');
        if (gate) gate.hidden = Boolean(currentUser);
        if (host) host.hidden = !currentUser;
        const as = $('foroReplyAs');
        if (as) as.textContent = currentUser ? `Respondiendo como ${authorData().autorNombre}` : '';
        if (!t.cerrado && currentUser) {
            const btn = document.querySelector('[data-foro-submit="foroReplyText"]');
            if (btn) btn.disabled = false;
        }

        // Contador de vistas: una vez por sesión.
        try {
            const vk = 'ps_foro_visto_' + t.id;
            if (!sessionStorage.getItem(vk)) {
                sessionStorage.setItem(vk, '1');
                const updated = Object.assign({}, t, { vistas: Number(t.vistas || 0) + 1 });
                upsertLocalTopic(updated);
            }
        } catch (e) { /* noop */ }

        renderThreadSide(t, messages, sec);
    }

    function postHtml(t, m, isOp, num) {
        const a = isOp ? t : m;
        const role = liveRole(a);
        const color = roleDef(role).color || '#0055ff';
        const isAuthor = String(a.autorUid || '') && String(a.autorUid) === String(t.autorUid);
        const mensajes = isOp ? (Number(t.autorMensajes) || replyCount(t) + 1) : (Number(a.autorMensajes) || 1);
        const postId = isOp ? 'op' : String(a.id);
        const quoteBody = isOp ? t.cuerpo : (m ? m.cuerpo : '');
        return `
        <article class="foro-post${isOp ? ' is-op' : ''}" id="post-${esc(postId)}" style="--author-color:${esc(color)}">
            <div class="foro-author">
                ${avatar(a.autorAvatar, a.autorNombre, 'foro-avatar')}
                <div class="foro-author-name">${esc(a.autorNombre)}</div>
                <div class="foro-author-badge">${badgeHtml(role)}</div>
                ${isAuthor ? '<span class="foro-author-op">Autor del tema</span>' : ''}
                <div class="foro-author-stats">
                    <div><span>Mensajes</span><b>${mensajes}</b></div>
                    <div><span>En el foro</span><b>${esc(a.autorDesde || '2026')}</b></div>
                    <div><span>Reacciones</span><b>${Number(isOp ? (t.reacciones || 0) : (a.reacciones || 0))}</b></div>
                </div>
            </div>
            <div class="foro-body">
                <div class="foro-post-head">
                    <span><span class="num">#${num || 1}</span> · ${esc(fmtDate(a.creadoEn, true))} · ${esc(timeAgo(a.creadoEn))}</span>
                    <span>${isOp ? '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Tema original' : `<button type="button" class="foro-btn foro-btn-sm foro-btn-ghost" data-foro-action="ir-op"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Ir al tema</button>`}</span>
                </div>
                <div class="foro-content">${renderBB(quoteBody)}</div>
                <div class="foro-post-foot">
                    <button type="button" class="foro-btn foro-btn-sm foro-btn-ghost" data-foro-action="responder"><i class="fa-solid fa-reply" aria-hidden="true"></i> Responder</button>
                    <button type="button" class="foro-btn foro-btn-sm foro-btn-ghost" data-foro-action="citar" data-foro-id="${esc(postId)}"><i class="fa-solid fa-quote-right" aria-hidden="true"></i> Citar</button>
                    <button type="button" class="foro-btn foro-btn-sm foro-btn-ghost" data-foro-action="compartir"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartir</button>
                    <button type="button" class="foro-btn foro-btn-sm foro-btn-ghost" data-foro-action="reportar" data-foro-id="${esc(postId)}"><i class="fa-solid fa-flag" aria-hidden="true"></i> Reportar</button>
                </div>
            </div>
        </article>`;
    }

    function renderThreadSide(t, messages, sec) {
        const readers = readersFor(t.id);
        const participantsMap = new Map();
        participantsMap.set(String(t.autorUid || t.autorNombre), {
            nombre: t.autorNombre, avatar: t.autorAvatar, rol: liveRole(t)
        });
        messages.forEach(m => {
            const k = String(m.autorUid || m.autorNombre);
            if (!participantsMap.has(k)) participantsMap.set(k, { nombre: m.autorNombre, avatar: m.autorAvatar, rol: liveRole(m) });
        });
        const participants = Array.from(participantsMap.values());
        const related = allTopics().filter(x => secDef(x.seccion).id === secDef(t.seccion).id && String(x.id) !== String(t.id))
            .sort((a, b) => String(b.ultimaRespuestaEn || b.creadoEn || '').localeCompare(String(a.ultimaRespuestaEn || a.creadoEn || '')))
            .slice(0, 5);

        $('foroThreadSide').innerHTML = `
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-eye" aria-hidden="true"></i> Leyendo ahora</h3><span class="count">${readers.length}</span></div>
                <div class="foro-side-body">
                    <div class="foro-readers">${readers.slice(0, 8).map(r => avatar(r.avatar, r.nombre, 'foro-avatar')).join('') || '<span class="foro-readers-text">Nadie más por aquí.</span>'}</div>
                    <p class="foro-readers-text" style="margin:.6rem 0 0;">${readers.length} ${readers.length === 1 ? 'persona está' : 'personas están'} leyendo este tema.</p>
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-users" aria-hidden="true"></i> Participantes</h3><span class="count">${participants.length}</span></div>
                <div class="foro-side-body">
                    ${participants.map(p => `<div class="foro-participant">${avatar(p.avatar, p.nombre, 'foro-avatar')}<span><b>${esc(p.nombre)}</b><br><small style="color:var(--foro-dim)">${esc(roleDef(p.rol).label)}</small></span></div>`).join('')}
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Más en esta sección</h3></div>
                <div class="foro-side-body foro-related">
                    ${related.length ? related.map(x => `<a href="#tema=${esc(x.id)}">${esc(x.titulo)}<span>${replyCount(x)} respuestas · ${esc(timeAgo(x.ultimaRespuestaEn || x.creadoEn))}</span></a>`).join('')
                        : '<p class="foro-side-note">Todavía no hay más temas en esta sección.</p>'}
                    <a href="#seccion=${esc(sec.id)}"><b>Ver toda la sección →</b><span>${esc(sec.label)}</span></a>
                </div>
            </div>
            <div class="foro-side-card">
                <div class="foro-side-head"><h3><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartir</h3></div>
                <div class="foro-side-body">
                    <p class="foro-side-note">Comparte este hilo con la comunidad o guárdalo en tus marcadores.</p>
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem;">
                        <button type="button" class="foro-btn foro-btn-sm" data-foro-action="compartir"><i class="fa-solid fa-link" aria-hidden="true"></i> Copiar enlace</button>
                        <button type="button" class="foro-btn foro-btn-sm" data-foro-action="marcador" data-foro-id="${esc(t.id)}"><i class="fa-solid fa-bookmark" aria-hidden="true"></i> Marcador</button>
                    </div>
                </div>
            </div>`;
    }

    /* ── Modal "Crear tema" ─────────────────────────────────── */
    function openCreateModal() {
        const modal = $('foroModal');
        if (!modal) return;
        modal.hidden = false;
        const msg = $('foroTopicFormMsg');
        if (msg) msg.textContent = '';
        const sel = $('foroTopicSection');
        if (sel && !sel.options.length) {
            sel.innerHTML = SECTIONS.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
        }
        if (routeState.view !== 'crear') go('crear');
    }
    function closeCreateModal() {
        // Sólo oculta el modal: NO resetea `moreOpen`, porque renderThread
        // lo llama en cada repintado y eso cerraría el menú «...».
        const modal = $('foroModal');
        if (modal) modal.hidden = true;
    }
    function closeCreateAndGoIndex() {
        moreOpen = false;
        const menu = $('foroMoreMenu');
        if (menu) menu.hidden = true;
        go('indice');
    }

    async function submitNewTopic() {
        const msg = $('foroTopicFormMsg');
        const fail = (text) => { if (msg) { msg.textContent = text; msg.style.color = '#f87171'; } return false; };
        if (!currentUser) return fail('Inicia sesión con Discord para crear un tema.');
        const titulo = String($('foroTopicTitle')?.value || '').trim().slice(0, 120);
        const cuerpo = String($('foroTopicBody')?.value || '').trim().slice(0, 12000);
        if (!titulo) return fail('Escribe un título para el tema.');
        if (!cuerpo) return fail('Escribe el contenido del tema.');
        const seccion = String($('foroTopicSection')?.value || 'general');
        const prefijo = String($('foroTopicPrefix')?.value || '');
        const now = new Date().toISOString();
        const a = authorData();
        const t = Object.assign({}, a, {
            id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
            seccion, prefijo, titulo, cuerpo,
            etiquetas: String($('foroTopicTags')?.value || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 6),
            creadoEn: now, actualizadoEn: now, ultimaRespuestaEn: now, ultimaRespuestaAutor: a.autorNombre,
            respuestas: 0, vistas: 1, fijado: false, cerrado: false, reacciones: 0
        });
        const btn = document.querySelector('[data-foro-submit="foroTopicBody"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Publicando...'; }
        try {
            const ok = await saveTopic(t);
            ['foroTopicTitle', 'foroTopicBody', 'foroTopicTags'].forEach(id => { const el = $(id); if (el) el.value = ''; });
            closeCreateAndGoIndex();
            toast(ok ? 'Tema publicado. Ya es visible para todos.' : 'Tema publicado (guardado en este navegador).', 'success');
            go('tema=' + t.id);
        } catch (e) {
            fail('No se pudo publicar el tema. Inténtalo de nuevo.');
            console.warn('[Foro] Error al crear tema:', e);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Publicar tema'; }
        }
    }

    async function submitReply() {
        if (!currentUser) { toast('Inicia sesión para responder.', 'error'); return; }
        const ta = $('foroReplyText');
        if (!ta) return;
        const cuerpo = String(ta.value || '').trim().slice(0, 12000);
        if (!cuerpo) { toast('Escribe tu respuesta antes de enviar.', 'error'); return; }
        const temaId = routeState.view === 'tema' ? routeState.id : null;
        const t = allTopics().find(x => String(x.id) === String(temaId));
        if (!t) return;
        if (t.cerrado) { toast('Este tema está cerrado y no admite nuevas respuestas.', 'error'); return; }
        const now = new Date().toISOString();
        const a = authorData();
        const m = Object.assign({}, a, {
            id: 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
            temaId: t.id, cuerpo, creadoEn: now, reacciones: 0
        });
        const updated = Object.assign({}, t, {
            respuestas: Number(replyCount(t)) + 1,
            ultimaRespuestaEn: now,
            ultimaRespuestaAutor: a.autorNombre,
            actualizadoEn: now
        });
        const btn = document.querySelector('[data-foro-submit="foroReplyText"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Enviando...'; }
        try {
            const ok = await saveMessage(m, updated);
            ta.value = '';
            const prev = $('foroReplyText_preview');
            if (prev) prev.hidden = true;
            toast(ok ? 'Respuesta publicada.' : 'Respuesta publicada (guardada en este navegador).', 'success');
            scheduleRender();
            setTimeout(() => {
                const posts = $('foroPosts');
                const last = posts && posts.lastElementChild;
                if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        } catch (e) {
            toast('No se pudo enviar la respuesta. Inténtalo de nuevo.', 'error');
            console.warn('[Foro] Error al responder:', e);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Enviar'; }
        }
    }

    /* ── Acciones ───────────────────────────────────────────── */
    function toggleSet(set, key, id, onMsg, offMsg) {
        const k = String(id);
        if (set.has(k)) { set.delete(k); toast(offMsg); }
        else { set.add(k); toast(onMsg, 'success'); }
        writeJson(key, Array.from(set));
        scheduleRender();
    }
    function copyLink() {
        const url = location.href;
        const done = () => toast('Enlace copiado al portapapeles.', 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(() => {
                window.prompt('Copia este enlace:', url);
            });
        } else {
            window.prompt('Copia este enlace:', url);
        }
    }
    function reportItem(id) {
        try {
            const list = readJson(LS_REPORTS, []);
            list.push({ id: String(id), by: authorData().autorNombre, at: new Date().toISOString() });
            writeJson(LS_REPORTS, list.slice(-100));
        } catch (e) { /* noop */ }
        toast('Reporte enviado al equipo de moderación. Gracias.', 'success');
    }
    function quotePost(id) {
        const t = routeState.view === 'tema' ? allTopics().find(x => String(x.id) === String(routeState.id)) : null;
        let body = '', who = '';
        if (t && id === 'op') { body = t.cuerpo; who = t.autorNombre; }
        else if (t) {
            const m = allMessages(t.id).find(x => String(x.id) === String(id));
            if (m) { body = m.cuerpo; who = m.autorNombre; }
        }
        const ta = $('foroReplyText');
        if (!ta) return;
        if (!currentUser) { toast('Inicia sesión para citar y responder.', 'error'); return; }
        const quote = `[quote=${who || 'Autor'}]\n${body}\n[/quote]\n\n`;
        insertAtCaret(ta, quote);
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('Cita insertada en la respuesta rápida.');
    }
    function focusReply() {
        if (!currentUser) { toast('Inicia sesión con Discord para participar en el foro.', 'error'); return; }
        const host = $('foroReplyEditorHost');
        if (host) host.hidden = false;
        const ta = $('foroReplyText');
        if (ta) { ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => ta.focus(), 250); }
    }

    /* ── Eventos (delegados: sobreviven a cada re-render) ────── */
    function bindEvents() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!target || !target.closest) return;

            const bb = target.closest('[data-foro-bb]');
            if (bb) { e.preventDefault(); applyTag(bb.dataset.foroTarget, bb.dataset.foroBb); return; }

            const emojiToggle = target.closest('[data-foro-emoji-toggle]');
            if (emojiToggle) {
                e.preventDefault();
                const panel = $(emojiToggle.dataset.foroEmojiToggle + '_emojis');
                if (panel) panel.hidden = !panel.hidden;
                return;
            }
            const emoji = target.closest('[data-foro-emoji]');
            if (emoji) {
                e.preventDefault();
                insertAtCaret($(emoji.dataset.foroTarget), emoji.dataset.foroEmoji);
                const panel = $(emoji.dataset.foroTarget + '_emojis');
                if (panel) panel.hidden = true;
                return;
            }
            const raw = target.closest('[data-foro-raw]');
            if (raw) { e.preventDefault(); showPreview(raw.dataset.foroRaw, 'raw'); return; }
            const preview = target.closest('[data-foro-preview]');
            if (preview) { e.preventDefault(); showPreview(preview.dataset.foroPreview, 'html'); return; }
            const submit = target.closest('[data-foro-submit]');
            if (submit) {
                e.preventDefault();
                if (submit.dataset.foroSubmit === 'foroTopicBody') submitNewTopic();
                else submitReply();
                return;
            }

            const act = target.closest('[data-foro-action]');
            if (act) {
                const action = act.dataset.foroAction;
                const id = act.dataset.foroId;
                if (action !== 'more') {
                    moreOpen = false;
                    const menu = $('foroMoreMenu');
                    if (menu) menu.hidden = true;
                }
                switch (action) {
                    case 'crear': e.preventDefault(); openCreateModal(); break;
                    case 'indice': case 'limpiar':
                        e.preventDefault(); searchTerm = ''; filterMode = 'all';
                        const si = $('foroSearch'); if (si) si.value = '';
                        go('indice'); break;
                    case 'buscar':
                        e.preventDefault();
                        if (parseRoute().view === 'tema') go('indice');
                        setTimeout(() => $('foroSearch')?.focus(), 80);
                        break;
                    case 'suscripciones':
                        e.preventDefault(); filterMode = filterMode === 'subs' ? 'all' : 'subs';
                        if (parseRoute().view === 'tema') go('indice'); else scheduleRender();
                        break;
                    case 'marcadores':
                        e.preventDefault(); filterMode = filterMode === 'bookmarks' ? 'all' : 'bookmarks';
                        if (parseRoute().view === 'tema') go('indice'); else scheduleRender();
                        break;
                    case 'suscribirse':
                        e.preventDefault(); toggleSet(subs, LS_SUBS, id, 'Te has suscrito a este tema.', 'Suscripción eliminada.'); break;
                    case 'marcador':
                        e.preventDefault(); toggleSet(bookmarks, LS_BOOKMARKS, id, 'Tema guardado en marcadores.', 'Marcador eliminado.'); break;
                    case 'responder': e.preventDefault(); focusReply(); break;
                    case 'ir-op': {
                        e.preventDefault();
                        const op = $('post-op');
                        if (op) op.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        break;
                    }
                    case 'citar': e.preventDefault(); quotePost(id); break;
                    case 'compartir': e.preventDefault(); copyLink(); break;
                    case 'reportar': e.preventDefault(); reportItem(id); break;
                    case 'more': {
                        e.preventDefault();
                        moreOpen = !moreOpen;
                        const menu = $('foroMoreMenu');
                        if (menu) menu.hidden = !moreOpen;
                        break;
                    }
                    case 'close-modal': e.preventDefault(); closeCreateAndGoIndex(); break;
                    default: break;
                }
                return;
            }

            // Cerrar el modal al pulsar el fondo.
            if (target.id === 'foroModal') closeCreateAndGoIndex();
        });

        document.addEventListener('change', (e) => {
            const sel = e.target && e.target.closest && e.target.closest('[data-foro-select]');
            if (!sel) return;
            applySelect(sel.dataset.foroTarget, sel.dataset.foroSelect, sel.value);
            sel.selectedIndex = 0;
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = $('foroModal');
                if (modal && !modal.hidden) { closeCreateAndGoIndex(); return; }
                moreOpen = false;
                const menu = $('foroMoreMenu');
                if (menu) menu.hidden = true;
            }
        });

        // Fallback de avatares e imágenes rotas.
        document.addEventListener('error', (e) => {
            const img = e.target;
            if (!img || !img.matches) return;
            if (img.matches('img[data-foro-avatar]')) {
                const parent = img.parentElement;
                if (parent) parent.textContent = String(img.dataset.name || '?').charAt(0).toUpperCase();
            } else if (img.matches('img[data-foro-img]')) {
                img.style.display = 'none';
            }
        }, true);

        const search = $('foroSearch');
        if (search) {
            search.addEventListener('input', (e) => {
                searchTerm = String(e.target.value || '').trim();
                const v = parseRoute().view;
                if (v === 'tema' || v === 'crear') go('indice');
                else scheduleRender();
            });
        }

        window.addEventListener('hashchange', () => { render(); });
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.indexOf('ps_foro') === 0) scheduleRender();
        });
        document.addEventListener(LOCAL_EVENT, scheduleRender);
        document.addEventListener('firebaseReady', reattachFeeds);

        // Un cambio de rango en Personal se refleja en el foro sin recargar:
        // se recalcula la sesión y se repintan posts, autores y participantes.
        let staffTimer = null;
        document.addEventListener('panter:staff-changed', () => {
            clearTimeout(staffTimer);
            staffTimer = setTimeout(() => { syncUser(); scheduleRender(); }, 60);
        });

        const onSession = () => {
            clearTimeout(authTimer);
            authTimer = setTimeout(syncUser, 60);
        };
        document.addEventListener('authStateChanged', onSession);
        document.addEventListener('discordAuthChanged', onSession);
    }

    /* ── Render principal ───────────────────────────────────── */
    function render() {
        routeState = parseRoute();
        if (routeState.view === 'crear') {
            renderIndex(null);
            openCreateModal();
            return;
        }
        if (routeState.view === 'tema') { renderThread(routeState.id); return; }
        renderIndex(routeState.view === 'seccion' ? routeState.id : null);
    }

    /* ── Arranque ───────────────────────────────────────────── */
    function buildEditors() {
        const topicHost = $('foroTopicEditor');
        if (topicHost) topicHost.innerHTML = editorHtml('foroTopicBody', {
            rows: 9, submitLabel: 'Publicar tema',
            placeholder: 'Escribe el contenido del tema. Puedes usar encabezados, listas, citas, código e imágenes...'
        });
        const replyHost = $('foroQuickReply');
        if (replyHost) {
            replyHost.innerHTML = `
                <div class="foro-panel foro-quickreply" id="foroQuickReplyPanel">
                    <div class="foro-panel-head"><h2><i class="fa-solid fa-reply" aria-hidden="true"></i> Respuesta rápida</h2><span class="foro-hint" id="foroReplyAs"></span></div>
                    <div id="foroReplyGate" class="foro-gate">
                        <p>Para participar en el foro, inicia sesión con tu cuenta de Discord.</p>
                        <button type="button" class="foro-btn foro-btn-primary" data-open-auth-modal="true"><i class="fa-brands fa-discord" aria-hidden="true"></i> Ingresar con Discord</button>
                    </div>
                    <div id="foroReplyEditorHost"></div>
                </div>`;
            const host = $('foroReplyEditorHost');
            if (host) host.innerHTML = editorHtml('foroReplyText', {
                rows: 6, submitLabel: 'Enviar',
                placeholder: 'Escribe tu respuesta... Usa la barra de herramientas para dar formato BBCode.'
            });
        }
        const sel = $('foroTopicSection');
        if (sel) sel.innerHTML = SECTIONS.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
    }

    function boot() {
        buildEditors();
        bindEvents();
        syncUser();
        render();
        waitForFirebase().then(ok => { if (ok) reattachFeeds(); });
        // El callback OAuth de Discord resuelve la sesión unos ms después.
        setTimeout(syncUser, 800);
        setInterval(() => {
            if (routeState.view === 'tema') markReading(routeState.id);
        }, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    // Superficie mínima para depuración / integración, sin efectos globales.
    window.PanterForo = {
        renderBB, allTopics, allMessages, sections: SECTIONS,
        render: scheduleRender, go
    };
})();
