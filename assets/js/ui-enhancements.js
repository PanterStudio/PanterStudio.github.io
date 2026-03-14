// UI enhancements: panel open animations, staggered link reveal, aria toggles
(function(){
  'use strict';
  console.log('[ui-enhancements] loaded');
  try { document.body.dataset.uiEnh = '1'; } catch(e){}
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  const leftTrigger = document.querySelector('.left-trigger');
  const rightTrigger = document.querySelector('.right-trigger');

  function setAria(trigger, panel){
    if (!trigger || !panel) return;
    trigger.setAttribute('aria-expanded', panel.classList.contains('active'));
  }

  function staggerLinks(panel){
    if (!panel) return;
    const links = panel.querySelectorAll('.panel-link');
    links.forEach((link, i) =>{
      link.style.transitionDelay = (i * 40) + 'ms';
      link.style.opacity = '0';
      requestAnimationFrame(()=>{ link.style.opacity = '1'; });
    });
  }

  const obs = new MutationObserver((mutations)=>{
    for (const m of mutations){
      if (m.target === leftPanel && m.attributeName === 'class'){
        setAria(leftTrigger, leftPanel);
        if (leftPanel.classList.contains('active')){
          staggerLinks(leftPanel);
          const first = leftPanel.querySelector('.panel-link'); if (first) first.focus();
        }
      }
      if (m.target === rightPanel && m.attributeName === 'class'){
        setAria(rightTrigger, rightPanel);
        if (rightPanel.classList.contains('active')){
          staggerLinks(rightPanel);
          const first = rightPanel.querySelector('.panel-link'); if (first) first.focus();
        }
      }
    }
  });

  try{
    if (leftPanel) obs.observe(leftPanel, { attributes: true });
    if (rightPanel) obs.observe(rightPanel, { attributes: true });
  }catch(e){ console.warn('ui-enhancements init failed', e); }
})();
