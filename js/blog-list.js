import "./theme.js";
import { fetchPosts, cachedPosts, reviveCached } from "./api.js";
import { escapeHtml, cardHtml, skeletonCards } from "./blog-common.js";

const grid = document.getElementById('posts');
const tagBar = document.getElementById('tags');
let posts = [];
let activeTag = null;

function render() {
  const list = activeTag ? posts.filter(p => (p.tags || []).includes(activeTag)) : posts;
  grid.innerHTML = list.length ? list.map(p => cardHtml(p)).join('') : '<p class="blog-empty">No posts yet. Check back soon.</p>';
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

// Show cached posts instantly, then refresh from the network.
const cached = cachedPosts();
if (cached) { posts = reviveCached(cached); renderTags(); render(); }
else grid.innerHTML = skeletonCards(3);

try {
  posts = await fetchPosts();
  renderTags(); render();
} catch (err) {
  console.error(err);
  if (!cached) grid.innerHTML = '<p class="blog-empty">Could not load posts right now.</p>';
}
