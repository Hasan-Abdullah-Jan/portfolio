// Shared helpers for blog pages: formatting, safe URLs, post cards, lazy Markdown rendering.
// Markdown libraries are only fetched on pages that actually render a post.
let mdLibs;
export async function renderMarkdown(md) {
  mdLibs ||= Promise.all([
    import("https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js"),
    import("https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs")
  ]);
  const [{ marked }, { default: DOMPurify }] = await mdLibs;
  return DOMPurify.sanitize(marked.parse(md || '', { gfm: true, breaks: false }));
}

export function formatDate(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function readMinutes(md) {
  const words = (md || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Only allow http(s) URLs for images/links coming from the database.
export function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
}

// Ask Cloudinary for a right-sized, auto-format image instead of the original upload.
export function imgUrl(u, width) {
  const url = safeUrl(u);
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/')
    ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`)
    : url;
}

// One post card, shared by the home page and the blog list.
export function cardHtml(p, headingTag = 'h2') {
  const img = imgUrl(p.coverImage, 720);
  const tags = (p.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `<a class="post-card" href="post.html?slug=${encodeURIComponent(p.slug)}">
    <div class="post-card__media">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" width="720" height="405">` : '<span class="post-card__ph" aria-hidden="true">&lt;/&gt;</span>'}</div>
    <div class="post-card__body">
      <span class="post-card__meta">${formatDate(p.publishedAt)}${p.readMins ? ' · ' + p.readMins + ' min read' : ''}</span>
      <${headingTag} class="post-card__title">${escapeHtml(p.title)}</${headingTag}>
      <p class="post-card__excerpt">${escapeHtml(p.excerpt)}</p>
      ${tags ? `<div class="post-card__tags">${tags}</div>` : ''}
    </div>
  </a>`;
}

export const skeletonCards = n => Array.from({ length: n }, () =>
  '<div class="post-card post-card--skeleton" aria-hidden="true"><div class="post-card__media"></div><div class="post-card__body"><span class="sk sk--s"></span><span class="sk"></span><span class="sk sk--m"></span></div></div>').join('');
