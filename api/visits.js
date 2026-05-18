import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      visited_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await initTable();
    if (req.method === 'POST') {
      await sql`INSERT INTO visits (visited_at) VALUES (NOW())`;
    }
    const total = await sql`SELECT COUNT(*) as cnt FROM visits`;
    const today = await sql`SELECT COUNT(*) as cnt FROM visits WHERE visited_at::date = CURRENT_DATE`;
    const thisMonth = await sql`SELECT COUNT(*) as cnt FROM visits WHERE DATE_TRUNC('month', visited_at) = DATE_TRUNC('month', NOW())`;
    return res.status(200).json({
      total: parseInt(total[0].cnt),
      today: parseInt(today[0].cnt),
      this_month: parseInt(thisMonth[0].cnt),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
