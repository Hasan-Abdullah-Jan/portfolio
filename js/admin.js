import { db, auth } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { renderMarkdown, formatDate, escapeHtml } from "./blog-common.js";

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

$('post-rows').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) openEditor(edit.dataset.edit);
  if (del && confirm(`Delete "${del.dataset.del}" permanently?`)) {
    try { await deleteDoc(doc(db, 'posts', del.dataset.del)); loadList(); }
    catch (err) { say($('list-msg'), 'Delete failed: ' + err.code, 'err'); }
  }
});
$('new-post').addEventListener('click', () => openEditor(null));

// ---------- Editor ----------
async function openEditor(slug) {
  editing = null; slugTouched = false;
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
  updatePreview();
  show('edit');
}

function updatePreview() { $('preview').innerHTML = renderMarkdown(f.content.value); }
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
    coverImage: f.cover.value.trim(),
    tags: f.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    published,
    updatedAt: serverTimestamp(),
    createdAt: editing?.createdAt || serverTimestamp(),
    publishedAt: published ? (editing?.publishedAt || serverTimestamp()) : (editing?.publishedAt || null)
  };
  try {
    if (!editing) {
      if ((await getDoc(doc(db, 'posts', slug))).exists()) return say($('edit-msg'), 'That slug is already used.', 'err');
    }
    await setDoc(doc(db, 'posts', slug), data);
    f.slug.value = slug; f.slug.readOnly = true;
    editing = { ...data, createdAt: editing?.createdAt, publishedAt: editing?.publishedAt };
    // re-read to pick up server timestamps for later saves
    editing = (await getDoc(doc(db, 'posts', slug))).data();
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
