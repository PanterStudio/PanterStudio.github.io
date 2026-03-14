// Minijuegos enhancements: particles, tilt/parallax and reveal-on-scroll
(function(){
  'use strict';
  console.log('[minijuegos-enhancements] loaded');
  try { document.body.dataset.minijuegosEnh = '1'; } catch(e){}
  const section = document.querySelector('.index-minijuegos-highlight');
  if (!section) return;
  const visual = section.querySelector('.minijuegos-visual');
  const icons = visual ? visual.querySelectorAll('svg.icon') : [];
  const particlesId = 'minigamesParticles';

  function initParticles(){
    if (!window.tsParticles) return;
    try {
      tsParticles.load(particlesId, {
        fpsLimit: 60,
        particles: {
          number: { value: 18 },
          color: { value: ['#ffffff','#ffd700','#8e5bff','#66f'] },
          shape: { type: 'circle' },
          opacity: { value: 0.9, random: { enable: true, minimumValue: 0.4 } },
          size: { value: { min: 4, max: 10 } },
          move: { enable: true, speed: 1.6, direction: 'top', outModes: { default: 'out' } }
        },
        interactivity: { detectsOn: 'canvas', events: { onhover: { enable: false } } },
        detectRetina: true
      });
    } catch (e) { console.warn('tsParticles init failed', e); }
  }

  function enableTilt(){
    if (!visual) return;
    if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rect = null;
    section.addEventListener('mousemove', (ev)=>{
      rect = rect || section.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width - 0.5;
      const y = (ev.clientY - rect.top) / rect.height - 0.5;
      const rotY = x * 12; // degrees
      const rotX = -y * 8;
      visual.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
      icons.forEach((ic, i) => {
        const ix = x * (6 + i*2);
        const iy = y * (6 + i*1.5);
        ic.style.transform = `translate3d(${ix}px, ${iy}px, ${i}px) scale(${1 + i*0.02})`;
      });
    });
    section.addEventListener('mouseleave', ()=>{
      visual.style.transform = '';
      icons.forEach(ic => ic.style.transform = '');
    });
  }

  function revealOnScroll(){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(en => {
        if (en.isIntersecting){
          section.classList.add('in-view');
          io.unobserve(section);
        }
      });
    }, { threshold: 0.18 });
    io.observe(section);
  }

  try{
    initParticles();
    enableTilt();
    revealOnScroll();
  }catch(e){ console.error('minijuegos enhancements error', e); }

})();
