import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
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
      const rows = await sql`SELECT * FROM plans ORDER BY sort_order ASC, created_at ASC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { text } = req.body;
      const count = await sql`SELECT COUNT(*) as cnt FROM plans`;
      const order = parseInt(count[0].cnt);
      const result = await sql`INSERT INTO plans (text, sort_order) VALUES (${text}, ${order}) RETURNING *`;
      return res.status(201).json(result[0]);
    }
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { text } = req.body;
      const result = await sql`UPDATE plans SET text = ${text} WHERE id = ${id} RETURNING *`;
      return res.status(200).json(result[0]);
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM plans WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
