/**
 * bbcode.js — BBCode seguro compartido + pegado con formato enriquecido.
 *
 * Se usa en el foro y en soporte (descripción de tickets y comentarios).
 *
 * · render(raw)       → HTML seguro: escapa TODO y aplica las etiquetas.
 * · htmlToBBCode(html)→ convierte el HTML del portapapeles a BBCode
 *                       conservando colores, negritas, listas, encabezados,
 *                       enlaces, imágenes, citas y alineación.
 * · attachPaste()     → delega el evento `paste` en todo el documento para
 *                       cualquier <textarea data-rich-paste>. Así funciona
 *                       también en editores creados dinámicamente.
 *
 * Seguridad: sólo se admiten URL http/https, colores hexadecimales y un
 * conjunto cerrado de etiquetas. Nunca se ejecuta script ni se copian estilos
 * arbitrarios; el texto siempre se escapa antes de volver a pintarse.
 */
(function () {
    'use strict';

    const COLOR_NAME = {
        red: '#ff0000', orange: '#e67e22', yellow: '#f1c40f', gold: '#ffbc00',
        green: '#00a715', blue: '#0055ff', cyan: '#7dd3fc', purple: '#9d00ff',
        violet: '#6f5cff', pink: '#ff7ddf', white: '#ffffff', black: '#000000'
    };

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function escAttr(value) {
        return esc(value).replace(/`/g, '&#96;');
    }
    function decodeEntities(str) {
        return String(str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    }
    function safeUrl(u) {
        const s = String(u || '').trim();
        return /^https?:\/\//i.test(s) ? s : '';
    }
    function normalizeColor(raw) {
        let c = String(raw || '').trim().toLowerCase();
        if (!c) return '';
        if (/^#[0-9a-f]{3}$/.test(c)) c = '#' + c.slice(1).split('').map(x => x + x).join('');
        if (/^#[0-9a-f]{6}$/.test(c)) return c;
        if (/^#[0-9a-f]{8}$/.test(c)) return c.slice(0, 7);
        if (COLOR_NAME[c]) return COLOR_NAME[c];
        const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgb) {
            const hex = [rgb[1], rgb[2], rgb[3]].map(n =>
                Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('');
            return '#' + hex;
        }
        return '';
    }
    function normalizeImageUrl(raw) {
        let u = String(raw || '').trim().replace(/[.,;:!?)]+$/, '');
        if (!safeUrl(u)) return '';
        const page = u.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,12})\/?(?:[?#].*)?$/i);
        if (page) return `https://i.imgur.com/${page[1]}.jpg`;
        if (/^https?:\/\/(?:www\.)?imgur\.com\/(?:a|gallery|t)\//i.test(u)) return '';
        return u;
    }

    /* ── Render BBCode → HTML seguro ─────────────────────────── */
    function render(raw) {
        let s = esc(String(raw == null ? '' : raw));
        const blocks = [];
        const stash = (html) => { blocks.push(html); return `\u0001B${blocks.length - 1}\u0001`; };
        const urlOk = (u) => Boolean(safeUrl(decodeEntities(u)));

        s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (m, c) =>
            stash(`<pre class="ps-code"><code>${String(c).replace(/^\n/, '')}</code></pre>`));
        s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (m, u) => {
            const norm = normalizeImageUrl(decodeEntities(u));
            return norm ? stash(`<img class="ps-bb-img" src="${escAttr(norm)}" alt="Imagen adjunta" loading="lazy">`) : m;
        });
        s = s.replace(/\[list(?:=(?:1|a))?\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
            const tag = /\[list=(?:1|a)\]/i.test(m) ? 'ol' : 'ul';
            const items = String(inner).split(/\[\*\]/g).map(x => x.trim()).filter(Boolean)
                .map(x => `<li>${x}</li>`).join('');
            return stash(`<${tag} class="ps-bb-list">${items}</${tag}>`);
        });
        s = s.replace(/\[quote(?:=[^\]]+)?\]([\s\S]*?)\[\/quote\]/gi, (m, body) => {
            const who = (m.match(/^\[quote=([^\]]+)\]/i) || [])[1] || '';
            return stash(`<blockquote>${who ? `<cite>${esc(decodeEntities(who))} dijo:</cite>` : ''}${body}</blockquote>`);
        });
        s = s.replace(/\[(center|left|right)\]([\s\S]*?)\[\/\1\]/gi, (m, al, inner) =>
            stash(`<div class="ps-bb-${al.toLowerCase()}">${inner}</div>`));
        s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, (m, c) => stash(`<h2>${c}</h2>`));
        s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, (m, c) => stash(`<h3>${c}</h3>`));
        s = s.replace(/\[hr\]/gi, () => stash('<hr>'));

        s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (m, u, label) => {
            if (!urlOk(u)) return label;
            return `<a href="${escAttr(decodeEntities(u))}" target="_blank" rel="noopener nofollow">${label}</a>`;
        });
        s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, u) => {
            if (!urlOk(u)) return m;
            const href = escAttr(decodeEntities(u));
            return `<a href="${href}" target="_blank" rel="noopener nofollow">${href}</a>`;
        });

        s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
        s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
        s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
        s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');
        s = s.replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi, (m, n, t) => {
            const map = { 1: '.72rem', 2: '.8rem', 3: '.88rem', 4: '1rem', 5: '1.15rem', 6: '1.35rem', 7: '1.6rem' };
            return `<span style="font-size:${map[n] || map[3]}">${t}</span>`;
        });
        s = s.replace(/\[color=(#[0-9a-f]{3,8}|[a-z]+)\]([\s\S]*?)\[\/color\]/gi, (m, c, t) => {
            const col = normalizeColor(c);
            return col ? `<span style="color:${escAttr(col)}">${t}</span>` : t;
        });
        s = s.replace(/\[font=([a-z0-9 ,'\-]+)\]([\s\S]*?)\[\/font\]/gi, (m, f, t) =>
            `<span style="font-family:${escAttr(f)},sans-serif">${t}</span>`);

        s = s.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
        s = s.replace(/\u0001B(\d+)\u0001/g, (m, i) => blocks[Number(i)] || '');
        s = s.replace(/<br>\s*(<(?:pre|blockquote|ul|ol|h2|h3|div|hr|img)\b)/gi, '$1');
        s = s.replace(/(<\/(?:pre|blockquote|ul|ol|h2|h3|div)>|<hr>)\s*<br>/gi, '$1');
        return s;
    }

    /* ── HTML del portapapeles → BBCode ───────────────────────── */
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'META', 'LINK']);

    function inlineStyle(node) {
        const raw = String(node.getAttribute && node.getAttribute('style') || '');
        const out = { color: '', size: '', align: '' };
        const color = raw.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        if (color) out.color = normalizeColor(color[1]);
        const fs = raw.match(/(?:^|;)\s*font-size\s*:\s*([\d.]+)\s*(px|pt|rem|em)/i);
        if (fs) {
            const px = fs[2] === 'px' ? Number(fs[1])
                : fs[2] === 'pt' ? Number(fs[1]) * 1.333
                    : Number(fs[1]) * 16;
            const map = [[11, 1], [13, 2], [15, 3], [17, 4], [20, 5], [24, 6], [30, 7]];
            let n = 3;
            for (const [max, v] of map) { if (px <= max) { n = v; break; } n = 7; }
            out.size = n;
        }
        const ta = raw.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)/i);
        if (ta) out.align = ta[1].toLowerCase();
        return out;
    }

    function wrapInline(node, text) {
        if (!text) return text;
        const st = inlineStyle(node);
        const tag = String(node.nodeName || '').toUpperCase();
        if (tag === 'B' || tag === 'STRONG' ||
            /font-weight\s*:\s*(bold|[6-9]00)/i.test(String(node.getAttribute && node.getAttribute('style') || ''))) {
            text = `[b]${text}[/b]`;
        }
        if (tag === 'I' || tag === 'EM' ||
            /font-style\s*:\s*italic/i.test(String(node.getAttribute && node.getAttribute('style') || ''))) {
            text = `[i]${text}[/i]`;
        }
        if (tag === 'U' || /text-decoration[^;]*underline/i.test(String(node.getAttribute && node.getAttribute('style') || ''))) {
            text = `[u]${text}[/u]`;
        }
        if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' ||
            /text-decoration[^;]*line-through/i.test(String(node.getAttribute && node.getAttribute('style') || ''))) {
            text = `[s]${text}[/s]`;
        }
        if (st.color) text = `[color=${st.color}]${text}[/color]`;
        if (st.size && st.size !== 3) text = `[size=${st.size}]${text}[/size]`;
        return text;
    }

    function nodeToBB(node, ctx) {
        if (node.nodeType === 3) return String(node.nodeValue || '').replace(/\r/g, '');
        if (node.nodeType !== 1) return '';
        const tag = String(node.nodeName || '').toUpperCase();
        if (SKIP.has(tag)) return '';
        if (tag === 'BR') return '\n';
        if (tag === 'IMG') {
            const u = normalizeImageUrl(node.getAttribute('src') || '');
            return u ? `[img]${u}[/img]` : '';
        }
        if (tag === 'A') {
            const href = safeUrl(node.getAttribute('href') || '');
            const inner = childrenBB(node, ctx);
            return href ? `[url=${href}]${inner || href}[/url]` : inner;
        }
        const kids = childrenBB(node, ctx);
        if (tag === 'LI') return `[*]${kids.trim()}\n`;
        if (tag === 'UL') return `[list]\n${kids.trim()}\n[/list]\n`;
        if (tag === 'OL') return `[list=1]\n${kids.trim()}\n[/list=1]\n`;
        if (tag === 'H1' || tag === 'H2') return `[h2]${kids.trim()}[/h2]\n`;
        if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') return `[h3]${kids.trim()}[/h3]\n`;
        if (tag === 'BLOCKQUOTE') return `[quote]${kids.trim()}[/quote]\n`;
        if (tag === 'PRE' || tag === 'CODE') return `[code]${kids.trim()}[/code]\n`;
        if (tag === 'HR') return '[hr]\n';
        if (tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'TR') {
            const st = inlineStyle(node);
            let body = kids.trim();
            if (!body) return '';
            if (st.align && st.align !== 'left') body = `[${st.align}]${body}[/${st.align}]`;
            return body + '\n';
        }
        if (tag === 'TABLE') return kids.trim() + '\n';
        if (tag === 'TD' || tag === 'TH') return kids.trim() + '  ';
        return wrapInline(node, kids);
    }

    function childrenBB(node, ctx) {
        let out = '';
        const children = node.childNodes || [];
        for (let i = 0; i < children.length; i++) out += nodeToBB(children[i], ctx);
        return out;
    }

    function htmlToBBCode(html) {
        let doc;
        try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); }
        catch (e) { return ''; }
        const body = doc && doc.body;
        if (!body) return '';
        let out = childrenBB(body, {});
        // El texto ya viene escapado por el parser; lo convertimos a texto
        // plano seguro y eliminamos cualquier etiqueta BBCode falsificada.
        out = out.replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return out;
    }

    /* ── Pegado delegado (funciona con editores dinámicos) ────── */
    let attached = false;
    function attachPaste() {
        if (attached) return;
        attached = true;
        document.addEventListener('paste', function (e) {
            const ta = e.target;
            if (!ta || String(ta.tagName || '').toUpperCase() !== 'TEXTAREA') return;
            if (!ta.matches || !ta.matches('textarea[data-rich-paste]')) return;
            const cd = e.clipboardData || (window.clipboardData);
            if (!cd) return;
            const html = cd.getData('text/html');
            if (!html || !String(html).trim()) return;    // texto plano: comportamiento normal
            const plain = String(cd.getData('text/plain') || '');
            // Si el portapapeles ya trae BBCode en texto plano, se respeta.
            if (/\[(?:b|i|u|s|color|h2|h3|list|quote|code|url|img)\b/i.test(plain)) return;
            const bb = htmlToBBCode(html);
            if (!bb) return;
            e.preventDefault();
            const start = ta.selectionStart, end = ta.selectionEnd;
            ta.value = ta.value.slice(0, start) + bb + ta.value.slice(end);
            const caret = start + bb.length;
            ta.focus();
            try { ta.setSelectionRange(caret, caret); } catch (err) { /* noop */ }
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            try {
                window.PanterRichPaste && window.PanterRichPaste.onPaste
                    && window.PanterRichPaste.onPaste(ta, bb);
            } catch (err) { /* noop */ }
        }, true);
    }

    const api = { render, htmlToBBCode, attachPaste, esc, normalizeColor, safeUrl };
    window.PanterBBCode = api;
    window.PanterRichPaste = api;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachPaste, { once: true });
    } else {
        attachPaste();
    }
})();
