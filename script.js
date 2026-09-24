/**
 * Portfolio — Interactions & Micro-animations
 * Minimal JS: scroll-based nav, reveal-on-scroll, hamburger menu, active links
 */

(function () {
  'use strict';

  // ─── DOM references ───
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const backToTop = document.getElementById('back-to-top');
  const navLinks = document.querySelectorAll('.nav__link');
  const sections = document.querySelectorAll('.section[id]');
  const reveals = document.querySelectorAll('.reveal');

  // ─── Navbar: scroll state ───
  let lastScroll = 0;
  const SCROLL_THRESHOLD = 50;

  function handleNavScroll() {
    const currentScroll = window.scrollY;

    if (currentScroll > SCROLL_THRESHOLD) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Back to top button
    if (currentScroll > 600) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }

    lastScroll = currentScroll;
  }

  // ─── Active nav link tracking ───
  function updateActiveLink() {
    const scrollPos = window.scrollY + 120;

    sections.forEach(function (section) {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(function (link) {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // ─── Scroll reveal (Intersection Observer) ───
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything
      reveals.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ─── Mobile menu toggle ───
  function toggleMobileMenu() {
    const isOpen = mobileMenu.classList.contains('open');

    if (isOpen) {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    } else {
      mobileMenu.classList.add('open');
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // ─── 3D Tilt Effect on Cards ───
  function init3DTilt() {
    // Only apply on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const cards = document.querySelectorAll('.project-card, .pillar-card, .edu-card, .skill-category');
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate rotation (max 4 degrees to keep it subtle)
        const rotateX = ((y - centerY) / centerY) * -4;
        const rotateY = ((x - centerX) / centerX) * 4;
        
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        
        // Also update glow position if the card uses it
        card.style.setProperty('--mouse-x', (x / rect.width * 100) + '%');
        card.style.setProperty('--mouse-y', (y / rect.height * 100) + '%');
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = `rotateX(0deg) rotateY(0deg) translateY(0px)`;
      });
    });
  }

  // ─── Magnetic Buttons ───
  function initMagneticButtons() {
    // Only apply on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const buttons = document.querySelectorAll('.btn, .nav__icon-btn');
    buttons.forEach(btn => {
      btn.classList.add('magnetic-btn'); // ensure CSS transitions are set
      
      btn.addEventListener('mousemove', function(e) {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        // Pull strength (0.3 = 30% of distance from center)
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      });
      
      btn.addEventListener('mouseleave', function() {
        btn.style.transform = 'translate(0px, 0px)';
      });
    });
  }

  // ─── Hero Parallax Scroll ───
  function handleParallaxScroll() {
    const scrolled = window.scrollY;
    if (scrolled > window.innerHeight) return;
    
    const heroContent = document.querySelector('.hero__content');
    const orbs = document.querySelectorAll('.hero__orb');
    
    if (heroContent) {
      heroContent.style.transform = `translateY(${scrolled * 0.25}px)`;
      heroContent.style.opacity = 1 - (scrolled / window.innerHeight) * 1.2;
    }
    
    if (orbs.length >= 2) {
      orbs[0].style.transform = `translateY(${scrolled * 0.4}px)`;
      orbs[1].style.transform = `translateY(${scrolled * 0.2}px)`;
    }
  }

  // ─── Smooth scroll for back-to-top ───
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Skill tag hover stagger ───
  function initSkillTagEffects() {
    const categories = document.querySelectorAll('.skill-category');
    categories.forEach(function (cat) {
      const tags = cat.querySelectorAll('.skill-tag');
      cat.addEventListener('mouseenter', function () {
        tags.forEach(function (tag, i) {
          tag.style.transitionDelay = (i * 0.04) + 's';
        });
      });
      cat.addEventListener('mouseleave', function () {
        tags.forEach(function (tag) {
          tag.style.transitionDelay = '0s';
        });
      });
    });
  }

  // ─── Theme Toggle ───
  function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const THEME_KEY = 'portfolio-theme';

    // Check for saved theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      root.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      root.setAttribute('data-theme', 'light');
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
      });
    }
  }

  // ─── Initialize ───
  function init() {
    // Scroll events (throttled via rAF)
    let ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          handleNavScroll();
          updateActiveLink();
          handleParallaxScroll(); // Added Parallax
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Hamburger
    hamburger.addEventListener('click', toggleMobileMenu);

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('.nav__link').forEach(function (link) {
      link.addEventListener('click', closeMobileMenu);
    });

    // Back to top
    backToTop.addEventListener('click', scrollToTop);

    // Initialize features
    initScrollReveal();
    init3DTilt();          // Replaced initCardGlow with init3DTilt
    initMagneticButtons(); // Added Magnetic Buttons
    initSkillTagEffects();
    initThemeToggle();

    // Initial state
    handleNavScroll();
    updateActiveLink();
  }

  // Kick off when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
