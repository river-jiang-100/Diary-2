import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
async function initTable() {
  await sql`CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await initTable();
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM events ORDER BY year DESC, id ASC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { year, title } = req.body;
      const result = await sql`INSERT INTO events (year, title) VALUES (${year}, ${title}) RETURNING *`;
      return res.status(201).json(result[0]);
    }
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { year, title } = req.body;
      const result = await sql`UPDATE events SET year=${year}, title=${title} WHERE id=${id} RETURNING *`;
      return res.status(200).json(result[0]);
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM events WHERE id=${id}`;
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
