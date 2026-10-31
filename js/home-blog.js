// Latest posts for the home page "Blog" section.
import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { formatDate, readingTime, escapeHtml, safeUrl } from "./blog-common.js";

const grid = document.getElementById('home-posts');
const LIMIT = 3;

try {
  const snap = await getDocs(query(collection(db, 'posts'), where('published', '==', true)));
  const posts = snap.docs.map(d => ({ slug: d.id, ...d.data() }))
    .sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0))
    .slice(0, LIMIT);

  grid.innerHTML = posts.length ? posts.map(p => {
    const img = safeUrl(p.coverImage);
    return `<a class="post-card" href="post.html?slug=${encodeURIComponent(p.slug)}">
      ${img ? `<img class="post-card__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ''}
      <div class="post-card__body">
        <span class="post-card__meta">${formatDate(p.publishedAt)} · ${readingTime(p.content)}</span>
        <h3 class="post-card__title">${escapeHtml(p.title)}</h3>
        <p class="post-card__excerpt">${escapeHtml(p.excerpt)}</p>
      </div>
    </a>`;
  }).join('') : '<p class="blog-empty">New posts are coming soon.</p>';
} catch (err) {
  console.error(err);
  grid.innerHTML = '<p class="blog-empty">New posts are coming soon.</p>';
}
