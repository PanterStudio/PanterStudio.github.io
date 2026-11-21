/**
 * role-colors.js — Paleta de rangos GLOBAL y sincronizada en vivo.
 *
 * Publica variables CSS en :root para los 9 rangos oficiales:
 *   --ps-role-fundador_ceo, --ps-role-administrador, ...
 *   --ps-role-<id>-bg, --ps-role-<id>-border, --ps-role-<id>-label
 *
 * Cualquier categoría, subcategoría, sección, insignia o hilo puede usar
 * var(--ps-role-...) y se actualizará SOLO cuando cambie la configuración
 * en Panel Admin → Personal (roles_config), sin recargar y en TODAS las
 * páginas a la vez (evento panter:role-colors + storage).
 */
(function () {
    'use strict';

    const IDS = [
        'founder_ceo', 'administrador', 'programador', 'modelador',
        'moderador', 'soporte', 'creador_contenido', 'vip', 'usuario'
    ];
    const FALLBACK = {
        founder_ceo: '#f1c40f', administrador: '#ff0000', programador: '#ffbc00',
        modelador: '#6f5cff', moderador: '#e67e22', soporte: '#00a715',
        creador_contenido: '#9d00ff', vip: '#ff7ddf', usuario: '#0055ff'
    };

    function normHex(v) {
        const c = String(v || '').trim();
        return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '';
    }
    function rgba(hex, a) {
        const h = normHex(hex) || '#0055ff';
        const n = parseInt(h.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    function defFor(id) {
        const R = window.PanterRoles;
        if (R && typeof R.get === 'function') {
            try {
                const d = R.get(id);
                if (d && normHex(d.color)) return d;
            } catch (e) { /* noop */ }
        }
        return null;
    }

    /** Devuelve {id, color, bg, border, label, icon} siempre actualizado. */
    function role(id) {
        const key = String(id || 'usuario').toLowerCase();
        const d = defFor(key) || {};
        const color = normHex(d.color) || FALLBACK[key] || FALLBACK.usuario;
        return {
            id: key,
            color,
            bg: rgba(color, 0.12),
            border: rgba(color, 0.35),
            label: String(d.label || key.replace(/_/g, ' ')),
            icon: String(d.icon || 'fa-solid fa-user')
        };
    }

    /** Escribe las variables CSS de los 9 rangos en el documento. */
    function apply() {
        const root = document.documentElement;
        if (!root) return;
        IDS.forEach(id => {
            const r = role(id);
            root.style.setProperty(`--ps-role-${id}`, r.color);
            root.style.setProperty(`--ps-role-${id}-bg`, r.bg);
            root.style.setProperty(`--ps-role-${id}-border`, r.border);
        });
        try {
            document.dispatchEvent(new CustomEvent('panter:role-colors'));
            window.dispatchEvent(new CustomEvent('panter:role-colors'));
        } catch (e) { /* noop */ }
    }

    /**
     * Mapeo semántico: cada sección / categoría del foro y del soporte se
     * asocia a un rango oficial para que su color se sincronice globalmente.
     */
    const SECTION_ROLE = {
        anuncios: 'founder_ceo',
        general: 'usuario',
        'nuestra-tierra': 'programador',
        soporte: 'soporte',
        sugerencias: 'creador_contenido',
        offtopic: 'vip'
    };
    function sectionRole(sectionId) {
        return SECTION_ROLE[String(sectionId || '').toLowerCase()] || 'usuario';
    }
    function sectionColor(sectionId) { return role(sectionRole(sectionId)).color; }

    window.PanterRoleColors = {
        IDS, FALLBACK, role, apply, sectionRole, sectionColor,
        colorFor: (id) => role(id).color
    };

    // panter:roles-config YA significa que roles.js cargó y aplicó la
    // configuración. Volver a llamar a loadRoleConfig(true) desde aquí creaba
    // un ciclo recursivo (applyRoleConfig -> evento -> loadRoleConfig -> ...)
    // que lanzaba decenas de peticiones a roles_config por segundo y hacía
    // que la página se sintiera lenta. Aquí solo se repinta la paleta.
    function onRolesConfig() {
        apply();
    }
    // Fuentes externas reales (firebase listo / otra pestaña) sí fuerzan
    // una recarga desde Supabase.
    function onChange() {
        const R = window.PanterRoles;
        if (R && typeof R.loadRoleConfig === 'function') {
            try { Promise.resolve(R.loadRoleConfig(true)).then(apply).catch(apply); return; }
            catch (e) { /* noop */ }
        }
        apply();
    }
    window.addEventListener('panter:roles-config', onRolesConfig);
    document.addEventListener('panter:roles-config', onRolesConfig);
    document.addEventListener('firebaseReady', onChange, { once: true });
    window.addEventListener('storage', (e) => {
        if (e && /role/i.test(String(e.key || ''))) onChange();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }
})();
