// Vercel serverless function: signs a Cloudinary upload, but only for the logged-in admin.
// Required env vars (Vercel > Settings > Environment Variables):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ADMIN_UID, FIREBASE_API_KEY
const crypto = require('crypto');

const FOLDER = 'blog';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ADMIN_UID, FIREBASE_API_KEY } = process.env;
  const missing = Object.entries({ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ADMIN_UID, FIREBASE_API_KEY })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return res.status(500).json({ error: 'Server is not configured. Missing: ' + missing.join(', ') });
  }

  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Missing token' });

  // Ask Firebase to validate the ID token and tell us who it belongs to.
  let uid;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: match[1] })
    });
    if (!r.ok) return res.status(401).json({ error: 'Invalid token' });
    uid = (await r.json()).users?.[0]?.localId;
  } catch {
    return res.status(502).json({ error: 'Could not verify token' });
  }
  if (uid !== ADMIN_UID) return res.status(403).json({ error: 'Not authorised' });

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1')
    .update(`folder=${FOLDER}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex');

  res.status(200).json({ cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, timestamp, signature, folder: FOLDER });
};
