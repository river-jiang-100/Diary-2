import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      content TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await initTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, type, parent_id, size, created_at FROM files ORDER BY type DESC, name ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, type, parent_id, content } = req.body;
      const size = content ? Buffer.byteLength(content, 'utf8') : 0;
      const result = await sql`
        INSERT INTO files (name, type, parent_id, content, size)
        VALUES (${name}, ${type}, ${parent_id || null}, ${content || ''}, ${size})
        RETURNING id, name, type, parent_id, size, created_at
      `;
      return res.status(201).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM files WHERE id = ${id} OR parent_id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
