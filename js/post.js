import "./theme.js";
import { fetchPost, fetchComments, addComment } from "./api.js";
import { renderMarkdown, formatDate, readMinutes, escapeHtml, imgUrl } from "./blog-common.js";

const el = document.getElementById('post');
const slug = new URLSearchParams(location.search).get('slug');

function notFound() {
  document.title = 'Post not found — Hasan Abdullah Jan';
  el.innerHTML = '<p class="blog-empty">Post not found.</p><p style="text-align:center"><a class="post__back" href="blog.html">← All posts</a></p>';
}

// ---------- Reading progress ----------
const bar = document.getElementById('progress');
let ticking = false;
function updateProgress() {
  const h = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });

// ---------- Share ----------
function shareHtml(title) {
  const url = encodeURIComponent(location.href.split('#')[0]);
  const text = encodeURIComponent(title);
  return `<div class="share" aria-label="Share this post">
    <span class="share__label">Share</span>
    <button type="button" class="share__btn" id="copy-link">Copy link</button>
    <a class="share__btn" target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}">LinkedIn</a>
    <a class="share__btn" target="_blank" rel="noopener noreferrer" href="https://twitter.com/intent/tweet?text=${text}&url=${url}">X</a>
    <a class="share__btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${text}%20${url}">WhatsApp</a>
  </div>`;
}

// ---------- Comments ----------
const COOLDOWN_MS = 30000;
function commentHtml(c) {
  return `<li class="comment">
    <div class="comment__head"><span class="comment__avatar" aria-hidden="true">${escapeHtml((c.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="comment__name">${escapeHtml(c.name)}</span><time class="comment__date">${formatDate(c.createdAt)}</time></div>
    <p class="comment__text">${escapeHtml(c.text)}</p>
  </li>`;
}

async function initComments() {
  const list = document.getElementById('c-list');
  const count = document.getElementById('c-count');
  try {
    const comments = await fetchComments(slug);
    count.textContent = comments.length ? `(${comments.length})` : '';
    list.innerHTML = comments.length ? comments.map(commentHtml).join('') : '<li class="comment-empty">No comments yet. Be the first to share a thought.</li>';
  } catch (err) {
    console.error(err);
    list.innerHTML = '<li class="comment-empty">Comments could not be loaded right now.</li>';
  }

  const form = document.getElementById('c-form');
  const msg = document.getElementById('c-msg');
  const say = (t, kind = '') => { msg.textContent = t; msg.className = 'msg ' + kind; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = form.elements['c-name'].value.trim();
    const text = form.elements['c-text'].value.trim();
    if (form.elements['website'].value) return say('Thanks! Your comment will appear after review.', 'ok'); // honeypot: bots only
    if (!name || text.length < 2) return say('Please add your name and a comment.', 'err');
    let last = 0;
    try { last = Number(localStorage.getItem('last-comment')) || 0; } catch {}
    if (Date.now() - last < COOLDOWN_MS) return say('Please wait a few seconds before posting again.', 'err');

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; say('Sending…');
    try {
      await addComment({ postSlug: slug, name, text });
      try { localStorage.setItem('last-comment', String(Date.now())); } catch {}
      form.reset();
      say('Thanks! Your comment will appear after review.', 'ok');
    } catch (err) {
      console.error(err);
      say('Sorry, your comment could not be sent. Please try again later.', 'err');
    } finally { btn.disabled = false; }
  });
}

const commentsHtml = `
  <section class="comments" id="comments" aria-labelledby="comments-title">
    <h2 id="comments-title">Comments <span id="c-count"></span></h2>
    <ul class="comment-list" id="c-list"><li class="comment-empty">Loading comments…</li></ul>
    <form class="comment-form" id="c-form" novalidate>
      <h3>Leave a comment</h3>
      <div class="field"><label for="c-name">Name</label><input id="c-name" name="c-name" maxlength="60" autocomplete="name" required></div>
      <div class="field"><label for="c-text">Comment</label><textarea id="c-text" name="c-text" rows="4" maxlength="1500" required></textarea>
        <small>Comments are reviewed before they appear. Please be respectful and don't share personal details.</small></div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="msg" id="c-msg" role="status"></p>
      <button class="btn btn--primary" type="submit">Post comment</button>
    </form>
  </section>`;

// ---------- Page ----------
if (!slug) notFound();
else {
  try {
    const p = await fetchPost(slug);
    if (!p) notFound();
    else {
      const mins = p.readMins || readMinutes(p.content);
      const cover = imgUrl(p.coverImage, 1400);
      document.title = `${p.title} — Hasan Abdullah Jan`;
      document.querySelector('meta[name="description"]').setAttribute('content', p.excerpt || '');
      const tags = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      el.innerHTML = `
        <a class="post__back" href="blog.html">← All posts</a>
        <h1 class="post__title">${escapeHtml(p.title)}</h1>
        <p class="post__meta">${formatDate(p.publishedAt)} · ${mins} min read</p>
        ${tags ? `<div class="post-card__tags post__tags">${tags}</div>` : ''}
        ${cover ? `<img class="post__cover" src="${escapeHtml(cover)}" alt="" width="1400" height="700" fetchpriority="high" decoding="async">` : ''}
        <div class="prose" id="prose"></div>
        ${shareHtml(p.title)}
        ${commentsHtml}`;
      document.getElementById('prose').innerHTML = await renderMarkdown(p.content);
      document.getElementById('copy-link').addEventListener('click', async e => {
        if (navigator.share) { try { await navigator.share({ title: p.title, url: location.href }); return; } catch {} }
        try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Copied!'; setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800); } catch {}
      });
      initComments();
      updateProgress();
    }
  } catch (err) {
    console.error(err);
    notFound();
  }
}
