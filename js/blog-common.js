// Shared helpers for blog pages: theme toggle, markdown rendering, formatting.
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

const THEME_KEY = 'portfolio-theme';
const root = document.documentElement;
const saved = localStorage.getItem(THEME_KEY);
if (saved) root.setAttribute('data-theme', saved);
else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) root.setAttribute('data-theme', 'light');

const toggle = document.getElementById('theme-toggle');
if (toggle) toggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

export function renderMarkdown(md) {
  return DOMPurify.sanitize(marked.parse(md || '', { gfm: true, breaks: false }));
}

export function formatDate(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function readingTime(md) {
  const words = (md || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220)) + ' min read';
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Only allow http(s) URLs for images/links coming from the database.
export function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
}
