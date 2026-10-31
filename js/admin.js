import { db, auth } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import "./theme.js";
import { renderMarkdown, formatDate, escapeHtml, readMinutes } from "./blog-common.js";

// UI gating only. The real protection is firestore.rules and the server-side check in api/cloudinary-sign.js.
const ADMIN_UID = '9gGrEZYFHyasN0q0Ohjj5HNpFls1';

const $ = id => document.getElementById(id);
const views = { login: $('login-view'), list: $('list-view'), edit: $('edit-view') };
const f = { title: $('f-title'), slug: $('f-slug'), excerpt: $('f-excerpt'), tags: $('f-tags'), cover: $('f-cover'), content: $('f-content'), published: $('f-published') };
let editing = null; // existing post data, or null when creating
let slugTouched = false;

function show(name) {
  Object.entries(views).forEach(([k, v]) => v.classList.toggle('hidden', k !== name));
  $('logout').classList.toggle('hidden', name === 'login');
}
function say(el, text, kind = '') { el.textContent = text; el.className = 'msg ' + kind; }

const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

// ---------- Auth ----------
$('login-view').addEventListener('submit', async e => {
  e.preventDefault();
  say($('login-msg'), '');
  try {
    await signInWithEmailAndPassword(auth, $('email').value, $('password').value);
    $('password').value = '';
  } catch {
    say($('login-msg'), 'Login failed. Check your email and password.', 'err');
  }
});
$('logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (!user) return show('login');
  if (user.uid !== ADMIN_UID) {
    await signOut(auth);
    show('login');
    return say($('login-msg'), 'This account is not authorised.', 'err');
  }
  loadList();
});

// ---------- List ----------
async function loadList() {
  show('list');
  loadComments();
  say($('list-msg'), 'Loading…');
  try {
    const snap = await getDocs(collection(db, 'posts'));
    const posts = snap.docs.map(d => ({ slug: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    say($('list-msg'), posts.length ? '' : 'No posts yet. Click "New post" to write your first.');
    $('post-rows').innerHTML = posts.map(p => `
      <tr>
        <td>${escapeHtml(p.title)}</td>
        <td><span class="badge ${p.published ? 'badge--live' : 'badge--draft'}">${p.published ? 'Published' : 'Draft'}</span></td>
        <td>${formatDate(p.updatedAt)}</td>
        <td>
          <button class="link-btn" data-edit="${escapeHtml(p.slug)}">Edit</button>
          ${p.published ? `<a class="link-btn" href="post.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">View</a>` : ''}
          <button class="link-btn danger" data-del="${escapeHtml(p.slug)}">Delete</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    console.error(err);
    say($('list-msg'), 'Could not load posts: ' + err.code, 'err');
  }
}

// ---------- Comment moderation ----------
async function loadComments() {
  say($('comments-msg'), 'Loading…');
  try {
    const snap = await getDocs(collection(db, 'comments'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.approved - b.approved) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    const pending = items.filter(c => !c.approved).length;
    $('pending-badge').textContent = pending + ' pending';
    $('pending-badge').classList.toggle('hidden', !pending);
    say($('comments-msg'), items.length ? '' : 'No comments yet.');
    $('comment-rows').innerHTML = items.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong> <span style="color:var(--color-text-muted)">· ${formatDate(c.createdAt)}</span><br>${escapeHtml(c.text)}</td>
        <td><a class="link-btn" href="post.html?slug=${encodeURIComponent(c.postSlug)}" target="_blank" rel="noopener">${escapeHtml(c.postSlug)}</a></td>
        <td><span class="badge ${c.approved ? 'badge--live' : 'badge--draft'}">${c.approved ? 'Approved' : 'Pending'}</span></td>
        <td>
          ${c.approved ? `<button class="link-btn" data-unapprove="${escapeHtml(c.id)}">Hide</button>` : `<button class="link-btn" data-approve="${escapeHtml(c.id)}">Approve</button>`}
          <button class="link-btn danger" data-cdel="${escapeHtml(c.id)}">Delete</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    console.error(err);
    say($('comments-msg'), 'Could not load comments: ' + err.code, 'err');
  }
}

$('comment-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-approve],[data-unapprove],[data-cdel]');
  if (!b) return;
  try {
    if (b.dataset.cdel) {
      if (!confirm('Delete this comment permanently?')) return;
      await deleteDoc(doc(db, 'comments', b.dataset.cdel));
    } else {
      await updateDoc(doc(db, 'comments', b.dataset.approve || b.dataset.unapprove), { approved: !!b.dataset.approve });
    }
    loadComments();
  } catch (err) { say($('comments-msg'), 'Action failed: ' + err.code, 'err'); }
});

$('post-rows').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) openEditor(edit.dataset.edit);
  if (del && confirm(`Delete "${del.dataset.del}" permanently?`)) {
    try { await deleteDoc(doc(db, 'posts', del.dataset.del)); clearDrafts(del.dataset.del); loadList(); }
    catch (err) { say($('list-msg'), 'Delete failed: ' + err.code, 'err'); }
  }
});
$('new-post').addEventListener('click', () => openEditor(null));

// ---------- Local draft auto-save (this browser only) ----------
const draftKey = slug => 'blog-draft:' + (slug || 'new');
let dirty = false;
let draftTimer;

function readDraft(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function clearDrafts(...slugs) {
  try { slugs.forEach(s => localStorage.removeItem(draftKey(s))); } catch {}
}
function queueDraftSave() {
  dirty = true;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const fields = Object.fromEntries(Object.entries(f).map(([k, i]) => [k, k === 'published' ? i.checked : i.value]));
    try { localStorage.setItem(draftKey(editing ? f.slug.value : null), JSON.stringify({ fields, savedAt: Date.now() })); } catch {}
  }, 500);
}
Object.values(f).forEach(i => { i.addEventListener('input', queueDraftSave); i.addEventListener('change', queueDraftSave); });
window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });

// ---------- Editor ----------
async function openEditor(slug) {
  editing = null; slugTouched = false; dirty = false;
  say($('edit-msg'), '');
  Object.values(f).forEach(i => { i.value = ''; });
  f.published.checked = false;
  f.slug.readOnly = false;
  $('edit-heading').textContent = 'New post';
  if (slug) {
    const snap = await getDoc(doc(db, 'posts', slug));
    if (!snap.exists()) return;
    editing = snap.data();
    f.title.value = editing.title || '';
    f.slug.value = slug; f.slug.readOnly = true;
    f.excerpt.value = editing.excerpt || '';
    f.tags.value = (editing.tags || []).join(', ');
    f.cover.value = editing.coverImage || '';
    f.content.value = editing.content || '';
    f.published.checked = !!editing.published;
    $('edit-heading').textContent = 'Edit post';
  }
  const draft = readDraft(draftKey(slug));
  if (draft && draft.fields) {
    const d = draft.fields;
    f.title.value = d.title ?? f.title.value;
    if (!editing) { f.slug.value = d.slug ?? ''; slugTouched = !!d.slug; }
    f.excerpt.value = d.excerpt ?? '';
    f.tags.value = d.tags ?? '';
    f.cover.value = d.cover ?? '';
    f.content.value = d.content ?? '';
    f.published.checked = !!d.published;
    dirty = true;
    say($('edit-msg'), 'Restored unsaved changes from ' + new Date(draft.savedAt).toLocaleString() + '. Click Save to keep them.', 'ok');
  }
  updatePreview();
  show('edit');
}

let previewSeq = 0;
async function updatePreview() {
  const seq = ++previewSeq;
  const html = await renderMarkdown(f.content.value);
  if (seq === previewSeq) $('preview').innerHTML = html;
}
f.content.addEventListener('input', updatePreview);
f.slug.addEventListener('input', () => { slugTouched = true; });
f.title.addEventListener('input', () => { if (!editing && !slugTouched) f.slug.value = slugify(f.title.value); });
$('back').addEventListener('click', loadList);

$('save').addEventListener('click', async () => {
  const slug = slugify(f.slug.value);
  const title = f.title.value.trim();
  if (!title || !slug) return say($('edit-msg'), 'Title and slug are required.', 'err');
  const published = f.published.checked;
  const data = {
    title,
    excerpt: f.excerpt.value.trim(),
    content: f.content.value,
    readMins: readMinutes(f.content.value),
    coverImage: f.cover.value.trim(),
    tags: f.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    published,
    updatedAt: serverTimestamp(),
    createdAt: editing?.createdAt || serverTimestamp(),
    publishedAt: published ? (editing?.publishedAt || serverTimestamp()) : (editing?.publishedAt || null)
  };
  const wasNew = !editing;
  try {
    if (!editing) {
      if ((await getDoc(doc(db, 'posts', slug))).exists()) return say($('edit-msg'), 'That slug is already used.', 'err');
    }
    await setDoc(doc(db, 'posts', slug), data);
    f.slug.value = slug; f.slug.readOnly = true;
    editing = { ...data, createdAt: editing?.createdAt, publishedAt: editing?.publishedAt };
    // re-read to pick up server timestamps for later saves
    editing = (await getDoc(doc(db, 'posts', slug))).data();
    clearTimeout(draftTimer);
    clearDrafts(slug, ...(wasNew ? [null] : []));
    dirty = false;
    say($('edit-msg'), published ? 'Saved and published.' : 'Saved as draft.', 'ok');
  } catch (err) {
    console.error(err);
    say($('edit-msg'), 'Save failed: ' + err.code, 'err');
  }
});

// Markdown toolbar
document.querySelector('.toolbar').addEventListener('click', e => {
  const b = e.target.closest('[data-md]');
  if (!b) return;
  const [before, after] = b.dataset.md.split('|');
  const t = f.content;
  const { selectionStart: s, selectionEnd: en, value } = t;
  t.value = value.slice(0, s) + before + value.slice(s, en) + after + value.slice(en);
  t.focus();
  t.selectionStart = s + before.length; t.selectionEnd = en + before.length;
  updatePreview();
});

// ---------- Image upload (signed by /api/cloudinary-sign) ----------
let uploadTarget = 'cover';
$('upload-cover').addEventListener('click', () => { uploadTarget = 'cover'; $('file').click(); });
$('upload-inline').addEventListener('click', () => { uploadTarget = 'inline'; $('file').click(); });

$('file').addEventListener('change', async () => {
  const file = $('file').files[0];
  $('file').value = '';
  if (!file) return;
  say($('edit-msg'), 'Uploading image…');
  try {
    const token = await auth.currentUser.getIdToken();
    const sigRes = await fetch('/api/cloudinary-sign', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    if (!sigRes.ok) {
      const detail = await sigRes.json().catch(() => ({}));
      throw new Error('Signing failed (' + sigRes.status + ')' + (detail.error ? ': ' + detail.error : ''));
    }
    const { cloudName, apiKey, timestamp, signature, folder } = await sigRes.json();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', apiKey);
    fd.append('timestamp', timestamp);
    fd.append('signature', signature);
    fd.append('folder', folder);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
    const json = await up.json();
    if (!up.ok) throw new Error(json.error?.message || 'Upload failed');
    if (uploadTarget === 'cover') f.cover.value = json.secure_url;
    else {
      const t = f.content, pos = t.selectionStart;
      t.value = t.value.slice(0, pos) + `\n![](${json.secure_url})\n` + t.value.slice(pos);
      updatePreview();
    }
    say($('edit-msg'), 'Image uploaded.', 'ok');
  } catch (err) {
    console.error(err);
    say($('edit-msg'), err.message, 'err');
  }
});
