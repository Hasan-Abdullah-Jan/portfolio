import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { formatDate, readingTime, escapeHtml, safeUrl } from "./blog-common.js";

const grid = document.getElementById('posts');
const tagBar = document.getElementById('tags');
let posts = [];
let activeTag = null;

function render() {
  const list = activeTag ? posts.filter(p => (p.tags || []).includes(activeTag)) : posts;
  if (!list.length) { grid.innerHTML = '<p class="blog-empty">No posts yet. Check back soon.</p>'; return; }
  grid.innerHTML = list.map(p => {
    const img = safeUrl(p.coverImage);
    return `<a class="post-card" href="post.html?slug=${encodeURIComponent(p.slug)}">
      ${img ? `<img class="post-card__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ''}
      <div class="post-card__body">
        <span class="post-card__meta">${formatDate(p.publishedAt)} · ${readingTime(p.content)}</span>
        <h2 class="post-card__title">${escapeHtml(p.title)}</h2>
        <p class="post-card__excerpt">${escapeHtml(p.excerpt)}</p>
      </div>
    </a>`;
  }).join('');
}

function renderTags() {
  const tags = [...new Set(posts.flatMap(p => p.tags || []))].sort();
  tagBar.innerHTML = tags.length ? ['All', ...tags].map(t =>
    `<button class="chip${(t === 'All' ? !activeTag : t === activeTag) ? ' active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('') : '';
}

tagBar.addEventListener('click', e => {
  const b = e.target.closest('[data-tag]');
  if (!b) return;
  activeTag = b.dataset.tag === 'All' ? null : b.dataset.tag;
  renderTags(); render();
});

try {
  const snap = await getDocs(query(collection(db, 'posts'), where('published', '==', true)));
  posts = snap.docs.map(d => ({ slug: d.id, ...d.data() }))
    .sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0));
  renderTags(); render();
} catch (err) {
  console.error(err);
  grid.innerHTML = '<p class="blog-empty">Could not load posts right now.</p>';
}
