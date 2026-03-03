/* ===== PANTERSTUDIO MAIN SCRIPT ===== */

(() => {
  'use strict';

  /* --- Navbar scroll effect --- */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  /* --- Hamburger menu --- */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });

  /* Close menu when a link is clicked */
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* --- Intersection Observer for fade-in animations --- */
  const observer = new IntersectionObserver(
    entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }),
    { threshold: 0.12 }
  );

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  /* --- Pre-registration form --- */
  const form = document.getElementById('preregForm');
  const successMsg = document.getElementById('successMessage');
  const counterEl = document.getElementById('registeredCount');

  /* Load counter from localStorage */
  const getCount = () => parseInt(localStorage.getItem('ps_prereg_count') || '0', 10);
  const incrementCount = () => {
    const c = getCount() + 1;
    localStorage.setItem('ps_prereg_count', c);
    return c;
  };

  if (counterEl) counterEl.textContent = (getCount() + 127).toLocaleString();

  /* Simple validation helper */
  function validateField(input) {
    const group = input.closest('.form-group');
    if (!group) return true;
    const errorEl = group.querySelector('.field-error');
    let valid = true;

    if (input.required && !input.value.trim()) {
      valid = false;
    } else if (input.type === 'email' && input.value) {
      valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    }

    group.classList.toggle('has-error', !valid);
    if (errorEl) errorEl.style.display = valid ? 'none' : 'block';
    return valid;
  }

  /* Live validation on blur */
  form.querySelectorAll('[required], input[type="email"]').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if (group && group.classList.contains('has-error')) validateField(input);
    });
  });

  /* Checkbox required check */
  function validateCheckbox(checkbox) {
    const group = checkbox.closest('.form-group');
    const errorEl = group && group.querySelector('.field-error');
    const valid = checkbox.checked;
    if (group) group.classList.toggle('has-error', !valid);
    if (errorEl) errorEl.style.display = valid ? 'none' : 'block';
    return valid;
  }

  /* Generate unique pre-reg code */
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'PS-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  /* Check if email is already registered */
  function isAlreadyRegistered(email) {
    const regs = JSON.parse(localStorage.getItem('ps_registrations') || '[]');
    return regs.some(r => r.email.toLowerCase() === email.toLowerCase());
  }

  /* Save registration */
  function saveRegistration(data) {
    const regs = JSON.parse(localStorage.getItem('ps_registrations') || '[]');
    regs.push(data);
    localStorage.setItem('ps_registrations', JSON.stringify(regs));
  }

  /* Submit handler */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    let allValid = true;
    form.querySelectorAll('[required]').forEach(input => {
      if (input.type === 'checkbox') {
        if (!validateCheckbox(input)) allValid = false;
      } else {
        if (!validateField(input)) allValid = false;
      }
    });
    form.querySelectorAll('input[type="email"]').forEach(input => {
      if (!validateField(input)) allValid = false;
    });

    if (!allValid) return;

    const email = form.querySelector('#email').value.trim();

    if (isAlreadyRegistered(email)) {
      const emailGroup = form.querySelector('#email').closest('.form-group');
      emailGroup.classList.add('has-error');
      const errorEl = emailGroup.querySelector('.field-error');
      if (errorEl) {
        errorEl.textContent = 'Este correo ya está registrado.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> Registrando...';

    /* Simulate async request */
    setTimeout(() => {
      const code = generateCode();
      const data = {
        name: form.querySelector('#name').value.trim(),
        email,
        country: form.querySelector('#country').value,
        platform: form.querySelector('#platform').value,
        genre: form.querySelector('#genre').value,
        message: form.querySelector('#message').value.trim(),
        code,
        date: new Date().toISOString(),
      };

      saveRegistration(data);
      const total = incrementCount();

      /* Show code in success message */
      document.getElementById('regCode').textContent = code;
      document.getElementById('regName').textContent = data.name.split(' ')[0];
      if (counterEl) counterEl.textContent = (total + 127).toLocaleString();
      document.getElementById('successCount').textContent = (total + 127).toLocaleString();

      /* Animate transition */
      form.style.transition = 'opacity 0.35s ease';
      form.style.opacity = '0';
      setTimeout(() => {
        form.style.display = 'none';
        successMsg.classList.add('visible');
      }, 350);
    }, 1200);
  });

  /* Reset form button */
  const resetBtn = document.getElementById('resetFormBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      form.style.opacity = '1';
      form.style.display = '';
      successMsg.classList.remove('visible');
      form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
      const submitBtn = form.querySelector('.btn-submit');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🎮 Completar Pre-registro';
    });
  }

  /* --- Smooth scroll for anchor links --- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* --- Update "registered" counter with stored data --- */
  const totalCountEls = document.querySelectorAll('.js-total-count');
  totalCountEls.forEach(el => {
    el.textContent = (getCount() + 127).toLocaleString();
  });

})();
