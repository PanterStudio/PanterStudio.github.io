import { readFileSync, writeFileSync } from 'fs';

const newTop = `<%- include('partials/header', { 
    title: 'Inicio — Panter Studio', 
    currentPage: 'inicio',
    description: 'Panter Studio Game Dev — Hub oficial del estudio indie. Sigue el desarrollo de Nuestra Tierra Job Simulator, gana monedas en minijuegos y unete a la comunidad fundadora.',
    extraHead: \`<style>
        body { background: #09090b !important; }

        .index-page-wrap {
            position: relative;
            min-height: 100vh;
            background:
                radial-gradient(ellipse 80% 60% at 70% -10%, rgba(168,85,247,0.12) 0%, transparent 60%),
                radial-gradient(ellipse 60% 40% at 10% 80%, rgba(99,102,241,0.08) 0%, transparent 60%),
                #09090b;
        }
        .index-page-wrap::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px);
            background-size: 30px 30px;
            pointer-events: none;
            z-index: 0;
        }
        .ix-wrap {
            position: relative;
            z-index: 1;
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 1.5rem 5rem;
        }

        /* HERO */
        .ix-hero {
            position: relative;
            display: grid;
            grid-template-columns: 1fr;
            min-height: 600px;
            padding: 2.5rem 0 0;
            overflow: visible;
            align-items: center;
        }
        @media (min-width: 900px) {
            .ix-hero { grid-template-columns: 1fr 1fr; gap: 2rem; }
        }
        .ix-hero-text { position: relative; z-index: 3; padding: 2rem 0 3rem; }
        .ix-hero-label {
            display: inline-block;
            font-size: 0.72rem; font-weight: 700;
            letter-spacing: 3px; text-transform: uppercase;
            color: #a855f7; margin-bottom: 1rem;
        }
        .ix-hero-title {
            font-family: 'Outfit', 'Moderniz', sans-serif;
            font-weight: 900; line-height: 0.95; margin: 0 0 0.5rem;
        }
        .ix-hero-title .line1 {
            display: block;
            font-size: clamp(2.6rem, 6.5vw, 5.2rem);
            color: #ffffff; letter-spacing: -2px;
        }
        .ix-hero-title .line2 {
            display: block;
            font-size: clamp(2.6rem, 6.5vw, 5.2rem);
            background: linear-gradient(90deg, #a855f7 0%, #6366f1 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text; letter-spacing: -2px;
        }
        .ix-hero-desc {
            font-size: 1.05rem; color: #a1a1aa;
            line-height: 1.65; max-width: 440px;
            margin: 1.5rem 0 2.25rem;
        }
        .ix-hero-desc strong { color: #818cf8; font-weight: 600; }
        .ix-hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
        .btn-ix-primary {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 0.9rem 2.25rem;
            background: linear-gradient(135deg, #a855f7, #6366f1);
            color: #fff; font-weight: 700; font-size: 0.95rem;
            border-radius: 100px; text-decoration: none;
            transition: all 0.3s ease; border: none; cursor: pointer;
            box-shadow: 0 8px 30px rgba(168,85,247,0.4); white-space: nowrap;
        }
        .btn-ix-primary:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(168,85,247,0.55); color: #fff; }
        .btn-ix-outline {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 0.9rem 1.75rem; background: rgba(255,255,255,0.04);
            color: #e4e4e7; font-weight: 600; font-size: 0.95rem;
            border-radius: 100px; text-decoration: none;
            border: 1px solid rgba(255,255,255,0.12);
            transition: all 0.3s ease; white-space: nowrap;
        }
        .btn-ix-outline:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.25); color: #fff; }

        .ix-hero-visual {
            position: relative; display: flex;
            align-items: flex-end; justify-content: center;
            min-height: 500px; z-index: 2;
        }
        .ix-hero-glow {
            position: absolute; width: 560px; height: 560px; border-radius: 50%;
            background: radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%);
            top: 50%; left: 50%; transform: translate(-50%, -50%);
            pointer-events: none; z-index: 1;
        }
        .ix-mascot {
            position: relative; z-index: 3;
            height: 560px; max-height: 70vh; object-fit: contain;
            filter: drop-shadow(0 30px 70px rgba(0,0,0,0.9)) drop-shadow(0 0 60px rgba(168,85,247,0.25));
            transition: transform 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .ix-mascot:hover { transform: translateY(-16px) scale(1.025); }

        /* STATS */
        .ix-stats {
            display: grid; grid-template-columns: repeat(2, 1fr);
            margin: 1rem 0 4rem;
            background: rgba(255,255,255,0.03);
            border-radius: 20px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.07); gap: 1px;
        }
        @media (min-width: 600px) { .ix-stats { grid-template-columns: repeat(4, 1fr); } }
        .ix-stat {
            background: rgba(255,255,255,0.01); padding: 1.5rem;
            display: flex; align-items: center; gap: 1rem;
            transition: background 0.25s;
        }
        .ix-stat:hover { background: rgba(255,255,255,0.03); }
        .ix-stat-icon {
            font-size: 1.5rem; flex-shrink: 0;
            width: 44px; height: 44px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(168,85,247,0.1);
            border: 1px solid rgba(168,85,247,0.2); border-radius: 12px;
        }
        .ix-stat-val { font-size: 1.5rem; font-weight: 900; font-family: 'Outfit', sans-serif; color: #fff; line-height: 1; }
        .ix-stat-lbl { font-size: 0.68rem; color: #71717a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-top: 4px; }

        /* FEATURES */
        .ix-section-label { font-size: 0.7rem; color: #a855f7; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 0.6rem; }
        .ix-section-title { font-family: 'Outfit', sans-serif; font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 900; color: #fff; margin: 0 0 2rem; }
        .ix-features {
            display: grid; grid-template-columns: repeat(2, 1fr);
            gap: 1px; background: rgba(255,255,255,0.05);
            border-radius: 20px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.07); margin-bottom: 5rem;
        }
        @media (min-width: 768px) { .ix-features { grid-template-columns: repeat(4, 1fr); } }
        .ix-feature {
            background: rgba(255,255,255,0.012); padding: 2rem 1.5rem;
            display: flex; flex-direction: column; gap: 0.75rem;
            transition: background 0.25s; position: relative; overflow: hidden;
        }
        .ix-feature::after {
            content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, #a855f7, #6366f1);
            transform: scaleX(0); transform-origin: left; transition: transform 0.4s ease;
        }
        .ix-feature:hover { background: rgba(255,255,255,0.03); }
        .ix-feature:hover::after { transform: scaleX(1); }
        .ix-feature-icon {
            font-size: 1.6rem; width: 52px; height: 52px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(168,85,247,0.1); border-radius: 14px;
            border: 1px solid rgba(168,85,247,0.2); flex-shrink: 0;
        }
        .ix-feature h3 { font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 800; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .ix-feature p { font-size: 0.82rem; color: #71717a; margin: 0; line-height: 1.55; }
        .ix-feature-link {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: 0.78rem; font-weight: 700; color: #a855f7;
            text-decoration: none; margin-top: auto; padding-top: 0.75rem;
            transition: gap 0.2s, color 0.2s;
        }
        .ix-feature-link:hover { gap: 10px; color: #c084fc; }

        /* BOTTOM */
        .ix-bottom { display: grid; grid-template-columns: 1fr; gap: 2rem; }
        @media (min-width: 900px) { .ix-bottom { grid-template-columns: 1.9fr 1fr; } }

        .ix-news-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
        .ix-news-title {
            font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 800; color: #fff;
            text-transform: uppercase; letter-spacing: 1px;
            display: flex; align-items: center; gap: 12px;
        }
        .ix-news-title::before { content: ''; display: block; width: 4px; height: 20px; background: linear-gradient(180deg, #a855f7, #6366f1); border-radius: 2px; }
        .ix-view-all { font-size: 0.78rem; font-weight: 700; color: #a855f7; text-decoration: none; display: flex; align-items: center; gap: 4px; transition: gap 0.2s, color 0.2s; }
        .ix-view-all:hover { gap: 8px; color: #c084fc; }

        .ix-news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        @media (max-width: 600px) { .ix-news-grid { grid-template-columns: 1fr; } }
        @media (min-width: 601px) and (max-width: 860px) { .ix-news-grid { grid-template-columns: repeat(2, 1fr); } }

        .ix-news-card {
            position: relative; border-radius: 16px; overflow: hidden;
            background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
            text-decoration: none; display: block; transition: transform 0.3s, border-color 0.3s;
        }
        .ix-news-card:hover { transform: translateY(-5px); border-color: rgba(168,85,247,0.35); }
        .ix-news-img-wrap { overflow: hidden; height: 130px; }
        .ix-news-img { width: 100%; height: 130px; object-fit: cover; display: block; filter: brightness(0.65); transition: filter 0.35s, transform 0.35s; }
        .ix-news-card:hover .ix-news-img { filter: brightness(0.9); transform: scale(1.06); }
        .ix-news-body { padding: 1rem; }
        .ix-news-tag { display: inline-block; font-size: 0.6rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; background: rgba(168,85,247,0.15); color: #c4b5fd; margin-bottom: 0.5rem; }
        .ix-news-card-title { font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 800; color: #fff; line-height: 1.3; margin: 0; }

        @keyframes ix-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .ix-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%); background-size: 200% 100%; animation: ix-shimmer 1.8s infinite; border-radius: 8px; }

        .ix-community {
            background: linear-gradient(145deg, rgba(99,102,241,0.12), rgba(168,85,247,0.06));
            border: 1px solid rgba(168,85,247,0.2); border-radius: 20px;
            padding: 2.25rem 2rem; display: flex; flex-direction: column; gap: 1.1rem;
        }
        .ix-community-icon { font-size: 3rem; filter: drop-shadow(0 0 25px rgba(168,85,247,0.7)); }
        .ix-community h3 { font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 900; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .ix-community p { font-size: 0.85rem; color: #a1a1aa; margin: 0; line-height: 1.55; }
        .ix-community-stat { font-size: 0.82rem; color: #a1a1aa; }
        .ix-community-stat strong { font-size: 1.15rem; color: #fff; font-weight: 900; }
        .btn-me-interesa {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 0.9rem 1.5rem; background: linear-gradient(135deg, #16a34a, #15803d);
            color: #fff; font-weight: 700; font-size: 0.9rem; border-radius: 100px;
            text-decoration: none; transition: all 0.3s; margin-top: auto;
            box-shadow: 0 6px 22px rgba(22,163,74,0.4);
        }
        .btn-me-interesa:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(22,163,74,0.55); color: #fff; }

        .ix-data-bridge { display: none !important; visibility: hidden; pointer-events: none; }
        .comunidad-announcements-banner { margin-bottom: 2rem; }
    </style>\`
  }) %>

<div class="index-page-wrap">
<div class="ix-wrap">

    <div id="comunidadAnnouncements" class="comunidad-announcements-banner" style="display:none;"></div>

    <section class="ix-hero">
        <div class="ix-hero-text">
            <span class="ix-hero-label">Bienvenido a</span>
            <h1 class="ix-hero-title">
                <span class="line1">NUESTRA TIERRA</span>
                <span class="line2">JOB SIMULATOR</span>
            </h1>
            <p class="ix-hero-desc">
                El primer simulador de trabajos y conduccion en un mundo abierto inspirado en <strong>Colombia</strong>.
            </p>
            <div class="ix-hero-actions">
                <a href="pages/meinteresa" class="btn-ix-primary"><i class="fa-solid fa-heart" style="color:#22c55e" aria-hidden="true"></i> Me Interesa</a>
                <a href="pages/actualizaciones" class="btn-ix-outline"><i class="fa-solid fa-play" aria-hidden="true"></i> Ver Novedades</a>
            </div>
        </div>
        <div class="ix-hero-visual">
            <div class="ix-hero-glow"></div>
            <img src="/recursos/Pantera.png" alt="Pantera, mascota de Nuestra Tierra" class="ix-mascot">
        </div>
    </section>

    <div class="ix-stats">
        <div class="ix-stat"><div class="ix-stat-icon"><i class="fa-solid fa-map-location-dot" aria-hidden="true"></i></div><div><div class="ix-stat-val">+100 KM</div><div class="ix-stat-lbl">De Carreteras</div></div></div>
        <div class="ix-stat"><div class="ix-stat-icon"><i class="fa-solid fa-briefcase" aria-hidden="true"></i></div><div><div class="ix-stat-val">+15</div><div class="ix-stat-lbl">Trabajos</div></div></div>
        <div class="ix-stat"><div class="ix-stat-icon"><i class="fa-solid fa-truck" aria-hidden="true"></i></div><div><div class="ix-stat-val">+20</div><div class="ix-stat-lbl">Vehiculos</div></div></div>
        <div class="ix-stat"><div class="ix-stat-icon"><i class="fa-solid fa-users" aria-hidden="true"></i></div><div><div class="ix-stat-val"><span id="statJugadores">+10K</span></div><div class="ix-stat-lbl">Jugadores</div></div></div>
    </div>

    <p class="ix-section-label">Todo sobre el juego</p>
    <h2 class="ix-section-title">Explora cada modo de juego</h2>
    <div class="ix-features">
        <div class="ix-feature">
            <div class="ix-feature-icon"><i class="fa-solid fa-gamepad" aria-hidden="true"></i></div>
            <h3>Modo Carrera</h3>
            <p>Acepta trabajos, gana dinero y haz crecer tu imperio de transporte.</p>
            <a href="pages/meinteresa" class="ix-feature-link">Ver Mas &#8594;</a>
        </div>
        <div class="ix-feature">
            <div class="ix-feature-icon"><i class="fa-solid fa-earth-americas" aria-hidden="true"></i></div>
            <h3>Mundo Abierto</h3>
            <p>Explora ciudades, carreteras, campos y mucho mas de Colombia.</p>
            <a href="wiki/como-comenzar" class="ix-feature-link">Explorar &#8594;</a>
        </div>
        <div class="ix-feature">
            <div class="ix-feature-icon"><i class="fa-solid fa-handshake" aria-hidden="true"></i></div>
            <h3>Multijugador</h3>
            <p>Unete a convoyos, juega con amigos y forma tu propia empresa.</p>
            <a href="pages/minijuegos" class="ix-feature-link">Conectar &#8594;</a>
        </div>
        <div class="ix-feature">
            <div class="ix-feature-icon"><i class="fa-solid fa-trophy" aria-hidden="true"></i></div>
            <h3>Eventos y Retos</h3>
            <p>Participa en eventos semanales y gana recompensas unicas.</p>
            <a href="pages/actualizaciones" class="ix-feature-link">Ver Eventos &#8594;</a>
        </div>
    </div>

    <div class="ix-bottom">
        <div>
            <div class="ix-news-header">
                <div class="ix-news-title">Ultimas Noticias</div>
                <a href="pages/actualizaciones" class="ix-view-all">Ver todas &#8594;</a>
            </div>
            <div class="ix-news-grid" id="homeDevlogsGrid">
                <div class="ix-news-card"><div class="ix-news-img-wrap"><div class="ix-shimmer" style="height:130px;"></div></div><div class="ix-news-body"><div class="ix-shimmer" style="height:13px;width:55px;margin-bottom:8px;"></div><div class="ix-shimmer" style="height:15px;width:90%;"></div></div></div>
                <div class="ix-news-card"><div class="ix-news-img-wrap"><div class="ix-shimmer" style="height:130px;"></div></div><div class="ix-news-body"><div class="ix-shimmer" style="height:13px;width:55px;margin-bottom:8px;"></div><div class="ix-shimmer" style="height:15px;width:80%;"></div></div></div>
                <div class="ix-news-card"><div class="ix-news-img-wrap"><div class="ix-shimmer" style="height:130px;"></div></div><div class="ix-news-body"><div class="ix-shimmer" style="height:13px;width:55px;margin-bottom:8px;"></div><div class="ix-shimmer" style="height:15px;width:85%;"></div></div></div>
            </div>
        </div>
        <div class="ix-community">
            <div class="ix-community-icon"><i class="fa-solid fa-paw" aria-hidden="true"></i></div>
            <h3>Unete a la Comunidad</h3>
            <p>Forma parte de nuestra comunidad y no te pierdas ninguna novedad del desarrollo de Nuestra Tierra.</p>
            <div class="ix-community-stat"><strong id="statRegistrados">&#8212;</strong> personas interesadas</div>
            <a href="pages/meinteresa" class="btn-me-interesa"><i class="fa-solid fa-heart" style="color:#22c55e" aria-hidden="true"></i> ¡Me Interesa!</a>
        </div>
    </div>

</div>
</div>

<div class="ix-data-bridge" aria-hidden="true">
    <span id="hubAccountName"></span><span id="hubAccountStatus"></span>
    <div id="hubAccountAvatar"></div>
    <div id="hubAccountStats"><span id="hubCoins"></span><span id="hubEmeralds"></span><span id="hubGamesPlayed"></span><span id="hubRank"></span></div>
    <a id="hubProfileBtn"></a><div id="homeLeaderboard"></div><div id="lbSelfRow"></div><span id="widgetInteresados"></span>
</div>

<div class="ad-slot-wrapper ad-horizontal" id="ad-bottom">
    <span class="ad-slot-label">Publicidad</span>
    <div class="ad-slot-inner">
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8870488962578785" data-ad-slot="AUTO" data-ad-format="auto" data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
</div>
`;

const jsPart = readFileSync('views/index_js_backup.txt', 'utf8');
writeFileSync('views/index.ejs', newTop + '\n' + jsPart, 'utf8');
console.log('index.ejs written. Total length:', (newTop + jsPart).length);
