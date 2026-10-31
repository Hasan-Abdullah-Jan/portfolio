import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { renderMarkdown, formatDate, readingTime, escapeHtml, safeUrl } from "./blog-common.js";

const el = document.getElementById('post');
const slug = new URLSearchParams(location.search).get('slug');

function notFound() {
  document.title = 'Post not found — Hasan Abdullah Jan';
  el.innerHTML = '<p class="blog-empty">Post not found.</p><p style="text-align:center"><a class="post__back" href="blog.html">← All posts</a></p>';
}

if (!slug) notFound();
else {
  try {
    const snap = await getDoc(doc(db, 'posts', slug));
    if (!snap.exists()) notFound();
    else {
      const p = snap.data();
      const img = safeUrl(p.coverImage);
      document.title = `${p.title} — Hasan Abdullah Jan`;
      document.querySelector('meta[name="description"]').setAttribute('content', p.excerpt || '');
      el.innerHTML = `
        <a class="post__back" href="blog.html">← All posts</a>
        <h1 class="post__title">${escapeHtml(p.title)}</h1>
        <p class="post__meta">${formatDate(p.publishedAt)} · ${readingTime(p.content)}${(p.tags || []).length ? ' · ' + p.tags.map(escapeHtml).join(', ') : ''}</p>
        ${img ? `<img class="post__cover" src="${escapeHtml(img)}" alt="">` : ''}
        <div class="prose">${renderMarkdown(p.content)}</div>`;
    }
  } catch (err) {
    console.error(err);
    notFound();
  }
}
