// Lightweight read/write layer for public pages. Talks to Firestore's REST API directly so the
// visitor does not have to download the Firebase SDK. Access is still enforced by firestore.rules.
const PROJECT = 'haj-portfolio';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOCS}`;

function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) {
    const d = new Date(v.timestampValue);
    return { seconds: Math.floor(d.getTime() / 1000), toDate: () => d };
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = fields => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
const fromDoc = d => ({ id: d.name.split('/').pop(), slug: d.name.split('/').pop(), ...fromFields(d.fields || {}) });

async function runQuery(structuredQuery) {
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) throw new Error('Query failed (' + res.status + ')');
  return (await res.json()).filter(r => r.document).map(r => fromDoc(r.document));
}

const eq = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value } });
const byNewest = (a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0);

// Published posts, without the heavy article body. Cached for the tab so repeat views are instant.
const LIST_KEY = 'blog-list-v1';
export function cachedPosts() {
  try { return JSON.parse(sessionStorage.getItem(LIST_KEY)); } catch { return null; }
}
export async function fetchPosts() {
  const posts = (await runQuery({
    from: [{ collectionId: 'posts' }],
    where: eq('published', { booleanValue: true }),
    select: { fields: ['title', 'excerpt', 'coverImage', 'tags', 'publishedAt', 'readMins'].map(fieldPath => ({ fieldPath })) }
  })).sort(byNewest);
  try {
    sessionStorage.setItem(LIST_KEY, JSON.stringify(posts.map(p => ({ ...p, publishedAt: p.publishedAt && { ms: p.publishedAt.seconds * 1000 } }))));
  } catch {}
  return posts;
}
// sessionStorage can't hold functions, so rebuild the timestamp shape that formatDate expects.
export function reviveCached(posts) {
  return posts.map(p => ({ ...p, publishedAt: p.publishedAt && { seconds: Math.floor(p.publishedAt.ms / 1000), toDate: () => new Date(p.publishedAt.ms) } }));
}

export async function fetchPost(slug) {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`);
  if (res.status === 404 || res.status === 403) return null; // missing, or a draft the public may not read
  if (!res.ok) throw new Error('Load failed (' + res.status + ')');
  const post = fromDoc(await res.json());
  return post.published ? post : null;
}

export async function fetchComments(slug) {
  const list = await runQuery({
    from: [{ collectionId: 'comments' }],
    where: { compositeFilter: { op: 'AND', filters: [eq('postSlug', { stringValue: slug }), eq('approved', { booleanValue: true })] } }
  });
  return list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

// New comments are created unapproved; only the admin can approve them.
export async function addComment({ postSlug, name, text }) {
  const id = crypto.randomUUID().replace(/-/g, '');
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: {
          name: `${DOCS}/comments/${id}`,
          fields: {
            postSlug: { stringValue: postSlug },
            name: { stringValue: name },
            text: { stringValue: text },
            approved: { booleanValue: false }
          }
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false }
      }]
    })
  });
  if (!res.ok) throw new Error('Could not post comment (' + res.status + ')');
}
