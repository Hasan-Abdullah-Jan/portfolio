// Latest posts for the home page "Blog" section. Loaded only when the section is near the viewport.
import { fetchPosts, cachedPosts, reviveCached } from "./api.js";
import { cardHtml, skeletonCards } from "./blog-common.js";

const grid = document.getElementById('home-posts');
const LIMIT = 3;
const show = posts => {
  grid.innerHTML = posts.length ? posts.slice(0, LIMIT).map(p => cardHtml(p, 'h3')).join('') : '<p class="blog-empty">New posts are coming soon.</p>';
};

async function load() {
  const cached = cachedPosts();
  if (cached) show(reviveCached(cached));
  else grid.innerHTML = skeletonCards(3);
  try { show(await fetchPosts()); }
  catch (err) { console.error(err); if (!cached) show([]); }
}

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: '600px 0px' });
  io.observe(grid);
} else load();
