// Theme toggle for the blog and admin pages (the home page handles its own in script.js).
const THEME_KEY = 'portfolio-theme';
const root = document.documentElement;
try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute('data-theme', saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) root.setAttribute('data-theme', 'light');
} catch {}

const toggle = document.getElementById('theme-toggle');
if (toggle) toggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
});
