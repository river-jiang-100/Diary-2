import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

const sql = neon(process.env.DATABASE_URL);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function initTable() {
  await sql`CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    url TEXT DEFAULT '',
    public_id TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    mime_type TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await initTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, type, parent_id, url, size, mime_type, created_at FROM files ORDER BY type DESC, name ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, type, parent_id, url, public_id, size, mime_type } = req.body;
      if (type === 'folder') {
        const result = await sql`INSERT INTO files (name, type, parent_id) VALUES (${name}, 'folder', ${parent_id || null}) RETURNING id, name, type, parent_id, url, size, mime_type, created_at`;
        return res.status(201).json(result[0]);
      }
      const result = await sql`INSERT INTO files (name, type, parent_id, url, public_id, size, mime_type) VALUES (${name}, 'file', ${parent_id || null}, ${url || ''}, ${public_id || ''}, ${size || 0}, ${mime_type || ''}) RETURNING id, name, type, parent_id, url, size, mime_type, created_at`;
      return res.status(201).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      async function deleteRecursive(fid) {
        const children = await sql`SELECT id FROM files WHERE parent_id = ${fid}`;
        for (const c of children) await deleteRecursive(c.id);
        const fileRow = await sql`SELECT public_id, mime_type FROM files WHERE id = ${fid} AND type = 'file'`;
        if (fileRow[0]?.public_id) {
          const rt = fileRow[0].mime_type?.startsWith('video') ? 'video' : fileRow[0].mime_type?.startsWith('image') ? 'image' : 'raw';
          await cloudinary.uploader.destroy(fileRow[0].public_id, { resource_type: rt }).catch(() => {});
        }
        await sql`DELETE FROM files WHERE id = ${fid}`;
      }
      await deleteRecursive(id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
